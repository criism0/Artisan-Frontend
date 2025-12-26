import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useAuth } from "../../auth/AuthContext";
import { Lock, Unlock } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

function pautaToSearchText(p) {
  const estado =
    p?.is_active === true || p?.is_active === 1 || p?.is_active === "true" || p?.is_active === "1"
      ? "activo"
      : "inactivo";
  return [p?.id, p?.name, p?.description, estado]
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join(" ");
}

export default function PautasElaboracionPage() {
  const navigate = useNavigate();
  const api = useApi();
  const { user } = useAuth();
  const [pautas, setPautas] = useState([]);
  const [filteredPautas, setFilteredPautas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const toBoolIsActive = (value) =>
    value === true || value === "true" || value === 1 || value === "1";

  const patchLocalPauta = (idPauta, patch) => {
    setPautas((prev) => prev.map((p) => (p.id === idPauta ? { ...p, ...patch } : p)));
    setFilteredPautas((prev) => prev.map((p) => (p.id === idPauta ? { ...p, ...patch } : p)));
  };

  useEffect(() => {
    const fetchPautas = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api(`/pautas-elaboracion`, { method: "GET" });
        const sorted = response.sort((a, b) => a.id - b.id);
        setPautas(sorted);
        setFilteredPautas(sorted);
      } catch (err) {
        console.error("Error fetching pautas:", err);
        toast.error("No se pudo conectar al servidor. Verifica la conexión.");
        setError("No se pudieron cargar las pautas.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPautas();
  }, [api]);

  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "Pauta",
      accessor: "name",
      Cell: ({ value }) => (
        <div className="max-w-[320px] truncate" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Descripción",
      accessor: "description",
      Cell: ({ value }) => (
        <div className="max-w-[420px] truncate text-gray-600" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "is_active",
      Cell: ({ value }) => {
        const isActive = toBoolIsActive(value);
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              isActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
        );
      },
    },
    {
      header: "Actualizada",
      accessor: "updatedAt",
      Cell: ({ value }) => (
        <span className="text-gray-600">{formatDateTime(value)}</span>
      ),
    },
  ];

  const handleSearch = (query) => {
    const lower = query.toLowerCase();
    const filtered = pautas.filter((p) => pautaToSearchText(p).includes(lower));
    setFilteredPautas(filtered);
    setCurrentPage(1);
  };

  const handleToggleActive = async (row) => {
    const idPauta = row?.id;
    if (!idPauta) return;

    const current = toBoolIsActive(row?.is_active);
    const next = !current;

    setTogglingId(idPauta);
    try {
      await api(`/pautas-elaboracion/${idPauta}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: next }),
      });

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
    try {
      await api(`/pautas-elaboracion/${idPauta}`, { method: "DELETE" });
      setPautas((prev) => prev.filter((p) => p.id !== idPauta));
      setFilteredPautas((prev) => prev.filter((p) => p.id !== idPauta));
      toast.success("Pauta de elaboración eliminada correctamente.");
    } catch (err) {
      console.error("Error deleting pauta:", err);
      const msg =
        err?.message ||
        "Ocurrió un error al eliminar la pauta de elaboración.";
      toast.error(msg);
    }
  };

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      <ViewDetailButton
        onClick={() => navigate(`/PautasElaboracion/${row.id}`)}
        tooltipText="Ver detalle"
      />
      <EditButton
        onClick={() => navigate(`/PautasElaboracion/${row.id}/edit`)}
        tooltipText="Editar Pauta"
      />

      <button
        type="button"
        onClick={() => void handleToggleActive(row)}
        disabled={togglingId === row.id}
        className={`${
          toBoolIsActive(row?.is_active)
            ? "text-yellow-600 hover:text-yellow-700"
            : "text-green-600 hover:text-green-700"
        } ${togglingId === row.id ? "opacity-60 cursor-not-allowed" : ""}`}
        title={
          togglingId === row.id
            ? "Actualizando..."
            : toBoolIsActive(row?.is_active)
              ? "Desactivar pauta"
              : "Activar pauta"
        }
        aria-label={
          togglingId === row.id
            ? "Actualizando pauta"
            : toBoolIsActive(row?.is_active)
              ? "Desactivar pauta"
              : "Activar pauta"
        }
      >
        {toBoolIsActive(row?.is_active) ? (
          <Lock className="w-5 h-5" />
        ) : (
          <Unlock className="w-5 h-5" />
        )}
      </button>

      {isAdmin ? (
        <TrashButton
          onConfirmDelete={() => handleDelete(row.id)}
          tooltipText="Eliminar Pauta"
          entityName="pauta de elaboración"
        />
      ) : null}
    </div>
  );

  const totalPages = Math.ceil(filteredPautas.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredPautas.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-text">Pautas de Elaboración</h1>
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            onClick={() => navigate("/PautasElaboracion/add")}
          >
            Añadir Pauta
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center mb-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <span className="ml-3 text-primary">Cargando pautas...</span>
          </div>
        )}

        {error && (
          <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="flex justify-between items-center mb-6">
              <RowsPerPageSelector
                onRowsChange={(value) => {
                  setRowsPerPage(value);
                  setCurrentPage(1);
                }}
                defaultRows={25}
                options={[25, 50, 100]}
              />
              <SearchBar onSearch={handleSearch} placeholder="Buscar pauta..." />
            </div>

            <Table
              columns={columns}
              data={paginatedData}
              actions={actions}
              actionHeader="OPCIONES"
            />

            <div className="mt-6 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
