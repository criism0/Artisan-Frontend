import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { FiKey } from "react-icons/fi";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const navigate = useNavigate();
  const api = useApi();

  // ───────────────────────────────
  // Manejo de ordenamiento
  // ───────────────────────────────
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sorted = [...filteredUsuarios].sort((a, b) => {
      let aVal, bVal;

      // Caso especial para ordenamiento por nombre de rol
      if (key === "rol_nombre") {
        const aRole = roles?.find((r) => r.id === a.role_id);
        const bRole = roles?.find((r) => r.id === b.role_id);
        aVal = aRole ? aRole.name : "Sin rol";
        bVal = bRole ? bRole.name : "Sin rol";
      } else {
        aVal = a[key];
        bVal = b[key];
      }

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

    setFilteredUsuarios(sorted);
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
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>
            ▲
          </span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>
            ▼
          </span>
        </div>
      </div>
    );
  };

  const fetchRoles = async () => {
    try {
      const res = await api(`/roles`, { auth: true });
      setRoles(res);
    } catch (err) {
      toast.error(`Error cargando roles: ${err.response?.data || err.message}`);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const res = await api(`/usuarios`, { auth: true });
      setUsuarios(res);
      setFilteredUsuarios(res);
    } catch (err) {
      toast.error(
        `Error cargando usuarios: ${err.response?.data || err.message}`
      );
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value.toLowerCase();
    setSearch(value);

    if (!value) {
      setFilteredUsuarios(usuarios);
      return;
    }

    const filtrados = usuarios.filter((u) => {
      const nombre = u.nombre?.toLowerCase() || "";
      const email = u.email?.toLowerCase() || "";
      const role = roles?.find((r) => r.id === u.role_id);
      const rol = role ? role.name.toLowerCase() : "";
      const estado = u.activo ? "activo" : "inactivo";
      return (
        nombre.includes(value) ||
        email.includes(value) ||
        rol.includes(value) ||
        estado.includes(value)
      );
    });

    setFilteredUsuarios(filtrados);
  };

  const handleDelete = async (id) => {
    const seguro = window.confirm(
      "¿Estás seguro de que deseas eliminar este usuario?"
    );
    if (!seguro) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("No hay token en localStorage. No se puede eliminar.");
      return;
    }

    try {
      await api(`/usuarios/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast.success("Usuario eliminado con éxito.");
      fetchUsuarios();
    } catch (err) {
      toast.error(`Error al eliminar: ${err.response?.data || err.message}`);
    }
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const columns = [
    { header: renderHeader("ID", "id"), accessor: "id" },
    { header: renderHeader("Nombre", "nombre"), accessor: "nombre" },
    { header: renderHeader("Email", "email"), accessor: "email" },
    {
      header: renderHeader("Rol", "rol_nombre"),
      accessor: "role_id",
      Cell: ({ row }) => {
        const role = roles?.find((r) => r.id === row.role_id);
        const roleName = role ? role.name : "Sin rol";
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              role ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
            }`}
          >
            {roleName}
          </span>
        );
      },
    },
    {
      header: renderHeader("Estado", "activo"),
      accessor: "activo",
      Cell: ({ value }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {value ? "Activo" : "Inactivo"}
        </span>
      ),
    },
  ];

  const totalPages = Math.ceil((filteredUsuarios?.length || 0) / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData =
    filteredUsuarios?.slice(startIndex, startIndex + rowsPerPage) || [];

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Usuarios/${row.id}`)}
        tooltipText="Ver detalle"
      />
      <EditButton
        onClick={() => navigate(`/Usuarios/${row.id}/edit`)}
        tooltipText="Editar Usuario"
      />
      <button
        onClick={() => navigate(`/Usuarios/${row.id}/Contrasena`)}
        className="text-gray-400 hover:text-blue-500"
        title="Cambiar contraseña"
      >
        <FiKey className="w-5 h-5" />
      </button>

      <TrashButton
        onClick={() => handleDelete(row.id)} // ✅ ahora pregunta antes de eliminar y manda DELETE
        tooltipText="Eliminar Usuario"
      />
    </div>
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Usuarios</h1>
        <button
          onClick={() => navigate("/Usuarios/add")}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          Agregar Usuario
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector
          onRowsChange={handleRowsChange}
          value={rowsPerPage}
        />
        <input
          type="text"
          placeholder="Buscar por nombre, email o estado..."
          value={search}
          onChange={handleSearchChange}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-72"
        />
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
