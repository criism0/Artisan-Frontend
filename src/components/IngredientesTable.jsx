import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from "../axiosInstance";
import { FiPlus, FiTrash } from 'react-icons/fi';
import Selector from './Selector';

export default function IngredientesTable({ pasoId, recetaId, ingredientes, onIngredientesChange }) {
  const [isAdding, setIsAdding] = useState(false);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [newIngrediente, setNewIngrediente] = useState({
    materiaPrima: '',
    peso: '',
    unidad_medida: ''
  });
  const [errors, setErrors] = useState({});

  // Filtrar materias primas disponibles (excluyendo las ya usadas)
  const materiasPrimasDisponibles = useMemo(() => {
    if (!ingredientes || !materiasPrimas.length) return materiasPrimas;
    
    const idsUsados = ingredientes.map(i => i.materiaPrima.id.toString());
    return materiasPrimas.filter(mp => !idsUsados.includes(mp.value));
  }, [materiasPrimas, ingredientes]);

  useEffect(() => {
    const fetchMateriasPrimas = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/materias-primas`);
        const materiasPrimasData = response.data.map(mp => ({
          value: mp.id.toString(),
          label: mp.nombre
        }));
        setMateriasPrimas(materiasPrimasData);
      } catch (error) {
        console.error("Error fetching materias primas:", error);
      }
    };

    fetchMateriasPrimas();
  }, []);

  const validateIngrediente = (ingrediente) => {
    const newErrors = {};
    if (!ingrediente.materiaPrima) {
      newErrors.materiaPrima = 'Debe seleccionar una materia prima';
    }
    if (!ingrediente.peso || parseFloat(ingrediente.peso) <= 0) {
      newErrors.peso = 'El peso debe ser mayor a 0';
    }
    if (!ingrediente.unidad_medida) {
      newErrors.unidad_medida = 'Debe seleccionar una unidad de medida';
    } else if (!['Kilogramos', 'Litros', 'Unidades'].includes(ingrediente.unidad_medida)) {
      newErrors.unidad_medida = 'Debe seleccionar una unidad de medida válida';
    }
    return newErrors;
  };

  const handleAddClick = () => {
    if (materiasPrimasDisponibles.length === 0) {
      alert('No hay más materias primas disponibles para agregar');
      return;
    }
    
    setIsAdding(true);
    setNewIngrediente({
      materiaPrima: '',
      peso: '',
      unidad_medida: ''
    });
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewIngrediente({
      materiaPrima: '',
      peso: '',
      unidad_medida: ''
    });
    setErrors({});
  };

  const handleSubmit = async () => {
    const validationErrors = validateIngrediente(newIngrediente);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const ingredienteData = {
        "id_receta": parseInt(recetaId),
        "id_materia_prima": parseInt(newIngrediente.materiaPrima),
        "id_paso": parseInt(pasoId),
        "peso": parseFloat(newIngrediente.peso),
        "unidad_medida": newIngrediente.unidad_medida
      };

      console.log('Enviando datos:', ingredienteData);

      const response = await axiosInstance.post(
        `${import.meta.env.VITE_BACKEND_URL}/ingredientes-receta`,
        ingredienteData
      );
      
      if (response.status === 201) {
        setIsAdding(false);
        setNewIngrediente({
          materiaPrima: '',
          peso: '',
          unidad_medida: ''
        });
        setErrors({});
        onIngredientesChange();
      }
    } catch (error) {
      console.error('Error al agregar ingrediente:', error);
      if (error.response) {
        alert(`Error al agregar el ingrediente: ${error.response.data.message || 'Error desconocido'}`);
      } else {
        alert('Error al procesar la petición. Por favor intente nuevamente.');
      }
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-start gap-4">
        {ingredientes && ingredientes.length > 0 ? (
          <ul className="list-disc list-inside space-y-1 flex-grow">
            {ingredientes.map((ingrediente) => (
              <li key={ingrediente.id} className="text-gray-700">
                {ingrediente.materiaPrima.nombre} - {ingrediente.peso} - {ingrediente.unidad_medida}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400 flex-grow">Sin ingredientes</span>
        )}

        {!isAdding && (
          <button
            onClick={handleAddClick}
            className="flex items-center justify-center w-10 h-10 bg-primary text-white rounded-lg hover:bg-hover transition-colors"
            disabled={materiasPrimasDisponibles.length === 0}
            title="Agregar ingrediente"
          >
            <FiPlus className="w-5 h-5" />
          </button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2 mt-4">
          <div>
            <Selector
              options={materiasPrimasDisponibles}
              selectedValue={newIngrediente.materiaPrima}
              onSelect={(value) => setNewIngrediente({ ...newIngrediente, materiaPrima: value })}
              className={`w-full px-3 py-2 border ${errors.materiaPrima ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
            />
            {errors.materiaPrima && (
              <p className="mt-1 text-sm text-red-500">{errors.materiaPrima}</p>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                step="0.1"
                value={newIngrediente.peso}
                onChange={(e) => setNewIngrediente({ ...newIngrediente, peso: e.target.value })}
                className={`w-full px-3 py-2 border ${errors.peso ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                placeholder="Peso"
                min="0.1"
              />
              {errors.peso && (
                <p className="mt-1 text-sm text-red-500">{errors.peso}</p>
              )}
            </div>
            <div className="flex-1">
              <select
                value={newIngrediente.unidad_medida}
                onChange={(e) => setNewIngrediente({ ...newIngrediente, unidad_medida: e.target.value })}
                className={`w-full px-3 py-2 border ${errors.unidad_medida ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
              >
                <option value="">Seleccione unidad</option>
                <option value="Kilogramos">Kilogramos</option>
                <option value="Litros">Litros</option>
                <option value="Unidades">Unidades</option>
              </select>
              {errors.unidad_medida && (
                <p className="mt-1 text-sm text-red-500">{errors.unidad_medida}</p>
              )}
            </div>
          </div>
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
              <FiTrash className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 