import { ViewDetailButton, EditButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";

export default function PIPList() {
  const [pipItems, setPIPItems] = useState([]);
  const [filteredPIPItems, setFilteredPIPItems] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = [
    { header: "Nombre", accessor: "nombre" },
    { 
      header: "Categoría", 
      accessor: "CategoriaMateriaPrima",
      Cell: ({ value }) => value?.nombre || "Sin categoría"
    },
    { header: "Unidad de Medida", accessor: "unidad_medida" }
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const fetchPIPItems = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/materias-primas/buscar-categoria?nombre=PIP`);
        setPIPItems(response.data || []);
        setFilteredPIPItems(response.data || []);
      } catch (error) {
        console.error("Error fetching PIP items:", error);
      }
    };

    fetchPIPItems();
  }, []);

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Insumos/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/Insumos/${row.id}/edit`)}
        tooltipText="Editar Insumo"
      />
    </div>
  );

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredPIPItems(pipItems);
      return;
    }
    const filtered = pipItems.filter((item) =>
      Object.values(item).some(
        (value) =>
          value &&
          value.toString().toLowerCase().includes(lowercasedQuery)
      )
    );
    setFilteredPIPItems(filtered);
    setCurrentPage(1);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredPIPItems.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredPIPItems.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Productos en Proceso (PIP)</h1>
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