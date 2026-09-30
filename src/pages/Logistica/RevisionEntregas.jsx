import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { BackButton } from "../../components/Buttons/ActionButtons";
import ModalResolverRevision from "../../components/Entregas/ModalResolverRevision";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { listarRevisiones } from "../../services/rutasService";
import { formatearFecha } from "../../utils/rutas";

const FILTROS = [
  { valor: "Pendiente", texto: "Pendientes" },
  { valor: "Resuelta", texto: "Resueltas" },
  { valor: "todas", texto: "Todas" },
];

const fechaHora = (v) => (v ? new Date(v).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Logística → Entregas → Revisión (plan §6.3): las entregas que alguien tiene que mirar — una
 * parcial con acuerdo (NC, cambio, regresa a CD) o un rechazo del cliente — y qué se hizo con
 * cada una. Hasta que se resuelve, la OV no se vuelve a rutear.
 */
export default function RevisionEntregas() {
  const [estado, setEstado] = useState("Pendiente");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState(null);
  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await listarRevisiones(estado);
      setFilas(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const diferencias = (e) =>
    e.documentos.reduce((n, d) => n + d.lineas.filter((l) => Math.abs(l.recibida - l.esperada) > 1e-6).length, 0);

  const columns = [
    { header: "Fecha", accessor: "fecha_hora", sortable: true, sortValue: (e) => e.fecha_hora ?? "", Cell: ({ value }) => fechaHora(value) },
    { header: "Cliente", accessor: "cliente", sortable: true },
    {
      header: "Resultado",
      accessor: "estado",
      sortable: true,
      Cell: ({ row }) => (
        <span className="text-sm">
          {row.estado}
          <span className="block text-xs text-gray-500">{row.estado === "No entregada" ? row.motivo_no_entrega : row.motivo}</span>
        </span>
      ),
    },
    { header: "Acuerdo", accessor: "acuerdo", sortable: true, Cell: ({ value }) => value ?? "—" },
    {
      header: "Diferencias",
      accessor: "n_diferencias",
      align: "right",
      sortable: true,
      sortValue: (e) => diferencias(e),
      Cell: ({ row }) => (row.estado === "No entregada" ? "—" : diferencias(row)),
    },
    {
      header: "Ruta",
      accessor: "ruta",
      sortable: true,
      sortValue: (e) => e.ruta?.id ?? 0,
      filtro: false,
      Cell: ({ row }) => (row.ruta ? `#${row.ruta.id} · ${formatearFecha(row.ruta.fecha)}` : "—"),
    },
    {
      header: "Revisión",
      accessor: "estado_revision",
      sortable: true,
      Cell: ({ row }) =>
        row.estado_revision === "Pendiente" ? (
          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">Pendiente</span>
        ) : (
          <span className="text-sm">
            {row.resolucion}
            <span className="block text-xs text-gray-500">{[row.resuelta_por, fechaHora(row.resuelta_en)].filter(Boolean).join(" · ")}</span>
          </span>
        ),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center items-center">
      <button
        type="button"
        onClick={() => setAbierta(row)}
        className="text-gray-400 hover:text-primary"
        title={row.estado_revision === "Pendiente" && puedeEscribir ? "Revisar y resolver" : "Ver"}
      >
        <ClipboardCheck className="w-5 h-5" />
      </button>
    </div>
  );

  const filtros = (
    <div className="flex flex-wrap gap-2 px-1">
      {FILTROS.map((f) => (
        <button
          key={f.valor}
          type="button"
          onClick={() => setEstado(f.valor)}
          className={`px-3 py-1 rounded-full text-xs font-medium ${estado === f.valor ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          {f.texto}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="px-6 pt-6"><BackButton to="/Logistica/entregas" /></div>
      <DataTable
        title="Revisión de entregas"
        data={filas}
        columns={columns}
        actions={actions}
        stickyActions
        filters={filtros}
        getSearchText={(e) => [e.cliente, e.estado, e.motivo, e.motivo_no_entrega, e.acuerdo, e.comentario, e.ruta?.id].join(" ")}
        initialSort={{ key: "fecha_hora", direction: "desc" }}
        loading={cargando}
        loadingMessage="Cargando revisiones"
        emptyMessage={estado === "Pendiente" ? "No hay entregas esperando revisión." : "Nada por acá."}
      />
      <ModalResolverRevision entrega={abierta} soloLectura={!puedeEscribir} onCerrar={() => setAbierta(null)} onResuelta={cargar} />
    </>
  );
}
