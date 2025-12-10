import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";

export default function ListasPrecio() {
  const navigate = useNavigate();
  const [listasPrecio, setListasPrecio] = useState([]);
  const [filteredListasPrecio, setFilteredListasPrecio] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [loading, setLoading] = useState(true);

  const apiFetch = useApi();

  // ───────────────────────────────
  // Manejo de ordenamiento
  // ───────────────────────────────
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sorted = [...filteredListasPrecio].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    setFilteredListasPrecio(sorted);
    setCurrentPage(1);
  };

  const renderHeader = (label, accessor) => {
    const isActive = sortConfig.key === accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(accessor)}
      >
        <span>{label}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  // ───────────────────────────────
  // Columnas
  // ───────────────────────────────
  const columns = [
    { header: renderHeader("ID", "id"), accessor: "id" },
    { header: renderHeader("Nombre", "nombre"), accessor: "nombre" },
    { header: renderHeader("Descripción", "description"), accessor: "description" },
  ];

  // ───────────────────────────────
  // Acciones
  // ───────────────────────────────
  const handleDeleteListaPrecio = async (listaId) => {
    try {
      await apiFetch(`/lista-precio/${listaId}`, {
        method: "DELETE",
      });
      setListasPrecio((prev) => prev.filter((l) => l.id !== listaId));
      setFilteredListasPrecio((prev) =>
        prev.filter((l) => l.id !== listaId)
      );
    } catch (error) {
      console.error("Error eliminando lista de precio:", error);
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/lista-precio/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/lista-precio/${row.id}/edit`)}
        tooltipText="Editar Lista de Precio"
      />
      <TrashButton
        onConfirmDelete={() => handleDeleteListaPrecio(row.id)}
        tooltipText="Eliminar Lista de Precio"
        entityName="lista de precio"
      />
    </div>
  );

  // ───────────────────────────────
  // Fetch inicial
  // ───────────────────────────────
  useEffect(() => {
    const fetchListasPrecio = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/lista-precio`);
        setListasPrecio(response);
        setFilteredListasPrecio(response);
      } catch (error) {
        console.error("Error fetching listas de precio:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListasPrecio();
  }, [apiFetch]);

  // ───────────────────────────────
  // Buscador
  // ───────────────────────────────
  const handleSearch = (query) => {
    const q = query.toLowerCase();
    if (!q) {
      setFilteredListasPrecio(listasPrecio);
      return;
    }

    const filtered = listasPrecio.filter((lista) =>
      Object.values(lista).some(
        (v) =>
          v !== null &&
          v !== undefined &&
          String(v).toLowerCase().includes(q)
      )
    );
    setFilteredListasPrecio(filtered);
  };

  // ───────────────────────────────
  // Paginación
  // ───────────────────────────────
  const handleRowsChange = (value) => setRowsPerPage(value);
  const handlePageChange = (page) => setCurrentPage(page);

  const totalPages = Math.ceil(filteredListasPrecio.length / rowsPerPage);
  const paginatedListasPrecio = filteredListasPrecio.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // ───────────────────────────────
  // Render
  // ───────────────────────────────
  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text">Cargando listas de precio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Listas de Precio</h1>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table columns={columns} data={paginatedListasPrecio} actions={actions} />

      {/* Paginación */}
      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/lista-precio/add")}
        >
          Añadir Lista de Precio
        </button>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
