import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import axiosInstance from "../../axiosInstance";
import { useState } from "react";
import { toast } from "../../lib/toast";

export default function AddCategoria() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ nombre: "", descripcion: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

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
    if (!validate()) return;
    try {
      await axiosInstance.post(`${import.meta.env.VITE_BACKEND_URL}/categorias-materia-prima`, formData);
      navigate("/Insumos/Categorias");
      toast.success("Categoría creada correctamente");
    } catch (error) {
      toast.error("Error al crear categoría:", error);
      setError("No se pudo crear la categoría. Verifica los datos.");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
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
          <button className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded" type="submit">
            Crear Categoría
          </button>
        </div>
      </form>
    </div>
  );
}
