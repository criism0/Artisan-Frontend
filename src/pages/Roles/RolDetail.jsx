import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton, EditButton } from '../../components/Buttons/ActionButtons';
import { useApi } from '../../lib/api';

export default function RolDetail() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  useEffect(() => {
    const fetchRole = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/roles/${id}`);
        setRole(response);
      } catch (error) {
        console.error("Error fetching role:", error);
        setError("Error al cargar el rol");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRole();
    }
  }, [id]);


  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando rol...</p>
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || "Rol no encontrado"}</p>
          <BackButton to="/Roles" label="Volver a Roles" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Detalle del Rol</h1>
          <p className="text-gray-600 mt-1">Información completa del rol y sus permisos</p>
        </div>
        <div className="flex gap-2">
          <EditButton 
            onClick={() => navigate(`/Roles/${id}/edit`)} 
            tooltipText="Editar Rol" 
          />
        </div>
      </div>

      {/* Back button */}
      <div className="mb-6">
        <BackButton to="/Roles" label="Volver a Roles" />
      </div>

      {/* Role Information */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Información del Rol</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ID</label>
            <p className="mt-1 text-sm text-gray-900">{role.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <p className="mt-1 text-sm text-gray-900">{role.name}</p>
          </div>
        </div>
      </div>

      {/* Scopes */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Scopes Asignados</h2>
        {role.scopes && role.scopes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {role.scopes.map((scope) => (
              <div key={scope.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{scope.model_type} - {scope.scope_type}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    scope.scope_type === 'Read' ? 'bg-green-100 text-green-800' :
                    scope.scope_type === 'Write' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {scope.scope_type}
                  </span>
                </div>
                {scope.description && (
                  <p className="text-sm text-gray-600">{scope.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Este rol no tiene scopes asignados</p>
        )}
      </div>
    </div>
  );
}
