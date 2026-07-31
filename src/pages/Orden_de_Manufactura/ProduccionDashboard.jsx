import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Factory,
  Filter,
  Layers,
  Package,
  X,
} from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import {
  cargarDatosProduccion,
  cargarEficienciaLote,
  cargarRendimiento,
  cargarRendimientoDetalle,
  calcularKpisProduccion,
  omsPorEstado,
  tendenciaOMs,
  topProductosElaborados,
  alertasProduccion,
  colorEstadoOM,
  opcionesFiltrosProduccion,
} from "../../services/produccionAnalytics";
import KpiCard from "../../components/UI/KpiCard";

const formatNumCL = (num) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(num || 0);

const formatCLP = (num) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(num || 0);

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

export default function ProduccionDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosProduccion(api)
      .then((d) => {
        if (cancelled || !d) return;
        const { ordenes, lotesPip, lotesFinal } = d;
        setData({
          ordenes,
          lotesPip,
          lotesFinal,
          kpis: calcularKpisProduccion(ordenes, lotesPip, lotesFinal),
          porEstado: omsPorEstado(ordenes),
          tendencia: tendenciaOMs(ordenes, 6),
          topProds: topProductosElaborados(ordenes, 5),
          alertas: alertasProduccion(ordenes, 8),
          filtrosOpciones: opcionesFiltrosProduccion(ordenes),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de producción.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <PageLoader message="Cargando dashboard de producción" />;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Producción</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/Orden_de_Manufactura")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver elaboraciones
            </button>
            <button
              onClick={() => navigate("/lotes-producto-en-proceso")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver lotes
            </button>
            <button
              onClick={() => navigate("/Orden_de_Manufactura/add")}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
            >
              Nueva elaboración
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
  const { kpis, porEstado, tendencia, topProds, alertas, filtrosOpciones } = data;
  const totalPorEstado = porEstado.reduce((acc, e) => acc + e.cantidad, 0) || 1;
  const maxPesoTop = Math.max(...topProds.map((p) => p.cantidad), 1);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<Factory className="text-blue-600" size={22} />}
          label="Elaboraciones totales"
          value={kpis.total_oms}
          subtitle={`${kpis.activas} activas · ${kpis.en_ejecucion} en ejecución`}
          accent="blue"
        />
        <KpiCard
          icon={<CheckCircle className="text-green-600" size={22} />}
          label="Cerradas este mes"
          value={kpis.cerradas_mes}
          subtitle={
            kpis.peso_objetivo_mes > 0
              ? `${formatNumCL(kpis.peso_objetivo_mes)} kg objetivo`
              : "Producción del mes"
          }
          accent="green"
        />
        <KpiCard
          icon={<Layers className="text-indigo-600" size={22} />}
          label="Lotes totales"
          value={kpis.lotes_totales}
          subtitle={`${kpis.lotes_pip} PIP · ${kpis.lotes_final} finales`}
          accent="blue"
        />
        <KpiCard
          icon={<AlertTriangle className={kpis.activas > 0 ? "text-yellow-600" : "text-green-600"} size={22} />}
          label="En curso"
          value={kpis.activas}
          subtitle={kpis.activas === 0 ? "Nada pendiente" : "OMs sin cerrar"}
          accent={kpis.activas === 0 ? "green" : "yellow"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <GraficoTendenciaProduccion tendencia={tendencia}/>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">OMs por estado</h2>
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
                        className={`${colorEstadoOM(e.estado)} h-2 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {porEstado.every((e) => e.cantidad === 0) && (
              <p className="text-sm text-gray-500">Sin elaboraciones registradas.</p>
            )}
          </div>
        </div>
      </div>

      <GraficoEficienciaLote api={api} filtrosOpciones={filtrosOpciones} />
      <GraficoRendimiento api={api} filtrosOpciones={filtrosOpciones} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">OMs activas</h2>
            <button
              onClick={() => navigate("/Orden_de_Manufactura")}
              className="text-sm text-primary hover:underline"
            >
              Ver todas →
            </button>
          </div>
          {alertas.length === 0 ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-green-800">Sin OMs activas</p>
                <p className="text-xs text-green-700 mt-0.5">
                  No hay elaboraciones en curso.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/Orden_de_Manufactura/${a.id}`)}
                  className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Factory className="text-cyan-600 mt-1" size={18} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        OM #{a.id} · {a.producto}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${chipEstado(a.estado)}`}>
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
                      <span className="truncate">{a.bodega}</span>
                      {a.peso_objetivo > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatNumCL(a.peso_objetivo)} kg</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">Top productos elaborados</h2>
          {topProds.length === 0 ? (
            <p className="text-sm text-gray-500">Sin elaboraciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {topProds.map((p, i) => {
                const pct = Math.round((p.cantidad / maxPesoTop) * 100);
                return (
                  <div key={p.nombre} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-gray-500">#{i + 1}</p>
                        <h3 className="font-medium text-gray-800 text-sm truncate">
                          {p.nombre}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.cantidad} OM{p.cantidad === 1 ? "" : "s"}
                          {p.peso > 0 && <> · {formatNumCL(p.peso)} kg</>}
                        </p>
                      </div>
                      <Package className="text-gray-400" size={18} />
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

const MESES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function GraficoEficienciaLote({ api, filtrosOpciones }) {
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  const fetch = useCallback(async (f={}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await cargarEficienciaLote(api, f);
      setPuntos(data.filter((p) => p.kilos_entrada > 0 && p.costo_por_kg != null));
    } catch (err) {
      setError(err?.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetch(); }, [fetch]);

  const aplicar = () => fetch({
    id_producto_base: filtroProducto ? Number(filtroProducto) : undefined,
    id_bodega: filtroPlanta ? Number(filtroPlanta) : undefined,
    anio: filtroAnio ? Number(filtroAnio) : undefined,
    mes: filtroMes ? Number(filtroMes) : undefined,
  });

  const limpiar = () => {
    setFiltroProducto("");
    setFiltroPlanta("");
    setFiltroAnio("");
    setFiltroMes("");
    fetch("");
  };

  const hayFiltros = filtroProducto || filtroPlanta || filtroAnio || filtroMes;

  const W = 560;
  const H = 260;
  const PAD = {
    top: 16,
    right: 16,
    bottom: 40, 
    left: 64
  };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxX = puntos.length ? Math.max(...puntos.map((p) => p.kilos_entrada)) * 1.05 : 100;
  const maxY = puntos.length ? Math.max(...puntos.map((p) => p.costo_por_kg)) * 1.10 : 100;

  const sx = (v) => (v / maxX) * innerW;
  const sy = (v) => innerH - (v / maxY) * innerH;

  const marcasX = useMemo(() => {
    if (!puntos.length) return [0, 25, 50, 75, 100];
    const step = Math.ceil(maxX / 4 / 10) * 10 || 1;
    return Array.from({ length: 5 }, (_, i) => i * step);
  }, [puntos, maxX]);

  const marcasY = useMemo(() => {
    if (!puntos.length) return [0, 25, 50, 75, 100];
    const step = Math.ceil(maxY / 4 / 100) * 100 || 1;
    return Array.from({length: 5}, (_, i) => i * step);
  }, [puntos, maxY]);

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Eficiencia de lote</h2>
        <p className="text-xs text-gray-500 mt-0.5">Un punto por OM cerrada — eje X: kilos de entrada · eje Y: costo por kg producido</p>
      </div>
 
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Filter size={14} />Filtrar
        </div>
        <FiltroSelect 
          value={filtroProducto}
          onChange={setFiltroProducto}
          allText="Todos los productos"
          options={filtrosOpciones.productos}
        />
        <FiltroSelect 
          value={filtroPlanta}
          onChange={setFiltroPlanta}
          allText="Todas las plantas"
          options={filtrosOpciones.plantas}
        />
        <FiltroSelect 
          value={filtroAnio}
          onChange={setFiltroAnio}
          allText="Todos los años"
          options={filtrosOpciones.anios.map((a) => ({ id: a, nombre: String(a) }))}
        />
        {filtroAnio && (
          <FiltroSelect
            value={filtroMes}
            onChange={setFiltroMes}
            allText="Todos los meses"
            options={MESES.slice(1).map((m, i) => ({ id: i + 1, nombre: m }))}
          />
        )}
        <button 
          onClick={aplicar} 
          className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark"
        >
          Aplicar
        </button>
        {hayFiltros && (
          <button 
            onClick={limpiar} 
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <X size={13} />Limpiar
          </button>
        )}
      </div>
 
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <svg 
            viewBox={`0 0 ${W} ${H}`} 
            className="w-full max-w-3xl" 
            style={{ minWidth: 320 }} 
            onMouseLeave={() => setTooltip(null)}
          >
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {marcasY.map((v) => (
                <g key={v}>
                  <line x1={0} y1={sy(v)} x2={innerW} y2={sy(v)} stroke="#f0f0f0" strokeWidth={1} />
                  <text x={-8} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9ca3af">
                    {new Intl.NumberFormat("es-CL", { notation: "compact" }).format(v)}
                  </text>
                </g>
              ))}
              {marcasX.map((v) => (
                <g key={v}>
                  <line x1={sx(v)} y1={0} x2={sx(v)} y2={innerH} stroke="#f0f0f0" strokeWidth={1} />
                  <text x={sx(v)} y={innerH + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>
                </g>
              ))}
              <line x1={0} y1={0} x2={0} y2={innerH} stroke="#e5e7eb" strokeWidth={1} />
              <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#e5e7eb" strokeWidth={1} />
              <text x={innerW / 2} y={innerH + 32} textAnchor="middle" fontSize={10} fill="#6b7280">Kilos de entrada</text>
              <text transform={`rotate(-90) translate(${-innerH / 2},${-52})`} textAnchor="middle" fontSize={10} fill="#6b7280">CLP / kg</text>
              {puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={sx(p.kilos_entrada)}
                  cy={sy(p.costo_por_kg)}
                  r={5}
                  className="fill-primary opacity-70 hover:opacity-100 cursor-pointer transition-opacity"
                  onMouseEnter={(e) => setTooltip({ p, x: e.clientX, y: e.clientY })}
                  onMouseMove={(e)  => setTooltip({ p, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          </svg>
          <p className="text-xs text-gray-400 mt-1">{puntos.length} elaboración{puntos.length === 1 ? "" : "es"}</p>
        </div>
      )}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <p className="font-semibold text-gray-800 mb-1">OM #{tooltip.p.id_orden_manufactura}</p>
          <p className="text-gray-600">{tooltip.p.producto} · {tooltip.p.planta}</p>
          <p className="text-gray-600">{fmtFecha(tooltip.p.fecha)}</p>
          <div className="mt-1.5 pt-1.5 border-t border-gray-100 space-y-0.5">
            <p>Entrada: <span className="font-medium">{formatNumCL(tooltip.p.kilos_entrada)} kg</span></p>
            <p>Costo/kg: <span className="font-medium">{formatCLP(tooltip.p.costo_por_kg)}</span></p>
            <p>Costo total: <span className="font-medium">{formatCLP(tooltip.p.costo_total)}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

function GraficoTendenciaProduccion({ tendencia }) {
  const hayDatos = tendencia.some((t) => t.cantidad > 0);
  const maxCantidad = hayDatos ? Math.max(...tendencia.map((t)=>t.cantidad)) : 0;

  const ejeYMarcas = useMemo(() => {
    const pasos = 4;
    if (!hayDatos) {
      return Array.from({ length: pasos + 1 }, (_, i) => pasos - i);
    }
    const step = maxCantidad / pasos;
    const mag = Math.pow(10, Math.floor(Math.log10(step || 1)));
    const niceStep = Math.max(1, Math.ceil(step/mag)*mag);
    return Array.from({ length: pasos + 1 }, (_, i) => i * niceStep).reverse();
  }, [hayDatos, maxCantidad]);

  const ejeYMax = hayDatos ? ejeYMarcas[0] : 1;

  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Tendencia mensual</h2>
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
                        title={`${b.label}: ${b.cantidad} OMs · ${formatNumCL(b.peso)} kg`}
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
          <span>Altura: cantidad de OMs creadas en el mes</span>
        </div>
      </div>
    </div>
  );
}

const COLORES_SEGMENTO = {
  producto: {bg: "bg-primary", hex: "var(--color-primary, #6d28d9)"},
  subproducto: { bg: "bg-cyan-500", hex: "#06b6d4" },
  merma: {bg: "bg-orange-400", hex: "#fb923c"},
};

function GraficoRendimiento({ api, filtrosOpciones }) {
  const [barras, setBarras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [agrupacion, setAgrupacion] = useState("mes");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  const [barraActiva, setBarraActiva] = useState(null);
  const [detalle, setDetalle] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const filtrosActuales = useCallback(() => ({
    id_producto_base: filtroProducto ? Number(filtroProducto) : undefined,
    id_bodega: filtroPlanta ? Number(filtroPlanta) : undefined,
    anio: filtroAnio ? Number(filtroAnio) : undefined,
    mes: filtroMes ? Number(filtroMes) : undefined,
  }), [filtroProducto, filtroPlanta, filtroAnio, filtroMes]);

  const fetchBarras = useCallback(async (f={}, agr="mes") => {
    setLoading(true);
    setError(null);
    setBarraActiva(null);
    setDetalle([]);
    try {
      const data = await cargarRendimiento(api, f, agr);
      setBarras(data);
    } catch (err) {
      setError(err?.message || "Error al cargar rendimiento");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {fetchBarras();}, [fetchBarras]);

  const aplicar = () => fetchBarras(filtrosActuales(), agrupacion);
  const limpiar = () => {
    setFiltroProducto("");
    setFiltroPlanta("");
    setFiltroAnio("");
    setFiltroMes("");
    fetchBarras({}, agrupacion);
  };

  const hayFiltros = filtroProducto || filtroPlanta || filtroAnio || filtroMes;

  const handleBarraClick = useCallback(async (barra) => {
    if (barraActiva === barra.clave) {
      setBarraActiva(null);
      setDetalle([]);
      return;
    }
    setBarraActiva(barra.clave);
    setLoadingDetalle(true);
    try {
      const f = { ...filtrosActuales() };
      if (agrupacion === "producto") f.id_producto_base = barra.clave !== "sin" ? Number(barra.clave) : undefined;
      if (agrupacion === "planta") f.id_bodega = barra.clave !== "sin" ? Number(barra.clave) : undefined;
      if (agrupacion === "mes") {
        const [anio, mes] = barra.clave.split("-");
        f.anio = Number(anio);
        f.mes = Number(mes);
      }
      const data = await cargarRendimientoDetalle(api, f);
      setDetalle(data);
    } catch (error) {
      setDetalle([]);
    } finally {
      setLoadingDetalle(false);
    }
  }, [api, agrupacion, barraActiva, filtrosActuales]);

  const maxEntrada = barras.length ? Math.max(...barras.map((b) => b.total_entrada), 1): 1;

  const ejeYMarcas = useMemo(() => {
    const pasos = 4;
    if (!barras.length || maxEntrada <= 1) {
      return Array.from({ length: pasos + 1 }, (_, i) => pasos - i);
    }
    const step = maxEntrada / pasos;
    const mag = Math.pow(10, Math.floor(Math.log10(step || 1)));
    const niceStep = Math.max(1, Math.ceil(step / mag) * mag);
    return Array.from({ length: pasos + 1 }, (_, i) => i * niceStep).reverse();
  }, [barras, maxEntrada]);

  const ejeYMax = barras.length ? ejeYMarcas[0] : 1;

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Rendimiento de elaboración</h2>
        <p className="text-xs text-gray-500 mt-0.5">Salida acumulada de OMs desglosada en producto, subproducto y merma. Haz clic en una barra para ver el detalle.</p>
      </div>
 
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium"><Filter size={14} />Filtrar</div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
          {["mes", "producto", "planta"].map((a) => (
            <button 
              key={a} 
              onClick={() => { setAgrupacion(a); fetchBarras(filtrosActuales(), a); }}
              className={`px-3 py-1.5 capitalize ${agrupacion === a ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <FiltroSelect 
          value={filtroProducto} 
          onChange={setFiltroProducto} 
          allText="Todos los productos" 
          options={filtrosOpciones.productos} 
        />
        <FiltroSelect 
          value={filtroPlanta}
          onChange={setFiltroPlanta}
          allText="Todas las plantas"
          options={filtrosOpciones.plantas}
        />
        <FiltroSelect 
          value={filtroAnio}
          onChange={setFiltroAnio}
          allText="Todos los años"
          options={filtrosOpciones.anios.map((a) => ({ id: a, nombre: String(a) }))}
        />
        {filtroAnio && (
          <FiltroSelect 
            value={filtroMes}
            onChange={setFiltroMes}
            allText="Todos los meses"
            options={MESES.slice(1).map((m, i) => ({ id: i + 1, nombre: m }))}
          />
        )}
        <button 
          onClick={aplicar} 
          className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark"
        >
          Aplicar
        </button>
        {hayFiltros && (
          <button 
            onClick={limpiar} 
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <X size={13} />Limpiar
          </button>
        )}
      </div>
 
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {Object.entries(COLORES_SEGMENTO).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`inline-block w-3 h-3 rounded-sm ${v.bg}`} />
                <span className="capitalize">{k}</span>
              </div>
            ))}
          </div>
          { barras.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center" >No hay datos suficientes para generar un gráfico</p>
          ) : (
            <div className="flex gap-2">
              <div className="flex flex-col justify-between h-56 text-right pr-2 w-14 shrink-0">
                {ejeYMarcas.map((marca, i) => (
                  <span key={i} className="text-[10px] text-gray-400 leading-none">
                    {formatNumCL(marca)}
                  </span>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="relative h-56">
                  <div className="absolute inset-0 z-0 flex flex-col justify-between pointer-events-none">
                    {ejeYMarcas.map((marca, i) => (
                      <div key={i} className="w-full border-t border-gray-100" />
                    ))}
                  </div>
                  <div className="flex gap-2 items-end h-full relative z-10">
                    {barras.map((b) => {
                      const total = b.total_entrada || 1;
                      const pPct  = (b.producto    / total) * 100;
                      const sPct  = (b.subproducto / total) * 100;
                      const mPct  = (b.merma       / total) * 100;
                      const hPct  = b.total_entrada > 0 ? Math.max((b.total_entrada / ejeYMax) * 100, 4) : 0;
                      const activa = barraActiva === b.clave;

                      return (
                        <div key={b.clave} className="flex-1 flex flex-col items-center h-full min-w-0">
                          <div className="w-full flex-1 flex flex-col justify-end items-center">
                            <div className="text-xs text-gray-600 font-medium leading-4 mb-0.5 truncate w-full text-center">
                              {b.total_entrada > 0 ? formatNumCL(b.total_entrada) : ""}
                            </div>
                            <button
                              onClick={() => handleBarraClick(b)}
                              title={`${b.etiqueta}: ${formatNumCL(total)} kg entrada · clic para ver detalle`}
                              className={`w-full rounded-t overflow-hidden transition-all ${activa ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-90"}`}
                              style={{ height: `${hPct}%`, minHeight: b.total_entrada > 0 ? 8 : 0, display: "flex", flexDirection: "column-reverse" }}
                            >
                              {mPct > 0  && <div style={{ height: `${mPct}%`  }} className="w-full bg-orange-400" />}
                              {sPct > 0  && <div style={{ height: `${sPct}%`  }} className="w-full bg-cyan-500" />}
                              {pPct > 0  && <div style={{ height: `${pPct}%`  }} className="w-full bg-primary" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  {barras.map((b) => {
                    const activa = barraActiva === b.clave;
                    return (
                      <div key={b.clave} className="flex-1 min-w-0 flex flex-col items-center">
                        <div className="text-xs text-gray-500 truncate w-full text-center" title={b.etiqueta}>
                          {b.etiqueta.length > 8 ? b.etiqueta.slice(0, 7) + "…" : b.etiqueta}
                        </div>
                        {activa && (
                          <div className="mt-0.5 text-primary">
                            {loadingDetalle ? <Spinner size="sm" label="" /> : <ChevronUp size={14} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {barraActiva && !loadingDetalle && detalle.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  Detalle de elaboraciones — {barras.find((b) => b.clave === barraActiva)?.etiqueta}
                </span>
                <button onClick={() => { setBarraActiva(null); setDetalle([]); }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {["OM", "Fecha", "Producto", "Planta", "Entrada (kg)", "Producto (kg)", "Subprod. (kg)", "Merma (kg)"].map((h) => (
                        <th key={h} className="text-left py-2 px-3 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detalle.map((d) => (
                      <tr key={d.id_orden_manufactura} className={d.inconsistente ? "bg-yellow-50" : ""}>
                        <td className="py-2 px-3 font-medium text-gray-800">#{d.id_orden_manufactura}</td>
                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{fmtFecha(d.fecha)}</td>
                        <td className="py-2 px-3 text-gray-700">{d.producto}</td>
                        <td className="py-2 px-3 text-gray-600">{d.planta}</td>
                        <td className="py-2 px-3 text-center text-gray-700">{formatNumCL(d.total_entrada)}</td>
                        <td className="py-2 px-3 text-center" style={{ color: COLORES_SEGMENTO.producto.hex }}>{formatNumCL(d.producto_bueno)}</td>
                        <td className="py-2 px-3 text-center" style={{ color: COLORES_SEGMENTO.subproducto.hex }}>{formatNumCL(d.subproducto)}</td>
                        <td className="py-2 px-3 text-center" style={{ color: COLORES_SEGMENTO.merma.hex }}>
                          {formatNumCL(d.merma)}
                          {d.inconsistente && <span className="ml-1 text-yellow-600" title="Datos inconsistentes">⚠</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function chipEstado(estado) {
  const v = (estado || "").toLowerCase();
  if (v.includes("ejecuci")) return "bg-cyan-100 text-cyan-800";
  if (v.includes("esperando salidas")) return "bg-orange-100 text-orange-800";
  if (v.includes("esperando pvas")) return "bg-purple-100 text-purple-800";
  if (v.includes("insumos asignados")) return "bg-blue-100 text-blue-800";
  return "bg-yellow-100 text-yellow-800";
}
function FiltroSelect({ value, onChange, allText, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <option value="">{allText}</option>
      {options.map((o) => {
        const id = typeof o === "object" ? String(o.id) : o;
        const label = typeof o === "object" ? o.nombre : o;
        return <option key={id} value={id}>{label}</option>;
      })}
    </select>
  );
}
