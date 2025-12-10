import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";

export default function RecetasPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [recetas, setRecetas] = useState([]);
  const [filteredRecetas, setFilteredRecetas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    const fetchRecetas = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api(`/recetas`, { method: "GET" });
        const sorted = response.sort((a, b) => a.id - b.id);
        setRecetas(sorted);
        setFilteredRecetas(sorted);
      } catch (err) {
        console.error("Error fetching recetas:", err);
        setError("⚠️ No se pudo conectar al servidor. Verifica la conexión.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecetas();
  }, []);

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "NOMBRE", accessor: "nombre" },
    { header: "CANTIDAD PRODUCIDA", accessor: "peso" },
    { header: "UNIDAD DE MEDIDA", accessor: "unidad_medida" },
  ];

  const handleSearch = (query) => {
    const lower = query.toLowerCase();
    const filtered = recetas.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(lower))
    );
    setFilteredRecetas(filtered);
    setCurrentPage(1);
  };

  const handleDelete = async (idReceta) => {
    try {
      await api(`/recetas/${idReceta}`, { method: "DELETE" });
      setFilteredRecetas((prev) => prev.filter((r) => r.id !== idReceta));
      setSuccessMessage("✅ Receta eliminada correctamente.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting receta:", err);
      alert("❌ Ocurrió un error al eliminar la receta.");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Recetas/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Recetas/${row.id}/edit`)} tooltipText="Editar Receta" />
      <TrashButton
        onConfirmDelete={() => handleDelete(row.id)}
        tooltipText="Eliminar Receta"
        entityName="receta"
      />
    </div>
  );

  const totalPages = Math.ceil(filteredRecetas.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredRecetas.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Recetas</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Recetas/add")}
        >
          Añadir Receta
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center mb-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-purple-500">Cargando recetas...</span>
        </div>
      )}

      {error && <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">{error}</div>}

      {successMessage && (
        <div className="p-4 mb-6 text-green-700 bg-green-100 rounded-lg">{successMessage}</div>
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
            <SearchBar onSearch={handleSearch} placeholder="Buscar receta..." />
          </div>

          <Table columns={columns} data={paginatedData} actions={actions} actionHeader="OPCIONES" />

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
