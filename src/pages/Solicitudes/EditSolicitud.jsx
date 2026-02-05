import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { toast } from "react-toastify";

import { useAuth } from "../../auth/AuthContext";
import { BackButton } from "../../components/Buttons/ActionButtons";
import MultiSelectInput from "../../components/MultiSelectInput";
import InsumosTable from "../../components/InsumosTable";
import Selector from "../../components/Selector";
import { useApi } from "../../lib/api";

export default function EditSolicitud() {
  const { solicitudId } = useParams();
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const [solicitud, setSolicitud] = useState(null);

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedDestino, setSelectedDestino] = useState("");
  const [selectedOrigen, setSelectedOrigen] = useState("");
  const [bodegas, setBodegas] = useState([]);

  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addSignal, setAddSignal] = useState(0);
  const [canAddMoreInsumos, setCanAddMoreInsumos] = useState(false);

  const solicitudEditable = useMemo(() => String(solicitud?.estado || "") === "Creada", [solicitud]);

  const initialInsumos = useMemo(() => {
    const detalles = Array.isArray(solicitud?.detalles) ? solicitud.detalles : [];
    return detalles
      .map((d) => ({
        id_materia_prima: d?.materiaPrima?.id,
        cantidad_solicitada: d?.cantidad_solicitada,
        comentario: d?.comentario ?? "",
      }))
      .filter((x) => x?.id_materia_prima);
  }, [solicitud]);

  const fetchUsers = async () => {
    const response = await api(`/usuarios`);
    return (Array.isArray(response) ? response : []).map((usuario) => ({
      id: usuario.id,
      label: usuario.nombre,
      email: usuario.email,
    }));
  };

  const fetchBodegas = async () => {
    const response = await api(`/bodegas`);
    const bodegasArray = Array.isArray(response) ? response : response?.bodegas;
    return (Array.isArray(bodegasArray) ? bodegasArray : [])
      .filter((bodega) => bodega?.nombre?.toLowerCase?.() !== "en tránsito")
      .map((bodega) => ({
        value: bodega.id.toString(),
        label: bodega.nombre,
        encargados: bodega.Encargados || [],
      }));
  };

  const fetchSolicitud = async () => {
    const res = await api(`/solicitudes-mercaderia/${solicitudId}`);
    return res;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setShowErrors(false);

        const [usersData, bodegasData, solicitudData] = await Promise.all([
          fetchUsers(),
          fetchBodegas(),
          fetchSolicitud(),
        ]);

        setUsers(usersData);
        setBodegas(bodegasData);
        setSolicitud(solicitudData);

        const origenId =
          solicitudData?.id_bodega_proveedora ?? solicitudData?.bodegaProveedora?.id ?? "";
        const destinoId =
          solicitudData?.id_bodega_solicitante ?? solicitudData?.bodegaSolicitante?.id ?? "";

        setSelectedOrigen(origenId ? String(origenId) : "");
        setSelectedDestino(destinoId ? String(destinoId) : "");

        const notifEmails = Array.isArray(solicitudData?.notificaciones) ? solicitudData.notificaciones : [];
        if (notifEmails.length > 0) {
          const setEmails = new Set(notifEmails.map((e) => String(e).toLowerCase()));
          const preselected = usersData.filter((u) => setEmails.has(String(u.email || "").toLowerCase()));
          setSelectedUsers(preselected);
        } else {
          // fallback: si no hay notificaciones guardadas, no preselecciona.
          setSelectedUsers([]);
        }
      } catch (err) {
        console.error("Error cargando datos de edición:", err);
        toast.error(err?.message || "Error al cargar la solicitud");
      } finally {
        setLoading(false);
      }
    };

    if (!solicitudId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  // IDs priorizados: encargados de la bodega proveedora (selectedOrigen)
  const priorityUserIds = useMemo(() => {
    const bodega = bodegas.find((b) => b.value === selectedOrigen);
    if (!bodega || !Array.isArray(bodega.encargados)) return [];
    return bodega.encargados
      .map((e) => (e?.id_usuario != null ? Number(e.id_usuario) : null))
      .filter((v) => v != null);
  }, [bodegas, selectedOrigen]);

  const handleAddEncargados = () => {
    if (!priorityUserIds || priorityUserIds.length === 0) return;
    const existingIds = new Set(selectedUsers.map((u) => u.id));
    const encargados = users.filter((u) => priorityUserIds.includes(u.id));
    const toAdd = encargados.filter((u) => !existingIds.has(u.id));
    if (toAdd.length === 0) return;
    setSelectedUsers([...selectedUsers, ...toAdd]);
  };

  const computeErrors = () => {
    const newErrors = {};
    if (!selectedOrigen) newErrors.origen = "Debe seleccionar una bodega de origen";
    if (!selectedDestino) newErrors.destino = "Debe seleccionar una bodega de destino";
    else if (selectedOrigen === selectedDestino)
      newErrors.destino = "La bodega de destino debe ser diferente a la de origen";
    if (!insumosSeleccionados || insumosSeleccionados.length === 0)
      newErrors.insumos = "Debe agregar al menos un insumo";
    if (selectedUsers.length === 0)
      newErrors.usuarios = "Debe seleccionar al menos un usuario para notificar";
    return newErrors;
  };

  const errors = useMemo(
    () => computeErrors(),
    [selectedOrigen, selectedDestino, insumosSeleccionados, selectedUsers]
  );
  const isFormReady = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const validateForm = () => {
    if (!isFormReady) {
      setShowErrors(true);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!solicitudEditable) {
      toast.error("Esta solicitud no se puede editar en su estado actual");
      return;
    }
    if (!validateForm()) return;

    setLoading(true);
    try {
      const solicitudData = {
        id_bodega_proveedora: parseInt(selectedOrigen),
        id_bodega_solicitante: parseInt(selectedDestino),
        materias_primas: insumosSeleccionados.map((insumo) => ({
          id_materia_prima: parseInt(insumo.id_articulo),
          cantidad_solicitada: Number(insumo.cantidad_solicitada),
          comentario: insumo.comentario || "",
        })),
        notificaciones: selectedUsers.map((u) => u.email),
      };

      await api(`/solicitudes-mercaderia/${solicitudId}`, {
        method: "PUT",
        body: JSON.stringify(solicitudData),
      });

      toast.success("Solicitud actualizada exitosamente");
      navigate(`/Solicitudes/${solicitudId}`);
    } catch (err) {
      console.error("Error al actualizar la solicitud:", err);
      toast.error(err?.message || "Error al actualizar la solicitud. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!solicitudId) {
    return (
      <div className="p-6">
        <BackButton label="Volver" />
        <div className="mt-2 text-sm text-gray-500">Solicitud inválida.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <BackButton label="Volver" />
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold">Editar Solicitud #{solicitudId}</h2>
        {!solicitudEditable && solicitud?.estado ? (
          <span className="text-sm text-amber-700">
            No editable (estado: {String(solicitud.estado)})
          </span>
        ) : null}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6">
          {/* Origen y destino */}
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bodega Proveedora</label>
              <Selector
                options={bodegas}
                selectedValue={selectedOrigen}
                onSelect={(v) => {
                  setSelectedOrigen(v);
                }}
                disabled={loading || !solicitudEditable}
                className={`w-full px-3 py-2 border ${
                  showErrors && errors.origen ? "border-red-500" : "border-gray-300"
                } rounded-md`}
              />
              {showErrors && errors.origen && (
                <p className="mt-1 text-sm text-red-500">{errors.origen}</p>
              )}
            </div>
            <div className="flex items-center justify-center text-primary">
              <FiArrowRight className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bodega Destino</label>
              <Selector
                options={bodegas}
                selectedValue={selectedDestino}
                onSelect={(v) => setSelectedDestino(v)}
                disabled={loading || !solicitudEditable}
                className={`w-full px-3 py-2 border ${
                  (showErrors && errors.destino) ||
                  (selectedOrigen && selectedDestino && selectedOrigen === selectedDestino)
                    ? "border-red-500"
                    : "border-gray-300"
                } rounded-md`}
              />
              {((showErrors && errors.destino) ||
                (selectedOrigen &&
                  selectedDestino &&
                  selectedOrigen === selectedDestino)) && (
                <p className="mt-1 text-sm text-red-500">
                  {selectedOrigen && selectedDestino && selectedOrigen === selectedDestino
                    ? "La bodega de destino debe ser diferente a la de origen"
                    : errors.destino}
                </p>
              )}
            </div>
          </div>

          {/* Usuarios */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Personas a notificar</label>
              <button
                type="button"
                onClick={handleAddEncargados}
                disabled={
                  loading ||
                  !solicitudEditable ||
                  !priorityUserIds ||
                  priorityUserIds.length === 0
                }
                className={`text-sm ${
                  loading || !solicitudEditable || !priorityUserIds || priorityUserIds.length === 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-primary hover:underline"
                }`}
                title={
                  !priorityUserIds || priorityUserIds.length === 0
                    ? "No hay encargados para la bodega seleccionada"
                    : "Agregar encargados de la bodega proveedora"
                }
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
              disabled={loading || !solicitudEditable}
            />
          </div>

          {/* Insumos */}
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Insumos a Solicitar</h3>
                {(!selectedOrigen || !selectedDestino) && (
                  <p className="mt-1 text-sm text-gray-500">
                    Selecciona ambas bodegas para agregar insumos.
                  </p>
                )}
                {(selectedOrigen && selectedDestino && !canAddMoreInsumos) && (
                  <p className="mt-1 text-sm text-gray-500">No quedan insumos por agregar.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setAddSignal((n) => n + 1)}
                disabled={
                  loading ||
                  !solicitudEditable ||
                  !selectedOrigen ||
                  !selectedDestino ||
                  !canAddMoreInsumos
                }
                title={
                  !selectedOrigen || !selectedDestino
                    ? "Selecciona ambas bodegas para agregar insumos"
                    : !canAddMoreInsumos
                      ? "No quedan insumos por agregar"
                      : undefined
                }
                className={`px-4 py-2 rounded-lg transition-colors ${
                  loading ||
                  !solicitudEditable ||
                  !selectedOrigen ||
                  !selectedDestino ||
                  !canAddMoreInsumos
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-hover"
                }`}
              >
                Añadir Insumo
              </button>
            </div>

            <InsumosTable
              key={`edit_${selectedOrigen}`}
              onInsumosChange={setInsumosSeleccionados}
              disabled={loading || !solicitudEditable || !selectedOrigen || !selectedDestino}
              bodegaId={selectedOrigen}
              bodegaSolicitanteId={selectedDestino}
              addSignal={addSignal}
              onAvailabilityChange={setCanAddMoreInsumos}
              initialInsumos={initialInsumos}
            />

            {selectedOrigen && selectedDestino && showErrors && errors.insumos && (
              <p className="mt-2 text-sm text-red-500">{errors.insumos}</p>
            )}
          </div>

          {/* Botón */}
          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={handleSubmit}
              disabled={loading || !isFormReady || !solicitudEditable}
              title={!isFormReady ? "Completa todos los campos requeridos" : undefined}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {solicitud && !solicitudEditable ? (
            <div className="mt-4 text-sm text-gray-600">
              Esta solicitud no se puede editar porque ya no está en estado <b>Creada</b>.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
