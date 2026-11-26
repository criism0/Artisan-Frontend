import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import HistorialCambiosModal from "../../components/Compras/HistorialCambiosModal.jsx";
import { toast } from "../../lib/toast";
import { useApi, apiBlob } from "../../lib/api";
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
import RecepcionesOC from "../../components/Compras/RecepcionesOC.jsx";
import SeccionAdjuntos from "../../components/DTE/SeccionAdjuntos.jsx";

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
  const [params] = useSearchParams();
  const api = useApi();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [tab, setTab] = useState(params.get("tab") || "insumos");
  const [nAdjuntos, setNAdjuntos] = useState(undefined);
  const [nRecepciones, setNRecepciones] = useState(undefined);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

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
  const ejecutar = async (ruta, exito, metodo = "PUT", body) => {
    setOcupado(true);
    try {
      await api(`/proceso-compra/ordenes/${ordenId}${ruta ? `/${ruta}` : ""}`, { method: metodo, body });
      toast.success(exito);
      if (metodo === "DELETE") navigate("/adquisiciones/ordenes-compra");
      else await cargar();
      return true;
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudo completar la acción");
      return false;
    } finally {
      setOcupado(false);
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
  const facturas = Array.isArray(orden.numero_factura) ? orden.numero_factura : orden.numero_factura ? [orden.numero_factura] : [];
  const conRecepcion = Boolean(orden.resultado?.recepcion);
  const borrador = orden.recepcion_borrador;
  const enBorrador = (mp) => Number((borrador?.lineas ?? []).find((l) => Number(l.id_linea) === mp.id)?.cantidad) || 0;
  const conBorrador = lineas.some((mp) => enBorrador(mp) > 0);
  const precio = (mp) => Number(mp.precio_unitario) || 0;
  const pedido = (mp) => Number(mp.cantidad_formato) || 0;
  const recibido = (mp) => Number(mp.cantidad_recepcionada) || 0;
  const netoRecibido = lineas.reduce((s, mp) => s + precio(mp) * recibido(mp), 0);
  const ivaRecibido = Math.round(netoRecibido * 0.19);

  const { principal, menu, destructivas } = accionesOC(orden, {
    puedeEscribir,
    puedeBorrar,
    ejecutar,
    navigate,
    rechazar: () => {
      setMotivo("");
      setRechazando(true);
    },
  });
  const desactivar = (a) => ({ ...a, disabled: a.disabled || ocupado });

  const resumen = [
    orden.BodegaSolicitante?.nombre,
    `emitida ${formatFecha(orden.fecha)}`,
    orden.estado === "Recepcionada" && orden.fecha_recepcion && `recibida ${formatFecha(orden.fecha_recepcion)}`,
    orden.cantidad_recepciones > 0 && `${orden.cantidad_recepciones} recepci${orden.cantidad_recepciones === 1 ? "ón" : "ones"}`,
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
            {borrador && <Marca marca={{ texto: "✎ recepción en borrador", titulo: `Recepción ${borrador.numero} sin confirmar`, tono: "borrador" }} />}
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
              { label: "Adjuntar archivos", onClick: () => setTab("documentos") },
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
          { id: "recepciones", label: "Recepciones", cantidad: nRecepciones ?? (orden.cantidad_recepciones || 0) + (borrador ? 1 : 0) },
          { id: "bultos", label: "Bultos", cantidad: bultos.length, deshabilitadaSiVacia: true },
          { id: "documentos", label: "Documentos", cantidad: nAdjuntos || undefined },
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
                {conBorrador && <th className="px-4 py-3 text-right font-semibold">En borrador</th>}
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
                  {conBorrador && (
                    <td className="px-4 py-3 text-right tabular-nums text-violet-700">
                      {enBorrador(mp) > 0 ? `+${formatNumberCL(enBorrador(mp), 2)}` : <span className="text-gray-400">—</span>}
                    </td>
                  )}
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
                  <td colSpan={(conRecepcion ? 4 : 3) + (conBorrador ? 1 : 0)} className={`px-4 py-2 text-right ${nombre === "Total" ? "" : "text-gray-500"}`}>
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

      {tab === "recepciones" && (
        <RecepcionesOC orden={orden} lineas={lineas} puedeEscribir={puedeEscribir} onCambio={cargar} onCantidad={setNRecepciones} />
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
            <SeccionAdjuntos idOrdenCompra={orden.id} onCantidad={setNAdjuntos} />
          </div>
        </div>
      )}

      {rechazando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">¿Rechazar la OC #{orden.id}?</h3>
            <label htmlFor="oc-motivo" className="block text-sm text-gray-700">Motivo</label>
            <textarea
              id="oc-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              placeholder="Llegó vencido, precio distinto…"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secundario" onClick={() => setRechazando(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={!motivo.trim() || ocupado}
                onClick={async () => {
                  if (await ejecutar("rechazar", "Orden rechazada", "PUT", { motivo_rechazo: motivo.trim() })) setRechazando(false);
                }}
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      <HistorialCambiosModal abierto={showHistorial} onCerrar={() => setShowHistorial(false)} historial={historial} formatFecha={formatFechaCambio} />
    </div>
  );
}
