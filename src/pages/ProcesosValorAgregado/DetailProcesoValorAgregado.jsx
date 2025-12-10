import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function DetailProcesoValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [proceso, setProceso] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await api(`/procesos-de-valor-agregado/${id}`, { method: "GET" });
        setProceso(p);
        setPasos(p.pasos || []);
      } catch {
        toast.error("Error al cargar el proceso.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);


  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-purple-500">Cargando proceso...</span>
      </div>
    );
  }

  if (!proceso) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <p className="text-red-600 text-lg font-medium">No se encontró el proceso.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4 flex justify-between items-center">
        <BackButton to="/ProcesosValorAgregado" />
        <button
          onClick={() => navigate(`/ProcesosValorAgregado/${id}/edit`)}
          className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
        >
          Editar
        </button>
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Detalle del Proceso de Valor Agregado</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-8">
        <p><strong>ID:</strong> {proceso.id}</p>
        <p><strong>Descripción:</strong> {proceso.descripcion}</p>
        <p><strong>Costo estimado:</strong> {proceso.costo_estimado}</p>
        <p><strong>Tiempo estimado:</strong> {proceso.tiempo_estimado} {proceso.unidad_tiempo}</p>
        <p><strong>Utiliza insumos:</strong> {proceso.utiliza_insumos ? "Sí" : "No"}</p>
        <p><strong>Genera bultos nuevos:</strong> {proceso.genera_bultos_nuevos ? "Sí" : "No"}</p>
      </div>

      {pasos.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Pasos del Proceso</h2>
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">Orden</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b">{p.orden}</td>
                  <td className="px-4 py-2 border-b">{p.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
