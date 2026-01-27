import { ViewDetailButton, EditButton, ToggleActiveButton, BackButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";
import { toast } from "../../lib/toast";
import { fuzzyMatch, insumoToSearchText } from "../../services/fuzzyMatch";

export default function PIPList() {
  const [pipItems, setPIPItems] = useState([]);
  const [filteredPIPItems, setFilteredPIPItems] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const columns = [
    { header: "N°", accessor: "id", sortable: true },
    { header: "Nombre", accessor: "nombre", sortable: true },
    { header: "Unidad de Medida", accessor: "unidad_medida", sortable: true },
    {
      header: (
        <div className="flex items-center gap-2 relative group">
          Stock Crítico
          <span className="cursor-help text-primary hover:text-hover">(?)</span>

          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2
                      bg-white text-gray-800 text-xs px-4 py-2 rounded-lg shadow-lg
                      border border-gray-200 w-64 text-center
                      opacity-0 group-hover:opacity-100
                      transform scale-95 group-hover:scale-100
                      transition-all duration-200 z-10 leading-snug break-words"
          >
            Cuando el inventario de este PIP sea igual o menor a este número,
            el sistema generará una alerta de bajo stock.
            <span
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2
                        bg-white border-l border-t border-gray-200 rotate-45"
            ></span>
          </span>
        </div>
      ),
      accessor: "stock_critico",
      sortable: true,
    },
    { header: "Activo", accessor: "activo", sortable: true, Cell: ({ value }) => (value ? "Sí" : "No") },
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const fetchPIPItems = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/materias-primas/buscar-categoria?nombre=PIP`);
        const raw = response.data || [];
        // Normalizar shape para reusar lógica de Insumos (categoria)
        const normalized = Array.isArray(raw)
          ? raw.map((x) => ({
            ...x,
            categoria: x?.categoria || x?.CategoriaMateriaPrima || null,
          }))
          : [];

        setPIPItems(normalized);
        setFilteredPIPItems(normalized);
      } catch (error) {
        console.error("Error fetching PIP items:", error);
        toast.error("Error al cargar PIPs");
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
      <ToggleActiveButton
        isActive={row.activo}
        entityName={row.nombre || "PIP"}
        onToggleActive={() => handleToggleActivePip(row.id)}
      />
    </div>
  );

  const handleToggleActivePip = async (id) => {
    try {
      const res = await axiosInstance.put(`/materias-primas/${id}/toggle-active`);
      const updated = res.data;

      setPIPItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, activo: updated.activo } : i))
      );
      setFilteredPIPItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, activo: updated.activo } : i))
      );
    } catch (error) {
      toast.error("Error activando/desactivando PIP");
      console.error(error);
    }
  };

  useEffect(() => {
    let filtered = pipItems;

    if (showOnlyActive) {
      filtered = filtered.filter((item) => item.activo === true);
    }

    if (searchQuery) {
      filtered = filtered.filter((item) => {
        const text = insumoToSearchText(item);
        return fuzzyMatch(text, searchQuery);
      });
    }

    setFilteredPIPItems(filtered);
    setCurrentPage(1);
  }, [pipItems, showOnlyActive, searchQuery]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterToggle = () => {
    setShowOnlyActive(!showOnlyActive);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }

    setSortConfig({ key, direction });

    const sortedData = [...filteredPIPItems].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    setFilteredPIPItems(sortedData);
    setCurrentPage(1);
  };

  const renderHeader = (col) => {
    if (!col.sortable) return col.header;
    const isActive = sortConfig.key === col.accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";

    if (typeof col.header !== "string") {
      return (
        <div
          className="flex items-center gap-1 cursor-pointer select-none"
          onClick={() => handleSort(col.accessor)}
        >
          {col.header}
          <div className="flex flex-col leading-none text-xs ml-1">
            <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
            <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(col.accessor)}
      >
        <span>{col.header}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
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
        <div className="flex gap-4">
          <BackButton to={`/InsumosPIPProductos`} />
          <button
            className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
            onClick={() => navigate("/Insumos")}
          >
            Ver Insumos
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <RowsPerPageSelector onRowsChange={handleRowsChange} />
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-700">Solo activos</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={handleFilterToggle}
                className="sr-only"
              />
              <div
                className={`block w-14 h-8 rounded-full transition-colors ${
                  showOnlyActive ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                    showOnlyActive ? "transform translate-x-6" : ""
                  }`}
                />
              </div>
            </div>
          </label>
        </div>
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table
        columns={columns.map((col) => ({
          ...col,
          header: renderHeader(col),
        }))}
        data={paginatedData}
        actions={actions}
      />

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