import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import Selector from "../../components/Forms/Selector";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

const ESTADO_STYLES = {
  "Creada": { bg: "bg-gray-200", text: "text-gray-800", label: "Creada" },
  "Validada": { bg: "bg-sky-200", text: "text-sky-800", label: "Validada" },
  "En preparación": { bg: "bg-amber-200", text: "text-amber-800", label: "En preparación" },
  "Lista para despacho": { bg: "bg-lime-200", text: "text-lime-800", label: "Lista para despacho" },
  "En tránsito": { bg: "bg-indigo-200", text: "text-indigo-800", label: "En tránsito" },
  "Recepción Completa": { bg: "bg-green-400", text: "text-green-900", label: "Recepción Completa" },
  "Recepción Completa con Pérdida": { bg: "bg-amber-200", text: "text-amber-900", label: "Recepción Completa con Pérdida" },
  "Recepción Parcial": { bg: "bg-yellow-200", text: "text-yellow-900", label: "Recepción Parcial" },
  "Recepción Parcial con Pérdida": { bg: "bg-orange-200", text: "text-orange-900", label: "Recepción Parcial con Pérdida" },
  // Compatibilidad con estados antiguos
  "Recepcionada Parcial Falta Stock": { bg: "bg-yellow-200", text: "text-yellow-900", label: "Recepción Parcial" },
  "Recepcionada Parcial Perdida": { bg: "bg-orange-200", text: "text-orange-900", label: "Recepción Parcial con Pérdida" },
  "Recepcionada Completa": { bg: "bg-green-400", text: "text-green-900", label: "Recepción Completa" },
  "Pendiente": { bg: "bg-orange-200", text: "text-orange-800", label: "Pendiente" },
  "Cancelada": { bg: "bg-red-200", text: "text-red-800", label: "Cancelada" },
};

const normalizeEstadoSolicitud = (estado) => {
  if (!estado) return estado;
  switch (estado) {
    case "Recepcionada Completa":
      return "Recepción Completa";
    case "Recepcionada Parcial Falta Stock":
      return "Recepción Parcial";
    case "Recepcionada Parcial Perdida":
      return "Recepción Parcial con Pérdida";
    default:
      return estado;
  }
};

const getEstadoChip = (estado) => {
  const base = "px-3 py-1 rounded-full text-xs font-medium text-center whitespace-nowrap";
  const s = ESTADO_STYLES[estado] ?? { bg: "bg-gray-100", text: "text-gray-700", label: estado };
  return <span className={`${base} ${s.bg} ${s.text}`}>{s.label}</span>;
};

const fmtFecha = (value) =>
  value
    ? new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroBodegaProv, setFiltroBodegaProv] = useState("Todas");
  const [filtroBodegaSol, setFiltroBodegaSol] = useState("Todas");
  const navigate = useNavigate();
  const api = useApi();

  useEffect(() => {
    const fetchSolicitudes = async () => {
      try {
        const data = await api(`/solicitudes-mercaderia`);
        const list = Array.isArray(data)
          ? data.map((s) => ({
              id: s.id,
              bodegaProveedora: s.bodegaProveedora,
              bodegaSolicitante: s.bodegaSolicitante,
              usuarioSolicitante: s.usuarioSolicitante,
              estado: normalizeEstadoSolicitud(s.estado),
              createdAt: s.createdAt,
              fecha_envio: s.fecha_envio,
              fecha_recepcion: s.fecha_recepcion,
              numero_guia_despacho: s.numero_guia_despacho,
              medio_transporte: s.medio_transporte,
            }))
          : [];
        setSolicitudes(list);
      } catch (err) {
        console.error("Error cargando solicitudes:", err);
        toast.error("No se pudieron cargar las solicitudes");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSolicitudes();
  }, [api]);

  const estadoOptions = useMemo(
    () => ["Todos", ...Array.from(new Set(solicitudes.map((s) => s.estado).filter(Boolean)))],
    [solicitudes]
  );

  const buildBodegaOptions = (items, key) => {
    const map = new Map();
    items.forEach((s) => {
      const b = s[key];
      if (b?.id && !map.has(String(b.id))) map.set(String(b.id), b.nombre || `Bodega ${b.id}`);
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  };

  const bodegaProvOptions = useMemo(() => buildBodegaOptions(solicitudes, "bodegaProveedora"), [solicitudes]);
  const bodegaSolOptions = useMemo(() => buildBodegaOptions(solicitudes, "bodegaSolicitante"), [solicitudes]);

  // Filtros de negocio: se aplican ANTES de pasar la data al DataTable
  const dataFiltrada = useMemo(() => {
    let list = solicitudes;
    if (filtroEstado !== "Todos") list = list.filter((s) => s.estado === filtroEstado);
    if (filtroBodegaProv !== "Todas") {
      list = list.filter((s) => String(s.bodegaProveedora?.id) === String(filtroBodegaProv));
    }
    if (filtroBodegaSol !== "Todas") {
      list = list.filter((s) => String(s.bodegaSolicitante?.id) === String(filtroBodegaSol));
    }
    return list;
  }, [solicitudes, filtroEstado, filtroBodegaProv, filtroBodegaSol]);

  const columns = [
    { header: "ID", accessor: "id", sortable: true },
    {
      header: "Bodega Proveedora",
      accessor: "bodegaProveedora",
      sortable: true,
      sortValue: (row) => row?.bodegaProveedora?.nombre || "",
      Cell: ({ value }) => value?.nombre || value?.id || "N/A",
    },
    {
      header: "Bodega Solicitante",
      accessor: "bodegaSolicitante",
      sortable: true,
      sortValue: (row) => row?.bodegaSolicitante?.nombre || "",
      Cell: ({ value }) => value?.nombre || value?.id || "N/A",
    },
    {
      header: "Usuario Solicitante",
      accessor: "usuarioSolicitante",
      sortable: true,
      sortValue: (row) => row?.usuarioSolicitante?.nombre || row?.usuarioSolicitante?.email || "",
      Cell: ({ value }) => value?.nombre || value?.email || "N/A",
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      align: "center",
      Cell: ({ value }) => <div className="flex justify-center">{getEstadoChip(value)}</div>,
    },
    {
      header: "Fecha Solicitud",
      accessor: "createdAt",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
      Cell: ({ value }) => <div className="text-center text-sm text-gray-700">{fmtFecha(value)}</div>,
    },
    {
      header: "Fecha Envío",
      accessor: "fecha_envio",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.fecha_envio ? new Date(row.fecha_envio).getTime() : 0),
      Cell: ({ value }) => <div className="text-center text-sm text-gray-700">{fmtFecha(value)}</div>,
    },
    {
      header: "Fecha Recepción",
      accessor: "fecha_recepcion",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.fecha_recepcion ? new Date(row.fecha_recepcion).getTime() : 0),
      Cell: ({ value }) => <div className="text-center text-sm text-gray-700">{fmtFecha(value)}</div>,
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton
        onClick={() => navigate(`/Solicitudes/${row.id}`)}
        tooltipText="Ver detalle"
      />
    </div>
  );

  const getSearchText = (s) =>
    [
      s.id,
      s.bodegaProveedora?.nombre,
      s.bodegaSolicitante?.nombre,
      s.usuarioSolicitante?.nombre,
      s.usuarioSolicitante?.email,
      s.estado,
      s.numero_guia_despacho,
      s.medio_transporte,
    ]
      .filter(Boolean)
      .join(" ");

  const filtrosPanel = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-sm text-gray-600 p-1">Estado</label>
        <div className="flex flex-wrap gap-2 px-1">
          {estadoOptions.map((opt) => {
            const isActive = filtroEstado === opt;
            const style =
              opt === "Todos"
                ? { bg: "bg-gray-100", text: "text-gray-700", label: "Todos" }
                : (ESTADO_STYLES[opt] ?? { bg: "bg-gray-100", text: "text-gray-700", label: opt });
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFiltroEstado(opt)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${style.bg} ${style.text} ${
                  isActive ? "ring-2 ring-offset-1 ring-primary" : "opacity-80 hover:opacity-100"
                }`}
                aria-pressed={isActive}
              >
                {style.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-sm text-gray-600">Bodega Proveedora</label>
        <Selector
          options={bodegaProvOptions}
          selectedValue={filtroBodegaProv}
          onSelect={setFiltroBodegaProv}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-sm text-gray-600">Bodega Solicitante</label>
        <Selector
          options={bodegaSolOptions}
          selectedValue={filtroBodegaSol}
          onSelect={setFiltroBodegaSol}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      <div className="md:col-span-3 flex justify-end">
        <button
          type="button"
          className="px-3 py-2 text-sm text-gray-700 hover:text-primary"
          onClick={() => {
            setFiltroEstado("Todos");
            setFiltroBodegaProv("Todas");
            setFiltroBodegaSol("Todas");
          }}
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );

  return (
    <DataTable
      title="Solicitudes"
      data={dataFiltrada}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      filters={filtrosPanel}
      loading={isLoading}
      loadingMessage="Cargando solicitudes"
      initialSort={{ key: "id", direction: "desc" }}
      emptyMessage="No hay solicitudes registradas."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Solicitudes/add")}
        >
          Nueva Solicitud
        </button>
      }
    />
  );
}
