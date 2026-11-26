/**
 * Lógica pura de la vista «Inventario» (2026-09-29), separada para poder probarla.
 *
 * 🔴 El filtro de Tipo se aplica sobre las MISMAS filas que «Todos». Antes cada tipo pedía un
 * endpoint distinto y cada uno contaba distinto: un insumo aparecía con «Materias Primas» y no
 * con «Todos» (reporte de Logística, la leche en polvo de Santiago). Con esto «Todos» es, por
 * construcción, la unión exacta de los tipos. Las filas vienen de `GET /inventario/resumen`.
 */

export const TIPOS = [
  { id: "materia_prima", label: "Materias primas", corta: "MP" },
  { id: "pip", label: "En proceso (PIP)", corta: "PIP" },
  { id: "subproducto", label: "Subproductos", corta: "Sub" },
  { id: "producto_terminado", label: "Productos terminados", corta: "PT" },
];

const ETIQUETA = Object.fromEntries(TIPOS.map((t) => [t.id, t.label]));

export const etiquetaTipo = (tipo) => ETIQUETA[tipo] ?? tipo ?? "—";

export function filtrarPorTipo(filas, tipo) {
  if (!tipo || tipo === "todos") return filas;
  return filas.filter((f) => f.tipo === tipo);
}

/** Cuántas filas hay de cada tipo, más «todos». Para los contadores de las pestañas. */
export function conteoPorTipo(filas) {
  const c = { todos: filas.length };
  for (const t of TIPOS) c[t.id] = 0;
  for (const f of filas) if (f.tipo in c) c[f.tipo] += 1;
  return c;
}

/** Lo que encuentra el buscador: nombre, categoría y tipo. */
export const textoBusqueda = (f) => [f.nombre, f.categoria, etiquetaTipo(f.tipo)].filter(Boolean).join(" ");

const UNIDAD = { kilogramos: "kg", litros: "L", unidades: "un" };
export const abreviaturaUnidad = (u) => UNIDAD[String(u ?? "").toLowerCase()] ?? u ?? "";

export function formatearStock(n, unidad) {
  const texto = Number(n ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 });
  return `${texto} ${abreviaturaUnidad(unidad)}`.trim();
}

export const ENCABEZADOS_EXPORTACION = [
  "Nombre", "Tipo", "Categoría", "Stock", "Unidad", "Bultos", "Estado", "Costo total CLP", "Último movimiento",
];

export const filaExportacion = (f) => [
  f.nombre,
  etiquetaTipo(f.tipo),
  f.categoria,
  f.stock,
  f.unidad_medida,
  f.bultos,
  f.estado_stock ?? "—",
  Math.round(Number(f.precio_total || 0)),
  f.ultimo_movimiento ? new Date(f.ultimo_movimiento).toLocaleString("es-CL") : "—",
];

/**
 * Bajo crítico = `estado_stock: "Peligro"` del backend (stock bajo el mínimo del ítem). Es lo
 * único del estado que se muestra en la lista: «Bien» en 210 filas era ruido (Fase 5, 2026-11-25).
 */
export const esCritico = (f) => f?.estado_stock === "Peligro";

export function filtrarCriticos(filas, soloCriticos) {
  return soloCriticos ? filas.filter(esCritico) : filas;
}

// Una toma se hace en el día. Hay sesiones «Activa» de meses atrás que nadie cerró (6 en
// producción al 2026-11-25): contarlas dejaba fijo el número en ámbar de la pestaña Tomas y
// dejaba de avisar. Cuentan las por validar y las activas de los últimos días.
export const DIAS_TOMA_EN_CURSO = 3;

export function tomaAbierta(s, ahora = Date.now()) {
  if (s?.estado === "Terminada") return true;
  if (s?.estado !== "Activa") return false;
  const t = new Date(s.createdAt ?? s.created_at ?? 0).getTime();
  return Number.isFinite(t) && t > 0 && ahora - t <= DIAS_TOMA_EN_CURSO * 24 * 3600 * 1000;
}
