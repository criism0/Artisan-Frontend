import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function AddProcesoValorAgregado() {
  const navigate = useNavigate();
  const api = useApi();

  const [formData, setFormData] = useState({
    descripcion: "",
    costo_estimado: "",
    tiempo_estimado: "",
    unidad_tiempo: "",
    tiene_pasos: false,
    genera_bultos_nuevos: false,
    utiliza_insumos: false,
  });

  const [pasos, setPasos] = useState([{ descripcion: "", orden: 1 }]);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.descripcion.trim()) newErrors.descripcion = "Este campo es obligatorio.";
    if (formData.costo_estimado.trim() !== "") {
      const costo = parseFloat(formData.costo_estimado);
      if (isNaN(costo)) newErrors.costo_estimado = "Debe ser un número válido.";
      else if (costo < 0) newErrors.costo_estimado = "No puede ser negativo.";
    }
    const tiempo = parseFloat(formData.tiempo_estimado);
    if (isNaN(tiempo)) newErrors.tiempo_estimado = "Debe ser un número válido.";
    else if (tiempo < 0) newErrors.tiempo_estimado = "No puede ser negativo.";
    if (!formData.unidad_tiempo) newErrors.unidad_tiempo = "Selecciona una unidad de tiempo.";

    if (formData.tiene_pasos) {
      pasos.forEach((paso, index) => {
        if (!paso.descripcion.trim()) newErrors[`paso_${index}`] = "La descripción del paso es obligatoria.";
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddPaso = () => {
    setPasos([...pasos, { descripcion: "", orden: pasos.length + 1 }]);
  };

  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);
  };

  const handleRemovePaso = (index) => {
    if (pasos.length > 1) {
      const updated = pasos.filter((_, i) => i !== index);
      const reordered = updated.map((p, i) => ({ ...p, orden: i + 1 }));
      setPasos(reordered);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const pvaBody = {
        descripcion: formData.descripcion,
        costo_estimado: formData.costo_estimado.trim() === "" ? 0 : parseFloat(formData.costo_estimado),
        tiempo_estimado: parseFloat(formData.tiempo_estimado),
        unidad_tiempo: formData.unidad_tiempo,
        tiene_pasos: formData.tiene_pasos,
        genera_bultos_nuevos: formData.genera_bultos_nuevos,
        utiliza_insumos: formData.utiliza_insumos,
      };

      const pvaRes = await api(`/procesos-de-valor-agregado`, {
        method: "POST",
        body: JSON.stringify(pvaBody),
      });

      const idPva = pvaRes.id;

      if (formData.tiene_pasos && pasos.length > 0) {
        for (const paso of pasos) {
          if (paso.descripcion.trim()) {
            await api(`/pasos-valor-agregado`, {
              method: "POST",
              body: JSON.stringify({
                id_proceso: idPva,
                descripcion: paso.descripcion.trim(),
              }),
            });
          }
        }
      }

      toast.success("Proceso de valor agregado creado correctamente.");
      navigate(`/ProcesosValorAgregado/${idPva}`);
    } catch (err) {
      console.error("Error al crear el proceso de valor agregado:", err);
      toast.error("Error al crear el proceso. Verifica los campos e intenta nuevamente.");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/ProcesosValorAgregado" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Añadir Proceso de Valor Agregado</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Datos del Proceso</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <input
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ej: Maduración"
            className={`w-full border rounded-lg px-3 py-2 ${errors.descripcion ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.descripcion && <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Costo estimado</label>
          <input
            name="costo_estimado"
            value={formData.costo_estimado}
            onChange={handleChange}
            placeholder="Ej: 2000"
            className={`w-full border rounded-lg px-3 py-2 ${errors.costo_estimado ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.costo_estimado && <p className="text-red-500 text-sm mt-1">{errors.costo_estimado}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tiempo estimado</label>
          <input
            name="tiempo_estimado"
            value={formData.tiempo_estimado}
            onChange={handleChange}
            placeholder="Ej: 3"
            className={`w-full border rounded-lg px-3 py-2 ${errors.tiempo_estimado ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.tiempo_estimado && <p className="text-red-500 text-sm mt-1">{errors.tiempo_estimado}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Unidad de tiempo</label>
          <select
            name="unidad_tiempo"
            value={formData.unidad_tiempo}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${errors.unidad_tiempo ? "border-red-500" : "border-gray-300"}`}
          >
            <option value="">Seleccionar...</option>
            <option value="Minutos">Minutos</option>
            <option value="Horas">Horas</option>
            <option value="Días">Días</option>
            <option value="Semanas">Semanas</option>
          </select>
          {errors.unidad_tiempo && <p className="text-red-500 text-sm mt-1">{errors.unidad_tiempo}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="tiene_pasos"
              checked={formData.tiene_pasos}
              onChange={handleChange}
              className="mr-2"
            />
            <label className="text-sm">Tiene pasos</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="utiliza_insumos"
              checked={formData.utiliza_insumos}
              onChange={handleChange}
              className="mr-2"
            />
            <label className="text-sm">Utiliza insumos</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="genera_bultos_nuevos"
              checked={formData.genera_bultos_nuevos}
              onChange={handleChange}
              className="mr-2"
            />
            <label className="text-sm">Genera nuevos bultos</label>
          </div>
        </div>
      </div>

      {formData.tiene_pasos && (
        <div className="bg-white mt-8 p-6 rounded-lg shadow space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Pasos del Proceso</h2>
            <button
              onClick={handleAddPaso}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Agregar Paso
            </button>
          </div>

          {pasos.map((paso, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-700">Paso {index + 1}</h3>
                {pasos.length > 1 && (
                  <button
                    onClick={() => handleRemovePaso(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={paso.descripcion}
                  onChange={(e) => handlePasoChange(index, "descripcion", e.target.value)}
                  placeholder="Descripción del paso..."
                  className={`w-full border rounded-lg px-3 py-2 ${errors[`paso_${index}`] ? "border-red-500" : "border-gray-300"}`}
                />
                {errors[`paso_${index}`] && <p className="text-red-500 text-sm mt-1">{errors[`paso_${index}`]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-8">
        <button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Crear Proceso de Valor Agregado
        </button>
      </div>
    </div>
  );
}
