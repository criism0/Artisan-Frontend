import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function DeletePautaValorAgregado() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const [pauta, setPauta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api(`/pautas-valor-agregado/${id}`, { method: "GET" });
        setPauta(res);
      } catch {
        toast.error("No se pudo cargar la pauta.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);

  const handleDelete = async () => {
    try {
      await api(`/pautas-valor-agregado/${id}`, { method: "DELETE" });
      toast.success("Pauta eliminada correctamente.");
      navigate("/PautasValorAgregado");
    } catch {
      toast.error("No se pudo eliminar la pauta.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-purple-500">Cargando pauta...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">¿Estás seguro?</h2>
        <p className="text-gray-600 mb-6">
          La pauta <strong>ID {pauta?.id}</strong> del proceso{" "}
          <strong>{pauta?.id_proceso}</strong> será{" "}
          <span className="text-red-600 font-semibold">eliminada permanentemente</span>.
        </p>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
          >
            Sí, eliminar
          </button>
          <button
            onClick={() => navigate(`/PautasValorAgregado/${id}`)}
            className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded"
          >
            Cancelar
          </button>
        </div>

        <div className="mt-6">
          <BackButton to="/PautasValorAgregado" />
        </div>
      </div>
    </div>
  );
}
