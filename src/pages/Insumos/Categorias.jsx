import Table from "../../components/Tables/Table";
import SearchBar from "../../components/UI/SearchBar";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
import Pagination from "../../components/UI/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton,  EditButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [filteredCategorias, setFilteredCategorias] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const api = useApi();

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "nombre" },
    { header: "Descripción", accessor: "descripcion" },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const response = await api(`/categorias-materia-prima`);
        const categoriasData = Array.isArray(response)
          ? response.map((categoria) => ({
              id: categoria.id,
              nombre: categoria.nombre,
              descripcion: categoria.descripcion,
              estado: categoria.activo,
            }))
          : [];

        setCategorias(categoriasData);
        setFilteredCategorias(categoriasData);
      } catch (error) {
        toast.error(`Error fetching categorias: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategorias();
  }, []);

  const actions = (row) => (
    <div className="flex gap-2">
      <EditButton
        onClick={() => navigate(`/Insumos/Categorias/edit/${row.id}`)}
        tooltipText="Editar Categoría"
      />
      {/* TODO: Deshabilitar eliminación temporalmente */}
      {/* <TrashButton
        tooltipText="Eliminar Categoría"
        entityName={row.nombre || "Categoría"}
        onConfirmDelete={() => handleDeleteCategoria(row.id)}
      /> */}
    </div>
  );

  const handleDeleteCategoria = async (id) => {
    try {
      // await api(`/categorias-materia-prima/${id}`, { method: "DELETE" });
      // setCategorias((prev) => prev.filter((c) => c.id !== id));
      // setFilteredCategorias((prev) => prev.filter((c) => c.id !== id));
      // toast.success("Categoría eliminada correctamente");
      toast.info("Funcionalidad de eliminación deshabilitada temporalmente.");
    } catch (error) {
      toast.error(`Error deleting categoria: ${error.message}`);
    }
  };

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredCategorias(categorias);
      return;
    }
    const filtered = categorias.filter(categoria =>
      Object.values(categoria).some(value =>
        value && value.toString().toLowerCase().includes(lowercasedQuery)
      )
    );
    setFilteredCategorias(filtered);
    setCurrentPage(1);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredCategorias.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredCategorias.slice(startIndex, startIndex + rowsPerPage);

  if (isLoading) return <PageLoader message="Cargando categorías" />;

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <BackButton to="/Insumos"/>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Categorías de Insumos</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate('/Insumos/Categorias/add')}
        >
          Añadir Categoría
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table columns={columns} data={paginatedData} actions={actions} />

      {/* Paginación */}
      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
} 