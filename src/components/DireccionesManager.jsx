import { useState, useEffect } from "react";
import DireccionModal from "./DireccionModal";
import { api } from "../lib/api";

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
    } catch (error) {
      alert("Error al guardar la dirección");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDireccion = async (direccionId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta dirección?")) {
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
    } catch (error) {
      alert("Error al eliminar la dirección");
    } finally {
      setLoading(false);
    }
  };

  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case "Facturación":
        return "📄";
      case "Despacho":
        return "🚚";
      case "Cobranza":
        return "💰";
      default:
        return "📍";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Direcciones</h3>
        {isEditing && (
          <button
            type="button"
            onClick={handleAddDireccion}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Añadir Nueva Dirección
          </button>
        )}
      </div>

      {direccionesList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>No hay direcciones registradas</p>
          {isEditing && (
            <p className="text-sm mt-1">Haz clic en "Añadir Nueva Dirección" para comenzar</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {direccionesList.map((direccion) => (
            <div
              key={direccion.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{getTipoIcon(direccion.tipo_direccion)}</span>
                    <span className="font-medium text-gray-900">
                      {direccion.tipo_direccion}
                    </span>
                    {direccion.es_principal && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Principal
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Nombre sucursal:</strong> {direccion.nombre_sucursal || '-'}</p>
                    <p><strong>Calle y número:</strong> {direccion.calle || '-'} {direccion.numero || ''}</p>
                    <p><strong>Región:</strong> {direccion.region || '-'}</p>
                    <p><strong>Comuna:</strong> {direccion.comuna || '-'}</p>
                    {direccion.tipo_recinto && (
                      <p><strong>Tipo recinto:</strong> {direccion.tipo_recinto}</p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEditDireccion(direccion)}
                      disabled={loading}
                      className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-sm disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDireccion(direccion.id)}
                      disabled={loading}
                      className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-sm disabled:opacity-50"
                    >
                      Eliminar
                    </button>
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
