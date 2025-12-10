import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function DeleteProcesoValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [pva, setPva] = useState(null);

  useEffect(() => {
    const fetchPva = async () => {
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
  }, [api, id]);

  const handleDelete = async () => {
    try {
      await api(`/procesos-de-valor-agregado/${id}`, { method: "DELETE" });
      toast.success("Proceso de valor agregado eliminado correctamente.");
      navigate("/ProcesosValorAgregado");
    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("No se pudo eliminar el proceso.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-purple-500">Cargando proceso...</span>
      </div>
    );
  }

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
