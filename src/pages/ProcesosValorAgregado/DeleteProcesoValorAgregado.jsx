import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function DeleteProcesoValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [pva, setPva] = useState(null);

  const canReadAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ);
  const canDeleteAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.DELETE);

  useEffect(() => {
    const fetchPva = async () => {
      if (!canReadAddedValueProcess) {
        toast.permissionError([ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const res = await api(`/procesos-de-valor-agregado/${id}`, { method: "GET" });
        setPva(res);
      } catch (err) {
        console.error("Error al cargar el proceso:", err);
        toast.error("No se pudo cargar el proceso.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPva();
  }, [api, id, canReadAddedValueProcess]);

  const handleDelete = async () => {
    if (!canDeleteAddedValueProcess) {
      toast.permissionError([ModelType.PROCESO_VALOR_AGREGADO, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/procesos-de-valor-agregado/${id}`, { method: "DELETE" });
      toast.success("Proceso de valor agregado eliminado correctamente.");
      navigate("/ProcesosValorAgregado");
    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("No se pudo eliminar el proceso.");
    }
  };

  if (isLoading) return <PageLoader message="Cargando proceso" />;

  if (!pva) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <p className="text-red-600 text-lg font-medium">
          No se encontró el proceso.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          ¿Estás seguro?
        </h2>
        <p className="text-gray-600 mb-6">
          <strong>{pva.descripcion}</strong> será{" "}
          <span className="text-red-600 font-semibold">eliminado permanentemente</span>.
        </p>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={handleDelete}
            disabled={!canDeleteAddedValueProcess}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Sí, eliminar
          </button>
          <button
            onClick={() => navigate(`/ProcesosValorAgregado/${id}`)}
            className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
