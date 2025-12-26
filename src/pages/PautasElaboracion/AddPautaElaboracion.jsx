import { useState } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import StepsEditor from "../../components/Pautas/StepsEditor";
import { toast } from "../../lib/toast";

export default function AddPautaElaboracion() {
  const navigate = useNavigate();
  const api = useApi();
  const PASO_MIN_LEN = 5;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [pasos, setPasos] = useState([
    {
      descripcion: "",
      orden: 1,
      requires_ph: false,
      requires_temperature: false,
      requires_obtained_quantity: false,
      // Array of extra variable definitions: { name: string, type: 'text'|'number' }
      extra_input_data: [],
    }
  ]);

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Este campo es obligatorio.";
    if (!formData.description.trim()) newErrors.description = "Este campo es obligatorio.";
    if (pasos.length === 0) newErrors.pasos = "Debe agregar al menos un paso.";

    // Validate steps
    pasos.forEach((paso, index) => {
      if (!paso.descripcion.trim()) {
        newErrors[`paso_${index}`] = "La descripción del paso es obligatoria.";
      } else if (paso.descripcion.trim().length < PASO_MIN_LEN) {
        newErrors[`paso_${index}`] = `La descripción debe tener al menos ${PASO_MIN_LEN} caracteres.`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddPaso = () => {
    setPasos([...pasos, {
      descripcion: "",
      orden: pasos.length + 1,
      requires_ph: false,
      requires_temperature: false,
      requires_obtained_quantity: false,
    }]);
  };

  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);
  };

  // Variables adicionales handlers
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

  const handleRemovePaso = (index) => {
    if (pasos.length > 1) {
      const updated = pasos.filter((_, i) => i !== index);
      // Reorder steps
      const reordered = updated.map((paso, i) => ({ ...paso, orden: i + 1 }));
      setPasos(reordered);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      // Create the pauta
      const pautaBody = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
      };

      const pautaRes = await api(`/pautas-elaboracion`, {
        method: "POST",
        body: JSON.stringify(pautaBody)
      });

      const idPauta = pautaRes.id;
      console.log("Pauta creada:", idPauta);

      // Create steps
      for (let i = 0; i < pasos.length; i++) {
        const paso = pasos[i];
        if (paso.descripcion.trim()) {
          await api(`/pasos-pauta-elaboracion`, {
            method: "POST",
            body: JSON.stringify({
              id_pauta_elaboracion: idPauta,
              orden: i + 1,
              descripcion: paso.descripcion,
              requires_ph: paso.requires_ph,
              requires_temperature: paso.requires_temperature,
              requires_obtained_quantity: paso.requires_obtained_quantity,
              extra_input_data: paso.extra_input_data || null,
            })
          });
        }
      }

      toast.success("Pauta de elaboración creada correctamente con sus pasos.");
      navigate(`/PautasElaboracion/${idPauta}`);
    } catch (err) {
      console.error("Error al crear pauta:", err);
      toast.error(err.message || "Error al crear la pauta de elaboración. Verifica los campos e intenta nuevamente.");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton to="/PautasElaboracion" />
        </div>

        <h1 className="text-2xl font-bold text-text mb-6">Añadir Pauta de Elaboración</h1>

        {/* ─────────────── SECCIÓN 1: DATOS DE LA PAUTA ─────────────── */}
        <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800">Datos de la Pauta</h2>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de la Pauta: <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
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
            value={formData.description}
            onChange={handleChange}
            placeholder="Descripción detallada del proceso de elaboración..."
            rows={4}
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>

        </div>

        {/* ─────────────── SECCIÓN 2: PASOS DE ELABORACIÓN ─────────────── */}
        <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800">Pasos de Elaboración</h2>
          <StepsEditor pasos={pasos} setPasos={setPasos} errors={errors} />
          {errors.pasos && <p className="text-red-500 text-sm">{errors.pasos}</p>}
        </div>

        {/* BOTONES */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleAddPaso}
            className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
          >
            Agregar Paso
          </button>
          <button
            onClick={handleSubmit}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
          >
            Crear Pauta de Elaboración
          </button>
        </div>
      </div>
    </div>
  );
}
