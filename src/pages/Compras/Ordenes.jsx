import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import MenuAcciones from "../../components/UI/MenuAcciones.jsx";
import ChipsEstado from "../../components/UI/ChipsEstado.jsx";
import Ayuda from "../../components/UI/Ayuda.jsx";
import { ModalConfirmacion } from "../../components/UI/PanelAcciones.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { formatFecha } from "../../lib/dateUtils";
import { claseEstadoOC } from "../../utils/estadoOrdenCompra.js";
import { descargarPdfOrdenCompra } from "../../utils/pdfOrdenCompra.js";
import {
  ESTADOS_OC_CHIPS,
  accionesOC,
  etiquetaEstadoOC,
  fechaDelPasoOC,
  marcaPagoOC,
  marcaRecepcionOC,
  nombreInsumoOC,
  porPagar,
} from "../../utils/ordenCompraVista.js";
import Marca from "../../components/Compras/MarcaOC.jsx";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";

export default function Ordenes() {
  const api = useApi();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bodega, setBodega] = useState("");
  const [soloPorPagar, setSoloPorPagar] = useState(false);
  const [porConfirmar, setPorConfirmar] = useState(null);

  const puedeEscribir = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const puedeBorrar = checkScope(ModelType.ORDEN_COMPRA, ScopeType.DELETE);

  const cargar = useCallback(async () => {
    try {
      const res = await api(`/proceso-compra/ordenes`);
      setOrdenes(Array.isArray(res) ? res : []);
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudieron cargar las órdenes de compra");
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El correo de cada cambio lo manda el backend: acá sólo se llama y se recarga.
  const ejecutar = (orden) => async (ruta, exito, metodo = "PUT") => {
    try {
      await api(`/proceso-compra/ordenes/${orden.id}${ruta ? `/${ruta}` : ""}`, { method: metodo });
      toast.success(exito);
      cargar();
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo completar la acción");
    }
  };

  const bodegas = useMemo(() => {
    const m = new Map();
    for (const o of ordenes) if (o.BodegaSolicitante?.id != null) m.set(String(o.BodegaSolicitante.id), o.BodegaSolicitante.nombre);
    return [...m].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"));
  }, [ordenes]);

  // La bodega filtra antes de los chips, así los conteos son de esa bodega.
  const porBodega = useMemo(
    () => (bodega ? ordenes.filter((o) => String(o.BodegaSolicitante?.id) === bodega) : ordenes),
    [ordenes, bodega]
  );
  const cuantasPorPagar = useMemo(() => porBodega.filter(porPagar).length, [porBodega]);
  const datos = useMemo(() => (soloPorPagar ? porBodega.filter(porPagar) : porBodega), [porBodega, soloPorPagar]);

  const columns = [
    { header: "N°", accessor: "id", sortable: true, hideable: false, filtro: "numero" },
    {
      header: "Proveedor",
      accessor: "proveedor",
      sortable: true,
      sortValue: (o) => o.proveedor?.nombre_empresa ?? "",
      cellClassName: "!whitespace-normal min-w-[8rem] max-w-[10rem]",
      Cell: ({ row }) => row.proveedor?.nombre_empresa || "—",
    },
    {
      header: "Bodega",
      accessor: "BodegaSolicitante",
      sortable: true,
      sortValue: (o) => o.BodegaSolicitante?.nombre ?? "",
      Cell: ({ value }) => value?.nombre || "—",
    },
    {
      header: "Insumos",
      accessor: "materiasPrimas",
      cellClassName: "!whitespace-normal min-w-[8rem] max-w-[11rem]",
      Cell: ({ value }) => {
        const lista = Array.isArray(value) ? value : [];
        if (!lista.length) return <span className="text-gray-400">—</span>;
        return (
          <span title={lista.map(nombreInsumoOC).join("\n")}>
            {nombreInsumoOC(lista[0])}
            {lista.length > 1 && <span className="text-xs text-gray-500"> +{lista.length - 1}</span>}
          </span>
        );
      },
    },
    {
      header: "Neto",
      accessor: "total_neto",
      sortable: true,
      align: "right",
      filtro: "numero",
      Cell: ({ value }) => formatCLP(value, 0),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      filtro: "valores",
      Cell: ({ value }) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${claseEstadoOC(value)}`}>
          {etiquetaEstadoOC(value)}
        </span>
      ),
    },
    {
      header: (
        <span className="inline-flex items-center gap-1">
          Recibido
          <Ayuda titulo="Recibido y pago">
            <div className="space-y-1.5 normal-case tracking-normal font-normal">
              <p><b>Recibido</b>: lo que llegó contra lo pedido, línea por línea. «= pedido» si llegó todo, «▼» cuántas líneas llegaron con menos y «▲» con más.</p>
              <p><b>Pago</b> va aparte del estado: una orden se puede pagar antes de recibirla (prepago).</p>
            </div>
          </Ayuda>
        </span>
      ),
      headerLabel: "Recibido",
      accessor: "resultado",
      filtro: "valores",
      filtroValor: (o) => marcaRecepcionOC(o.resultado)?.texto || "—",
      Cell: ({ value }) => <Marca marca={marcaRecepcionOC(value)} vacio />,
    },
    {
      header: "Pago",
      accessor: "pagada",
      filtro: "valores",
      filtroValor: (o) => marcaPagoOC(o)?.texto || "—",
      Cell: ({ row }) => <Marca marca={marcaPagoOC(row)} vacio />,
    },
    {
      header: "Fecha",
      accessor: "fecha_paso",
      sortable: true,
      sortValue: (o) => fechaDelPasoOC(o).fecha?.getTime() ?? 0,
      cellClassName: "!whitespace-normal max-w-[8rem]",
      Cell: ({ row }) => {
        const { fecha, etiqueta, dias, antigua } = fechaDelPasoOC(row);
        if (!fecha) return <span className="text-gray-400">—</span>;
        return (
          <span className="text-sm">
            <span className="whitespace-nowrap">{formatFecha(fecha)}</span>{" "}
            {antigua ? (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" title={`Lleva ${dias} días sin cerrar`}>
                hace {dias} d
              </span>
            ) : (
              <span className="text-xs text-gray-500">{etiqueta}</span>
            )}
          </span>
        );
      },
    },
    // Las fechas por separado, las facturas y las condiciones siguen disponibles en «Columnas».
    { header: "Emitida", accessor: "fecha", sortable: true, defaultHidden: true, filtro: "fecha", Cell: ({ value }) => formatFecha(value) },
    { header: "Recibida", accessor: "fecha_recepcion", sortable: true, defaultHidden: true, filtro: "fecha", Cell: ({ value }) => formatFecha(value) },
    {
      header: "Facturas",
      accessor: "numero_factura",
      defaultHidden: true,
      Cell: ({ value }) => (Array.isArray(value) && value.length ? value.join(", ") : <span className="text-gray-400">—</span>),
    },
    { header: "Condiciones", accessor: "condiciones", defaultHidden: true, cellClassName: "!whitespace-normal max-w-[14rem]" },
  ];

  const actions = (o) => {
    const { principal, menu, destructivas } = accionesOC(o, { puedeEscribir, puedeBorrar, ejecutar: ejecutar(o), navigate });
    const conConfirmacion = (a, destructiva = false) => ({
      ...a,
      peligro: destructiva,
      onClick: () => (a.confirmar ? setPorConfirmar({ ...a, destructiva }) : a.onClick()),
    });
    return (
      <div className="flex gap-2 justify-end items-center">
        <ViewDetailButton onClick={() => navigate(`/adquisiciones/ordenes-compra/${o.id}`)} tooltipText="Ver detalle" />
        <MenuAcciones
          etiqueta={`Más acciones de la OC #${o.id}`}
          items={[
            principal && conConfirmacion(principal),
            {
              label: "Descargar PDF",
              onClick: () => descargarPdfOrdenCompra(o).catch(() => toast.error("Error generando el PDF")),
            },
            ...menu.map((a) => conConfirmacion(a)),
            { separador: true },
            ...destructivas.map((a) => conConfirmacion(a, true)),
          ]}
        />
      </div>
    );
  };

  const getSearchText = (o) =>
    [
      o.id,
      o.proveedor?.nombre_empresa,
      o.BodegaSolicitante?.nombre,
      o.estado,
      o.condiciones,
      o.guia_despacho,
      ...(Array.isArray(o.numero_factura) ? o.numero_factura : []),
      ...(o.materiasPrimas || []).map(nombreInsumoOC),
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <>
      <DataTable
        title="Órdenes de compra"
        data={datos}
        headerExtra={({ filtrosColumna, cambiarFiltroColumna }) => (
          <div className="flex flex-wrap items-start gap-2">
            <ChipsEstado
              filas={porBodega}
              estados={ESTADOS_OC_CHIPS}
              filtro={filtrosColumna.estado}
              onCambiar={(f) => cambiarFiltroColumna("estado", f)}
            />
            {cuantasPorPagar > 0 && (
              <button
                type="button"
                aria-pressed={soloPorPagar}
                onClick={() => setSoloPorPagar((v) => !v)}
                title="Validadas o recibidas que no están pagadas"
                className={`${chipBase} ${
                  soloPorPagar ? "border-amber-500 bg-amber-50 text-amber-800 font-medium" : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                }`}
              >
                $ Por pagar <b className="font-semibold">{cuantasPorPagar}</b>
              </button>
            )}
          </div>
        )}
        toolbarStart={
          <select
            aria-label="Bodega"
            value={bodega}
            onChange={(e) => setBodega(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Todas las bodegas</option>
            {bodegas.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        }
        columns={columns.map((c) => ({ ...c, headerClassName: `!px-3 ${c.headerClassName ?? ""}`, cellClassName: `!px-3 ${c.cellClassName ?? ""}` }))}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        loading={isLoading}
        loadingMessage="Cargando órdenes de compra"
        defaultRowsPerPage={25}
        initialSort={{ key: "id", direction: "desc" }}
        persistKey="ordenes_compra_v2"
        emptyMessage="No hay órdenes de compra que calcen."
        headerActions={
          <button className="btn btn-primario" onClick={() => navigate("/adquisiciones/ordenes-compra/nuevo")}>
            + Nueva orden
          </button>
        }
      />
      <ModalConfirmacion accion={porConfirmar} onCerrar={() => setPorConfirmar(null)} />
    </>
  );
}
