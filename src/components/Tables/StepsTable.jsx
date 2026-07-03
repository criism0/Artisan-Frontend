import React, { useState } from 'react';
import { Plus, Trash } from 'lucide-react';
import IngredientesTable from '../Recetas/IngredientesTable';
import { toast } from '../../lib/toast.js';
import { api, ApiError } from '../../lib/api.js';

export default function StepsTable({ data, recetaId, onStepAdded }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newStep, setNewStep] = useState({
    orden: 1,
    descripcion: ''
  });
  const [errors, setErrors] = useState({});

  const validateStep = (step) => {
    const newErrors = {};
    if (!step.descripcion || step.descripcion.trim().length < 10) {
      newErrors.descripcion = 'La descripción debe tener al menos 10 caracteres';
    }
    return newErrors;
  };

  const handleAddClick = () => {
    const nextOrder = data.length > 0 ? Math.max(...data.map(p => p.orden)) + 1 : 1;
    setNewStep({
      orden: nextOrder,
      descripcion: ''
    });
    setIsAdding(true);
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewStep({
      orden: 1,
      descripcion: ''
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    const validationErrors = validateStep(newStep);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const pasoData = {
        "id_receta": parseInt(recetaId),
        "orden": newStep.orden,
        "descripcion": newStep.descripcion.trim()
      };

      const response = await api("/pasos-recetas", { method: "POST", body: pasoData });
      
      setIsAdding(false);
      setNewStep({
        orden: 1,
        descripcion: ''
      });
      setErrors({});
      onStepAdded();
    } catch (error) {
      console.error('Error al agregar paso:', error);
      if (error instanceof ApiError) {
        console.error('Datos del error:', error.data);
        console.error('Estado del error:', error.status);
        toast.error(`Error al agregar el paso: ${error.data?.message || error.message || 'Error desconocido'}`);
      } else {
        console.error('Error inesperado', error);
        toast.error('No se pudo conectar con el servidor. Por favor intente nuevamente.');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
              Orden
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
              Descripción
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
              Ingredientes
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-border">
          {[...data].sort((a, b) => a.orden - b.orden).map((paso) => (
            <tr key={paso.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                {paso.orden}
              </td>
              <td className="px-6 py-4 text-sm text-text">
                {paso.descripcion}
              </td>
              <td className="px-6 py-4 text-sm text-text">
                <IngredientesTable 
                  pasoId={paso.id}
                  recetaId={recetaId}
                  ingredientes={paso.ingredientes}
                  onIngredientesChange={onStepAdded}
                />
              </td>
            </tr>
          ))}

          {/* Fila para agregar nuevo paso */}
          {isAdding && (
            <tr className="bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <input
                    type="number"
                    value={newStep.orden}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>
              </td>
              <td className="px-6 py-4">
                <div>
                  <input
                    type="text"
                    value={newStep.descripcion}
                    onChange={(e) => setNewStep({ ...newStep, descripcion: e.target.value })}
                    className={`w-full px-3 py-2 border ${errors.descripcion ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                    placeholder="Descripción del paso"
                  />
                  {errors.descripcion && (
                    <p className="mt-1 text-sm text-red-500">{errors.descripcion}</p>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover transition-colors"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="p-4 flex justify-end">
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover transition-colors"
        >
          <Plus className="w-5 h-5" />
          Agregar Paso
        </button>
      </div>
    </div>
  );
} 