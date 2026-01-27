import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import {ViewDetailButton, EditButton, TrashButton, BackButton} from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";

export default function Productos() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

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

    const sorted = [...filteredProductos].sort((a, b) => {
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

    setFilteredProductos(sorted);
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
    { header: renderHeader("Nombre", "nombre"), accessor: "nombre" },
    {
      header: renderHeader("Cantidad", "peso_unitario"),
      accessor: "peso_unitario",
      Cell: ({ row }) => {
        const unidad = row.unidad_medida;
        const unidadLabel =
          {
            Kilogramos: "kg",
            Litros: "L",
            Unidades: "unid.",
          }[unidad] || "";
        return `${row.peso_unitario?.toLocaleString("es-CL")} ${unidadLabel}`;
      },
    },
    {
      header: renderHeader("Unidades por Caja", "unidades_por_caja"),
      accessor: "unidades_por_caja",
      Cell: ({ value }) => `${value?.toLocaleString("es-CL") || "0"}`,
    },
  ];

  // ───────────────────────────────
  // Acciones
  // ───────────────────────────────
  const handleDeleteProduct = async (productId) => {
    try {
      await apiFetch(`/productos-base/${productId}`, {
        method: "DELETE",
      });
      setProductos((prev) => prev.filter((p) => p.id !== productId));
      setFilteredProductos((prev) =>
        prev.filter((p) => p.id !== productId)
      );
    } catch (error) {
      console.error("❌ Error eliminando producto:", error);
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Productos/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/Productos/${row.id}/edit`)}
        tooltipText="Editar Producto"
      />
      <TrashButton
        onConfirmDelete={() => handleDeleteProduct(row.id)}
        tooltipText="Eliminar Producto"
        entityName="producto"
      />
    </div>
  );

  // ───────────────────────────────
  // Fetch inicial
  // ───────────────────────────────
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await apiFetch(`/productos-base`);
        setProductos(response);
        setFilteredProductos(response);
      } catch (error) {
        console.error("Error fetching productos:", error);
      }
    };
    fetchProductos();
  }, []);

  // ───────────────────────────────
  // Buscador
  // ───────────────────────────────
  const handleSearch = (query) => {
    const q = query.toLowerCase();
    if (!q) {
      setFilteredProductos(productos);
      return;
    }

    const filtered = productos.filter((producto) =>
      Object.values(producto).some(
        (v) =>
          v !== null &&
          v !== undefined &&
          String(v).toLowerCase().includes(q)
      )
    );
    setFilteredProductos(filtered);
  };

  // ───────────────────────────────
  // Paginación
  // ───────────────────────────────
  const handleRowsChange = (value) => setRowsPerPage(value);
  const handlePageChange = (page) => setCurrentPage(page);

  const totalPages = Math.ceil(filteredProductos.length / rowsPerPage);
  const paginatedProductos = filteredProductos.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // ───────────────────────────────
  // Render
  // ───────────────────────────────
  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Productos</h1>
        <div className="flex gap-4">
          <BackButton to={`/InsumosPIPProductos`} />
        </div>
      </div>


      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table columns={columns} data={paginatedProductos} actions={actions} />

      {/* Paginación */}
      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Productos/crear")}
        >
          Añadir Producto Terminado
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
