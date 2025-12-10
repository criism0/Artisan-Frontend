import { useState, useEffect } from 'react';
import Table from '../../components/Table';
import SearchBar from '../../components/SearchBar';
import RowsPerPageSelector from '../../components/RowsPerPageSelector';
import Pagination from '../../components/Pagination';
import { ViewDetailButton, EditButton } from '../../components/Buttons/ActionButtons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApi } from '../../lib/api';
import { toast, ToastContainer, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { translateScopeType, translateModelType } from './permissionUtils';

export default function RolManagement() {
  const [roles, setRoles] = useState([]);
  const [filteredRoles, setFilteredRoles] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [modalClosed, setModalClosed] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    scopes: []
  });
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const apiFetch = useApi();
  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "name" },
    { 
      header: "Scopes", 
      accessor: "scopes",
      Cell: ({ value }) => (
        <div className="flex flex-wrap gap-1">
          {value && value.length > 0 ? (
            value.map((scope, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                {translateModelType(scope.model_type)} - {translateScopeType(scope.scope_type)}
              </span>
            ))
          ) : (
            <span className="text-gray-500 text-sm">Sin scopes</span>
          )}
        </div>
      )
    },
  ];

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await apiFetch(`/roles`);
        const rolesData = Array.isArray(response) ? response.map(rol => ({
          id: rol.id,
          name: rol.name,
          scopes: rol.scopes || []
        })) : [];
        setRoles(rolesData);
        setFilteredRoles(rolesData);
      } catch (error) {
        console.error("Error fetching roles:", error);
      }
    };

    const fetchScopes = async () => {
      try {
        const response = await apiFetch(`/scopes`);
        setScopes(response || []);
      } catch (error) {
        console.error("Error fetching scopes:", error);
      }
    };

    fetchRoles();
    fetchScopes();
  }, []);

  useEffect(() => {
    setModalClosed(false);
    if (location.pathname.endsWith('/add')) {
      setEditingRole(null);
      setFormData({
        name: '',
        scopes: []
      });
      setShowModal(true);
    } else if (id && location.pathname.includes('/edit')) {
      const role = roles.find(r => r.id === parseInt(id));
      if (role) {
        setEditingRole(role);
        setFormData({
          name: role.name,
          scopes: role.scopes && Array.isArray(role.scopes) ? role.scopes.map(scope => scope.id) : []
        });
        setShowModal(true);
      }
    }
  }, [location.pathname, id]);

  useEffect(() => {
    if (id && location.pathname.includes('/edit') && !modalClosed) {
      const role = roles.find(r => r.id === parseInt(id));
      if (role) {
        setEditingRole(role);
        setFormData({
          name: role.name,
          scopes: role.scopes && Array.isArray(role.scopes) ? role.scopes.map(scope => scope.id) : []
        });
      }
    }
  }, [roles]);

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredRoles(roles);
      return;
    }
    const filtered = roles.filter(rol => {
      return Object.values(rol).some(value => {
        if (value !== null && value !== undefined) {
          return String(value).toLowerCase().includes(lowercasedQuery);
        }
        return false;
      });
    });
    setFilteredRoles(filtered);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

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
    try {
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
      setFilteredRoles(rolesData);

      setModalClosed(true);
      setShowModal(false);
      
      // Mostrar toast de éxito
      if (editingRole) {
        toast.success('¡Cambios guardados exitosamente!', {
          position: "top-left",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      } else {
        toast.success('¡Rol creado exitosamenete!', {
          position: "top-left",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      }
      
      navigate('/Roles');
      
    } catch (error) {
      console.error("Error saving role:", error);
      alert("Error al guardar el rol");
      setModalClosed(true);
      setShowModal(false);
      navigate('/Roles');
    }
  };


  const handleCloseModal = () => {
    setModalClosed(true);
    setShowModal(false);
    navigate('/Roles');
  };

  const totalPages = Math.ceil(filteredRoles.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredRoles.slice(startIndex, startIndex + rowsPerPage);

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Roles/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Roles/${row.id}/edit`)} tooltipText="Editar Rol" />
    </div>
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Gestión de Roles</h1>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} value={rowsPerPage} />
        <SearchBar onSearch={handleSearch} />
      </div>

      <Table columns={columns} data={paginatedData} actions={actions} />

      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate('/Roles/add')}
        >
          Añadir Rol
        </button>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>

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
                <div className="mt-2 max-h-60 overflow-y-auto">
                  {scopes.length > 0 ? (
                    (() => {
                      // Agrupar scopes por model_type
                      const groupedScopes = scopes.reduce((acc, scope) => {
                        if (!acc[scope.model_type]) {
                          acc[scope.model_type] = [];
                        }
                        acc[scope.model_type].push(scope);
                        return acc;
                      }, {});

                      return Object.entries(groupedScopes).map(([modelType, modelScopes]) => (
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
                      ));
                    })()
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
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-hover"
                >
                  {editingRole ? 'Guardar Cambios' : 'Crear Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ToastContainer
        position="top-left"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
    </div>
  );
}