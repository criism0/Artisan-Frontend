import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton, EditButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function DetailProcesoValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [proceso, setProceso] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canReadAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ);

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadAddedValueProcess) {
        toast.permissionError([ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
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
  }, [api, id, canReadAddedValueProcess]);


  if (isLoading) return <PageLoader message="Cargando proceso" />;

  if (!proceso) {
    return (
      <div className="min-h-[60vh] flex justify-center items-center">
        <p className="text-red-600 text-lg font-medium">No se encontró el proceso.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/ProcesosValorAgregado" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle del Proceso de Valor Agregado</h1>
        <div className="flex gap-2">
          <EditButton
            onClick={() => navigate(`/ProcesosValorAgregado/${id}/edit`)}
            tooltipText="Editar Proceso"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4">Información del Proceso</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <p className="text-gray-500 text-sm mb-1">Descripción</p>
            <p className="font-medium">{proceso.descripcion || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Costo estimado</p>
            <p className="font-medium">{proceso.costo_estimado ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Tiempo estimado</p>
            <p className="font-medium">{proceso.tiempo_estimado} {proceso.unidad_tiempo}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Comportamiento</p>
            <p className="font-medium">
              {proceso.utiliza_insumos ? "Utiliza insumos" : "No utiliza insumos"}
              {" · "}
              {proceso.genera_bultos_nuevos ? "Genera bultos nuevos" : "No genera bultos nuevos"}
            </p>
          </div>
        </div>
      </div>

      {pasos.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-text mb-4">Pasos del Proceso</h2>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Orden</th>
                <th className="px-3 py-2 text-left">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{p.orden}</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
