import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import MultiSelectInput from '../../components/MultiSelectInput';
import InsumosTable from '../../components/InsumosTable';
import Selector from '../../components/Selector';
import { FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../../components/Buttons/ActionButtons';
import { useApi } from '../../lib/api';
import { toast } from 'react-toastify';

export default function AddSolicitud() {
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDestino, setSelectedDestino] = useState('');
  const [selectedOrigen, setSelectedOrigen] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addSignal, setAddSignal] = useState(0);
  const [hasStock, setHasStock] = useState(false);
  const navigate = useNavigate();
  const api = useApi();

  // Limpiar insumos al cambiar la bodega de origen
  useEffect(() => {
    setInsumosSeleccionados([]);
  }, [selectedOrigen]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api(`/usuarios`);
        const usersData = response.map(usuario => ({
          id: usuario.id,
          label: usuario.nombre,
          email: usuario.email
        }));
        setUsers(usersData);
      } catch {
        toast.error('Error al cargar usuarios');
      }
    };

    const fetchBodegas = async () => {
      try {
        const response = await api(`/bodegas`);
        const bodegasArray = Array.isArray(response) ? response : response.bodegas;
        const bodegasData = bodegasArray
          .filter(bodega => bodega?.nombre.toLowerCase() !== 'en tránsito')
          .map(bodega => ({
            value: bodega.id.toString(),
            label: bodega.nombre,
            encargados: bodega.Encargados || [],
          }));
        setBodegas(bodegasData);

        // Cargar por default la bodega del usuario si tiene asignada alguna
        if (user?.id) {
          const userIdNum = Number(user.id);
          const bodegasDelUsuario = bodegasData.filter(bodega =>
            (bodega.encargados || []).some(enc => Number(enc.id_usuario) === userIdNum)
          );
          if (bodegasDelUsuario.length > 0) {
            setSelectedDestino(bodegasDelUsuario[0].value);
          }
        }
      } catch (err) {
        toast.error(err.message || 'Error al cargar bodegas');
      }
    };

    fetchUsers();
    fetchBodegas();
  }, []);

  // IDs priorizados: encargados de la bodega proveedora (selectedOrigen)
  const priorityUserIds = useMemo(() => {
    const bodega = bodegas.find(b => b.value === selectedOrigen);
    if (!bodega || !Array.isArray(bodega.encargados)) return [];
    return bodega.encargados
      .map((e) => (e?.id_usuario != null ? Number(e.id_usuario) : null))
      .filter((v) => v != null);
  }, [bodegas, selectedOrigen]);

  const computeErrors = () => {
    const newErrors = {};
    if (!selectedOrigen) newErrors.origen = 'Debe seleccionar una bodega de origen';
    if (!selectedDestino) newErrors.destino = 'Debe seleccionar una bodega de destino';
    else if (selectedOrigen === selectedDestino) newErrors.destino = 'La bodega de destino debe ser diferente a la de origen';
    if (!insumosSeleccionados || insumosSeleccionados.length === 0) newErrors.insumos = 'Debe agregar al menos un insumo';
    if (selectedUsers.length === 0) newErrors.usuarios = 'Debe seleccionar al menos un usuario para notificar';
    return newErrors;
  };

  const errors = useMemo(() => computeErrors(), [selectedOrigen, selectedDestino, insumosSeleccionados, selectedUsers]);
  const isFormReady = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const validateForm = () => {
    if (!isFormReady) {
      setShowErrors(true);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const solicitudData = {
        id_bodega_proveedora: parseInt(selectedOrigen),
        id_bodega_solicitante: parseInt(selectedDestino),
        materias_primas: insumosSeleccionados.map(insumo => ({
          id_materia_prima: parseInt(insumo.id_articulo),
          cantidad_solicitada: Number(insumo.cantidad_solicitada),
          comentario: insumo.comentario || ''
        })),
        notificaciones: selectedUsers.map(user => user.email)
      };

      await api(`/solicitudes-mercaderia`, {
        method: 'POST',
        body: JSON.stringify(solicitudData)
      });
      toast.success('Solicitud creada exitosamente');
      navigate('/Solicitudes');
    } catch (err) {
      console.error('Error al crear la solicitud:', err);
      toast.error(err.message || 'Error al crear la solicitud. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Precargar encargados de la bodega proveedora en las selecciones
  const handleAddEncargados = () => {
    if (!priorityUserIds || priorityUserIds.length === 0) return;
    const existingIds = new Set(selectedUsers.map(u => u.id));
    const encargados = users.filter(u => priorityUserIds.includes(u.id));
    const toAdd = encargados.filter(u => !existingIds.has(u.id));
    if (toAdd.length === 0) return;
    setSelectedUsers([...selectedUsers, ...toAdd]);
  };

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <BackButton label="Volver" />
      </div>
      <h2 className="text-xl font-bold mb-4">Nueva Solicitud</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          {/* Origen y destino */}
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bodega Proveedora</label>
              <Selector
                options={bodegas}
                selectedValue={selectedOrigen}
                onSelect={setSelectedOrigen}
                className={`w-full px-3 py-2 border ${showErrors && errors.origen ? 'border-red-500' : 'border-gray-300'} rounded-md`}
              />
              {showErrors && errors.origen && <p className="mt-1 text-sm text-red-500">{errors.origen}</p>}
            </div>
            <div className="flex items-center justify-center text-primary">
              <FiArrowRight className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bodega Destino</label>
              <Selector
                options={bodegas}
                selectedValue={selectedDestino}
                onSelect={setSelectedDestino}
                className={`w-full px-3 py-2 border ${((showErrors && errors.destino) || (selectedOrigen && selectedDestino && selectedOrigen === selectedDestino)) ? 'border-red-500' : 'border-gray-300'} rounded-md`}
              />
              {(
                (showErrors && errors.destino) || (selectedOrigen && selectedDestino && selectedOrigen === selectedDestino)
              ) && (
                <p className="mt-1 text-sm text-red-500">
                  {selectedOrigen && selectedDestino && selectedOrigen === selectedDestino
                    ? 'La bodega de destino debe ser diferente a la de origen'
                    : errors.destino}
                </p>
              )}
            </div>
            
          </div>

          {/* Usuarios */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Personas a notificar
              </label>
              <button
                type="button"
                onClick={handleAddEncargados}
                disabled={!priorityUserIds || priorityUserIds.length === 0}
                className={`text-sm ${(!priorityUserIds || priorityUserIds.length === 0) ? 'text-gray-400 cursor-not-allowed' : 'text-primary hover:underline'}`}
                title={(!priorityUserIds || priorityUserIds.length === 0) ? 'No hay encargados para la bodega seleccionada' : 'Agregar encargados de la bodega proveedora'}
              >
                Agregar encargados de bodega proveedora
              </button>
            </div>
            <MultiSelectInput
              options={users}
              selected={selectedUsers}
              onSelectionChange={setSelectedUsers}
              placeholder="Buscar personas por nombre o correo..."
              label=""
              error={showErrors ? errors.usuarios : null}
              priorityIds={priorityUserIds}
            />
          </div>

          {/* Insumos */}
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Insumos a Solicitar</h3>
            </div>
            <InsumosTable
              onInsumosChange={setInsumosSeleccionados}
              disabled={!selectedOrigen || !selectedDestino}
              bodegaId={selectedOrigen}
              bodegaSolicitanteId={selectedDestino}
              addSignal={addSignal}
              onAvailabilityChange={setHasStock}
            />
            {selectedOrigen && selectedDestino && showErrors && errors.insumos && (
              <p className="mt-2 text-sm text-red-500">{errors.insumos}</p>
            )}
          </div>

          {/* Botón */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAddSignal((n) => n + 1)}
                disabled={!selectedOrigen || !selectedDestino || !hasStock}
                title={!selectedOrigen || !selectedDestino ? 'Selecciona ambas bodegas para agregar insumos' : (!hasStock ? 'No hay insumos disponibles en la bodega seleccionada' : undefined)}
                className={`px-4 py-2 rounded-lg transition-colors ${(!selectedOrigen || !selectedDestino || !hasStock) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-hover'}`}
              >
                Añadir Insumo
              </button>
              {(!selectedOrigen || !selectedDestino) && (
                <span className="text-sm text-gray-500">Selecciona ambas bodegas para agregar insumos.</span>
              )}
              {(selectedOrigen && selectedDestino && !hasStock) && (
                <span className="text-sm text-gray-500">No hay insumos disponibles en la bodega seleccionada.</span>
              )}
            </div>

            <div>
              <button
                onClick={handleSubmit}
                disabled={loading || !isFormReady}
                title={!isFormReady ? 'Completa todos los campos requeridos para solicitar' : undefined}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Creando...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
