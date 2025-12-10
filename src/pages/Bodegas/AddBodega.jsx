import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState } from "react";
import { useApi } from "../../lib/api";

export default function AddBodega() {
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [formData, setFormData] = useState({
    nombre: "",
    region: "",
    comuna: "",
    direccion: "",
    admite_produccion: false,
  });

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim())
      newErrors.nombre = "El nombre de la bodega es obligatorio.";
    else if (formData.nombre.trim().length < 3)
      newErrors.nombre = "El nombre debe tener al menos 3 caracteres.";

    if (!formData.region.trim())
      newErrors.region = "La región es obligatoria.";

    if (!formData.comuna.trim())
      newErrors.comuna = "La comuna es obligatoria.";

    if (!formData.direccion.trim())
      newErrors.direccion = "La dirección es obligatoria.";
    else if (formData.direccion.trim().length < 5)
      newErrors.direccion = "La dirección debe tener al menos 5 caracteres.";

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
      setSaving(true);
      setError(null);

      const res = await apiFetch(`/bodegas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre.trim(),
          region: formData.region.trim(),
          comuna: formData.comuna.trim(),
          direccion: formData.direccion.trim(),
          admite_produccion: formData.admite_produccion,
        }),
      });

      const body = res?.data ?? res;
      const bodegaId =
        body?.id || body?.bodega?.id || body?.data?.bodega?.id || null;

      if (!bodegaId) throw new Error("No se recibió el ID de la bodega creada.");

      navigate(`/Bodegas/${bodegaId}/encargados`);
    } catch (err) {
      console.error("Error al crear bodega:", err);
      setError(err.message || "No se pudo crear la bodega. Revisa los datos e intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Bodegas" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Añadir Bodega</h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4 max-w-lg"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de la Bodega *
          </label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Bodega Central Norte"
            className={`w-full border rounded px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Región *
          </label>
          <input
            name="region"
            value={formData.region}
            onChange={handleChange}
            placeholder="Ej: Región Metropolitana"
            className={`w-full border rounded px-3 py-2 placeholder-gray-400 ${
              errors.region ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.region && (
            <p className="text-red-500 text-sm mt-1">{errors.region}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Comuna *
          </label>
          <input
            name="comuna"
            value={formData.comuna}
            onChange={handleChange}
            placeholder="Ej: Macul"
            className={`w-full border rounded px-3 py-2 placeholder-gray-400 ${
              errors.comuna ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.comuna && (
            <p className="text-red-500 text-sm mt-1">{errors.comuna}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Dirección *
          </label>
          <input
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="Ej: Av. Macul 123"
            className={`w-full border rounded px-3 py-2 placeholder-gray-400 ${
              errors.direccion ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.direccion && (
            <p className="text-red-500 text-sm mt-1">{errors.direccion}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            ¿Admite Producción?
          </label>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="admite_produccion"
                value="si"
                checked={formData.admite_produccion === true}
                onChange={() => setFormData({ ...formData, admite_produccion: true })}
              />
              Sí
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="admite_produccion"
                value="no"
                checked={formData.admite_produccion === false}
                onChange={() => setFormData({ ...formData, admite_produccion: false })}
              />
              No
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
          >
            {saving ? "Guardando..." : "Crear Bodega"}
          </button>
        </div>
      </form>
    </div>
  );
}
