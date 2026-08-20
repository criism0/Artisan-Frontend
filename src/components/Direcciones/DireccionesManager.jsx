import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import DireccionModal from "./DireccionModal";
import { EditButton, TrashButton } from "../Buttons/ActionButtons";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { useConfirm } from "../Modals/ConfirmProvider.jsx";

export default function DireccionesManager({ 
  clienteId, 
  direcciones = [], 
  onDireccionesChange,
  isEditing = false 
}) {
  const [direccionesList, setDireccionesList] = useState(direcciones);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDireccion, setEditingDireccion] = useState(null);
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  const canWriteAddress = checkScope(ModelType.DIRECCION, ScopeType.WRITE);
  const canDeleteAddress = checkScope(ModelType.DIRECCION, ScopeType.DELETE);

  useEffect(() => {
    setDireccionesList(direcciones);
  }, [direcciones]);

  const handleAddDireccion = () => {
    setEditingDireccion(null);
    setIsModalOpen(true);
  };

  const handleEditDireccion = (direccion) => {
    setEditingDireccion(direccion);
    setIsModalOpen(true);
  };

  const handleSaveDireccion = async (direccionData, direccionesParaActualizar = null) => {
    if (!canWriteAddress) {
      toast.permissionError([ModelType.DIRECCION, ScopeType.WRITE]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let updatedDireccion = null;
      let nuevaDireccion = null;
      
      if (direccionData.es_principal && direccionesParaActualizar) {
        for (const dir of direccionesParaActualizar) {
          if (dir.id !== editingDireccion?.id) {
            if (clienteId) {
              await api(`/direcciones/${dir.id}`, {
                method: "PUT",
                body: JSON.stringify({ ...dir, es_principal: false })
              });
            }
          }
        }
      }
      
      if (editingDireccion) {
        if (clienteId) {
          updatedDireccion = await api(`/direcciones/${editingDireccion.id}`, {
            method: "PUT",
            body: JSON.stringify(direccionData)
          });
          
          setDireccionesList(prev => 
            prev.map(dir => dir.id === editingDireccion.id ? updatedDireccion : dir)
          );
        } else {
          updatedDireccion = {
            ...editingDireccion,
            ...direccionData,
            id: editingDireccion.id || `temp-${Date.now()}`
          };
          
          setDireccionesList(prev => 
            prev.map(dir => dir.id === editingDireccion.id ? updatedDireccion : dir)
          );
        }
      } else {
        if (clienteId) {
          nuevaDireccion = await api("/direcciones", {
            method: "POST",
            body: JSON.stringify({
              ...direccionData,
              cliente_id: clienteId
            })
          });
          
          setDireccionesList(prev => [...prev, nuevaDireccion]);
        } else {
          nuevaDireccion = {
            ...direccionData,
            id: `temp-${Date.now()}`,
            cliente_id: null
          };
          
          setDireccionesList(prev => [...prev, nuevaDireccion]);
        }
      }
      
      if (onDireccionesChange) {
        let updatedDirecciones;
        if (editingDireccion) {
          updatedDirecciones = direccionesList.map(dir => 
            dir.id === editingDireccion.id 
              ? updatedDireccion
              : direccionData.es_principal 
                ? { ...dir, es_principal: false }
                : dir
          );
        } else {
          updatedDirecciones = direccionData.es_principal
            ? [...direccionesList.map(dir => ({ ...dir, es_principal: false })), nuevaDireccion]
            : [...direccionesList, nuevaDireccion];
        }
        
        onDireccionesChange(updatedDirecciones);
      }
    } catch {
      toast.error("Error al guardar la dirección");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDireccion = async (direccionId) => {
    if (!canDeleteAddress) {
      toast.permissionError([ModelType.DIRECCION, ScopeType.DELETE]);
      setLoading(false);
      return;
    }

    if (!(await confirm({ title: "¿Eliminar dirección?", message: "Esta acción no se puede deshacer.", confirmText: "Eliminar", danger: true }))) {
      return;
    }

    setLoading(true);
    try {
      if (clienteId && !direccionId.toString().startsWith('temp-')) {
        await api(`/direcciones/${direccionId}`, { method: "DELETE" });
      }
      
      setDireccionesList(prev => prev.filter(dir => dir.id !== direccionId));
      
      if (onDireccionesChange) {
        onDireccionesChange(direccionesList.filter(dir => dir.id !== direccionId));
      }
    } catch {
      toast.error("Error al eliminar la dirección");
    } finally {
      setLoading(false);
    }
  };

  // Badge del tipo de dirección — mismo criterio de color que el resto de la app (chips de
  // estado): un tono por categoría, no un ícono suelto sin contexto.
  const badgeTipo = (tipo) => {
    const base = "px-2 py-0.5 rounded-full text-xs font-medium";
    const map = {
      "Facturación": "bg-blue-100 text-blue-700",
      "Despacho": "bg-orange-100 text-orange-700",
      "Cobranza": "bg-purple-100 text-purple-700",
    };
    return <span className={`${base} ${map[tipo] || "bg-gray-100 text-gray-600"}`}>{tipo || "Otra"}</span>;
  };

  // Sin tarjeta propia a propósito: los 3 lugares que lo usan (ClienteDetail, ClienteEdit,
  // AddClientes) ya lo envuelven en su propia tarjeta de sección numerada — envolverlo acá
  // también dejaba una tarjeta dentro de otra con dos títulos "Direcciones".
  return (
    <div>
      {isEditing && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={handleAddDireccion}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg hover:bg-hover text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Añadir dirección
          </button>
        </div>
      )}

      {direccionesList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>No hay direcciones registradas</p>
          {isEditing && (
            <p className="text-sm mt-1">Usa "Añadir dirección" para agregar la primera.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {direccionesList.map((direccion) => (
            <div
              key={direccion.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    {badgeTipo(direccion.tipo_direccion)}
                    {direccion.tipo_recinto && (
                      <span className="text-xs text-gray-400">{direccion.tipo_recinto}</span>
                    )}
                    {direccion.es_principal && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                        Principal
                      </span>
                    )}
                    {direccion.es_principal_facturacion && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full font-medium">
                        Predeterminada de facturación
                      </span>
                    )}
                  </div>

                  <div className="font-medium text-text">{direccion.nombre_sucursal || "—"}</div>
                  <div className="text-sm text-gray-600 mt-0.5">
                    {[direccion.calle, direccion.numero].filter(Boolean).join(" ") || "—"}
                    {direccion.info_adicional ? ` (${direccion.info_adicional})` : ""}
                  </div>
                  <div className="text-sm text-gray-500">
                    {[direccion.comuna, direccion.region].filter(Boolean).join(", ")}
                  </div>
                  {direccion.comentarios && (
                    <div className="text-xs text-gray-500 mt-1 italic">{direccion.comentarios}</div>
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-1 shrink-0">
                    <EditButton onClick={() => handleEditDireccion(direccion)} tooltipText="Editar dirección" />
                    {canDeleteAddress && (
                      <TrashButton
                        onConfirmDelete={() => handleDeleteDireccion(direccion.id)}
                        tooltipText="Eliminar dirección"
                        entityName={direccion.nombre_sucursal || "esta dirección"}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DireccionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDireccion}
        direccion={editingDireccion}
        isEditing={!!editingDireccion}
        direccionesExistentes={direccionesList}
      />
    </div>
  );
}
