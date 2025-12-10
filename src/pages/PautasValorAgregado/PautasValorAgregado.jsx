import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "../../lib/toast";

export default function PautasValorAgregado() {
  const api = useApi();
  const navigate = useNavigate();
  const [pautas, setPautas] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api(`/pautas-valor-agregado`, { method: "GET" });
        setPautas(res);
      } catch {
        toast.error("Error al cargar pautas.");
      }
    };
    fetchData();
  }, [api]);

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pautas de Valor Agregado</h1>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Proceso</th>
              <th className="px-4 py-2">Lote</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pautas.map((pauta) => (
              <tr key={pauta.id} className="border-b">
                <td className="px-4 py-2">{pauta.id}</td>
                <td className="px-4 py-2">{pauta.Proceso?.descripcion}</td>
                <td className="px-4 py-2">{pauta.id_lote_producto_en_proceso || pauta.id_lote_producto_final}</td>
                <td className="px-4 py-2">{pauta.estado}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => navigate(`/PautasValorAgregado/${pauta.id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    Ver Detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
