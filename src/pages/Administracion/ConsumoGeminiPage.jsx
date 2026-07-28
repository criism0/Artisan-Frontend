import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { FiDollarSign, FiAlertCircle, FiRefreshCw, FiArrowLeft } from "react-icons/fi";

function formatMoneda(valor, moneda) {
  if (valor == null) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: moneda || "CLP",
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatFechaCorta(fecha) {
  return new Date(fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function ConsumoGeminiPage() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/gemini-usage");
      setData(res);
    } catch (err) {
      setError(err?.message ?? "Error al cargar el consumo de la API de Gemini");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCosto = data?.porDia?.length ? Math.max(...data.porDia.map((d) => d.costo)) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link
          to="/ventas/cola-ia"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#7A5AF8] transition"
        >
          <FiArrowLeft size={14} /> Volver a Cola IA
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consumo API de Gemini</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gasto real del mes en curso, desde la exportación de facturación de Google Cloud.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-[#7A5AF8] hover:text-[#6648e0] font-medium disabled:opacity-50 shrink-0"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} size={14} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <FiAlertCircle className="shrink-0 mt-0.5" /> {error}
        </div>
      ) : !data?.disponible ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 flex items-start gap-2">
          <FiAlertCircle className="shrink-0 mt-0.5" />
          <span>{data?.motivo || "El consumo aún no está disponible."}</span>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
              <FiDollarSign size={13} /> Gasto acumulado este mes
            </p>
            <p className="text-4xl font-bold text-gray-900 mt-1">
              {formatMoneda(data.totalMesActual, data.moneda)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Gasto por día</p>
            {data.porDia.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">
                Sin datos todavía para este mes — la exportación tiene ~24h de atraso
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-40">
                {data.porDia.map((d) => (
                  <div
                    key={d.fecha}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    <div
                      className="w-full bg-[#7A5AF8]/70 hover:bg-[#7A5AF8] rounded-t transition-colors"
                      style={{ height: maxCosto > 0 ? `${Math.max((d.costo / maxCosto) * 100, 2)}%` : "2%" }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {formatFechaCorta(d.fecha)}: {formatMoneda(d.costo, data.moneda)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">
              Los datos de facturación tienen ~24h de atraso respecto al uso real.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
