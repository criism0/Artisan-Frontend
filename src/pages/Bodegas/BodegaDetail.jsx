import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { BackButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { toast } from "../../lib/toast.js";

export default function BodegaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [bodega, setBodega] = useState(null);
  const [encargados, setEncargados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canDeleteWarehouse = checkScope(ModelType.BODEGA, ScopeType.DELETE);

  useEffect(() => {
    const fetchBodega = async () => {
      try {
        const bodegaData = await apiFetch(`/bodegas/${id}`);
        setBodega(bodegaData);
      } catch (error) {
        console.error("Error al obtener bodega:", error);
        setError("No se pudo cargar la información de la bodega.");
      } finally {
        setLoading(false);
      }
    };

    const fetchEncargados = async () => {
      try {
        const encargadosData = await apiFetch(`/bodegas/${id}/encargados`);
        setEncargados(encargadosData.encargados || []);
      } catch (error) {
        console.error("Error al obtener encargados:", error);
      }
    };

    fetchBodega();
    fetchEncargados();
  }, [id, apiFetch]);

  const handleDeleteBodega = async () => {
    if (!canDeleteWarehouse) {
      toast.permissionError([ModelType.BODEGA, ScopeType.DELETE]);
      return;
    }
    try {
      await apiFetch(`/bodegas/${id}`, { method: "DELETE" });
      navigate("/Bodegas");
    } catch (error) {
      console.error("Error eliminando bodega:", error);
      setError("Error al eliminar la bodega.");
    }
  };

  if (loading) return <PageLoader message="Cargando información" />;

  if (!bodega)
    return (
      <div>
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          No se encontró la bodega.
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/Bodegas" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de la Bodega</h1>
        <div className="flex gap-2 items-center">
          <EditButton
            onClick={() => navigate(`/Bodegas/${id}/edit`)}
            tooltipText="Editar Bodega"
          />
          {canDeleteWarehouse ? (
            <TrashButton
              onConfirmDelete={handleDeleteBodega}
              tooltipText="Eliminar Bodega"
              entityName={`bodega ${bodega.nombre || ""}`}
            />
          ) : null}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* INFORMACIÓN DE LA BODEGA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-text mb-4">Información de la Bodega</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-sm mb-1">Nombre</p>
              <p className="font-medium">{bodega.nombre || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Región</p>
              <p className="font-medium">{bodega.region || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Comuna</p>
              <p className="font-medium">{bodega.comuna || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">Dirección</p>
              <p className="font-medium">{bodega.direccion || "—"}</p>
            </div>
          </div>
        </div>

        {/* ENCARGADOS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-lg font-semibold text-text">Encargados de la Bodega</h2>
            <button
              onClick={() => navigate(`/Bodegas/${id}/encargados`)}
              className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Modificar encargados
            </button>
          </div>
          {encargados.length > 0 ? (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left py-2 px-3">Nombre</th>
                  <th className="text-left py-2 px-3">Correo</th>
                  <th className="text-left py-2 px-3">Rol</th>
                </tr>
              </thead>
              <tbody>
                {encargados.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2 px-3">{e.usuario?.nombre}</td>
                    <td className="py-2 px-3">{e.usuario?.email}</td>
                    <td className="py-2 px-3 capitalize">{e.usuario?.rol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-sm">No hay encargados asignados.</p>
          )}
        </div>
      </div>
    </div>
  );
}
