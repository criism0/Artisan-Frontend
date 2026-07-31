import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Package,
  Send,
  Truck,
} from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import {
  cargarDatosLogistica,
  calcularKpisLogistica,
  solicitudesPorEstado,
  tendenciaSolicitudes,
  topRutas,
  alertasLogistica,
  colorEstadoSolicitud,
} from "../../services/logisticaAnalytics";
import KpiCard from "../../components/UI/KpiCard";

const formatNumCL = (num) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(num || 0);

const formatoFechaLarga = (d) =>
  d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function LogisticaDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosLogistica(api)
      .then((d) => {
        if (cancelled || !d) return;
        const { solicitudes, pallets } = d;
        setData({
          solicitudes,
          pallets,
          kpis: calcularKpisLogistica(solicitudes, pallets),
          porEstado: solicitudesPorEstado(solicitudes),
          tendencia: tendenciaSolicitudes(solicitudes, 6),
          rutas: topRutas(solicitudes, 5),
          alertas: alertasLogistica(solicitudes, pallets, 8),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de logística.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <PageLoader message="Cargando dashboard de logística" />;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Logística</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/Solicitudes")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver solicitudes
            </button>
            <button
              onClick={() => navigate("/Pallets")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver pallets
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!error && data && <DashboardContent data={data} navigate={navigate} />}
      </div>
    </div>
  );
}

function DashboardContent({ data, navigate }) {
  const { kpis, porEstado, tendencia, rutas, alertas } = data;
  const totalPorEstado = porEstado.reduce((acc, e) => acc + e.cantidad, 0) || 1;
  const maxRuta = Math.max(...rutas.map((r) => r.cantidad), 1);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Send className="text-blue-600" size={22} />}
          label="Solicitudes totales"
          value={kpis.total_solicitudes}
          subtitle={`${kpis.activos} activas · ${kpis.completados} completadas`}
          accent="blue"
        />
        <KpiCard
          icon={<Truck className="text-indigo-600" size={22} />}
          label="En tránsito"
          value={kpis.en_transito}
          subtitle={`${kpis.pendientes_despacho} pendientes de despacho`}
          accent="blue"
        />
        <KpiCard
          icon={<Package className="text-yellow-600" size={22} />}
          label="Pallets abiertos"
          value={kpis.pallets_abiertos}
          subtitle={`${kpis.total_pallets} totales`}
          accent="yellow"
        />
        <KpiCard
          icon={<Layers className="text-green-600" size={22} />}
          label="Bultos en pallets"
          value={kpis.bultos_en_pallets}
          subtitle="Total acumulado"
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        <GraficoTendenciaSolicitudes tendencia={tendencia} />

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Solicitudes por estado</h2>
          <div className="space-y-3">
            {porEstado
              .filter((e) => e.cantidad > 0)
              .map((e) => {
                const pct = Math.round((e.cantidad / totalPorEstado) * 100);
                return (
                  <div key={e.estado}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{e.estado}</span>
                      <span className="font-semibold text-gray-800">
                        {e.cantidad}{" "}
                        <span className="text-xs text-gray-500">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${colorEstadoSolicitud(e.estado)} h-2 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {porEstado.every((e) => e.cantidad === 0) && (
              <p className="text-sm text-gray-500">Sin solicitudes registradas.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Alertas y pendientes</h2>
            <button
              onClick={() => navigate("/Solicitudes")}
              className="text-sm text-primary hover:underline"
            >
              Ver todo →
            </button>
          </div>
          {alertas.length === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">Sin alertas</p>
                <p className="text-xs text-green-700 mt-0.5">
                  No hay solicitudes activas ni pallets abiertos.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <button
                  key={`${a.tipo}-${a.id}`}
                  onClick={() =>
                    a.tipo === "solicitud"
                      ? navigate(`/Solicitudes/${a.id}`)
                      : navigate(`/Pallets`)
                  }
                  className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <IconoAlerta tipo={a.tipo} estado={a.estado} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {a.titulo}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        {a.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {a.dias_antiguedad != null
                          ? `${a.dias_antiguedad} día${a.dias_antiguedad === 1 ? "" : "s"}`
                          : "Sin fecha"}
                      </span>
                      <span>·</span>
                      <span className="truncate">{a.subtitulo}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Top rutas</h2>
          {rutas.length === 0 ? (
            <p className="text-sm text-gray-500">Sin solicitudes registradas.</p>
          ) : (
            <div className="space-y-3">
              {rutas.map((r, i) => {
                const pct = Math.round((r.cantidad / maxRuta) * 100);
                return (
                  <div key={`${r.origen}-${r.destino}`} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-500">#{i + 1}</p>
                        <h3 className="font-medium text-gray-800 text-sm truncate">
                          {r.origen} → {r.destino}
                        </h3>
                      </div>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {r.cantidad}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function GraficoTendenciaSolicitudes({ tendencia }) {
  const hayDatos = tendencia.some((t) => t.cantidad > 0);
  const maxCantidad = hayDatos ? Math.max(...tendencia.map((t) => t.cantidad)) : 0;

  const ejeYMarcas = useMemo(() => {
    const pasos = 4;
    if (!hayDatos) {
      return Array.from({ length: pasos + 1 }, (_,i) => pasos - i);
    }
    const step = maxCantidad/pasos;
    const mag = Math.pow(10,Math.floor(Math.log10(step||1)));
    const niceStep = Math.max(1, Math.ceil(step/mag)*mag);
    return Array.from({ length: pasos+1 }, (_,i)=>i*niceStep).reverse();
  }, [hayDatos, maxCantidad]);

  const ejeYMax = hayDatos ? ejeYMarcas[0] : 1;

  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Tendencia mensual de solicitudes</h2>
        <span className="text-xs text-gray-500">Últimos 6 meses</span>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between h-56 text-right pr-2 w-10 shrink-0">
          {ejeYMarcas.map((marca, i) => (
            <span key={i} className="text-[10px] text-gray-400 leading-none">
              {formatNumCL(marca)}
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="relative h-56">
            <div className="absolute inset-0 z-0 flex flex-col justify-between pointer-events-none">
              {ejeYMarcas.map((marca, i) => (
                <div key={i} className="w-full border-t border-gray-100" />
              ))}
            </div>
            <div className="flex gap-3 h-full relative z-10">
              {tendencia.map((b) => {
                const h = b.cantidad > 0
                  ? Math.max((b.cantidad / ejeYMax) * 100, 4)
                  : 0;
                return (
                  <div key={b.key} className="flex-1 flex flex-col items-center h-full">
                    <div className="w-full flex-1 flex flex-col justify-end items-center">
                      <div className="text-xs text-gray-600 font-medium leading-4 mb-0.5">
                        {b.cantidad > 0 ? b.cantidad : ""}
                      </div>
                      <div
                        title={`${b.label}: ${b.cantidad} solicitudes`}
                        className="w-full bg-primary hover:bg-primary-dark rounded-t transition-colors"
                        style={{ height: `${h}%`, minHeight: b.cantidad > 0 ? "4px" : "0" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 mt-1">
            {tendencia.map((b) => (
              <div key={b.key} className="flex-1 text-center">
                <span className="text-xs text-gray-500 capitalize">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 border-t text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
          <span>Altura: cantidad de solicitudes en el mes</span>
        </div>
      </div>
    </div>
  );
}

function IconoAlerta({ tipo, estado }) {
  if (tipo === "pallet")
    return <Package className="text-amber-600 mt-1" size={18} />;
  if (estado === "En tránsito")
    return <Truck className="text-indigo-600 mt-1" size={18} />;
  if (estado === "Lista para despacho")
    return <Send className="text-lime-600 mt-1" size={18} />;
  return <AlertTriangle className="text-yellow-600 mt-1" size={18} />;
}
