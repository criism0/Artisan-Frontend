import { ViewDetailButton, EditButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatRutDisplay, toTitleCaseES, formatPhoneDisplay } from "../../services/formatHelpers";
import { toast } from "../../lib/toast";
import { useApi } from "../../lib/api";

export default function ProveedoresPage() {
  const api = useApi();
  const [proveedores, setProveedores] = useState([]);
  const [filteredProveedores, setFilteredProveedores] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre_empresa",
      Cell: ({ row }) => toTitleCaseES(row.nombre_empresa),
    },
    { header: "ID", accessor: "id" },
    {
      header: "RUT",
      accessor: "rut_empresa",
      Cell: ({ row }) => formatRutDisplay(row.rut_empresa),
    },
    {
      header: "Teléfono",
      accessor: "telefono",
      Cell: ({ row }) => formatPhoneDisplay(row.telefono),
    },
    {
      header: "Email",
      accessor: "email_transferencia",
      Cell: ({ row }) => String(row.email_transferencia || "").toLowerCase(),
    },
    {
      header: "Tipo Proveedor",
      accessor: "tipo_proveedor",
      Cell: ({ row }) => String(row.tipo_proveedor || ""),
    },
    {
      header: "Estado",
      accessor: "activo",
      Cell: ({ row }) => {
        const activo = row.activo === true;
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              activo ? "bg-green-100 text-green-800" : "bg-red-200 text-red-800"
            }`}
          >
            {activo ? "Activo" : "Inactivo"}
          </span>
        );
      },
    },
  ];

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const response = await api(
          `/proveedores`, { method: "GET" }
        );

        const normalized = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : response?.data?.proveedores || [];

        setProveedores(normalized);
        setFilteredProveedores(normalized);
      } catch (error) {
        toast.error("Error fetching providers:" + error);
      }
    };
    fetchProveedores();
  }, []);

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Proveedores/${row.id}`)} tooltipText="Ver Detalle" />
      <EditButton onClick={() => navigate(`/Proveedores/${row.id}/edit`)} tooltipText="Editar Proveedor" />   
    </div>
  );

  useEffect(() => {
    let filtered = proveedores;

    if (showOnlyActive) {
      filtered = filtered.filter((p) => p.activo === true);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        Object.values(p).some((v) => v && v.toString().toLowerCase().includes(q))
      );
    }

    setFilteredProveedores(filtered);
    setCurrentPage(1);
  }, [proveedores, showOnlyActive, searchQuery]);

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

  const totalPages = Math.ceil(filteredProveedores.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredProveedores.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Proveedores</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Proveedores/add")}
          aria-label="Añadir Proveedor"
        >
          Añadir Proveedor
        </button>
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

      <Table columns={columns} data={paginatedData} actions={actions} />

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
