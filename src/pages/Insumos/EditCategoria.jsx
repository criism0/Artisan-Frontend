import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import axiosInstance from "../../axiosInstance";
import { useState, useEffect } from "react";
import { toast } from "../../lib/toast";

export default function EditCategoria() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ nombre: "", descripcion: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    const fetchCategoria = async () => {
      try {
        const res = await axiosInstance.get(
          `${import.meta.env.VITE_BACKEND_URL}/categorias-materia-prima/${id}`
        );
        const categoria = res.data;
        setFormData({
          nombre: categoria.nombre || "",
          descripcion: categoria.descripcion || "",
        });
      } catch (error) {
        toast.error("Error al cargar categoría:", error);
        setError("No se pudo cargar la categoría.");
      }
    };
    fetchCategoria();
  }, [id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim())
      newErrors.nombre = "El nombre de la categoría es obligatorio.";
    if (!formData.descripcion.trim())
      newErrors.descripcion = "La descripción es obligatoria.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await axiosInstance.put(
        `${import.meta.env.VITE_BACKEND_URL}/categorias-materia-prima/${id}`,
        formData
      );
      toast.success("Categoría actualizada correctamente");
      navigate("/Insumos/Categorias");
    } catch (error) {
      console.error("Error al actualizar categoría:", error);
      toast.error("Error al actualizar categoría");
      setError("No se pudo actualizar la categoría. Verifica los datos.");
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate("/Insumos/Categorias");
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    navigate("/Insumos/Categorias");
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/Insumos/Categorias" />
      <h1 className="text-2xl font-bold text-text mb-6">Editar Categoría</h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4"
      >
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
          {errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
          )}
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
          {errors.descripcion && (
            <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={handleCancelClick}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded transition"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded transition"
          >
            Guardar Cambios
          </button>
        </div>
      </form>

      {/* Modal de confirmación */}
      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              Cambios sin guardar
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Tienes cambios sin guardar. Si sales ahora, se perderán todos los
              cambios realizados.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
