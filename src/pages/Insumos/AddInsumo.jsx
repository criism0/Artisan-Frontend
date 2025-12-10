import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import axiosInstance from "../../axiosInstance";
import { useState, useEffect } from "react";
import { toast } from "../../lib/toast";
import { useApi } from "../../lib/api";

export default function AddInsumo() {
  const navigate = useNavigate();
  const api = useApi();
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nombre: "",
    id_categoria: "",
    unidad_medida: "",
    stock_critico: ""
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/categorias-materia-prima`);
        setCategories(response.data);
      } catch (error) {
        console.error("Error al cargar categorías:", error);
        setError("Error al cargar las categorías. Intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "El nombre del insumo es obligatorio.";
    if (!formData.id_categoria) newErrors.id_categoria = "Debe seleccionar una categoría.";
    if (!formData.unidad_medida) newErrors.unidad_medida = "Debe seleccionar la unidad de medida.";
    if (!formData.stock_critico || parseInt(formData.stock_critico) < 0)
      newErrors.stock_critico = "Debe ingresar un stock crítico mayor o igual a 0.";
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
      const requestBody = {
        nombre: formData.nombre,
        id_categoria: parseInt(formData.id_categoria),
        unidad_medida: formData.unidad_medida,
        stock_critico: parseInt(formData.stock_critico)
      };

      await api(`/materias-primas`, { method: "POST", body: JSON.stringify(requestBody) });
      toast.success("Insumo creado correctamente.");
      navigate("/Insumos");
    } catch (error) {
      toast.error("Error al crear insumo:", error);
      const backendMessage = error.response?.data?.error || error.response?.data?.message;
      setError(`No se pudo crear el insumo. ${backendMessage || "Intenta nuevamente más tarde."}`);
    }
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <span className="text-primary">Cargando categorías...</span>
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/Insumos" />
      <h1 className="text-2xl font-bold text-text mb-6">Añadir Insumo</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre del Insumo *</label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Leche entera"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Categoría *</label>
          <select
            name="id_categoria"
            value={formData.id_categoria}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_categoria ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {errors.id_categoria && <p className="text-red-500 text-sm mt-1">{errors.id_categoria}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Unidad de Medida *</label>
          <input
            name="unidad_medida"
            value={formData.unidad_medida}
            onChange={handleChange}
            placeholder="Ej: Unidades, Litros, Kilogramos, N/A, etc."
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.unidad_medida ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.unidad_medida && <p className="text-red-500 text-sm mt-1">{errors.unidad_medida}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Stock Crítico *</label>
          <input
            type="number"
            name="stock_critico"
            value={formData.stock_critico}
            onChange={handleChange}
            placeholder="Ej: 50"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.stock_critico ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.stock_critico && <p className="text-red-500 text-sm mt-1">{errors.stock_critico}</p>}
        </div>

        <div className="flex justify-end">
          <button className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded" type="submit">
            Crear Insumo
          </button>
        </div>
      </form>
    </div>
  );
}
