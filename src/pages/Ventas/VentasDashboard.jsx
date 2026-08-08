import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  Filter,
  Scale,
  Send,
  ShoppingCart,
  Truck,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import { dteService } from "../../services/dteService.js";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import {
  cargarDatosVentas,
  cargarQuiebres,
  calcularKpisVentas,
  ovsPorEstado,
  tendenciaMensualVentas,
  topClientes,
  pendientesVentas,
  colorEstadoVenta,
  opcionesFiltros,
} from "../../services/ventasAnalytics";
import { formatCLP, formatCLPCompact } from "../../services/formatHelpers";
import KpiCard from "../../components/UI/KpiCard";

const formatEjeY = (num) => formatCLPCompact(num, true);

const formatoFechaLarga = (d) =>
  d.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function VentasDashboard() {
  const api = useApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [emisionesTrabadas, setEmisionesTrabadas] = useState(0);

  // Consulta aparte y barata: no consulta LibreDTE, sólo nuestra tabla. Si falla, el
  // dashboard no se cae ni avisa — el aviso vive en la vista de conciliación, y una
  // alerta rota acá haría dudar del resto del tablero.
  useEffect(() => {
    let cancelled = false;
    dteService
      .listarEmisionesAbiertas()
      .then((abiertas) => {
        if (!cancelled) setEmisionesTrabadas(Array.isArray(abiertas) ? abiertas.length : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosVentas(api)
      .then((d) => {
        if (cancelled || !d) return;
        const { ordenes, direccionToCliente, bodegas } = d;
        setData({
          ordenes,
          direccionToCliente,
          bodegas,
          kpis: calcularKpisVentas(ordenes),
          porEstado: ovsPorEstado(ordenes),
          tendencia: tendenciaMensualVentas(ordenes, 6),
          topCls: topClientes(ordenes, direccionToCliente, 5),
          pendientes: pendientesVentas(ordenes, direccionToCliente, 8),
          filtros: opcionesFiltros(ordenes, direccionToCliente),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || "Error al cargar datos de ventas.";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <PageLoader message="Cargando dashboard de ventas" />;

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Dashboard de Ventas</h1>
            <p className="text-sm text-gray-500 capitalize mt-1">
              {formatoFechaLarga(new Date())}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate("/ventas/ordenes")}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            >
              Ver órdenes
            </button>
            <button
              onClick={() => navigate("/ventas/ordenes/add")}
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

        {!error && data && (
          <DashboardContent data={data} navigate={navigate} api={api} emisionesTrabadas={emisionesTrabadas} />
        )}
      </div>
    </div>
  );
}

function DashboardContent({ data, navigate, api, emisionesTrabadas = 0 }) {
  const { ordenes, direccionToCliente, filtros, bodegas } = data;

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("");

  const ordenesFiltradas = useMemo(() => {
    if (!filtroCliente && !filtroCanal) return ordenes;
    return ordenes.filter((o) => {
      const c = direccionToCliente.get(o.id_local);
      if (filtroCliente && String(c?.id) !== filtroCliente) return false;
      if (filtroCanal && String(c?.id_canal) !== filtroCanal) return false;
      return true;
    })
  }, [ordenes, direccionToCliente, filtroCliente, filtroCanal]);

  const kpis = useMemo(() => calcularKpisVentas(ordenesFiltradas), [ordenesFiltradas]);
  const porEstado = useMemo(() => ovsPorEstado(ordenesFiltradas), [ordenesFiltradas]);
  const tendencia = useMemo(() => tendenciaMensualVentas(ordenesFiltradas, 6), [ordenesFiltradas]);
  const topCls = useMemo(() => topClientes(ordenesFiltradas, direccionToCliente, 5), [ordenesFiltradas, direccionToCliente]);
  const pendientes = useMemo(() => pendientesVentas(ordenesFiltradas, direccionToCliente, 8), [ordenesFiltradas, direccionToCliente]);
  
  const hayFiltros = filtroCliente || filtroCanal;
  
  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Filter size={15} />
          Filtrar por
        </div>
        <FilterOption 
          value={filtroCliente} 
          onChange={setFiltroCliente} 
          allText={"Todos los clientes"} 
          options={filtros.clientes}
        />
        <FilterOption
          value={filtroCanal}
          onChange={setFiltroCanal}
          allText={"Todos los canales"}
          options={filtros.canales}
        />
        {hayFiltros && (
          <>
            <button
              onClick={() => {setFiltroCliente(""); setFiltroCanal(""); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 ml-1"
            >
              <X size={13} /> Limpiar filtros
            </button>
            <span className="ml-auto text-xs text-gray-500">
              Mostrando {ordenesFiltradas.length} de {ordenes.length} órdenes
            </span>
          </>
        )}
        
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<ShoppingCart className="text-blue-600" size={22} />}
          label="Órdenes totales"
          value={kpis.total_ovs}
          subtitle={`${kpis.pendientes} pendientes · ${kpis.entregadas} entregadas`}
          accent="blue"
        />
        <KpiCard
          icon={<DollarSign className="text-indigo-600" size={22} />}
          label="Monto facturado"
          value={formatCLPCompact(kpis.monto_total)}
          subtitle="Suma de todas las OVs"
          accent="blue"
        />
        <KpiCard
          icon={<TrendingUp className="text-green-600" size={22} />}
          label="Mes actual"
          value={formatCLPCompact(kpis.monto_mes_actual)}
          subtitle="Monto emitido este mes"
          accent="green"
        />
        <KpiCard
          icon={<CheckCircle className="text-lime-600" size={22} />}
          label="Tasa de entrega"
          value={pctText(kpis.entregadas, kpis.total_ovs)}
          subtitle={`${kpis.entregadas} de ${kpis.total_ovs} entregadas`}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <GraficoTendencia tendencia={tendencia} />
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-text">OVs por estado</h2>
          <div className="space-y-3">
            {(() => {
              const totalPorEstado = porEstado.reduce((acc, e) => acc + e.cantidad, 0) || 1;
              return porEstado
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
                          className={`${colorEstadoVenta(e.estado)} h-2 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                });
            })()}
            {porEstado.every((e) => e.cantidad === 0) && (
              <p className="text-sm text-gray-500">Sin órdenes registradas.</p>
            )}
          </div>
        </div>
      </div>

      <TablaQuiebres api={api} filtros={filtros} bodegas={bodegas} />
      {/* Bandeja DTE Emitidos */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/ventas/bandeja-dte-emitidos")}
          className="w-full flex items-center gap-4 p-5 bg-white rounded-lg shadow border border-gray-200 hover:border-green-400 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors shrink-0">
            <Send size={24} className="text-green-600" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm">Bandeja DTE Emitidos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Consulta facturas, guías de despacho y documentos emitidos a clientes vía LibreDTE
            </p>
          </div>
          <span className="text-gray-400 group-hover:text-green-500 transition-colors text-lg shrink-0">→</span>
        </button>
      </div>

      {/*
        Conciliación con LibreDTE. La tarjeta trae el conteo de emisiones trabadas para que se
        vea desde acá que hay algo bloqueado, sin tener que entrar: una emisión trabada impide
        volver a facturar esa orden, y antes de esto sólo se detectaba al intentarlo.
      */}
      <div className="mb-6">
        <button
          onClick={() => navigate("/ventas/conciliacion-libredte")}
          className={`w-full flex items-center gap-4 p-5 bg-white rounded-lg shadow border transition-all group ${
            emisionesTrabadas > 0
              ? "border-red-300 hover:border-red-400"
              : "border-gray-200 hover:border-indigo-400"
          } hover:shadow-md`}
        >
          <div
            className={`p-3 rounded-lg transition-colors shrink-0 ${
              emisionesTrabadas > 0 ? "bg-red-50 group-hover:bg-red-100" : "bg-indigo-50 group-hover:bg-indigo-100"
            }`}
          >
            <Scale size={24} className={emisionesTrabadas > 0 ? "text-red-600" : "text-indigo-600"} />
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm">Conciliación con LibreDTE</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {emisionesTrabadas > 0
                ? `${emisionesTrabadas} emisión${emisionesTrabadas === 1 ? "" : "es"} trabada${
                    emisionesTrabadas === 1 ? "" : "s"
                  }: esas órdenes no se pueden volver a facturar hasta revisarlas`
                : "Compara nuestros documentos con los emitidos y los borradores de LibreDTE"}
            </p>
          </div>
          {emisionesTrabadas > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold shrink-0">
              {emisionesTrabadas}
            </span>
          )}
          <span
            className={`transition-colors text-lg shrink-0 ${
              emisionesTrabadas > 0 ? "text-red-400 group-hover:text-red-600" : "text-gray-400 group-hover:text-indigo-500"
            }`}
          >
            →
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Pendientes y alertas</h2>
            <button
              onClick={() => navigate("/ventas/ordenes")}
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
                  Todas las órdenes están entregadas.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pendientes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/ventas/ordenes/${p.id}`)}
                  className="w-full text-left flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <IconoTipoPendiente tipo={p.tipo} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        OV #{p.id} · {p.cliente}
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
          <h2 className="text-lg font-semibold text-text">Top clientes</h2>
          {topCls.length === 0 ? (
            <p className="text-sm text-gray-500">Sin órdenes registradas.</p>
          ) : (
            <div className="space-y-3">
              {topCls.map((c, i) => (
                <div key={c.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-gray-500">#{i + 1}</p>
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {c.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.cantidad} OV{c.cantidad === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">
                      {formatCLPCompact(c.monto)}
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

function TablaQuiebres({ api, filtros, bodegas=[] }) {
  const [rows, setRows] = useState([]);
  const [loadingQuiebres, setLoadingQuiebres] = useState(true);
  const [errorQuiebres, setErrorQuiebres] = useState(null);

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroBodega, setFiltroBodega] = useState("");

  const [productosOpciones, setProductosOpciones] = useState([]);

  const bodegasOpciones = useMemo(
    () => bodegas.map((b) => ({ id: b.id, nombre:b.nombre })),
    [bodegas]
  );

  const fetchQuiebres = useCallback(async (f={}) => {
    setLoadingQuiebres(true);
    setErrorQuiebres(null);
    try {
      const data = await cargarQuiebres(api, f);
      setRows(data);
      if (!f.id_cliente && !f.id_canal && !f.id_producto) {
        const vistos = new Map();
        for (const r of data) {
          if (r.id_producto && r.producto) vistos.set(r.id_producto, r.producto);
        }
        setProductosOpciones(
          Array.from(vistos.entries())
            .map(([id, nombre]) => ({ id, nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
      }
    } catch (err) {
      setErrorQuiebres(err?.message || "Error al cargar quiebres de stock");
    } finally {
      setLoadingQuiebres(false);
    }
  }, [api]);

  useEffect(() => { fetchQuiebres();}, [fetchQuiebres]);

  const aplicarFiltros = () => {
    fetchQuiebres({
      id_cliente: filtroCliente ? Number(filtroCliente) : undefined,
      id_canal: filtroCanal ? Number(filtroCanal) : undefined,
      id_producto: filtroProducto ? Number(filtroProducto) : undefined,
      id_bodega: filtroBodega ? Number(filtroBodega) : undefined,
    });
  };

  const limpiarFiltros = () => {
    setFiltroCliente("");
    setFiltroCanal("");
    setFiltroProducto("");
    setFiltroBodega("");
    fetchQuiebres();
  };

  const hayFiltros = filtroCliente || filtroCanal || filtroProducto || filtroBodega;
  const conQuiebre = rows.filter((r) => r.quiebre).length;

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Stock vs. ventas pendientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">OVs en estados anteriores a picking contrastadas con el inventario de producto terminado</p>
        </div>
        {conQuiebre > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
            <AlertTriangle size={13} />
            {conQuiebre} producto{conQuiebre === 1 ? "" : "s"} con quiebre
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
          <Filter size={14} />
          Filtrar tabla
        </div>
        <FilterOption
          value={filtroCliente}
          onChange={setFiltroCliente}
          allText="Todos los clientes"
          options={filtros.clientes}
        />
        <FilterOption
          value={filtroCanal}
          onChange={setFiltroCanal}
          allText="Todos los canales"
          options={filtros.canales}
        />
        <FilterOption 
          value={filtroProducto}
          onChange={setFiltroProducto}
          allText="Todos los productos"
          options={productosOpciones}
        />
        <FilterOption 
          value={filtroBodega}
          onChange={setFiltroBodega}
          allText="Todas las bodegas"
          options={bodegasOpciones}
        />
        <button
          onClick={aplicarFiltros}
          className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary-dark"
        >
          Aplicar
        </button>
        {hayFiltros && (
          <button 
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>
      {loadingQuiebres ? (
        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
          <Spinner />
        </div>
      ) : errorQuiebres ? (
        <p className="text-sm text-red-500 py-4">{errorQuiebres}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Producto", "Bodega", "Demanda", "Stock disponible", "Faltante", "Estado"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className={r.quiebre ? "bg-red-50" : ""}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{r.producto}</td>
                    <td className="py-2.5 pr-4 text-gray-600 text-xs">{r.bodega || "—"}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-700">{r.demanda} u</td>
                    <td className="py-2.5 pr-4 text-center text-gray-700">{r.stock_disponible} u</td>
                    <td className="py-2.5 pr-4 text-center">
                      {r.faltante > 0 ? (
                        <span className="font-semibold text-red-600">-{r.faltante} u</span>
                      ) : (
                        <span className="text-green-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {r.quiebre ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">
                          <AlertTriangle size={11} /> Quiebre
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
                          <CheckCircle size={11} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GraficoTendencia({ tendencia }) {
  const hayDatos = tendencia.some((t) => t.monto > 0);
  const maxMonto = hayDatos ? Math.max(...tendencia.map((t) => t.monto)): 0;
  const ejeYMarcas = useMemo(() => {
    const pasos = 4;
    if (!hayDatos) {
      return Array.from({ length: pasos + 1}, (_, i) => (pasos - 1 ) * 1_000_000 );
    }
    const step = maxMonto / pasos;
    const mag = Math.pow(10, Math.floor(Math.log10(step)));
    const niceStep = Math.ceil(step/mag)*mag;
    return Array.from({ length: pasos + 1 }, (_, i) => i*niceStep).reverse();
  }, [hayDatos, maxMonto]);

  const ejeYMax = hayDatos ? ejeYMarcas[0] : 1;

  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Tendencia mensual</h2>
        <span className="text-xs text-gray-500">Últimos 6 meses</span>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between h-56 text-right pr-2 w-12 shrink-0">
          {ejeYMarcas.map((marca, i) => (
            <span key={i} className="text-[10px] text-gray-400 leading-none">
              {formatEjeY(marca)}
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
                        title={`${b.label}: ${b.cantidad} OVs · ${formatCLP(b.monto)}`}
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
          <span>Altura: monto facturado (CLP)</span>
        </div>
      </div>
    </div>
  );
}

function IconoTipoPendiente({ tipo }) {
  if (tipo === "Pendiente de asignar")
    return <ClipboardList className="text-gray-600 mt-1" size={18} />;
  if (tipo === "Por facturar")
    return <UserCheck className="text-blue-600 mt-1" size={18} />;
  if (tipo === "Por despachar")
    return <FileText className="text-yellow-600 mt-1" size={18} />;
  if (tipo === "Por enviar" || tipo === "En tránsito")
    return <Truck className="text-purple-600 mt-1" size={18} />;
  return <Clock className="text-gray-600 mt-1" size={18} />;
}

function pctText(a, b) {
  if (!b) return "0%";
  return `${Math.round((a / b) * 100)}%`;
}
function FilterOption({value, onChange, allText, options}) {
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
        return <option key={id} value={id}>{label}</option>
      })}
    </select>
  );
}