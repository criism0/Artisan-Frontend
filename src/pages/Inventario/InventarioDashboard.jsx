import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Package,
  Warehouse,
  Boxes,
} from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import {
  cargarDatosInventario,
  calcularKpisInventario,
  distribucionPorCategoria,
  stockPorBodega,
  topProductos,
  alertasStock,
  colorCategoria,
  cargarAlertasInventario,
  cargarPipPorBodega,
  cargarProductosTerminadosPorBodega,
} from "../../services/inventarioAnalytics";
import { formatCLP, formatCLPCompact } from "../../services/formatHelpers";
import KpiCard from "../../components/UI/KpiCard";

const formatNumCL = (num) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(num || 0);

const formatoFechaLarga = (d) =>
  d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function InventarioDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosInventario(api)
      .then((d) => {
        if (cancelled || !d) return;
        const { inventario, bodegas, porBodega } = d;
        setData({
          inventario,
          bodegas,
          kpis: calcularKpisInventario(inventario, bodegas),
          porCategoria: distribucionPorCategoria(inventario),
          porBodega: stockPorBodega(porBodega),
          topProds: topProductos(inventario, 5),
          alertas: alertasStock(inventario, 8),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de inventario.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <PageLoader message="Cargando dashboard de inventario" />;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Inventario</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}{" "}
              <span className="text-xs text-gray-400">· Snapshot del estado actual</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/Inventario")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver inventario
            </button>
            <button
              onClick={() => navigate("/Inventario/bultos")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver bultos
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
  const { kpis, porCategoria, porBodega, topProds, alertas, bodegas } = data;
  const totalCat = porCategoria.reduce((acc, c) => acc + c.valor, 0) || 1;
  const maxValorBodega = Math.max(...porBodega.map((b) => b.valor), 1);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Package className="text-blue-600" size={22} />}
          label="Ítems totales"
          value={kpis.total_items}
          subtitle={`${kpis.total_items - kpis.stock_peligro} con stock saludable`}
          accent="blue"
        />
        <KpiCard
          icon={<DollarSign className="text-indigo-600" size={22} />}
          label="Valor total"
          value={formatCLPCompact(kpis.valor_total)}
          subtitle="Suma del inventario"
          accent="blue"
        />
        <KpiCard
          icon={<Warehouse className="text-green-600" size={22} />}
          label="Bodegas"
          value={kpis.total_bodegas}
          subtitle={`${porBodega.filter((b) => b.items > 0).length} con stock`}
          accent="green"
        />
        <KpiCard
          icon={<AlertTriangle className="text-red-600" size={22} />}
          label="Stock en peligro"
          value={kpis.stock_peligro}
          subtitle={kpis.stock_peligro === 0 ? "Todo OK" : "Ítems bajo umbral"}
          accent={kpis.stock_peligro === 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Stock por bodega</h2>
            <span className="text-xs text-gray-500">Valor en CLP</span>
          </div>
          {porBodega.length === 0 ? (
            <p className="text-sm text-gray-500">Sin bodegas registradas.</p>
          ) : (
            <div className="space-y-3">
              {porBodega.map((b) => {
                const pct = Math.round((b.valor / maxValorBodega) * 100);
                return (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/Inventario?bodega=${b.id}`)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-800 text-sm truncate">
                          {b.nombre}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.items} ítem{b.items === 1 ? "" : "s"}
                          {b.unidades > 0 && (
                            <> · {formatNumCL(b.unidades)} unidades</>
                          )}
                          {b.peligro > 0 && (
                            <span className="text-red-600 ml-1">
                              · {b.peligro} en peligro
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {formatCLPCompact(b.valor)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Por categoría</h2>
          <div className="space-y-3">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos.</p>
            ) : (
              porCategoria.map((c) => {
                const pct = Math.round((c.valor / totalCat) * 100);
                return (
                  <div key={c.categoria}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate">{c.categoria}</span>
                      <span className="font-semibold text-gray-800 whitespace-nowrap">
                        {c.items}{" "}
                        <span className="text-xs text-gray-500">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${colorCategoria(c.categoria)} h-2 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCLP(c.valor, 0)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Alertas de stock</h2>
            <button
              onClick={() => navigate("/Inventario")}
              className="text-sm text-primary hover:underline"
            >
              Ver inventario →
            </button>
          </div>
          {alertas.length === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">Sin alertas</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Todos los ítems tienen stock saludable.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 border border-red-200 bg-red-50/40 rounded-lg"
                >
                  <AlertTriangle className="text-red-600 mt-1" size={18} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {a.nombre}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">
                        Stock bajo
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 flex-wrap">
                      <span>{a.categoria}</span>
                      <span>·</span>
                      <span>
                        {formatNumCL(a.unidades)} {a.unidad_medida || "un."}
                      </span>
                      <span>·</span>
                      <span>{formatCLP(a.valor, 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Top productos por valor</h2>
          {topProds.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {topProds.map((p, i) => (
                <div key={p.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-gray-500">#{i + 1}</p>
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {p.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.categoria}
                        {p.unidades > 0 && <> · {formatNumCL(p.unidades)} un.</>}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                      {formatCLPCompact(p.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PanelAlertasReposicion api={api} />
      <PanelValorInventario api={api} bodegas={bodegas} />
      <TablaPipPorBodega api={api} bodegas={bodegas} />
      <TablaProductosTerminados api={api} bodegas={bodegas} />
    </>
  );
}

/**
 * M7 — Valorización histórica del inventario por bodega: un punto por cada
 * toma de inventario VALIDADA (snapshot post-ajustes, considera mermas), con
 * el delta respecto de la toma anterior de la misma bodega.
 */
function PanelValorInventario({ api, bodegas }) {
  const [snapshots, setSnapshots] = useState([]);
  const [bodegaId, setBodegaId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/inventario-dashboard/valorizacion${bodegaId ? `?id_bodega=${bodegaId}` : ""}`)
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res) ? res : res?.data ?? [];
        setSnapshots(data);
      })
      .catch(() => { if (!cancelled) setSnapshots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, bodegaId]);

  const serie = bodegaId ? snapshots : [];
  const maxValor = Math.max(...serie.map((s) => s.valor_total), 1);
  const W = 620, H = 140, PAD = 8;
  const puntos = serie.map((s, i) => ({
    x: PAD + (serie.length === 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (serie.length - 1)),
    y: H - PAD - (s.valor_total / maxValor) * (H - 2 * PAD),
    s,
  }));

  const filas = [...snapshots].reverse();

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Valor del inventario por toma</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Un punto por cada toma de inventario validada (post-ajustes, considera mermas) y su
            variación vs la toma anterior de la bodega.
          </p>
        </div>
        <BodegaSelect bodegas={bodegas || []} value={bodegaId} onChange={setBodegaId} />
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Cargando valorización…</div>
      ) : snapshots.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-5 text-sm text-gray-500 text-center">
          Aún no hay tomas de inventario validadas{bodegaId ? " en esta bodega" : ""} — el historial
          se construye con cada validación.
        </div>
      ) : (
        <>
          {bodegaId && puntos.length > 0 && (
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label="Evolución del valor de inventario">
                <polyline
                  fill="none" stroke="#7A5AF8" strokeWidth="2"
                  points={puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                />
                {puntos.map((p) => (
                  <circle key={p.s.id} cx={p.x} cy={p.y} r="3.5" fill="#7A5AF8" />
                ))}
              </svg>
            </div>
          )}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  {!bodegaId && <th className="px-3 py-2 text-left font-semibold">Bodega</th>}
                  <th className="px-3 py-2 text-right font-semibold">Valor total</th>
                  <th className="px-3 py-2 text-right font-semibold">Insumos</th>
                  <th className="px-3 py-2 text-right font-semibold">PIP</th>
                  <th className="px-3 py-2 text-right font-semibold">PT</th>
                  <th className="px-3 py-2 text-right font-semibold">Δ vs toma anterior</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{new Date(s.fecha).toLocaleDateString()}</td>
                    {!bodegaId && <td className="px-3 py-2">{s.bodega || `#${s.id_bodega}`}</td>}
                    <td className="px-3 py-2 text-right font-semibold">{formatCLP(s.valor_total, 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCLP(s.valor_insumos, 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCLP(s.valor_pip, 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{formatCLP(s.valor_pt, 0)}</td>
                    <td className="px-3 py-2 text-right">
                      {s.delta_valor == null ? (
                        <span className="text-gray-400">— primera toma</span>
                      ) : (
                        <span className={s.delta_valor >= 0 ? "text-green-700" : "text-red-700"}>
                          {s.delta_valor >= 0 ? "+" : ""}{formatCLP(s.delta_valor, 0)}
                          {s.delta_pct != null && ` (${s.delta_pct >= 0 ? "+" : ""}${s.delta_pct}%)`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const NIVEL_CONFIG = {
  Crítico: {
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
    row: "bg-red-50",
  },
  Reordenar: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
    row: "bg-yellow-50",
  },
  OK: {
    badge: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-500",
    row: "",
  },
};


function PanelAlertasReposicion({ api }) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soloProblemas, setSoloProblemas] = useState(true);
 
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarAlertasInventario(api)
      .then((data) => { if (!cancelled) setAlertas(data); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Error al cargar alertas"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);
 
  const criticos = alertas.filter((a) => a.nivel === "Crítico").length;
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
            Stock calculado sobre consumo real de las últimas 4 semanas
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {criticos > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
              <AlertTriangle size={13} />
              {criticos} crítico{criticos === 1 ? "" : "s"}
            </span>
          )}
          {reordenar > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs font-medium text-yellow-700">
              <AlertTriangle size={13} />
              {reordenar} por reordenar
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
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) : alertas.length > 0 && alertasMostradas.length === 0 ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="text-green-600 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-green-800">Sin alertas activas</p>
            <p className="text-xs text-green-700 mt-0.5">
              Todos los insumos tienen stock suficiente.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {[
                  "Insumo",
                  "Categoría",
                  "Nivel",
                  "Stock actual",
                  "Stock seguridad",
                  "Punto reorden",
                  "Consumo semanal",
                  "Semanas disp.",
                  "Sugerido reponer",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alertasMostradas
                .sort((a, b) => {
                  const orden = { Crítico: 0, Reordenar: 1, OK: 2 };
                  return (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3);
                })
                .map((a) => {
                  const cfg = NIVEL_CONFIG[a.nivel] || NIVEL_CONFIG["OK"];
                  const fmtKg = (n) =>
                    n != null
                      ? `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(n)} ${a.unidad_medida}`
                      : "—";
                  return (
                    <tr key={a.id_materia_prima} className={cfg.row}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{a.nombre}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{a.categoria}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {a.nivel}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.stock_actual)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.stock_seguridad)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.punto_reorden)}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{fmtKg(a.consumo_semanal)}</td>
                      <td className="py-2.5 pr-4 text-center text-gray-700">
                        {a.semanas_disponibles === "sin consumo" ? (
                          <span className="text-gray-400 text-xs">sin consumo</span>
                        ) : (
                          `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(a.semanas_disponibles)} sem`
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700">
                        {a.cantidad_sugerida_reposicion > 0 ? (
                          <span className="font-medium text-orange-600">
                            {fmtKg(a.cantidad_sugerida_reposicion)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
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

function TablaPipPorBodega({ api, bodegas }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bodegaId, setBodegaId] = useState("");
 
  const fetch = useCallback((id) => {
    setLoading(true);
    setError(null);
    cargarPipPorBodega(api, id || undefined)
      .then(setData)
      .catch((err) => setError(err?.message || "Error al cargar PIP"))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {fetch(""); }, [fetch]);

  const handleBodega = (id) => { 
    setBodegaId(id); 
    fetch(id);
  };

  const total = data.reduce((acc, r) => acc + r.kg_disponible, 0);
 
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <Boxes size={20} className="text-amber-500" />
            Productos en proceso (PIP)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Kg disponibles por bodega e insumo base</p>
        </div>
        <BodegaSelect 
          bodegas={bodegas}
          value={bodegaId}
          onChange={handleBodega}
        />
      </div>
 
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Bodega", "Insumo base", "Unidad", "Kg disponibles"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...data].sort((a, b) => b.kg_disponible - a.kg_disponible).map((r) => (
                <tr key={`${r.id_bodega}-${r.id_materia_prima}`} className="hover:bg-gray-50">
                  <td className="py-2.5 pr-4 text-gray-700">{r.bodega}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-800">{r.producto}</td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">{r.unidad_medida || "—"}</td>
                  <td className="py-2.5 pr-4 font-semibold text-amber-700">
                    {formatNumCL(r.kg_disponible)} kg
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">Total</td>
                <td className="py-2 pr-4 font-bold text-gray-800">{data.length === 0 ? "—" :  `${formatNumCL(total)} kg`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
 
function TablaProductosTerminados({ api, bodegas }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bodegaId, setBodegaId] = useState("");
 
  const fetch = useCallback((id) => {
    setLoading(true);
    setError(null);
    cargarProductosTerminadosPorBodega(api, id || undefined)
      .then(setData)
      .catch((err) => setError(err?.message || "Error al cargar productos terminados"))
      .finally(() => setLoading(false));
  }, [api]);
 
  useEffect(() => { fetch(""); }, [fetch]);

  const handleBodega = (id) => {
    setBodegaId(id);
    fetch(id);
  };

  const hayCajas = data.some((r) => r.cajas_disponibles != null);
  const totalUnidades = data.reduce((acc, r) => acc + r.unidades_disponibles, 0);
  const totalCajas = data.reduce(
    (acc, r) => (r.cajas_disponibles != null ? acc + r.cajas_disponibles : acc),
    0
  );
  const totalKg = data.reduce((acc, r) => acc + r.kg_disponible, 0);
  
 
  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <Package size={20} className="text-green-600" />
            Productos terminados
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cajas (bultos cerrados) y kg disponibles por bodega y producto
          </p>
        </div>
        <BodegaSelect 
          bodegas={bodegas} 
          value={bodegaId} 
          onChange={handleBodega}
        />
      </div>
 
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {[
                  "Bodega",
                  "Producto",
                  "Unidad",
                  "Unidades disp.",
                  ...(hayCajas ? ["Cajas disp."] : []),
                  "Kg disponibles",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...data]
                .sort((a, b) => b.kg_disponible - a.kg_disponible)
                .map((r) => (
                  <tr
                    key={`${r.id_bodega}-${r.id_producto_base}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="py-2.5 pr-4 text-gray-700">{r.bodega}</td>
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{r.producto}</td>
                    <td className="py-2.5 pr-4 text-gray-500 text-xs">{r.unidad_medida || "—"}</td>
                    <td className="py-2.5 pr-4 text-gray-700">
                      {new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(
                        r.unidades_disponibles
                      )}
                    </td>
                    {hayCajas && (
                      <td className="py-2.5 pr-4 font-semibold text-green-700">
                        {r.cajas_disponibles != null
                          ? new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(
                              r.cajas_disponibles
                            )
                          : <span className="text-gray-400 font-normal">—</span>}
                      </td>
                    )}
                    <td className="py-2.5 pr-4 text-gray-700">
                      {new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(
                        r.kg_disponible
                      )}{" "}
                      kg
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                  Total
                </td>
                <td className="py-2 pr-4 font-bold text-gray-800">
                  {data.length === 0 ? "—" : formatNumCL(totalUnidades)}
                </td>
                {hayCajas && (
                  <td className="py-2 pr-4 font-bold text-green-700">
                    {formatNumCL(totalCajas)}
                  </td>
                )}
                <td className="py-2 pr-4 font-bold text-gray-800">
                  {data.length === 0 ? "—" : `${formatNumCL(totalKg)} kg`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}



function BodegaSelect({ bodegas, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <option value="">Todas las bodegas</option>
      {bodegas.map((b) => (
        <option key={b.id} value={String(b.id)}>{b.nombre}</option>
      ))}
    </select>
  );
}


