import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import MultiSelectInput from '../../components/Forms/MultiSelectInput';
import InsumosTable from '../../components/Insumos/InsumosTable';
import ProductosTerminadosTable from '../../components/Solicitudes/ProductosTerminadosTable';
import ImportarDesdeOCModal from '../../components/ImportarDesdeOCModal';
import Selector from '../../components/Forms/Selector';
import { ArrowRight, Download } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/UI/PageHeader.jsx';
import { useApi } from '../../lib/api';
import { toast } from "../../lib/toast.js";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from '../../services/scopeCheck.js';
import { useEncargadosAutomaticos } from '../../hooks/useEncargadosAutomaticos.js';

export default function AddSolicitud() {
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDestino, setSelectedDestino] = useState('');
  const [selectedOrigen, setSelectedOrigen] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addSignal, setAddSignal] = useState(0);
  const [canAddMoreInsumos, setCanAddMoreInsumos] = useState(false);
  const [showImportOC, setShowImportOC] = useState(false);
  const [importInsumos, setImportInsumos] = useState(null);
  const [importSignal, setImportSignal] = useState(0);
  const navigate = useNavigate();
  const api = useApi();

  const canWriteMerchRequest = checkScope(ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE);

  useEncargadosAutomaticos({
    bodegas,
    usuarios: users,
    origen: selectedOrigen,
    destino: selectedDestino,
    setSeleccion: setSelectedUsers,
  });

  // Limpiar insumos/productos al cambiar la bodega de origen
  useEffect(() => {
    setInsumosSeleccionados([]);
    setProductosSeleccionados([]);
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
    if ((insumosSeleccionados?.length ?? 0) === 0 && (productosSeleccionados?.length ?? 0) === 0)
      newErrors.insumos = 'Debe agregar al menos un insumo o producto terminado';
    if (selectedUsers.length === 0) newErrors.usuarios = 'Agrega al menos una persona a notificar';
    return newErrors;
  };

  const errors = useMemo(() => computeErrors(), [selectedOrigen, selectedDestino, insumosSeleccionados, productosSeleccionados, selectedUsers]);
  const isFormReady = useMemo(() => Object.keys(errors).length === 0, [errors]);

  // El botón no se deshabilita por lo que falta: con el botón gris no había cómo saber QUÉ faltaba
  // (sólo un `title` al pasar el mouse) y el aviso rojo de stock parecía ser la causa. Al apretarlo,
  // el toast dice qué falta y los campos se marcan.
  const validateForm = () => {
    if (!isFormReady) {
      setShowErrors(true);
      toast.error(`No se pudo crear la solicitud: ${Object.values(errors).join(' · ')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!canWriteMerchRequest) {
      toast.permissionError([ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const solicitudData = {
        id_bodega_proveedora: parseInt(selectedOrigen),
        id_bodega_solicitante: parseInt(selectedDestino),
        // El array combina insumos (id_materia_prima) y productos terminados
        // por nombre de facturación (id_nombre_facturacion + cajas, M4).
        materias_primas: [
          ...insumosSeleccionados.map(insumo => ({
            id_materia_prima: parseInt(insumo.id_articulo),
            cantidad_solicitada: Number(insumo.cantidad_solicitada),
            comentario: insumo.comentario || ''
          })),
          ...productosSeleccionados.map(p => ({
            id_nombre_facturacion: p.id_nombre_facturacion,
            cantidad_solicitada: Number(p.cantidad_solicitada),
            producto_por_cajas: p.producto_por_cajas,
            cantidad_por_caja: p.cantidad_por_caja,
            comentario: p.comentario || ''
          })),
        ],
        notificaciones: selectedUsers.map(user => user.email)
      };

      await api(`/solicitudes-mercaderia`, {
        method: 'POST',
        body: JSON.stringify(solicitudData)
      });
      toast.success('Solicitud creada exitosamente');
      navigate('/logistica/solicitudes');
    } catch (err) {
      console.error('Error al crear la solicitud:', err);
      toast.error(err.message || 'Error al crear la solicitud. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromOC = (insumos, ocId) => {
    setImportInsumos(insumos);
    setImportSignal((n) => n + 1);
    setShowImportOC(false);
    toast.success(
      `${insumos.length} insumo${insumos.length === 1 ? '' : 's'} importado${insumos.length === 1 ? '' : 's'} desde OC-${String(ocId).padStart(3, '0')}. Revisa cantidades y disponibilidad antes de solicitar.`
    );
  };


  return (
    <div className="max-w-5xl mx-auto">
      {/* El overlay negro a pantalla completa desapareció: el resto de la app deshabilita
          los controles mientras guarda, y una cortina oscura sobre toda la vista para una
          espera de un segundo asusta más de lo que informa. */}
      <PageHeader volverA="/logistica/solicitudes" titulo="Nueva solicitud" />

      <div className="bg-white rounded-lg shadow p-6">
          {/* Origen y destino */}
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Desde</label>
              <Selector
                options={bodegas}
                selectedValue={selectedOrigen}
                onSelect={setSelectedOrigen}
                className={`w-full px-3 py-2 border ${showErrors && errors.origen ? 'border-red-500' : 'border-gray-300'} rounded-md`}
              />
              {showErrors && errors.origen && <p className="mt-1 text-sm text-red-500">{errors.origen}</p>}
            </div>
            <div className="flex items-center justify-center text-primary">
              <ArrowRight className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Hacia</label>
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

          {/* Insumos */}
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Insumos y PIP <span className="text-gray-400 font-normal">{insumosSeleccionados.length}</span></h3>
                {(selectedOrigen && selectedDestino && !canAddMoreInsumos) && (
                  <p className="mt-1 text-sm text-gray-500">No quedan insumos por agregar.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportOC(true)}
                  disabled={!selectedOrigen || !selectedDestino}
                  title={!selectedOrigen || !selectedDestino ? 'Selecciona ambas bodegas para importar insumos' : 'Precargar insumos y cantidades desde una orden de compra'}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border transition-colors ${(!selectedOrigen || !selectedDestino) ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-primary text-primary bg-white hover:bg-primary hover:text-white'}`}
                >
                  <Download className="w-4 h-4" />
                  Importar desde OC
                </button>
                <button
                  type="button"
                  onClick={() => setAddSignal((n) => n + 1)}
                  disabled={!selectedOrigen || !selectedDestino || !canAddMoreInsumos}
                  title={!selectedOrigen || !selectedDestino ? 'Selecciona ambas bodegas para agregar insumos' : (!canAddMoreInsumos ? 'No quedan insumos por agregar' : undefined)}
                  className={`px-4 py-2 rounded-lg transition-colors ${(!selectedOrigen || !selectedDestino || !canAddMoreInsumos) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-hover'}`}
                >
                  Añadir Insumo
                </button>
              </div>
            </div>
            <InsumosTable
              onInsumosChange={setInsumosSeleccionados}
              disabled={!selectedOrigen || !selectedDestino}
              bodegaId={selectedOrigen}
              bodegaSolicitanteId={selectedDestino}
              addSignal={addSignal}
              onAvailabilityChange={setCanAddMoreInsumos}
              importInsumos={importInsumos}
              importSignal={importSignal}
            />
            {selectedOrigen && selectedDestino && showErrors && errors.insumos && (
              <p className="mt-2 text-sm text-red-500">{errors.insumos}</p>
            )}
          </div>

          {/* Productos terminados (B4) */}
          <div className="mt-8">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Productos terminados <span className="text-gray-400 font-normal">{productosSeleccionados.length}</span></h3>
            </div>
            <ProductosTerminadosTable
              bodegaId={selectedOrigen}
              disabled={!selectedOrigen || !selectedDestino}
              onChange={setProductosSeleccionados}
            />
          </div>

          {/* Avisar a: al final, después de lo que se pide. Los encargados de las dos bodegas se
              agregan solos (useEncargadosAutomaticos); se pueden quitar o sumar a otros. */}
          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avisar a <span className="text-xs font-normal text-gray-500">· se agregan solos los encargados de las dos bodegas</span>
            </label>
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

          {/* Botón */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
            <span className="text-sm text-gray-500">
              {insumosSeleccionados.length} insumo{insumosSeleccionados.length === 1 ? "" : "s"} · {productosSeleccionados.length} PT
            </span>
            {/* El botón se llama igual que lo que produce, como en el resto de la app:
                "Crear solicitud" → "Solicitud creada". "Solicitar" dejaba la duda de si
                creaba un borrador o mandaba algo. */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-primario"
            >
              {loading ? 'Creando…' : 'Crear solicitud'}
            </button>
          </div>
      </div>

      <ImportarDesdeOCModal
        open={showImportOC}
        onClose={() => setShowImportOC(false)}
        onImport={handleImportFromOC}
      />
    </div>
  );
}
