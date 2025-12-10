import React from 'react';

export default function StepsEditor({ pasos, setPasos, errors, onRemovePaso, showAddButton = false }) {
  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);
  };

  const handleAddPaso = () => {
    setPasos([
      ...pasos,
      {
        descripcion: "",
        orden: pasos.length + 1,
        requires_ph: false,
        requires_temperature: false,
        requires_obtained_quantity: false,
        extra_input_data: [],
      },
    ]);
  };

  const handleRemovePaso = (index) => {
    // If parent provided onRemovePaso, delegate deletion (useful for edit page to call API)
    if (typeof onRemovePaso === 'function') {
      onRemovePaso(index);
      return;
    }
    const updated = pasos.filter((_, i) => i !== index);
    const reordered = updated.map((p, i) => ({ ...p, orden: i + 1 }));
    setPasos(reordered);
  };

  const handleAddVariable = (pasoIndex) => {
    const updated = [...pasos];
    const vars = updated[pasoIndex].extra_input_data || [];
    vars.push({ name: "", type: "text" });
    updated[pasoIndex].extra_input_data = vars;
    setPasos(updated);
  };

  const handleVariableChange = (pasoIndex, varIndex, field, value) => {
    const updated = [...pasos];
    const vars = updated[pasoIndex].extra_input_data || [];
    vars[varIndex] = { ...vars[varIndex], [field]: value };
    updated[pasoIndex].extra_input_data = vars;
    setPasos(updated);
  };

  const handleRemoveVariable = (pasoIndex, varIndex) => {
    const updated = [...pasos];
    const vars = updated[pasoIndex].extra_input_data || [];
    vars.splice(varIndex, 1);
    updated[pasoIndex].extra_input_data = vars;
    setPasos(updated);
  };

  return (
    <div>
      {pasos.map((paso, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-700">Paso {index + 1}</h3>
            {pasos.length > 1 && (
              <button
                onClick={() => handleRemovePaso(index)}
                className="text-red-500 hover:text-red-700 text-sm"
                type="button"
              >
                Eliminar
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Descripción del Paso: <span className="text-red-500">*</span>
            </label>
            <textarea
              value={paso.descripcion}
              onChange={(e) => handlePasoChange(index, 'descripcion', e.target.value)}
              placeholder="Descripción detallada del paso..."
              rows={2}
              className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
                errors && errors[`paso_${index}`] ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors && errors[`paso_${index}`] && (
              <p className="text-red-500 text-sm mt-1">{errors[`paso_${index}`]}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={!!paso.requires_ph}
                onChange={(e) => handlePasoChange(index, 'requires_ph', e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm">Requiere medición de pH</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={!!paso.requires_temperature}
                onChange={(e) => handlePasoChange(index, 'requires_temperature', e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm">Requiere medición de temperatura</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={!!paso.requires_obtained_quantity}
                onChange={(e) => handlePasoChange(index, 'requires_obtained_quantity', e.target.checked)}
                className="mr-2"
              />
              <label className="text-sm">Requiere cantidad obtenida</label>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium mb-2">Variables adicionales</label>
            <div className="space-y-2">
              {(paso.extra_input_data || []).map((v, vi) => (
                <div key={vi} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nombre (ej: densidad)"
                    value={v.name}
                    onChange={(e) => handleVariableChange(index, vi, 'name', e.target.value)}
                    className="border rounded px-2 py-1 w-44"
                  />
                  <select
                    value={v.type}
                    onChange={(e) => handleVariableChange(index, vi, 'type', e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                  </select>
                  <button
                    onClick={() => handleRemoveVariable(index, vi)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={() => handleAddVariable(index)}
                  className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm"
                >
                  + Agregar variable
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {showAddButton && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAddPaso}
            type="button"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            Agregar Paso
          </button>
        </div>
      )}
    </div>
  );
}
