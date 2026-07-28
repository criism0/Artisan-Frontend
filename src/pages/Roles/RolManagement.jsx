import { useState, useEffect, useRef } from 'react';
import DataTable from '../../components/Tables/DataTable';
import { ViewDetailButton, EditButton } from '../../components/Buttons/ActionButtons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApi } from '../../lib/api';
import { translateScopeType, translateModelType } from '../../utils/permissionUtils';
import {Spinner} from "../../components/UI/Spinner.jsx";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from '../../services/scopeCheck.js';
import { PageLoader } from '../../components/UI/PageLoader.jsx';

const MAX_ROWS = 4;
const BADGES_PER_ROW = 4;
const ALL_SCOPES = ['read', 'write', 'delete'];

function ScopesBadges({ scopes }) {
  if (!scopes || scopes.length === 0)
    return <span className="text-gray-500 text-sm">Sin scopes</span>;

  const grouped = scopes.reduce((acc, scope) => {
    if (!acc[scope.model_type]) acc[scope.model_type] = [];
    acc[scope.model_type].push(scope.scope_type);
    return acc;
  }, {});

  const badges = Object.entries(grouped).map(([model, types]) => ({
    model,
    label: ALL_SCOPES.every(s => types.includes(s)) ? 'Todos' : types.map(translateScopeType).join(', '),
  }));

  const rows = [];

  for (let row = 0; row < MAX_ROWS; row++) {
    const start = row * BADGES_PER_ROW;
    const isLastRow = row === MAX_ROWS-1;
    const hasHidden = badges.length > MAX_ROWS * BADGES_PER_ROW;
    const end = isLastRow && hasHidden ? start + BADGES_PER_ROW-1 : start + BADGES_PER_ROW;
    const rowBadges = badges.slice(start, end);
    if (rowBadges.length === 0) break;
    
    const totalHidden = badges.length - end;
    const hiddenNames = badges.slice(end).map(b => translateModelType(b.model)).join(', ');

    rows.push(
      <div key={row} className="flex gap-1 mb-0.5">
        {rowBadges.map(b => (
          <span key={b.model} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full whitespace-nowrap">
            {translateModelType(b.model)}: {b.label}
          </span>
        ))}
        {isLastRow && totalHidden > 0 && (
          <span
            className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full cursor-default"
            title={hiddenNames}
          >
            +{totalHidden} más
          </span>
        )}
      </div>
    );
  }
  return <div>{rows}</div>;
}

export default function RolManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState(true);
  const [isScopesLoading, setIsScopesLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [modalClosed, setModalClosed] = useState(false);
  const [scopeSearch, setScopeSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    scopes: []
  });
  const sortedModelOrderRef = useRef([]);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const apiFetch = useApi();

  const canReadRoles = checkScope(ModelType.ROLE, ScopeType.READ);
  const canWriteRoles = checkScope(ModelType.ROLE, ScopeType.READ);

  const columns = [
    { header: "Nombre", accessor: "name", sortable: true },
    {
      header: "Scopes",
      accessor: "scopes",
      Cell: ({ value }) => <ScopesBadges scopes={value} />
    },
  ];

  useEffect(() => {
    const fetchRoles = async () => {
      if (!canReadRoles) {
        toast.permissionError([ModelType.ROLE, ScopeType.READ]);
        setIsRolesLoading(false);
        return;
      }
      try {
        setIsRolesLoading(true);

        const response = await apiFetch(`/roles`);
        const rolesData = Array.isArray(response) ? response.map(rol => ({
          id: rol.id,
          name: rol.name,
          scopes: rol.scopes || []
        })) : [];
        setRoles(rolesData);
      } catch (error) {
        toast.error(`Error fetching roles: ${error.message}`);
        console.error("Error fetching roles:", error);
      } finally {
        setIsRolesLoading(false);
      }
    };

    const fetchScopes = async () => {
      try {
        setIsScopesLoading(true);

        const response = await apiFetch(`/scopes`);
        setScopes(response || []);
      } catch (error) {
        toast.error(`Error fetching scopes: ${error.message}`);
        console.error("Error fetching scopes:", error);
      } finally {
        setIsScopesLoading(false);
      }
    };

    fetchRoles();
    fetchScopes();
  }, [canReadRoles]);

  const computeModelOrder = (allScopes, selectedScopeIds) => {
    const grouped = allScopes.reduce((acc, scope) => {
      if (!acc[scope.model_type]) acc[scope.model_type] = [];
      acc[scope.model_type].push(scope);
      return acc;
    }, {});

    const withPerms = Object.keys(grouped).filter(mt =>
      grouped[mt].some(s => selectedScopeIds.includes(s.id))
    );
    const withoutPerms = Object.keys(grouped).filter(mt =>
      !grouped[mt].some(s => selectedScopeIds.includes(s.id))
    );

    return [...withPerms, ...withoutPerms];
  };

  useEffect(() => {
    setModalClosed(false);
    if (location.pathname.endsWith('/add')) {
      setEditingRole(null);
      setFormData({
        name: '',
        scopes: []
      });
      setScopeSearch('');
      sortedModelOrderRef.current = computeModelOrder(scopes, []);
      setShowModal(true);
    } else if (id && location.pathname.includes('/edit')) {
      const role = roles.find(r => r.id === parseInt(id));
      if (role) {
        setEditingRole(role);
        const initialScopeIds = role.scopes && Array.isArray(role.scopes) 
          ? role.scopes.map(scope => scope.id)
          : [];
        setFormData({
          name: role.name,
          scopes: initialScopeIds
        });
        setScopeSearch('');
        sortedModelOrderRef.current = computeModelOrder(scopes, initialScopeIds);
        setShowModal(true);
      }
    }
  }, [location.pathname, id]);

  useEffect(() => {
    if (id && location.pathname.includes('/edit') && !modalClosed) {
      const role = roles.find(r => r.id === parseInt(id));
      if (role) {
        setEditingRole(role);
        const initialScopeIds = role.scopes && Array.isArray(role.scopes) 
          ? role.scopes.map(scope => scope.id) 
          : [];
        setFormData({
          name: role.name,
          scopes: initialScopeIds
        });
        sortedModelOrderRef.current = computeModelOrder(scopes, initialScopeIds);
      }
    }
  }, [roles]);

  const getSearchText = (rol) =>
    [rol.name, ...(rol.scopes || []).map((s) => s.model_type)].join(" ");

  const handleScopeToggle = (scopeId) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scopeId)
        ? prev.scopes.filter(id => id !== scopeId)
        : [...prev.scopes, scopeId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canReadRoles || !canWriteRoles) {
      toast.permissionError([ModelType.ROLE, [ScopeType.READ, ScopeType.WRITE]]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);

      const roleData = {
        name: formData.name,
        scopes: formData.scopes
      };

      if (editingRole) {
        await apiFetch(`/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(roleData)
        });
      } else {
        await apiFetch(`/roles`, {
          method: 'POST',
          body: JSON.stringify(roleData)
        });
      }

      const response = await apiFetch(`/roles`);
      const rolesData = Array.isArray(response) ? response.map(rol => ({
        id: rol.id,
        name: rol.name,
        scopes: rol.scopes || []
      })) : [];
      setRoles(rolesData);

      setModalClosed(true);
      setShowModal(false);
      toast.success(editingRole ? '¡Cambios guardados exitosamente!' : '¡Rol creado exitosamente!');      
      navigate('/Roles');
    } catch (error) {
      console.error("Error saving role:", error);
      toast.error("Error al guardar el rol");
      setModalClosed(true);
      setShowModal(false);
      navigate('/Roles');
    } finally {
      setIsLoading(false);
      setScopeSearch('');
    }
  };


  const handleCloseModal = () => {
    setModalClosed(true);
    setShowModal(false);
    setScopeSearch('');
    navigate('/Roles');
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Roles/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Roles/${row.id}/edit`)} tooltipText="Editar Rol" />
    </div>
  );

  const normalize = (str) => str.replace(/\s+/g, '').toLowerCase();

  const groupedScopes = scopes.reduce((acc, scope) => {
    if (!acc[scope.model_type]) acc[scope.model_type] = [];
    acc[scope.model_type].push(scope);
    return acc;
  }, {});

  const searchTerm = normalize(scopeSearch);
  const filteredModelEntries = sortedModelOrderRef.current
    .filter(mt => normalize(mt).includes(searchTerm))
    .map(mt => [mt, groupedScopes[mt]]);

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <Spinner/>
        </div>
      )}

      <DataTable
        title="Gestión de Roles"
        data={roles}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        loading={isRolesLoading || isScopesLoading}
        loadingMessage="Cargando Roles"
        emptyMessage="No hay roles registrados."
        headerActions={
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate('/Roles/add')}
          >
            Añadir Rol
          </button>
        }
      />

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Nombre del Rol</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Scopes</label>
                <div className="mt-2">
                  {scopes.length > 0 ? (
                    <>
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Buscar modelo"
                          value={scopeSearch}
                          onChange={(e) => setScopeSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredModelEntries.length === 0 ? (
                          <div className="text-center text-gray-500 py-4 text-sm">No se encontraron modelos</div>
                        ) : (
                          filteredModelEntries.map(([modelType, modelScopes]) => (
                            <div key={modelType} className="mb-4 border border-gray-200 rounded-lg p-3">
                              <h4 className="text-sm font-semibold text-gray-800 mb-2">{translateModelType(modelType)}</h4>
                              <div className="space-y-2">
                                {modelScopes.map((scope) => (
                                  <label key={scope.id} className="flex items-start space-x-3 p-2 border border-gray-100 rounded hover:bg-gray-50">
                                    <input
                                      type="checkbox"
                                      checked={formData.scopes.includes(scope.id)}
                                      onChange={() => handleScopeToggle(scope.id)}
                                      className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <div className="flex flex-col flex-1">
                                      <span className="text-sm font-medium text-gray-700">
                                        {translateScopeType(scope.scope_type)}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {scope.description}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No hay scopes disponibles
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  {editingRole ? 'Guardar Cambios' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}