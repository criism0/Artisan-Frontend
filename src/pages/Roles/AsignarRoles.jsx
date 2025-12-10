import { useState, useEffect } from 'react';
import Table from '../../components/Table';
import SearchBar from '../../components/SearchBar';
import RowsPerPageSelector from '../../components/RowsPerPageSelector';
import Pagination from '../../components/Pagination';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/api';

export default function AsignarRoles() {
  const [usuarios, setUsuarios] = useState([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [tempRoleChanges, setTempRoleChanges] = useState({}); // Para guardar cambios temporales
  const navigate = useNavigate();
  const apiFetch = useApi();
  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "nombre" },
    { header: "Email", accessor: "email" },
    { 
      header: "Rol Actual", 
      accessor: "rol_nombre",
      Cell: ({ row }) => {
        const currentRole = roles.find(role => role.id === row.role_id);
        const roleName = currentRole ? currentRole.name : 'Sin rol asignado';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            row.role_id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {roleName}
          </span>
        );
      }
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
      try {
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
        setFilteredUsuarios(usuariosData);
        setRoles(rolesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

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

      setFilteredUsuarios(prev => prev.map(usuario => 
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

      alert("Rol actualizado correctamente");

    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Error al actualizar el rol del usuario");
    }
  };

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredUsuarios(usuarios);
      return;
    }
    const filtered = usuarios.filter(usuario => {
      return Object.values(usuario).some(value => {
        if (value !== null && value !== undefined) {
          return String(value).toLowerCase().includes(lowercasedQuery);
        }
        return false;
      });
    });
    setFilteredUsuarios(filtered);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(filteredUsuarios.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredUsuarios.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Asignar Roles a Usuarios</h1>
      </div>

      {/* Barra de búsqueda y selector */}
      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} value={rowsPerPage} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Tabla */}
      <Table columns={columns} data={paginatedData} />

      {/* Paginación */}
      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
