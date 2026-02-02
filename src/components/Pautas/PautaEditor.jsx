import { useState } from 'react';
import StepsEditor from './StepsEditor';
import AnalisisSensorialDefinicionForm from '../AnalisisSensorial/DefinicionForm';

/**
 * Componente reutilizable para editar una Pauta de Elaboración completa
 * Incluye: Datos básicos, Pasos de elaboración, y Análisis Sensorial
 * 
 * @param {Object} props
 * @param {Object} props.pautaData - Datos básicos de la pauta {name, description, is_active}
 * @param {Function} props.onPautaDataChange - Callback cuando cambian los datos básicos
 * @param {Array} props.pasos - Array de pasos de elaboración
 * @param {Function} props.setPasos - Setter para los pasos
 * @param {Array} props.camposAnalisisSensorial - Array de campos de análisis sensorial
 * @param {Function} props.setCamposAnalisisSensorial - Setter para los campos de análisis
 * @param {Object} props.errors - Objeto con errores de validación
 * @param {Function} props.onRemovePaso - Callback para remover un paso (opcional)
 * @param {boolean} props.showTitle - Mostrar títulos de sección (default: true)
 * @param {boolean} props.compactMode - Modo compacto para wizards (default: false)
 */
export default function PautaEditor({
  pautaData,
  onPautaDataChange,
  pasos,
  setPasos,
  camposAnalisisSensorial = [],
  setCamposAnalisisSensorial,
  errors = {},
  onRemovePaso,
  showTitle = true,
  compactMode = false
}) {
  const handlePautaChange = (e) => {
    const { name, value, type, checked } = e.target;
    onPautaDataChange({
      ...pautaData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const containerClass = compactMode 
    ? "space-y-4" 
    : "space-y-6";

  const sectionClass = compactMode
    ? "bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3"
    : "bg-white p-6 rounded-lg shadow space-y-6 mb-8";

  return (
    <div className={containerClass}>
      {/* SECCIÓN 1: DATOS DE LA PAUTA */}
      <div className={sectionClass}>
        {showTitle && (
          <h2 className="text-lg font-semibold text-gray-800">Datos de la Pauta</h2>
        )}

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de la Pauta: <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={pautaData.name || ''}
            onChange={handlePautaChange}
            placeholder="Ej: Elaboración de Queso Cabra"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.name ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Descripción: <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            value={pautaData.description || ''}
            onChange={handlePautaChange}
            placeholder="Descripción detallada del proceso de elaboración..."
            rows={compactMode ? 3 : 4}
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>

        {/* Estado */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            checked={pautaData.is_active ?? true}
            onChange={handlePautaChange}
            className="mr-2"
          />
          <label className="text-sm font-medium">Pauta activa</label>
        </div>
      </div>

      {/* SECCIÓN 2: PASOS DE ELABORACIÓN */}
      <div className={sectionClass}>
        {showTitle && (
          <h2 className="text-lg font-semibold text-gray-800">Pasos de Elaboración</h2>
        )}
        
        <StepsEditor 
          pasos={pasos} 
          setPasos={setPasos} 
          errors={errors} 
          onRemovePaso={onRemovePaso} 
        />

        {errors.pasos && <p className="text-red-500 text-sm">{errors.pasos}</p>}
      </div>

      {/* SECCIÓN 3: ANÁLISIS SENSORIAL */}
      {setCamposAnalisisSensorial && (
        <div className={sectionClass}>
          {showTitle && (
            <h2 className="text-lg font-semibold text-gray-800">Análisis Sensorial (Opcional)</h2>
          )}
          
          <AnalisisSensorialDefinicionForm 
            campos={camposAnalisisSensorial}
            setCampos={setCamposAnalisisSensorial}
          />
        </div>
      )}
    </div>
  );
}
