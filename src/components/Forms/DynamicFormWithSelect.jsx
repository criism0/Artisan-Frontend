import { useState } from "react";

export default function DynamicFormWithSelect({ entity, onSubmit, validationRules = {}, onSelectChange }) {
  const [formData, setFormData] = useState(entity.data);
  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    // Usar solo las reglas de validación proporcionadas
    if (validationRules[name]) {
      return validationRules[name](value);
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validar el campo
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));

    setFormData({
      ...formData,
      [name]: value,
    });

    // Si es un select y hay un onSelectChange, llamarlo
    if (entity.selectOptions?.[name] && onSelectChange) {
      onSelectChange(e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar todos los campos antes de enviar
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (key, value) => {
    const isReadOnly = entity.readOnly?.includes(key);
    const hasSelectOptions = entity.selectOptions?.[key];

    if (hasSelectOptions) {
      return (
        <div>
          <select
            name={key}
            value={value}
            onChange={handleChange}
            disabled={isReadOnly}
            className={`mt-1 block w-full px-3 py-2 border ${errors[key] ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${
              isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          >
            <option value="">Seleccione una opción</option>
            {entity.selectOptions[key].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors[key] && (
            <p className="mt-1 text-sm text-red-500">{errors[key]}</p>
          )}
        </div>
      );
    }

    // Determinar el tipo de input basado en el nombre del campo
    const isNumericField = key === 'stock_critico';
    const inputType = isNumericField ? 'number' : 'text';

    return (
      <div>
        <input
          type={inputType}
          name={key}
          value={value}
          onChange={handleChange}
          readOnly={isReadOnly}
          className={`mt-1 block w-full px-3 py-2 border ${errors[key] ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${
            isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
          min={isNumericField ? "1" : undefined}
          step={isNumericField ? "1" : undefined}
        />
        {errors[key] && (
          <p className="mt-1 text-sm text-red-500">{errors[key]}</p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow">
      {Object.entries(formData).map(([key, value]) => (
        <div key={key} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
            {entity.labels[key] || key}
          </label>
          {renderField(key, value)}
        </div>
      ))}
      <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover">
        Guardar Cambios
      </button>
    </form>
  );
} 