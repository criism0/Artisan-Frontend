import {
  ViewDetailButton,
  EditButton,
  TrashButton,
  WarehouseButton,
} from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { KeyRound } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const navigate = useNavigate();
  const api = useApi();

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const canReadRoles = checkScope(ModelType.ROLE, ScopeType.READ);

  const roleName = (row) => {
    const role = roles?.find((r) => r.id === row.role_id);
    return role ? role.name : "Sin rol";
  };

  const fetchRoles = async () => {
    if (!canReadRoles) {
      toast.permissionError([ModelType.ROLE, ScopeType.READ]);
      setLoadingRoles(false);
      return;
    }
    try {
      const res = await api(`/roles`, { auth: true });
      setRoles(res);
    } catch (err) {
      toast.error(`Error cargando roles: ${err.response?.data || err.message}`);
    } finally {
      setLoadingRoles(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const res = await api(`/usuarios`, { auth: true });
      setUsuarios(Array.isArray(res) ? res : []);
    } catch (err) {
      toast.error(
        `Error cargando usuarios: ${err.response?.data || err.message}`
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
  }, []);

  const handleDelete = async (id) => {
    try {
      await api(`/usuarios/${id}`, { method: "DELETE" });
      toast.success("Usuario eliminado con éxito.");
      fetchUsuarios();
    } catch (err) {
      toast.error(`Error al eliminar: ${err.response?.data || err.message}`);
    }
  };

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => <span className="font-medium">{value || "—"}</span>,
    },
    { header: "Email", accessor: "email", sortable: true },
    {
      header: "Rol",
      accessor: "role_id",
      sortable: true,
      sortValue: (row) => roleName(row),
      Cell: ({ row }) => {
        const role = roles?.find((r) => r.id === row.role_id);
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              role ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
            }`}
          >
            {roleName(row)}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: "activo",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.activo ? 1 : 0),
      Cell: ({ value }) => (
        <div className="flex justify-center">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {value ? "Activo" : "Inactivo"}
          </span>
        </div>
      ),
    },
  ];

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

      <WarehouseButton
        onClick={() => navigate(`/Usuarios/${row.id}/asignar-bodega`)}
        tooltipText="Asignar Bodega"
      />

      <button
        onClick={() => navigate(`/Usuarios/${row.id}/Contrasena`)}
        className="text-gray-400 hover:text-blue-500"
        title="Cambiar contraseña"
      >
        <KeyRound className="w-5 h-5" />
      </button>

      <TrashButton
        onConfirmDelete={() => handleDelete(row.id)}
        tooltipText="Eliminar Usuario"
        entityName={row.nombre || "Usuario"}
      />
    </div>
  );

  const getSearchText = (row) =>
    [row?.nombre, row?.email, roleName(row), row?.activo ? "activo" : "inactivo"]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Usuarios"
      data={usuarios}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      loading={loadingUsers || loadingRoles}
      loadingMessage="Cargando Usuarios"
      emptyMessage="No hay usuarios registrados."
      headerActions={
        <button
          onClick={() => navigate("/Usuarios/add")}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          Añadir Usuario
        </button>
      }
    />
  );
}
