import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, ClipboardCheck, Route as IconoRuta } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { EditButton, ViewDetailButton } from "../../components/Buttons/ActionButtons";
import EstadoRuta from "../../components/Entregas/EstadoRuta";
import ModalCancelarRuta from "../../components/Entregas/ModalCancelarRuta";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { listarRevisiones, listarRutas } from "../../services/rutasService";
import { ESTADOS_RUTA, formatearCLP, formatearFecha, formatearKm, pedidosDeRuta } from "../../utils/rutas";

const nombreCliente = (p) => p.cliente?.nombre_empresa || p.cliente?.razon_social || "";

/**
 * Logística → Entregas: la lista de rutas de entrega. Planificar una nueva vive en su propia
 * vista («Planificar ruta»); cada ruta se abre en su detalle, donde también se edita.
 */
export default function Entregas() {
  const navigate = useNavigate();
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [cancelando, setCancelando] = useState(null);
  const [porRevisar, setPorRevisar] = useState(0);

  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    try {
      const [r, rev] = await Promise.all([listarRutas(), listarRevisiones("Pendiente").catch(() => [])]);
      setRutas(Array.isArray(r) ? r : []);
      setPorRevisar(Array.isArray(rev) ? rev.length : 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(
    () => (filtroEstado === "Todos" ? rutas : rutas.filter((r) => r.estado === filtroEstado)),
    [rutas, filtroEstado],
  );

  const columns = [
    { header: "N°", accessor: "id", sortable: true, sortValue: (r) => Number(r.id) || 0 },
    {
      header: "Día",
      accessor: "fecha",
      sortable: true,
      sortValue: (r) => r.fecha ?? "",
      Cell: ({ value }) => formatearFecha(value),
    },
    {
      header: "Encargado",
      accessor: "transportista",
      sortable: true,
      sortValue: (r) => r.transportista?.nombre ?? "",
      Cell: ({ row }) => row.transportista?.nombre ?? <span className="text-gray-400">Sin encargado</span>,
    },
    {
      header: "Estado",
      accessor: "estado",
      align: "center",
      sortable: true,
      sortValue: (r) => r.estado ?? "",
      Cell: ({ value }) => (
        <div className="flex justify-center">
          <EstadoRuta estado={value} />
        </div>
      ),
    },
    {
      header: "Recorrido",
      accessor: "paradas",
      sortable: false,
      filtro: false,
      Cell: ({ row }) => (
        <span className="block max-w-xs truncate text-sm text-gray-700" title={row.paradas.map(nombreCliente).join(" → ")}>
          {row.paradas.length ? row.paradas.map(nombreCliente).join(" → ") : "—"}
        </span>
      ),
    },
    {
      header: "Paradas",
      accessor: "n_paradas",
      align: "right",
      sortable: true,
      sortValue: (r) => r.paradas.length,
      Cell: ({ row }) => row.paradas.length,
    },
    {
      header: "Pedidos",
      accessor: "n_pedidos",
      align: "right",
      sortable: true,
      sortValue: (r) => pedidosDeRuta(r),
      Cell: ({ row }) => pedidosDeRuta(row),
    },
    {
      header: "Km",
      accessor: "km_planificados",
      align: "right",
      sortable: true,
      sortValue: (r) => Number(r.km_planificados) || 0,
      Cell: ({ value }) => formatearKm(value),
    },
    {
      header: "Costo",
      accessor: "costo_estimado",
      align: "right",
      sortable: true,
      sortValue: (r) => Number(r.costo_estimado) || 0,
      Cell: ({ value }) => formatearCLP(value),
    },
    {
      header: "Sale de",
      accessor: "bodega",
      sortable: true,
      sortValue: (r) => r.bodega?.nombre ?? "",
      Cell: ({ row }) => row.bodega?.nombre ?? "—",
    },
  ];

  const actions = (row) => {
    const editable = puedeEscribir && row.estado === "Planificada";
    return (
      <div className="flex gap-2 justify-center items-center">
        <ViewDetailButton onClick={() => navigate(`/Logistica/entregas/${row.id}`)} tooltipText="Ver detalle" />
        {editable && <EditButton onClick={() => navigate(`/Logistica/entregas/${row.id}?editar=1`)} tooltipText="Editar ruta" />}
        {editable && (
          <button type="button" onClick={() => setCancelando(row)} className="text-gray-400 hover:text-red-500" title="Cancelar ruta">
            <Ban className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  };

  const getSearchText = (r) =>
    [
      r.id,
      formatearFecha(r.fecha),
      r.transportista?.nombre,
      r.estado,
      r.bodega?.nombre,
      ...r.paradas.map(nombreCliente),
      ...r.paradas.flatMap((p) => (p.ordenes ?? []).map((o) => `OV ${o.id_orden_venta} ${o.orden?.numero_oc ?? ""}`)),
    ].join(" ");

  const filtros = (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600 p-1">Estado</label>
      <div className="flex flex-wrap gap-2 px-1">
        {["Todos", ...Object.keys(ESTADOS_RUTA)].map((opt) => {
          const s = ESTADOS_RUTA[opt] ?? { bg: "bg-gray-100", text: "text-gray-700" };
          const activo = filtroEstado === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setFiltroEstado(opt)}
              aria-pressed={activo}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${s.bg} ${s.text} ${
                activo ? "ring-2 ring-offset-1 ring-primary" : "opacity-80 hover:opacity-100"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <DataTable
        title="Rutas de entrega"
        data={filtradas}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        filters={filtros}
        initialSort={{ key: "fecha", direction: "desc" }}
        loading={cargando}
        loadingMessage="Cargando rutas"
        emptyMessage="Todavía no hay rutas. Arma la primera con «Planificar ruta»."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/Logistica/entregas/revision")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${porRevisar ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              title="Entregas parciales o rechazadas que alguien tiene que resolver"
            >
              <ClipboardCheck className="w-4 h-4" /> Revisión{porRevisar ? ` (${porRevisar})` : ""}
            </button>
            {puedeEscribir && (
              <button
                type="button"
                onClick={() => navigate("/Logistica/entregas/planificar")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                <IconoRuta className="w-4 h-4" /> Planificar ruta
              </button>
            )}
          </div>
        }
      />
      <ModalCancelarRuta ruta={cancelando} onCerrar={() => setCancelando(null)} onCancelada={cargar} />
    </>
  );
}
