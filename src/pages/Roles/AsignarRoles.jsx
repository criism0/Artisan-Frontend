import { useState, useEffect } from 'react';
import DataTable from '../../components/Tables/DataTable';
import { useApi } from '../../lib/api';
import { Spinner } from "../../components/UI/Spinner.jsx";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from '../../services/scopeCheck.js';

export default function AsignarRoles() {
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tempRoleChanges, setTempRoleChanges] = useState({}); // Para guardar cambios temporales
  const apiFetch = useApi();

  const canReadRoles = checkScope(ModelType.ROLE, ScopeType.READ);

  const roleNameFor = (roleId) => {
    const currentRole = roles.find(role => role.id === roleId);
    return currentRole ? currentRole.name : 'Sin rol asignado';
  };

  const columns = [
    { header: "Nombre", accessor: "nombre", sortable: true },
    { header: "Email", accessor: "email", sortable: true },
    {
      header: "Rol Actual",
      accessor: "rol_nombre",
      sortable: true,
      sortValue: (row) => roleNameFor(row.role_id),
      Cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          row.role_id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {roleNameFor(row.role_id)}
        </span>
      )
    },
    {
      header: "Cambiar Rol",
      accessor: "role_id",
      Cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          <select
            value={tempRoleChanges[row.id] !== undefined ? tempRoleChanges[row.id] : (row.role_id || '')}
            onChange={(e) => handleTempRoleChange(row.id, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Sin rol</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleApplyRoleChange(row.id)}
            disabled={tempRoleChanges[row.id] === undefined}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Cambiar
          </button>
        </div>
      )
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadRoles) {
        toast.permissionError(
          [ModelType.ROLE, ScopeType.READ]
        );
        setIsFetching(false);
        return;
      }
      try {
        setIsFetching(true);
        // Fetch usuarios
        const usuariosResponse = await apiFetch(`/usuarios`);
        const usuariosData = Array.isArray(usuariosResponse) ? usuariosResponse.map(usuario => ({
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          role_id: usuario.role_id
        })) : [];

        // Fetch roles
        const rolesResponse = await apiFetch(`/roles`);
        const rolesData = Array.isArray(rolesResponse) ? rolesResponse : [];

        setUsuarios(usuariosData);
        setRoles(rolesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [canReadRoles]);

  // Función para manejar cambios temporales en el select
  const handleTempRoleChange = (usuarioId, newRoleId) => {
    const roleId = newRoleId ? parseInt(newRoleId) : '';
    setTempRoleChanges(prev => ({
      ...prev,
      [usuarioId]: roleId
    }));
  };

  // Función para aplicar el cambio de rol
  const handleApplyRoleChange = async (usuarioId) => {
    try {
      setIsLoading(true);
      const newRoleId = tempRoleChanges[usuarioId];
      const roleId = newRoleId ? parseInt(newRoleId) : null;

      await apiFetch(`/usuarios/${usuarioId}`, {
        method: 'PUT',
        body: JSON.stringify({
          role_id: roleId
        })
      });

      // Update local state
      setUsuarios(prev => prev.map(usuario =>
        usuario.id === usuarioId
          ? { ...usuario, role_id: roleId }
          : usuario
      ));

      // Limpiar el cambio temporal
      setTempRoleChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[usuarioId];
        return newChanges;
      });

      toast.success("Rol actualizado correctamente");

    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Error al actualizar el rol del usuario");
    } finally {
      setIsLoading(false);
    }
  };

  const getSearchText = (usuario) =>
    [usuario.nombre, usuario.email, roleNameFor(usuario.role_id)].join(" ");

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <Spinner/>
        </div>
      )}

      <DataTable
        title="Asignar Roles a Usuarios"
        data={usuarios}
        columns={columns}
        getSearchText={getSearchText}
        loading={isFetching}
        loadingMessage="Cargando usuarios"
        emptyMessage="No hay usuarios registrados."
      />
    </>
  );
}
