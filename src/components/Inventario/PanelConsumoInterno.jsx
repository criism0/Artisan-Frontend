import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCLP, formatCLPCompact } from "../../services/formatHelpers";

/**
 * Consumo interno por bodega en el dashboard de inventario (2026-09-28): el costo de lo que se
 * descontó desde la app, semana a semana o mes a mes, apilado por bodega.
 *
 * - Se mide en PESOS porque es lo único que se puede sumar entre insumos distintos.
 * - Los consumos deshechos no cuentan.
 * - El color sigue a la BODEGA, no a su lugar en el ranking: sale de su posición en la lista de
 *   todas las que alguna vez consumieron (ordenada por id), así que no cambia al pasar de semanas
 *   a meses ni cuando una bodega deja de aparecer en el período.
 * - Paleta categórica validada (orden fijo, nunca se repite). Dos de sus colores quedan bajo 3:1
 *   contra el blanco; por eso la tabla de totales va siempre debajo del gráfico.
 */
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const COLOR_OTRAS = "#9ca3af";

const VISTAS = [
  { clave: "semana", etiqueta: "12 semanas", periodos: 12 },
  { clave: "mes", etiqueta: "6 meses", periodos: 6 },
];

const W = 720;
const H = 220;
const M = { top: 12, right: 8, bottom: 26, left: 56 };
const GAP = 2;
const RADIO = 4;

/** 'YYYY-MM-DD' como fecha LOCAL: `new Date('2026-09-21')` es medianoche UTC y en Chile cae el día antes. */
function fechaLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function etiquetaPeriodo(iso, agrupacion, larga = false) {
  const f = fechaLocal(iso);
  if (agrupacion === "mes") {
    return f.toLocaleDateString("es-CL", { month: larga ? "long" : "short", year: larga ? "numeric" : undefined });
  }
  const txt = f.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  return larga ? `Semana del ${txt}` : txt;
}

/** Un tope «redondo» para el eje: 1, 2 o 5 × 10ⁿ. */
function topeRedondo(max) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** Rectángulo con las esquinas de ARRIBA redondeadas: el extremo del dato se redondea, la base no. */
function pathColumna(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export default function PanelConsumoInterno({ api }) {
  const navigate = useNavigate();
  const [vista, setVista] = useState(VISTAS[0]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [foco, setFoco] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api(`/inventario-dashboard/consumo-interno?agrupacion=${vista.clave}&periodos=${vista.periodos}`)
      .then((res) => { if (!cancelado) { setDatos(res?.data ?? null); setError(false); } })
      .catch(() => { if (!cancelado) setError(true); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [api, vista]);

  const modelo = useMemo(() => {
    if (!datos) return null;
    // Color por posición entre TODAS las bodegas con historial; más de ocho se juntan en «Otras».
    const series = [];
    const porBodega = new Map();
    datos.bodegas.forEach((b, i) => {
      if (i < PALETA.length - 1 || datos.bodegas.length <= PALETA.length) {
        const s = { clave: `b${b.id}`, nombre: b.nombre, color: PALETA[i], costo: 0, consumos: 0 };
        series.push(s);
        porBodega.set(b.id, s);
      } else {
        let otras = series.find((s) => s.clave === "otras");
        if (!otras) {
          otras = { clave: "otras", nombre: "Otras bodegas", color: COLOR_OTRAS, costo: 0, consumos: 0 };
          series.push(otras);
        }
        porBodega.set(b.id, otras);
      }
    });

    const columnas = datos.periodos.map((inicio) => ({ inicio, partes: new Map(), total: 0, consumos: 0 }));
    const indice = new Map(columnas.map((c, i) => [c.inicio, i]));
    for (const v of datos.valores) {
      const col = columnas[indice.get(v.inicio)];
      const s = porBodega.get(v.id_bodega);
      if (!col || !s) continue;
      col.partes.set(s.clave, (col.partes.get(s.clave) ?? 0) + v.costo);
      col.total += v.costo;
      col.consumos += v.consumos;
      s.costo += v.costo;
      s.consumos += v.consumos;
    }

    const visibles = series.filter((s) => s.costo > 0);
    const total = visibles.reduce((a, s) => a + s.costo, 0);
    const consumos = visibles.reduce((a, s) => a + s.consumos, 0);
    return { series: visibles, columnas, total, consumos };
  }, [datos]);

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Consumo interno por bodega</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Costo de los insumos descontados desde la app. No cuenta los consumos deshechos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm" role="group" aria-label="Período">
            {VISTAS.map((v) => (
              <button
                key={v.clave}
                type="button"
                onClick={() => { setVista(v); setFoco(null); }}
                aria-pressed={vista.clave === v.clave}
                className={`px-3 py-1.5 ${vista.clave === v.clave ? "bg-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => navigate("/Inventario/consumo-interno")} className="text-sm text-primary hover:underline">
            Ver consumos →
          </button>
        </div>
      </div>

      {cargando && !modelo ? (
        <div className="text-sm text-gray-500">Cargando consumos…</div>
      ) : error ? (
        <div className="text-sm text-red-600">No se pudo cargar el consumo interno.</div>
      ) : !modelo || modelo.series.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-5 text-sm text-gray-500 text-center">
          Sin consumos internos en {vista.clave === "mes" ? "los últimos 6 meses" : "las últimas 12 semanas"}.
          Se registran desde la app, en las bodegas que lo tienen habilitado.
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <span className="text-2xl font-bold text-text mr-2">{formatCLP(modelo.total, 0)}</span>
            en {modelo.consumos} consumo{modelo.consumos === 1 ? "" : "s"}
          </p>
          <Grafico modelo={modelo} agrupacion={datos.agrupacion} foco={foco} setFoco={setFoco} />
          <TablaTotales modelo={modelo} />
        </>
      )}
    </div>
  );
}

function Grafico({ modelo, agrupacion, foco, setFoco }) {
  const { columnas, series } = modelo;
  const tope = topeRedondo(Math.max(...columnas.map((c) => c.total), 1));
  const altoUtil = H - M.top - M.bottom;
  const banda = (W - M.left - M.right) / columnas.length;
  const ancho = Math.min(24, banda * 0.6);
  const y = (v) => M.top + altoUtil - (v / tope) * altoUtil;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * tope);
  const col = foco == null ? null : columnas[foco];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Costo del consumo interno por ${agrupacion === "mes" ? "mes" : "semana"}, apilado por bodega. El detalle está en la tabla de abajo.`}
        onMouseLeave={() => setFoco(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#eef0f3" strokeWidth="1" />
            <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6b7280">
              {formatCLPCompact(t)}
            </text>
          </g>
        ))}

        {columnas.map((c, i) => {
          const x = M.left + i * banda + (banda - ancho) / 2;
          const partes = series.map((s) => ({ s, v: c.partes.get(s.clave) ?? 0 })).filter((p) => p.v > 0);
          let base = y(0);
          return (
            <g key={c.inicio}>
              {partes.map((p, k) => {
                const alto = y(0) - y(p.v);
                const arriba = base - alto;
                // Separación de 2px entre segmentos; el de más arriba lleva el extremo redondeado.
                const altoDibujo = Math.max(alto - (k > 0 ? GAP : 0), 0.5);
                const yDibujo = arriba;
                base = arriba;
                const esUltimo = k === partes.length - 1;
                return esUltimo ? (
                  <path key={p.s.clave} d={pathColumna(x, yDibujo, ancho, altoDibujo, RADIO)} fill={p.s.color} opacity={foco == null || foco === i ? 1 : 0.45} />
                ) : (
                  <rect key={p.s.clave} x={x} y={yDibujo} width={ancho} height={altoDibujo} fill={p.s.color} opacity={foco == null || foco === i ? 1 : 0.45} />
                );
              })}
              <text x={M.left + i * banda + banda / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7280">
                {etiquetaPeriodo(c.inicio, agrupacion)}
              </text>
              {/* Zona de hover: toda la banda, más grande que la columna. */}
              <rect
                x={M.left + i * banda}
                y={M.top}
                width={banda}
                height={altoUtil}
                fill="transparent"
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
              />
            </g>
          );
        })}
        <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#d1d5db" strokeWidth="1" />
      </svg>

      {col && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((M.left + (foco + 0.5) * banda) / W) * 100}%`,
            transform: foco > columnas.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <div className="font-semibold text-gray-800 mb-1 capitalize">{etiquetaPeriodo(col.inicio, agrupacion, true)}</div>
          {col.total === 0 ? (
            <div className="text-gray-500">Sin consumos</div>
          ) : (
            <>
              {series.filter((s) => (col.partes.get(s.clave) ?? 0) > 0).map((s) => (
                <div key={s.clave} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-gray-700">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.nombre}
                  </span>
                  <span className="tabular-nums text-gray-800">{formatCLP(col.partes.get(s.clave), 0)}</span>
                </div>
              ))}
              <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between gap-3 text-gray-800 font-medium">
                <span>Total · {col.consumos} consumo{col.consumos === 1 ? "" : "s"}</span>
                <span className="tabular-nums">{formatCLP(col.total, 0)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Leyenda y vista en tabla a la vez: nombra cada color y da los números exactos. */
function TablaTotales({ modelo }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Bodega</th>
            <th className="px-3 py-2 text-right font-semibold">Consumos</th>
            <th className="px-3 py-2 text-right font-semibold">Costo</th>
            <th className="px-3 py-2 text-right font-semibold">% del total</th>
          </tr>
        </thead>
        <tbody>
          {modelo.series.map((s) => (
            <tr key={s.clave} className="border-t border-gray-100">
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  {s.nombre}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{s.consumos}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCLP(s.costo, 0)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                {modelo.total > 0 ? `${Math.round((s.costo / modelo.total) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
