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

export default function PautasElaboracionPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [pautas, setPautas] = useState([]);
  const [filteredPautas, setFilteredPautas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPautas = async () => {
      setIsLoading(true);
      try {
        const response = await api(`/pautas-elaboracion`, { method: "GET" });
        const sorted = response.sort((a, b) => a.id - b.id);
        setPautas(sorted);
        setFilteredPautas(sorted);
      } catch (err) {
        console.error("Error fetching pautas:", err);
        toast.error("No se pudo conectar al servidor. Verifica la conexión.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPautas();
  }, [api]);

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "NOMBRE", accessor: "name" },
    { header: "DESCRIPCIÓN", accessor: "description" },
    {
      header: "ESTADO",
      accessor: "is_active",
      Cell: ({ value }) => {
        const isActive =
          value === true || value === "true" || value === 1 || value === "1";
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
  ];

  const handleSearch = (query) => {
    const lower = query.toLowerCase();
    const filtered = pautas.filter((p) =>
      Object.values(p).some((v) => String(v).toLowerCase().includes(lower))
    );
    setFilteredPautas(filtered);
    setCurrentPage(1);
  };

  const handleDelete = async (idPauta) => {
    try {
      await api(`/pautas-elaboracion/${idPauta}`, { method: "DELETE" });
      setFilteredPautas((prev) => prev.filter((p) => p.id !== idPauta));
      toast.success("Pauta de elaboración eliminada correctamente.");
    } catch (err) {
      console.error("Error deleting pauta:", err);
      toast.error("Ocurrió un error al eliminar la pauta de elaboración.");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/PautasElaboracion/${row.id}`)}
        tooltipText="Ver detalle"
      />
      <EditButton
        onClick={() => navigate(`/PautasElaboracion/${row.id}/edit`)}
        tooltipText="Editar Pauta"
      />
      <TrashButton
        onConfirmDelete={() => handleDelete(row.id)}
        tooltipText="Eliminar Pauta"
        entityName="pauta de elaboración"
      />
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-purple-500">Cargando pautas...</span>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="flex justify-between items-center mb-6">
            <RowsPerPageSelector
              onRowsChange={(value) => {
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
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
  );
}
