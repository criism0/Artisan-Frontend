import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import HistorialCambiosModal from "../../components/Compras/HistorialCambiosModal.jsx";
import { toast } from "../../lib/toast";
import { useApi, apiBlob } from "../../lib/api";
import { uploadToS3 } from "../../lib/uploadToS3";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import DTERecibidoPanel from "../../components/DTE/DTERecibidoPanel.jsx";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";
import DataTable from "../../components/Tables/DataTable";
import { formatFecha } from "../../lib/dateUtils";
import PageHeader from "../../components/UI/PageHeader";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { claseEstadoOC } from "../../utils/estadoOrdenCompra.js";
import { descargarPdfOrdenCompra } from "../../utils/pdfOrdenCompra.js";
import {
  accionesOC,
  etiquetaEstadoOC,
  marcaPagoOC,
  marcaRecepcionOC,
  nombreInsumoOC,
} from "../../utils/ordenCompraVista.js";
import Marca from "../../components/Compras/MarcaOC.jsx";

const formatFechaCambio = (registro) => {
  const fecha = registro?.creado_en ?? registro?.fecha_cambio;
  return fecha ? new Date(fecha).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";
};

/** Celda «Recibido» con la diferencia contra lo pedido marcada en la fila. */
function celdaRecibido(pedido, recibido) {
  const d = Math.round((recibido - pedido) * 1000) / 1000;
  if (d === 0) return <span>{formatNumberCL(recibido, 2)}</span>;
  const menos = d < 0;
  return (
    <span className={menos ? "text-amber-700 font-semibold" : "text-blue-700 font-semibold"}>
      {formatNumberCL(recibido, 2)}{" "}
      <span className="text-xs">
        {menos ? "▼" : "▲"}
        {formatNumberCL(Math.abs(d), 2)}
      </span>
    </span>
  );
}

const COLUMNAS_BULTOS = [
  {
    header: "Bulto",
    accessor: "identificador",
    sortable: true,
    Cell: ({ row: b }) => <span className="font-medium">{b.identificador || `#${b.id}`}</span>,
  },
  {
    header: "Item",
    accessor: "item",
    sortable: true,
    sortValue: (b) => b?.materiaPrima?.nombre ?? "",
    cellClassName: "!whitespace-normal max-w-[11rem] lg:max-w-[15rem] xl:max-w-[20rem]",
    Cell: ({ row: b }) => b.materiaPrima?.nombre || "—",
  },
  {
    // Mismo formato que Inventario: el contenido de un bulto en la unidad del insumo.
    header: "Formato",
    accessor: "peso_unitario",
    sortable: true,
    Cell: ({ row: b }) => (
      <>
        {formatNumberCL(b.peso_unitario, 2)} <span className="text-gray-500">{b.materiaPrima?.unidad_medida || ""}</span>
      </>
    ),
  },
  {
    // «Queda de cuánto vino»: `cantidad_unidades` es lo inicial y no se mueve.
    header: "Disponible",
    accessor: "unidades_disponibles",
    sortable: true,
    sortValue: (b) => Number(b?.unidades_disponibles || 0),
    Cell: ({ row: b }) => {
      const quedan = Number(b.unidades_disponibles ?? 0);
      const inicial = Number(b.cantidad_unidades ?? 0);
      return (
        <div className="font-medium">
          <span className={inicial > 0 && quedan < inicial ? "text-amber-700" : undefined}>{formatNumberCL(quedan, 2)}</span>
          <span className="text-gray-500 font-normal"> / {formatNumberCL(inicial, 2)}</span>
        </div>
      );
    },
  },
  {
    header: "Lote proveedor",
    accessor: "lote",
    sortable: true,
    sortValue: (b) => b?.lote?.identificador_proveedor ?? "",
    Cell: ({ row: b }) => b.lote?.identificador_proveedor || "—",
  },
  {
    header: "Costo",
    accessor: "costo_unitario",
    sortable: true,
    align: "right",
    Cell: ({ row: b }) =>
      b.costo_unitario ? (
        <>
          <div className="font-medium">{formatCLP(Number(b.costo_unitario) * Number(b.cantidad_unidades || 0), 0)}</div>
          <div className="text-xs text-gray-500">{formatCLP(b.costo_unitario, 0)} c/u</div>
        </>
      ) : (
        "—"
      ),
  },
];

export default function OrdenDetail() {
  const { ordenId } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [nuevosArchivos, setNuevosArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [mostrarModalArchivos, setMostrarModalArchivos] = useState(false);
  const [tab, setTab] = useState("insumos");

  const puedeEscribir = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const puedeBorrar = checkScope(ModelType.ORDEN_COMPRA, ScopeType.DELETE);

  const cargar = useCallback(async () => {
    try {
      setOrden(await api(`/proceso-compra/ordenes/${ordenId}`));
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudo cargar la orden");
    } finally {
      setCargando(false);
    }
  }, [api, ordenId]);

  useEffect(() => {
    if (ordenId) cargar();
  }, [ordenId, cargar]);

  // El correo de cada cambio lo manda el backend.
  const ejecutar = async (ruta, exito, metodo = "PUT") => {
    setOcupado(true);
    try {
      await api(`/proceso-compra/ordenes/${ordenId}${ruta ? `/${ruta}` : ""}`, { method: metodo });
      toast.success(exito);
      if (metodo === "DELETE") navigate("/adquisiciones/ordenes-compra");
      else await cargar();
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudo completar la acción");
    } finally {
      setOcupado(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setNuevosArchivos((prev) => [...prev, ...files.filter((n) => !prev.some((p) => p.name === n.name))]);
    e.target.value = "";
  };

  const cerrarModalArchivos = () => {
    setMostrarModalArchivos(false);
    setNuevosArchivos([]);
  };

  const handleAdjuntarArchivos = async () => {
    if (nuevosArchivos.length === 0) return;
    setSubiendoArchivos(true);
    try {
      const refs = await Promise.all(
        nuevosArchivos.map((file) =>
          uploadToS3(file).catch((err) => {
            toast.error(`Error subiendo ${file.name}: ${err}`);
            return null;
          })
        )
      );
      const archivos = refs.filter(Boolean);
      if (archivos.length === 0) return;
      await api(`/proceso-compra/ordenes/${ordenId}/adjuntar-archivos`, { method: "PUT", body: { archivos } });
      toast.success("Archivos adjuntados");
      cerrarModalArchivos();
      await cargar();
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudieron adjuntar los archivos");
    } finally {
      setSubiendoArchivos(false);
    }
  };

  const handleDownloadEtiquetas = async () => {
    try {
      const ids_bultos = (orden?.bultos || []).map((b) => b.id).filter(Boolean);
      const blob = await apiBlob("/bultos/etiquetas", { method: "POST", body: { ids_bultos } });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiquetas_OC_${orden.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Error al descargar las etiquetas: " + (error?.message || error));
    }
  };

  const handleVerHistorial = async () => {
    try {
      setHistorial((await api(`/proceso-compra/ordenes/${ordenId}/historial`)) ?? []);
      setShowHistorial(true);
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudo cargar el historial");
    }
  };

  if (cargando) return <PageLoader message="Cargando orden" />;
  if (!orden)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">No se encontró la orden o hubo un error al cargar.</div>
      </div>
    );

  const lineas = orden.materiasPrimas || [];
  const bultos = orden.bultos || [];
  const archivos = orden.archivos || [];
  const facturas = Array.isArray(orden.numero_factura) ? orden.numero_factura : orden.numero_factura ? [orden.numero_factura] : [];
  const conRecepcion = Boolean(orden.resultado?.recepcion);
  const precio = (mp) => Number(mp.precio_unitario) || 0;
  const pedido = (mp) => Number(mp.cantidad_formato) || 0;
  const recibido = (mp) => Number(mp.cantidad_recepcionada) || 0;
  const netoRecibido = lineas.reduce((s, mp) => s + precio(mp) * recibido(mp), 0);
  const ivaRecibido = Math.round(netoRecibido * 0.19);

  const { principal, menu, destructivas } = accionesOC(orden, { puedeEscribir, puedeBorrar, ejecutar, navigate });
  const desactivar = (a) => ({ ...a, disabled: a.disabled || ocupado });

  const resumen = [
    orden.BodegaSolicitante?.nombre,
    `emitida ${formatFecha(orden.fecha)}`,
    orden.estado === "Recepcionada" && orden.fecha_recepcion && `recibida ${formatFecha(orden.fecha_recepcion)}`,
    facturas.length > 0 && `factura ${facturas.join(", ")}`,
    bultos.length > 0 && `${bultos.length} bulto${bultos.length === 1 ? "" : "s"}`,
    `neto ${formatCLP(orden.total_neto, 0)}`,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        volverA="/adquisiciones/ordenes-compra"
        titulo={`OC #${orden.id} · ${orden.proveedor?.nombre_empresa || "Sin proveedor"}`}
        estado={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${claseEstadoOC(orden.estado)}`}>
              {etiquetaEstadoOC(orden.estado)}
            </span>
            <Marca marca={marcaRecepcionOC(orden.resultado)} />
            <Marca marca={marcaPagoOC(orden)} />
          </span>
        }
        subtitulo={resumen.join(" · ")}
        acciones={
          <PanelAcciones
            principal={principal && desactivar(principal)}
            secundarias={[
              {
                label: "PDF",
                title: "Descargar la orden en PDF",
                onClick: () => descargarPdfOrdenCompra(orden).catch(() => toast.error("Error generando el PDF")),
              },
            ]}
            menu={[
              ...menu.map(desactivar),
              bultos.length > 0 && { label: "Descargar etiquetas", onClick: handleDownloadEtiquetas },
              { label: "Adjuntar archivos", onClick: () => setMostrarModalArchivos(true) },
              { label: "Historial de cambios", onClick: handleVerHistorial },
            ]}
            destructivas={destructivas.map(desactivar)}
          />
        }
      />

      {orden.estado === "Rechazada" && orden.motivo_rechazo && (
        <p className="-mt-3 mb-4 text-sm text-rose-700">Motivo del rechazo: {orden.motivo_rechazo}</p>
      )}

      <Tabs
        activa={tab}
        onCambiar={setTab}
        pestanas={[
          { id: "insumos", label: "Insumos", cantidad: lineas.length },
          { id: "bultos", label: "Bultos", cantidad: bultos.length, deshabilitadaSiVacia: true },
          { id: "documentos", label: "Documentos", cantidad: archivos.length || undefined },
        ]}
      />

      {tab === "insumos" && (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Insumo</th>
                <th className="px-4 py-3 text-right font-semibold">Pedido</th>
                {conRecepcion && <th className="px-4 py-3 text-right font-semibold">Recibido</th>}
                <th className="px-4 py-3 text-right font-semibold">Precio</th>
                <th className="px-4 py-3 text-right font-semibold">Neto pedido</th>
                {conRecepcion && <th className="px-4 py-3 text-right font-semibold">Neto recibido</th>}
              </tr>
            </thead>
            <tbody>
              {lineas.map((mp) => (
                <tr key={mp.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{nombreInsumoOC(mp)}</span>
                    {mp.proveedorMateriaPrima?.formato && <span className="text-xs text-gray-500"> · {mp.proveedorMateriaPrima.formato}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumberCL(pedido(mp), 2)}</td>
                  {conRecepcion && <td className="px-4 py-3 text-right tabular-nums">{celdaRecibido(pedido(mp), recibido(mp))}</td>}
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(precio(mp), 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(precio(mp) * pedido(mp), 0)}</td>
                  {conRecepcion && <td className="px-4 py-3 text-right tabular-nums">{formatCLP(precio(mp) * recibido(mp), 0)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[
                ["Neto", orden.total_neto, netoRecibido],
                ["IVA 19%", orden.iva, ivaRecibido],
                ["Total", orden.total_pago, netoRecibido + ivaRecibido],
              ].map(([nombre, valorPedido, valorRecibido]) => (
                <tr key={nombre} className={`border-t border-gray-100 ${nombre === "Total" ? "font-semibold" : ""}`}>
                  <td colSpan={conRecepcion ? 4 : 3} className={`px-4 py-2 text-right ${nombre === "Total" ? "" : "text-gray-500"}`}>
                    {nombre}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCLP(valorPedido, 0)}</td>
                  {conRecepcion && <td className="px-4 py-2 text-right tabular-nums">{formatCLP(valorRecibido, 0)}</td>}
                </tr>
              ))}
            </tfoot>
          </table>
          {orden.condiciones && <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">Condiciones: {orden.condiciones}</p>}
        </div>
      )}

      {tab === "bultos" && (
        <DataTable
          title="Bultos recepcionados"
          data={bultos}
          defaultRowsPerPage={25}
          emptyMessage="Esta orden todavía no generó bultos."
          getSearchText={(b) => [b?.identificador, b?.id, b?.materiaPrima?.nombre, b?.lote?.identificador_proveedor].filter(Boolean).join(" ")}
          initialSort={{ key: "identificador", direction: "asc" }}
          columns={COLUMNAS_BULTOS}
        />
      )}

      {tab === "documentos" && (
        <div className="space-y-4">
          <DTERecibidoPanel ordenId={ordenId} orden={orden} />
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Archivos adjuntos</h3>
              <button type="button" onClick={() => setMostrarModalArchivos(true)} className="text-sm text-primary hover:underline">
                + Adjuntar
              </button>
            </div>
            {archivos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin archivos.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {archivos.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-gray-800">{file.original_name}</span>{" "}
                      <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                    </span>
                    {file.signed_url || file.url ? (
                      <a href={file.signed_url || file.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Abrir
                      </a>
                    ) : (
                      <span className="text-xs text-red-500">No disponible</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mostrarModalArchivos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Adjuntar archivos a la OC #{orden.id}</h3>
              <button onClick={cerrarModalArchivos} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Cerrar">
                ×
              </button>
            </div>
            {nuevosArchivos.length > 0 && (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {nuevosArchivos.map((file, index) => (
                  <li key={index} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-200 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setNuevosArchivos((prev) => prev.filter((_, i) => i !== index))}
                      className="text-red-600 hover:underline flex-shrink-0"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <label className="btn btn-secundario cursor-pointer">
                Elegir archivos
                <input type="file" multiple onChange={handleFileChange} className="hidden" />
              </label>
              <button
                type="button"
                onClick={handleAdjuntarArchivos}
                disabled={subiendoArchivos || nuevosArchivos.length === 0 || !puedeEscribir}
                className="btn btn-primario disabled:opacity-50"
              >
                {subiendoArchivos ? "Subiendo…" : "Adjuntar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <HistorialCambiosModal abierto={showHistorial} onCerrar={() => setShowHistorial(false)} historial={historial} formatFecha={formatFechaCambio} />
    </div>
  );
}
