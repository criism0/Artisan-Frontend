import React, { useState } from 'react';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { TrashButton } from './Buttons/ActionButtons';

export default function EditIngredientes({ ingredientes, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validateField = (field, value) => {
    if (field === 'peso') {
      if (value <= 0) {
        return 'El peso debe ser mayor a 0';
      }
    } else if (field === 'unidad_medida') {
      if (!value) {
        return 'Debe seleccionar una unidad de medida';
      }
    }
    return '';
  };

  const handleEdit = (ingrediente) => {
    setEditingId(ingrediente.id);
    setEditedData({ ...ingrediente });
    setErrors({});
  };

  const handleSave = async () => {
    // Validar los campos
    const pesoError = validateField('peso', editedData.peso);
    const unidadError = validateField('unidad_medida', editedData.unidad_medida);
    
    if (pesoError || unidadError) {
      setErrors({ 
        peso: pesoError,
        unidad_medida: unidadError
      });
      return;
    }

    try {
      setIsSaving(true);
      await onEdit(editedData);
      setEditingId(null);
      setErrors({});
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error al guardar los cambios. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setErrors({});
  };

  const handleChange = (field, value) => {
    // Para el campo peso, asegurarse de que el valor sea mayor a 0
    if (field === 'peso') {
      const numValue = parseFloat(value);
      if (numValue <= 0) {
        return; // No actualizar el valor si es menor o igual a 0
      }
    }

    const error = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-gray-50 rounded-lg p-2">
      {ingredientes && ingredientes.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Materia Prima</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Peso</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unidad</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ingredientes.map((ingrediente) => (
              <tr key={ingrediente.id} className="border-t border-gray-200">
                <td className="px-3 py-2 text-sm text-gray-900">
                  {ingrediente.materiaPrima?.nombre || 'Sin nombre'}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900">
                  {editingId === ingrediente.id ? (
                    <div>
                      <input
                        type="number"
                        value={editedData.peso}
                        onChange={(e) => handleChange('peso', parseFloat(e.target.value))}
                        className={`w-full px-2 py-1 border ${errors.peso ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                        disabled={isSaving}
                        min="0.1"
                        step="0.1"
                      />
                      {errors.peso && (
                        <p className="mt-1 text-xs text-red-500">{errors.peso}</p>
                      )}
                    </div>
                  ) : (
                    ingrediente.peso
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900">
                  {editingId === ingrediente.id ? (
                    <div>
                      <select
                        value={editedData.unidad_medida}
                        onChange={(e) => handleChange('unidad_medida', e.target.value)}
                        className={`w-full px-2 py-1 border ${errors.unidad_medida ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                        disabled={isSaving}
                      >
                        <option value="">Seleccione unidad</option>
                        <option value="Kilogramos">Kilogramos</option>
                        <option value="Litros">Litros</option>
                        <option value="Unidades">Unidades</option>
                      </select>
                      {errors.unidad_medida && (
                        <p className="mt-1 text-xs text-red-500">{errors.unidad_medida}</p>
                      )}
                    </div>
                  ) : (
                    ingrediente.unidad_medida
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900">
                  {editingId === ingrediente.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        ) : (
                          <FiCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        disabled={isSaving}
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(ingrediente)}
                        className="text-primary hover:text-hover"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      {onDelete && (
                        <TrashButton 
                          onConfirmDelete={() => onDelete(ingrediente)}
                          tooltipText="Eliminar ingrediente"
                          entityName="ingrediente"
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-4 text-gray-500">
          Sin ingredientes
        </div>
      )}
    </div>
  );
} 