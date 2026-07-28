import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileCheck,
  Inbox,
  Filter,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import {
  cargarDatosAdquisiciones,
  cargarAlertasReposicion,
  cargarVariacionCosto,
  urlExportVariacionCosto,
  calcularKpis,
  ocsPorEstado,
  tendenciaMensual,
  topProveedores,
  pendientesAlertas,
  colorEstado,
  opcionesProveedores,
} from "../../services/adquisicionesAnalytics";
import { formatCLP, formatCLPCompact } from "../../services/formatHelpers";

const formatEjeY = (num) => formatCLPCompact(num, true);

const formatoFechaLarga = (d) =>
  d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const fmtFecha = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

function seleccionarEtiquetasFecha(fechas, maxEtiquetas) {
  if (fechas.length <= maxEtiquetas) return fechas;
  const paso = (fechas.length - 1) / (maxEtiquetas - 1);
  const indices = new Set();
  for (let i = 0; i < maxEtiquetas; i++) indices.add(Math.round(i * paso));
  return [...indices].sort((a, b) => a - b).map((i) => fechas[i]);
}

function formatPrecioCompacto(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(n)}`;
}

export default function AdquisicionesDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosAdquisiciones(api)
      .then((d) => {
        if (cancelled || !d) return;
        const { ordenes } = d;
        setData({
          ordenes,
          kpis: calcularKpis(ordenes),
          porEstado: ocsPorEstado(ordenes),
          tendencia: tendenciaMensual(ordenes, 6),
          topProvs: topProveedores(ordenes, 5),
          pendientes: pendientesAlertas(ordenes, 8),
          proveedoresOpciones: opcionesProveedores(ordenes),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de adquisiciones.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <PageLoader message="Cargando dashboard de adquisiciones" />;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Adquisiciones</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/Ordenes")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver órdenes
            </button>
            <button
              onClick={() => navigate("/Ordenes/add")}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
            >
              Nueva orden
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!error && data && <DashboardContent data={data} navigate={navigate} api={api} />}
      </div>
    </div>
  );
}

function DashboardContent({ data, navigate, api }) {
  const { ordenes, kpis, porEstado, tendencia, topProvs, pendientes, proveedoresOpciones } = data;
  const totalPorEstado = porEstado.reduce((acc, e) => acc + e.cantidad, 0) || 1;
  const [filtroProveedor, setFiltroProveedor] = useState("");

  const ordenesFiltradas = useMemo(() => {
    if (!filtroProveedor) return ordenes;
    return ordenes.filter((o) => {
      const id = o.proveedor?.id || o.Proveedor?.id || o.id_proveedor;
      return String(id) === filtroProveedor;
    });
  }, [ordenes, filtroProveedor]);

  const tendenciaFiltrada = useMemo(() => tendenciaMensual(ordenesFiltradas, 6), [ordenesFiltradas]);

  const hayDatosTendencia = tendenciaFiltrada.some((t) => t.monto > 0);
  const maxMontoTendencia = hayDatosTendencia ? Math.max(...tendenciaFiltrada.map((t) => t.monto)) : 0;

  const ejeYMarcas = useMemo(() => {
    const pasos = 4;
    if (!hayDatosTendencia) {
      return Array.from({ length: pasos + 1 }, (_, i) => (pasos - i) * 1_000_000);
    }
    const step = maxMontoTendencia / pasos;
    const mag = Math.pow(10, Math.floor(Math.log10(step)));
    const niceStep = Math.ceil(step / mag) * mag;
    return Array.from({ length: pasos + 1 }, (_, i) => i * niceStep).reverse();
  }, [hayDatosTendencia, maxMontoTendencia]);

  const ejeYMax = hayDatosTendencia ? ejeYMarcas[0] : 1;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ClipboardList className="text-blue-600" size={22} />}
          label="Órdenes totales"
          value={kpis.total_ocs}
          subtitle={`${kpis.pendientes_validar} por validar · ${kpis.pendientes_pago} por pagar`}
          accent="blue"
        />
        <KpiCard
          icon={<DollarSign className="text-indigo-600" size={22} />}
          label="Comprometido"
          value={formatCLPCompact(kpis.monto_comprometido)}
          subtitle="Suma de todas las OCs"
          accent="blue"
        />
        <KpiCard
          icon={<CreditCard className="text-green-600" size={22} />}
          label="Pagado"
          value={formatCLPCompact(kpis.monto_pagado)}
          subtitle={`${pctText(kpis.monto_pagado, kpis.monto_comprometido)} del comprometido`}
          accent="green"
        />
        <KpiCard
          icon={<TrendingUp className="text-yellow-600" size={22} />}
          label="Mes actual"
          value={formatCLPCompact(kpis.monto_mes_actual)}
          subtitle="Monto emitido este mes"
          accent="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-text">Tendencia mensual</h2>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-500" />
              <FiltroSelect 
                value={filtroProveedor}
                onChange={setFiltroProveedor}
                allText="Todos los proveedores"
                options={proveedoresOpciones}
              />
              {filtroProveedor && (
                <button 
                  onClick={() => setFiltroProveedor("")} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
              <span className="text-xs text-gray-500">Últimos 6 meses</span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col justify-between h-56 text-right pr-2 w-12 shrink-0">
              {ejeYMarcas.map((marca) => (
                <span key={marca} className="text-[10px] text-gray-400 leading-none">{formatEjeY(marca)}</span>
              ))}
            </div>
            <div className="flex-1">
              <div className="relative h-56">
                <div className="absolute inset-0 z-0 flex flex-col justify-between pointer-events-none">
                  {ejeYMarcas.map((marca) => (
                    <div key={marca} className="w-full border-t border-gray-100" />
                  ))}
                </div>
                <div className="flex gap-3 h-full relative z-10">
                  {tendenciaFiltrada.map((b) => {
                    const h = b.monto > 0
                      ? Math.max((b.monto / ejeYMax) * 100, 4)
                      : 0;
                    return (
                      <div key={b.key} className="flex-1 flex flex-col items-center h-full">
                        <div className="w-full flex-1 flex flex-col justify-end items-center">
                          <div className="text-xs text-gray-600 font-medium leading-4 mb-0.5">
                            {b.cantidad > 0 ? formatCLPCompact(b.monto) : ""}
                          </div>
                          <div
                            title={`${b.label}: ${b.cantidad} OCs · ${formatCLP(b.monto)}`}
                            className="w-full bg-primary hover:bg-primary-dark rounded-t transition-colors"
                            style={{ height: `${h}%`, minHeight: b.monto > 0 ? "4px" : "0" }}
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
              <span>Altura: monto comprometido (CLP)</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">OCs por estado</h2>
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
                        className={`${colorEstado(e.estado)} h-2 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {porEstado.every((e) => e.cantidad === 0) && (
              <p className="text-sm text-gray-500">Sin órdenes registradas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bandeja DTE Recibidos */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/ventas/bandeja-sii")}
          className="w-full flex items-center gap-4 p-5 bg-white rounded-lg shadow border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors shrink-0">
            <Inbox size={24} className="text-blue-600" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm">Bandeja DTE Recibidos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Consulta facturas, guías de despacho y documentos recibidos de proveedores vía LibreDTE
            </p>
          </div>
          <span className="text-gray-400 group-hover:text-blue-500 transition-colors text-lg shrink-0">→</span>
        </button>
      </div>

      <PanelAlertasReposicion api={api} />
      <GraficoVariacionCosto api={api} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Pendientes y alertas</h2>
            <button
              onClick={() => navigate("/Ordenes")}
              className="text-sm text-primary hover:underline"
            >
              Ver todas →
            </button>
          </div>
          {pendientes.length === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">Sin pendientes</p>
                <p className="text-xs text-green-700 mt-0.5">
                  No hay órdenes esperando validación, recepción o pago.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pendientes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/Ordenes/${p.id}`)}
                  className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <IconoTipoPendiente tipo={p.tipo} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm">
                        OC #{p.id} · {p.proveedor}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">
                        {p.tipo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {p.dias_antiguedad != null
                          ? `${p.dias_antiguedad} día${p.dias_antiguedad === 1 ? "" : "s"}`
                          : "Sin fecha"}
                      </span>
                      <span>·</span>
                      <span>{formatCLP(p.monto, 0)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Top proveedores</h2>
          {topProvs.length === 0 ? (
            <p className="text-sm text-gray-500">Sin órdenes registradas.</p>
          ) : (
            <div className="space-y-3">
              {topProvs.map((p, i) => (
                <div
                  key={p.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-gray-500">#{i + 1}</p>
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {p.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.cantidad} OC{p.cantidad === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                      {formatCLPCompact(p.monto)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const NIVEL_CONFIG = {
  "Crítico": { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", row: "bg-red-50" },
  "Reordenar": { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", row: "bg-yellow-50" },
  "OK": { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", row: "" },
}

function PanelAlertasReposicion({ api }) {
  const [alertas, setAlertas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [soloProblemas, setSoloProblemas] = useState(true);
  const [bodegas, setBodegas]   = useState([]);
  const [bodegaId, setBodegaId] = useState("");

  useEffect(() => {
    let cancelled = false;
    api(`/bodegas`)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.bodegas || res?.bodegas || [];
        setBodegas(data.filter((b) => (b?.nombre || "").toLowerCase().trim() !== "en tránsito"));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cargarAlertasReposicion(api, bodegaId ? { id_bodega: bodegaId } : {})
      .then((data) => { if (!cancelled) setAlertas(data); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Error al cargar alertas"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, bodegaId]);
 
  const criticos  = alertas.filter((a) => a.nivel === "Crítico").length;
  const reordenar = alertas.filter((a) => a.nivel === "Reordenar").length;
 
  const alertasMostradas = soloProblemas
    ? alertas.filter((a) => a.nivel !== "OK")
    : alertas;
 
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Alertas de reposición</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Stock y consumo real de las últimas 4 semanas
            {bodegaId
              ? ` en ${bodegas.find((b) => String(b.id) === bodegaId)?.nombre || "la bodega"}`
              : " (todas las bodegas)"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={bodegaId}
            onChange={(e) => setBodegaId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas las bodegas</option>
            {bodegas.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.nombre}</option>
            ))}
          </select>
          {criticos > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
              <AlertTriangle size={13} />{criticos} crítico{criticos === 1 ? "" : "s"}
            </span>
          )}
          {reordenar > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs font-medium text-yellow-700">
              <AlertTriangle size={13} />{reordenar} por reordenar
            </span>
          )}
          <button
            onClick={() => setSoloProblemas((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {soloProblemas ? "Ver todos" : "Solo alertas"}
          </button>
        </div>
      </div>
 
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) :  alertas.length > 0 && alertasMostradas.length === 0 ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-green-600 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-green-800">Sin alertas activas</p>
            <p className="text-xs text-green-700 mt-0.5">Todos los insumos tienen stock suficiente.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Insumo", "Categoría", "Nivel", "Stock actual", "Stock seguridad", "Punto reorden", "Consumo semanal", "Semanas disp.", "Sugerido reponer"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alertasMostradas
                .sort((a, b) => {
                  const orden = { "Crítico": 0, "Reordenar": 1, "OK": 2 };
                  return (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3);
                })
                .map((a) => {
                  const cfg = NIVEL_CONFIG[a.nivel] || NIVEL_CONFIG["OK"];
                  const fmtKg = (n) => n != null ? `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(n)} ${a.unidad_medida}` : "—";
                  return (
                    <tr key={a.id_materia_prima} className={cfg.row}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{a.nombre}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{a.categoria}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {a.nivel}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.stock_actual)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.stock_seguridad)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.punto_reorden)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.consumo_semanal)}</td>
                      <td className="py-2.5 pr-4 text-center text-gray-700">
                        {a.semanas_disponibles === "sin consumo" ? <span className="text-gray-400 text-xs">sin consumo</span> : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(a.semanas_disponibles)} sem`}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">
                        {a.cantidad_sugerida_reposicion > 0 ? <span className="font-medium text-orange-600">{fmtKg(a.cantidad_sugerida_reposicion)}</span> : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SERIE_COLORES = [
  "#6d28d9", 
  "#0891b2", 
  "#d97706", 
  "#16a34a", 
  "#dc2626", 
  "#7c3aed", 
  "#0284c7"
]

function GraficoVariacionCosto({ api }) {
  const [insumos, setInsumos]       = useState([]);
  const [insumoId, setInsumoId]     = useState("");
  const [serie, setSerie]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [loadingInsumos, setLoadingInsumos] = useState(true);
  const [error, setError]           = useState(null);
  const [serieVacia, setSerieVacia] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cargarAlertasReposicion(api)
      .then((data) => {
        if (cancelled) return;
        const opts = data
          .map((a) => ({ id: a.id_materia_prima, nombre: a.nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        setInsumos(opts);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingInsumos(false); });
    return () => { cancelled = true; };
  }, [api]);
 
  const fetchSerie = useCallback(async (id) => {
    if (!id) return;
    setLoading(true); setError(null); setSerie(null);
    try {
      const data = await cargarVariacionCosto(api, id);
      setSerie(data);
    } catch (err) {
      setError(err?.message || "Error al cargar la serie");
    } finally {
      setLoading(false);
    }
  }, [api]);
 
  const handleInsumoChange = (id) => {
    setInsumoId(id);
    if (id) fetchSerie(id);
    else setSerie(null);
  };

  const W = 620;
  const H = 240;
  const PAD = { top: 26, right: 16, bottom: 56, left: 72 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
 
  const maxEtiquetasX = Math.max(2, Math.floor(innerW / 45));

  const { fechas, maxY, marcasY, sx, sy } = useMemo(() => {
    const pasos = 4;
    const sinDatos = !serie || serie.series.every((s) => s.puntos.length === 0);
    if (sinDatos) {
      setSerieVacia(true);
      const marcasY = Array.from({ length: pasos + 1 }, (_, i) => (pasos - i) * 1000);
      return { 
        fechas: [], 
        maxY: 0, 
        marcasY, 
        sx: () => 0, 
        sy: (v) => innerH - (v / (marcasY[0] || 1)) * innerH,
      };
    }
    const todosLosPrecios = serie.series.flatMap((s) => s.puntos.map((p) => p.clp_por_unidad_base));
    const todasLasFechas = [...new Set(serie.series.flatMap((s) => s.puntos.map((p) => p.fecha_oc)))].sort();
    const maxY = Math.max(...todosLosPrecios) * 1.1 || 1;
    const step = Math.ceil(maxY / 4 / 100) * 100 || 1;
    const marcasY = Array.from({ length: 5 }, (_, i) => i * step).reverse();
    const minFecha = todasLasFechas[0];
    const maxFecha = todasLasFechas[todasLasFechas.length - 1];
    const rangoMs = new Date(maxFecha).getTime() - new Date(minFecha).getTime() || 1;
    const sx = (fecha) => ((new Date(fecha).getTime() - new Date(minFecha).getTime()) / rangoMs) * innerW;
    const sy = (v) => innerH - (v / (marcasY[0] || 1)) * innerH;
    return { fechas: todasLasFechas, maxY, marcasY, sx, sy };
  }, [serie, innerW, innerH]);

  const etiquetasFechaX = useMemo(
    () => seleccionarEtiquetasFecha(fechas, maxEtiquetasX),
    [fechas, maxEtiquetasX]
  );
 
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Variación de costo de insumo</h2>
          <p className="text-xs text-gray-500 mt-0.5">Precio por unidad base a lo largo del tiempo, por proveedor</p>
        </div>
        {serie && insumoId && !serieVacia && (
          <a
            href={urlExportVariacionCosto(insumoId)}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download size={13} />Exportar CSV
          </a>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Filter size={14} className="text-gray-500 shrink-0" />
        {loadingInsumos ? (
          <span className="text-xs text-gray-400">Cargando insumos...</span>
        ) : (
          <FiltroSelect
            value={insumoId}
            onChange={handleInsumoChange}
            allText="Seleccionar insumo…"
            options={insumos}
          />
        )}
      </div>
 
      {!insumoId && (
        <p className="text-sm text-gray-400 py-6 text-center">Selecciona un insumo para ver su evolución de precio.</p>
      )}
 
      {insumoId && loading && <div className="flex justify-center py-8"><Spinner /></div>}
 
      {insumoId && error && <p className="text-sm text-red-500 py-4">{error}</p>}
 
      {serie && !loading && (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {serie.series.map((s, i) => (
              <div key={s.id_proveedor} className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-0.5 rounded" style={{ background: SERIE_COLORES[i % SERIE_COLORES.length] }} />
                <span>{s.proveedor}</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
              <g transform={`translate(${PAD.left},${PAD.top})`}>
                {marcasY.map((v) => (
                  <g key={v}>
                    <line x1={0} y1={sy(v)} x2={innerW} y2={sy(v)} stroke="#f0f0f0" strokeWidth={1} />
                    <text x={-8} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">
                      {new Intl.NumberFormat("es-CL", { notation: "compact" }).format(v)}
                    </text>
                  </g>
                ))}
                <line x1={0} y1={0} x2={0} y2={innerH} stroke="#e5e7eb" strokeWidth={1} />
                <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#e5e7eb" strokeWidth={1} />
                <text transform={`rotate(-90) translate(${-innerH / 2},${-58})`} textAnchor="middle" fontSize={10} fill="#6b7280">
                  CLP / {serie.unidad_base}
                </text>
                {etiquetasFechaX.map((f) => (
                  <text
                    key={f}
                    x={sx(f)}
                    y={innerH + 12}
                    textAnchor="end"
                    fontSize={9}
                    fill="#9ca3af"
                    transform={`rotate(-40, ${sx(f)}, ${innerH + 12})`}
                  >
                    {f}
                  </text>
                ))}
                {serie.series.map((s, si) => {
                  const color = SERIE_COLORES[si % SERIE_COLORES.length];
                  const pts = s.puntos;
                  if (pts.length === 0) return null;
                  const d = pts.map((p, pi) => `${pi === 0 ? "M" : "L"}${sx(p.fecha_oc).toFixed(1)},${sy(p.clp_por_unidad_base).toFixed(1)}`).join(" ");
                  return (
                    <g key={s.id_proveedor}>
                      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
                      {pts.map((p, pi) => (
                        <g key={pi}>
                          <circle cx={sx(p.fecha_oc)} cy={sy(p.clp_por_unidad_base)} r={3.5} fill={color}>
                            <title>{`${s.proveedor}\n${p.fecha_oc}\n${formatCLP(p.clp_por_unidad_base)} / ${serie.unidad_base}`}</title>
                          </circle>
                          <text
                            x={sx(p.fecha_oc)}
                            y={sy(p.clp_por_unidad_base) - 8}
                            textAnchor="middle"
                            fontSize={8}
                            fontWeight={600}
                            fill={color}
                          >
                            {formatPrecioCompacto(p.clp_por_unidad_base)}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

function IconoTipoPendiente({ tipo }) {
  if (tipo === "Pendiente de validación")
    return <FileCheck className="text-sky-600 mt-1" size={18} />;
  if (tipo === "Pendiente de recepción" || tipo === "Recepción incompleta")
    return <Truck className="text-amber-600 mt-1" size={18} />;
  if (tipo === "Pendiente de pago")
    return <CreditCard className="text-green-600 mt-1" size={18} />;
  return <AlertTriangle className="text-yellow-600 mt-1" size={18} />;
}

function pctText(a, b) {
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
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

function FiltroSelect({ value, onChange, allText, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
      <option value="">{allText}</option>
      {options.map((o) => {
        const id    = typeof o === "object" ? String(o.id)    : o;
        const label = typeof o === "object" ? o.nombre        : o;
        return <option key={id} value={id}>{label}</option>;
      })}
    </select>
  );
}
