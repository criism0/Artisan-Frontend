import { useState, useEffect } from "react";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function InventarioInsumos() {
  const { id_bodega } = useParams();
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [inventario, setInventario] = useState([]);
  const [filteredInventario, setFilteredInventario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInventario = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/inventario/${id_bodega}`);
        const inventarioData = response.data.map(item => ({
          id: item.materiaPrima.id,
          insumo: item.materiaPrima.nombre,
          unidad: item.materiaPrima.unidad_medida,
          enInventario: item.cantidadDisponible,
          estado: item.estado,
          ultimoMovimiento: new Date(item.ultimo_movimiento).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        }));
        setInventario(inventarioData);
        setFilteredInventario(inventarioData);
      } catch (error) {
        console.error("Error fetching inventario:", error);
        setError("Error al cargar el inventario");
      } finally {
        setLoading(false);
      }
    };

    if (id_bodega) {
      fetchInventario();
    }
  }, [id_bodega]);

  const columns = [
    { header: "Insumo", accessor: "insumo" },
    { header: "Unidad", accessor: "unidad" },
    { header: "En Inventario", accessor: "enInventario" },
    { 
      header: "Estado", 
      accessor: "estado",
      Cell: ({ value }) => (
        <span className={`px-2 py-1 rounded-full text-sm ${
          value === "Bien" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {value}
        </span>
      )
    },
    { header: "Último Movimiento", accessor: "ultimoMovimiento" }
  ];

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredInventario(inventario);
      return;
    }
    const filtered = inventario.filter(item =>
      Object.values(item).some(value =>
        value && value.toString().toLowerCase().includes(lowercasedQuery)
      )
    );
    setFilteredInventario(filtered);
    setCurrentPage(1);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredInventario.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredInventario.slice(startIndex, startIndex + rowsPerPage);

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Cargando inventario...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">
          Inventario de Insumos - {id_bodega || "Global"}
        </h1>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table columns={columns} data={paginatedData} />

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
