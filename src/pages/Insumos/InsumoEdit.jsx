import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { useState, useEffect } from "react";
import { toast } from "../../lib/toast";

export default function InsumoEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [formData, setFormData] = useState({
    nombre: "",
    id_categoria: "",
    stock_critico: "",
    unidad_medida: ""
  });
  const [categorias, setCategorias] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [insumoRes, catRes] = await Promise.all([
          api(`/materias-primas/${id}`),
          api(`/categorias-materia-prima`)
        ]);
        setFormData({
          nombre: insumoRes.nombre,
          id_categoria: insumoRes.id_categoria,
          stock_critico: insumoRes.stock_critico,
          unidad_medida: insumoRes.unidad_medida
        });
        setCategorias(catRes);
      } catch (error) {
        console.error("Error al cargar insumo:", error);
        setError("No se pudieron cargar los datos.");
      }
    };
    fetchData();
  }, [id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "Debe ingresar un nombre.";
    if (!formData.id_categoria) newErrors.id_categoria = "Debe seleccionar una categoría.";
    if (!formData.stock_critico || parseInt(formData.stock_critico) <= 0)
      newErrors.stock_critico = "Debe ingresar un stock crítico mayor a 0.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setHasChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const body = {
        ...formData,
        id_categoria: parseInt(formData.id_categoria),
        stock_critico: parseInt(formData.stock_critico)
      };
      await api(`/materias-primas/${id}`, { method: "PUT", body: JSON.stringify(body) });
      navigate(`/Insumos/${id}`);
      toast.success("Insumo actualizado correctamente.");      
    } catch (error) {
      toast.error("Error al actualizar insumo:", error);
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setShowCancelModal(true); // si hay cambios, mostrar modal
    } else {
      navigate(`/Insumos/${id}`); // si no hay cambios, salir directo
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    navigate(`/Insumos/${id}`); // redirige sin guardar
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Insumos/${id}`} />
      <h1 className="text-2xl font-bold text-text mb-6">Editar Insumo</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Leche descremada"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Código/SKU</label>
          <label className="block w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 text-sm cursor-not-allowed" title="Campo inmutable">
            {id}
          </label>
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
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {errors.id_categoria && <p className="text-red-500 text-sm mt-1">{errors.id_categoria}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Stock Crítico *</label>
          <input
            type="number"
            name="stock_critico"
            value={formData.stock_critico}
            onChange={handleChange}
            placeholder="Ej: 100"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.stock_critico ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.stock_critico && <p className="text-red-500 text-sm mt-1">{errors.stock_critico}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unidad de Medida</label>
          <label className="block w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 text-sm cursor-not-allowed" title="Campo inmutable">
            {formData.unidad_medida}
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={handleCancelClick}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded transition"
          >
            Cancelar
          </button>

          <button
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded transition"
            type="submit"
          >
            Guardar Cambios
          </button>
        </div>
        {showCancelModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-3">Cambios sin guardar</h2>
              <p className="text-gray-600 text-sm mb-6">
                Tienes cambios sin guardar. Si sales ahora, se perderán todos los cambios realizados.
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

      </form>
    </div>
    
  );
}
