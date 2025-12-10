import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";

export default function BodegaEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [formData, setFormData] = useState({
    nombre: "",
    region: "",
    comuna: "",
    direccion: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBodega = async () => {
      try {
        const data = await apiFetch(`/bodegas/${id}`);
        setFormData({
          nombre: data.nombre || "",
          region: data.region || "",
          comuna: data.comuna || "",
          direccion: data.direccion || "",
        });
      } catch (err) {
        console.error("Error cargando bodega:", err);
        setError("No se pudo cargar la información de la bodega.");
      } finally {
        setLoading(false);
      }
    };
    fetchBodega();
  }, [id, apiFetch]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/bodegas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      navigate(`/Bodegas/${id}`);
    } catch (err) {
      console.error("Error actualizando bodega:", err);
      setError(err.message || "No se pudo actualizar la bodega.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <span className="text-primary">Cargando información...</span>
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Bodegas/${id}`} />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Editar Bodega</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4 max-w-xl"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Bodega Central"
            className="w-full border rounded px-3 py-2 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Región *</label>
          <input
            name="region"
            value={formData.region}
            onChange={handleChange}
            placeholder="Ej: Región Metropolitana"
            className="w-full border rounded px-3 py-2 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Comuna *</label>
          <input
            name="comuna"
            value={formData.comuna}
            onChange={handleChange}
            placeholder="Ej: Macul"
            className="w-full border rounded px-3 py-2 placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dirección *</label>
          <input
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="Ej: Av. Macul 123"
            className="w-full border rounded px-3 py-2 placeholder-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          {saving ? "Guardando..." : "Actualizar Bodega"}
        </button>
      </form>
    </div>
  );
}
