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
