import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { ApiError, useApi } from "../../lib/api";
import SimilarNameConfirmModal from "../../components/Modals/SimilarNameConfirmModal";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { toast } from "../../lib/toast.js";

export default function BodegaEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  const pendingSimilarActionRef = useRef(null);
  const [similarModal, setSimilarModal] = useState({ open: false, inputName: "", matches: [] });

  const [formData, setFormData] = useState({
    nombre: "",
    region: "",
    comuna: "",
    direccion: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canWriteWarehouse = checkScope(ModelType.BODEGA, ScopeType.WRITE);

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

  const handleSubmit = async (e, confirmSimilarName = false) => {
    e.preventDefault();
    if (!canWriteWarehouse){
      toast.permissionError([ModelType.BODEGA, ScopeType.WRITE]);
      setSaving(false);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await apiFetch(`/bodegas/${id}`, {
        method: "PUT",
        body: { ...formData, confirmSimilarName },
      });
      navigate(`/Bodegas/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleSubmit(e, true);
        setSimilarModal({
          open: true,
          inputName: err.data?.input || formData.nombre,
          matches: err.data?.matches || [],
        });
        return;
      }
      console.error("Error actualizando bodega:", err);
      setError(err.message || "No se pudo actualizar la bodega.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader message="Cargando información" />;

  return (
    <div>
      <div className="mb-4">
        <BackButton to={`/Bodegas/${id}`} />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Editar Bodega</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>}

      { canWriteWarehouse ?
        <form
          onSubmit={(e) => handleSubmit(e, false)}
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
       : <h2 className="text-2xl font-bold text-text mb-6">No tiene permisos para editar bodegas</h2> }
      { canWriteWarehouse && 
        <SimilarNameConfirmModal
          open={similarModal.open}
          entityLabel="bodega"
          inputName={similarModal.inputName}
          matches={similarModal.matches}
          onCancel={() => {
            setSimilarModal({ open: false, inputName: "", matches: [] });
            pendingSimilarActionRef.current = null;
          }}
          onConfirm={async () => {
            const fn = pendingSimilarActionRef.current;
            setSimilarModal({ open: false, inputName: "", matches: [] });
            pendingSimilarActionRef.current = null;
            if (typeof fn === "function") await fn();
          }}
          confirmText="Guardar igualmente"
        />
      }
    </div>
  );
}
