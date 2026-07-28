import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  FileCheck,
  FileText,
  ShieldAlert,
  TrendingUp,
  XOctagon,
} from "lucide-react";
import {
  cargarDatosCalidad,
  calcularKpis,
  topFormulariosPorRespuestas,
  actividadReciente,
  desviosYNoConformidades,
} from "../../services/calidadAnalytics";
import { toast } from "../../lib/toast";
import { Spinner } from "../../components/UI/Spinner";

const formatoHora = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatoFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
      })
    : "—";

// Muestra el nombre del usuario; si no se pudo resolver, cae a "#id".
const nombreUsuario = (item) => {
  if (item?.usuario_nombre) return item.usuario_nombre;
  return item?.id_usuario != null ? `#${item.id_usuario}` : "—";
};

const formatoFechaLarga = (d) =>
  d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const SEVERIDAD = {
  critica: { label: "Crítica", className: "bg-red-100 text-red-800" },
  media: { label: "Media", className: "bg-yellow-100 text-yellow-800" },
};

const ESTADO_CONFIG = {
  "no-conforme": {
    label: "No conforme",
    badgeClass: "bg-red-100 text-red-800",
    iconClass: "text-red-600",
  },
  desvio: {
    label: "Desvío",
    badgeClass: "bg-yellow-100 text-yellow-800",
    iconClass: "text-yellow-600",
  },
};

export default function CalidadDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosCalidad()
      .then((d) => {
        if (cancelled) return;
        const kpis = calcularKpis(d);
        const top = topFormulariosPorRespuestas(d.formularios, d.respuestasPorForm, 5);
        const actividad = actividadReciente(d.formularios, d.respuestas, 8);
        const desviosRecientes = desviosYNoConformidades(d.formularios, d.respuestas, 6);
        setData({ ...d, kpis, top, actividad, desviosRecientes });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de calidad.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Calidad</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/calidad/formularios")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver formularios
            </button>
            <button
              onClick={() => navigate("/calidad/formularios/aprobaciones")}
              className="px-4 py-2 rounded-lg border border-yellow-400 text-yellow-800 bg-yellow-50 hover:bg-yellow-100 text-sm flex items-center gap-2"
            >
              Aprobaciones pendientes
              {data?.kpis?.formularios_pendientes_aprobacion > 0 && (
              <span className="bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full px-2 py-0.5">
                {data.kpis.formularios_pendientes_aprobacion}
              </span>
            )}
            </button>
            <button
              onClick={() => navigate("/calidad/no-conformidades")}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
            >
              Ver alertas
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white p-8 rounded-lg shadow flex justify-center">
            <Spinner size="lg"/>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && data && <DashboardContent data={data} navigate={navigate} />}
      </div>
    </div>
  );
}

function DashboardContent({ data, navigate }) {
  const { kpis, top, actividad, alertas, desviosRecientes } = data;
  const alertasRecientes = alertas.slice(0, 5);

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ClipboardList className="text-blue-600" size={22} />}
          label="Formularios activos"
          value={kpis.total_formularios_activos}
          subtitle={`${kpis.formularios_aprobados} aprobados · ${kpis.formularios_pendientes_aprobacion} pendientes`}
          accent="blue"
        />
        <KpiCard
          icon={<FileCheck className="text-green-600" size={22} />}
          label="Respuestas hoy"
          value={kpis.respuestas_hoy}
          subtitle={`${kpis.respuestas_ultimas_24h} en 24h · ${kpis.total_conformes} conformes`}
          accent="green"
        />
        <KpiCard
          icon={<ShieldAlert className="text-yellow-600" size={22} />}
          label="Desvíos"
          value={kpis.total_desvios}
          subtitle={`${kpis.desvios_ultimas_24h} en últimas 24h`}
          accent="yellow"
        />
        <KpiCard
          icon={<XOctagon className="text-red-600" size={22} />}
          label="No conformidades"
          value={kpis.total_no_conformes}
          subtitle={`${kpis.no_conformes_ultimas_24h} en últimas 24h`}
          accent="red"
        />
      </div>

      {/* Banda secundaria: contexto adicional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<TrendingUp className="text-indigo-600" size={22} />}
          label="Respuestas últimos 7 días"
          value={kpis.respuestas_ultimos_7d}
          subtitle="Total semanal"
          accent="blue"
        />
        <KpiCard
          icon={<CheckCircle className="text-green-600" size={22} />}
          label="Conformes"
          value={kpis.total_conformes}
          subtitle="Respuestas dentro de norma"
          accent="green"
        />
        <KpiCard
          icon={<AlertTriangle className="text-red-600" size={22} />}
          label="Valores fuera de rango"
          value={kpis.total_alertas}
          subtitle={`${kpis.alertas_criticas} críticas · ${kpis.alertas_ultimas_24h} en 24h`}
          accent="red"
        />
      </div>

      {/* Desvíos y no conformidades recientes (basado en el estado del backend) */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Desvíos y no conformidades recientes
            </h2>
            <p className="text-xs text-gray-500">
              Respuestas marcadas como desvío o no conforme por el usuario.
            </p>
          </div>
          <button
            onClick={() => navigate("/calidad/no-conformidades")}
            className="text-sm text-primary hover:underline"
          >
            Ver todas →
          </button>
        </div>

        {desviosRecientes.length === 0 ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-600 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-green-800">
                Sin desvíos ni no conformidades
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Todas las respuestas registradas están como conformes.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {desviosRecientes.map((item) => {
              const cfg = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG.desvio;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/calidad/respuestas/${item.id}`)}
                  className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <AlertTriangle className={`${cfg.iconClass} mt-1`} size={18} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {item.formulario_nombre}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.badgeClass}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {item.detalle && (
                      <p className="text-xs text-gray-700 mt-1 line-clamp-2 whitespace-pre-wrap">
                        {item.detalle}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} /> {formatoFecha(item.fecha)}{" "}
                        {formatoHora(item.fecha)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} /> {item.formulario_codigo}
                      </span>
                      <span>Usuario {nombreUsuario(item)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas recientes */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">
                Valores fuera de rango
              </h2>
              <p className="text-xs text-gray-500">
                Derivados automáticamente de las validaciones numéricas.
              </p>
            </div>
            <button
              onClick={() => navigate("/calidad/no-conformidades")}
              className="text-sm text-primary hover:underline"
            >
              Ver todas →
            </button>
          </div>

          {alertasRecientes.length === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Sin alertas activas
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  Todos los valores numéricos registrados están dentro de rango.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {alertasRecientes.map((alerta) => {
                const sev = SEVERIDAD[alerta.severidad] || SEVERIDAD.media;
                return (
                  <button
                    key={alerta.id}
                    onClick={() => navigate(`/calidad/respuestas/${alerta.respuesta_id}`)}
                    className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <AlertTriangle
                      className={
                        alerta.severidad === "critica"
                          ? "text-red-600 mt-1"
                          : "text-yellow-600 mt-1"
                      }
                      size={18}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-800 text-sm">
                          {alerta.campo_etiqueta}: {alerta.valor}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${sev.className}`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Fuera de rango ({alerta.min ?? "—"} a {alerta.max ?? "—"})
                        {alerta.seccion_titulo ? ` · ${alerta.seccion_titulo}` : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {formatoFecha(alerta.fecha)}{" "}
                          {formatoHora(alerta.fecha)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText size={12} /> {alerta.formulario_codigo}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Top formularios */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Más completados</h2>
          {top.filter((t) => t.cantidad > 0).length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay respuestas registradas.</p>
          ) : (
            <div className="space-y-3">
              {top
                .filter((t) => t.cantidad > 0)
                .map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/calidad/formularios/${t.id}/respuestas`)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-500">
                          #{i + 1} · {t.codigo}
                        </p>
                        <h3 className="font-medium text-gray-800 text-sm truncate">
                          {t.nombre}
                        </h3>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {t.cantidad}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4 mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Actividad reciente</h2>
          <span className="text-xs text-gray-500">Últimas respuestas registradas</span>
        </div>
        {actividad.length === 0 ? (
          <p className="text-sm text-gray-500">Sin actividad registrada.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {actividad.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/calidad/respuestas/${item.id}`)}
                className="w-full text-left py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:bg-gray-50 px-2 rounded"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.formulario_nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.formulario_codigo} · Usuario {nombreUsuario(item)}
                  </p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatoFecha(item.fecha)} {formatoHora(item.fecha)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function KpiCard({ icon, label, value, subtitle, accent }) {
  const accentBorder =
    {
      red: "border-l-4 border-l-red-500",
      yellow: "border-l-4 border-l-yellow-500",
      blue: "border-l-4 border-l-blue-500",
      green: "border-l-4 border-l-green-500",
    }[accent] || "border-l-4 border-l-green-500";

  return (
    <div className={`bg-white p-5 rounded-lg shadow ${accentBorder}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
