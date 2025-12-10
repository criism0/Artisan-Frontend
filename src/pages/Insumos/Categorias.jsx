import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";
import { BackButton,  EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [filteredCategorias, setFilteredCategorias] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "nombre" },
    { header: "Descripción", accessor: "descripcion" },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/categorias-materia-prima`);
        const categoriasData = Array.isArray(response.data)
          ? response.data.map((categoria) => ({
              id: categoria.id,
              nombre: categoria.nombre,
              descripcion: categoria.descripcion,
              estado: categoria.activo,
            }))
          : [];

        setCategorias(categoriasData);
        setFilteredCategorias(categoriasData);
      } catch (error) {
        toast.error("Error fetching categorias:", error);
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
      // await axiosInstance(`/categorias-materia-prima/${id}`, { method: "DELETE" });
      // setCategorias((prev) => prev.filter((c) => c.id !== id));
      // setFilteredCategorias((prev) => prev.filter((c) => c.id !== id));
      // toast.success("Categoría eliminada correctamente");
      toast.info("Funcionalidad de eliminación deshabilitada temporalmente.");
    } catch (error) {
      toast.error("Error deleting categoria:", error);
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