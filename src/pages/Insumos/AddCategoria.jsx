import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { useState } from "react";
import { toast } from "../../lib/toast";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function AddCategoria() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ nombre: "", descripcion: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApi();

  const canWriteRawMaterialCategory = checkScope(ModelType.CATEGORIA_MATERIA_PRIMA, ScopeType.WRITE);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "El nombre de la categoría es obligatorio.";
    if (!formData.descripcion.trim()) newErrors.descripcion = "La descripción es obligatoria.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWriteRawMaterialCategory) {
      toast.permissionError([ModelType.CATEGORIA_MATERIA_PRIMA, ScopeType.WRITE]);
      setIsSubmitting(false);
      return;
    }
    if (!validate()) return;
    try {
      setIsSubmitting(true);
      await api(`/categorias-materia-prima`, { method: "POST", body: formData });
      navigate("/Insumos/Categorias");
      toast.success("Categoría creada correctamente");
    } catch (error) {
      toast.error(`Error al crear categoría: ${error.message}`);
      setError("No se pudo crear la categoría. Verifica los datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
      <BackButton to="/Insumos/Categorias" />
      <h1 className="text-2xl font-bold text-text mb-6">Añadir Categoría</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Lácteos"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descripción *</label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ej: Materias primas derivadas de leche"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.descripcion ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.descripcion && <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>}
        </div>

        <div className="flex justify-end">
          <button
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creando..." : "Crear Categoría"}
          </button>
        </div>
      </form>
    </div>
  );
}
