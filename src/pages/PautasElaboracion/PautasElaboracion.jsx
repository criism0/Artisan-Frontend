import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { Lock, Unlock } from "lucide-react";
import { checkScope, ModelType, ScopeType, isAdminOrSuperAdmin } from "../../services/scopeCheck.js";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

const toBoolIsActive = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

function pautaToSearchText(p) {
  const estado = toBoolIsActive(p?.is_active) ? "activo" : "inactivo";
  return [p?.id, p?.name, p?.description, estado].filter((v) => v != null).map((v) => String(v)).join(" ");
}

function EstadoChip({ activo }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

export default function PautasElaboracionPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [pautas, setPautas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  const isAdmin = isAdminOrSuperAdmin();
  const canReadElaborationGuideline = checkScope(ModelType.PAUTA_ELABORACION, ScopeType.READ);
  const canWriteElaborationGuideline = checkScope(ModelType.PAUTA_ELABORACION, ScopeType.WRITE);
  const canDeleteElaborationGuideline = checkScope(ModelType.PAUTA_ELABORACION, ScopeType.DELETE);

  const patchLocalPauta = (idPauta, patch) =>
    setPautas((prev) => prev.map((p) => (p.id === idPauta ? { ...p, ...patch } : p)));

  useEffect(() => {
    const fetchPautas = async () => {
      if (!canReadElaborationGuideline) {
        toast.permissionError([ModelType.PAUTA_ELABORACION, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await api(`/pautas-elaboracion`, { method: "GET" });
        setPautas(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error("Error fetching pautas:", err);
        toast.error("No se pudo conectar al servidor. Verifica la conexión.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPautas();
  }, [api, canReadElaborationGuideline]);

  const columns = [
    {
      header: "Pauta",
      accessor: "name",
      sortable: true,
      Cell: ({ value }) => <div className="max-w-[320px] truncate" title={value || ""}>{value || "—"}</div>,
    },
    {
      header: "Descripción",
      accessor: "description",
      Cell: ({ value }) => <div className="max-w-[420px] truncate text-gray-600" title={value || ""}>{value || "—"}</div>,
    },
    {
      header: "Estado",
      accessor: "is_active",
      sortable: true,
      align: "center",
      sortValue: (row) => (toBoolIsActive(row.is_active) ? 1 : 0),
      Cell: ({ row }) => <div className="flex justify-center"><EstadoChip activo={toBoolIsActive(row.is_active)} /></div>,
    },
    {
      header: "Actualizada",
      accessor: "updatedAt",
      sortable: true,
      Cell: ({ value }) => <span className="text-gray-600">{formatDateTime(value)}</span>,
    },
  ];

  const handleToggleActive = async (row) => {
    const idPauta = row?.id;
    if (!idPauta) return;
    if (!canWriteElaborationGuideline) {
      toast.permissionError([ModelType.PAUTA_ELABORACION, ScopeType.WRITE]);
      return;
    }
    const next = !toBoolIsActive(row?.is_active);
    setTogglingId(idPauta);
    try {
      await api(`/pautas-elaboracion/${idPauta}`, { method: "PUT", body: JSON.stringify({ is_active: next }) });
      patchLocalPauta(idPauta, { is_active: next });
      toast.success(next ? "Pauta activada." : "Pauta desactivada.");
    } catch (err) {
      console.error("Error toggling pauta:", err);
      toast.error("No se pudo actualizar el estado de la pauta.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (idPauta) => {
    if (!canDeleteElaborationGuideline) {
      toast.permissionError([ModelType.PAUTA_ELABORACION, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/pautas-elaboracion/${idPauta}`, { method: "DELETE" });
      setPautas((prev) => prev.filter((p) => p.id !== idPauta));
      toast.success("Pauta de elaboración eliminada correctamente.");
    } catch (err) {
      console.error("Error deleting pauta:", err);
      toast.error(err?.message || "Ocurrió un error al eliminar la pauta de elaboración.");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      <ViewDetailButton onClick={() => navigate(`/PautasElaboracion/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/PautasElaboracion/${row.id}/edit`)} tooltipText="Editar Pauta" />
      <button
        type="button"
        onClick={() => void handleToggleActive(row)}
        disabled={togglingId === row.id}
        className={`${toBoolIsActive(row?.is_active) ? "text-yellow-600 hover:text-yellow-700" : "text-green-600 hover:text-green-700"} ${togglingId === row.id ? "opacity-60 cursor-not-allowed" : ""}`}
        title={togglingId === row.id ? "Actualizando..." : toBoolIsActive(row?.is_active) ? "Desactivar pauta" : "Activar pauta"}
        aria-label={toBoolIsActive(row?.is_active) ? "Desactivar pauta" : "Activar pauta"}
      >
        {toBoolIsActive(row?.is_active) ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
      </button>
      {isAdmin ? (
        <TrashButton onConfirmDelete={() => handleDelete(row.id)} tooltipText="Eliminar Pauta" entityName="pauta de elaboración" />
      ) : null}
    </div>
  );

  return (
    <DataTable
      title="Pautas de Elaboración"
      data={pautas}
      columns={columns}
      actions={actions}
      filterFn={(row, q) => pautaToSearchText(row).toLowerCase().includes(q.toLowerCase())}
      loading={isLoading}
      loadingMessage="Cargando pautas de elaboración"
      defaultRowsPerPage={25}
      emptyMessage="No hay pautas de elaboración registradas."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/PautasElaboracion/add")}
        >
          Añadir Pauta
        </button>
      }
    />
  );
}
