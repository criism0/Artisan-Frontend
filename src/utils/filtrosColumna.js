/**
 * Filtro por valores de cada columna, al estilo de una planilla.
 *
 * 🔴 POR QUÉ ES GENÉRICO Y NO UN PANEL A MANO. La primera versión de la vista de Órdenes de
 * Venta traía siete filtros escritos uno por uno. Funcionaba, pero cada lista nueva empieza de
 * cero y cada columna nueva obliga a acordarse de agregarle su filtro. Pedido de Cristóbal
 * (2026-09-02): *«la idea también sería filtrar por valores en cada columna»*. Declarándolo en
 * la columna, el filtro nace junto con ella y lo hereda cualquier tabla de la app.
 *
 * La lógica vive acá y no dentro del componente para poder probarla: las reglas tienen
 * sutilezas que no se ven mirando la pantalla —qué significa una celda vacía, cómo se comparan
 * las fechas— y son justo las que se rompen sin que nadie se entere.
 */

/**
 * Marcador de «esta fila no tiene valor en esta columna».
 *
 * Es `null` y no una cadena centinela a propósito: `null` ES el valor que tiene la celda, viaja
 * por `JSON.stringify` a localStorage sin inventar nada, y no puede chocar con un valor real de
 * los datos como sí podría hacerlo cualquier texto que se nos ocurra.
 */
export const SIN_VALOR = null;

/** Etiqueta con la que se ofrece `SIN_VALOR` en la lista de opciones. */
export const ETIQUETA_SIN_VALOR = "(vacío)";

const esVacio = (v) => v == null || (typeof v === "string" && v.trim() === "");

/** Texto comparable: sin mayúsculas ni tildes, igual que la búsqueda global de la tabla. */
export const normalizar = (t) =>
  (t ?? "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Un día ISO `YYYY-MM-DD` a partir de lo que traiga la fila. */
const dia = (v) => {
  if (esVacio(v)) return null;
  const t = String(v);
  // Ya viene como día o como ISO con hora: se corta y listo. Construir un `Date` acá es lo que
  // introduce el corrimiento de zona horaria que ya costó un día de desvío en el vencimiento
  // de una factura (§0-centies-ter) — acá se vería como una orden que sale del rango del día.
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  // Componentes LOCALES, no `toISOString()`: la fecha que se muestra en pantalla se formatea en
  // hora local, así que filtrar en UTC dejaría fuera lo que el usuario está viendo.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const numero = (v) => {
  if (esVacio(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** ¿Este filtro de columna está puesto? Un filtro vacío no debe contar ni filtrar. */
export function filtroActivo(filtro) {
  if (!filtro) return false;
  switch (filtro.tipo) {
    case "valores":
      return Array.isArray(filtro.seleccion) && filtro.seleccion.length > 0;
    case "texto":
      return Boolean(filtro.q && filtro.q.trim());
    case "numero":
      return filtro.min !== "" && filtro.min != null
        ? true
        : filtro.max !== "" && filtro.max != null;
    case "fecha":
      return Boolean(filtro.desde || filtro.hasta);
    default:
      return false;
  }
}

/** Cuántas columnas tienen filtro puesto. */
export function contarFiltrosColumna(filtros) {
  return Object.values(filtros ?? {}).filter(filtroActivo).length;
}

/** El valor con el que se filtra una fila en una columna. */
export function valorDeFiltro(col, row) {
  if (typeof col?.filtroValor === "function") return col.filtroValor(row);
  if (typeof col?.sortValue === "function") return col.sortValue(row);
  return row?.[col?.accessor];
}

/**
 * Las opciones distintas de una columna, ya ordenadas y con su conteo.
 *
 * Se ofrecen SÓLO los valores que existen en los datos cargados: una opción que devuelve cero
 * filas parece un bug de la tabla, no un filtro bien puesto.
 */
export function opcionesDeColumna(col, data) {
  const cuenta = new Map();
  for (const row of data ?? []) {
    const bruto = valorDeFiltro(col, row);
    const clave = esVacio(bruto) ? SIN_VALOR : String(bruto);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  const opciones = [...cuenta.entries()].map(([valor, n]) => ({
    valor,
    etiqueta: valor === SIN_VALOR ? ETIQUETA_SIN_VALOR : valor,
    n,
  }));
  opciones.sort((a, b) => {
    // Los vacíos al final: son el caso menos buscado y arriba estorban.
    if (a.valor === SIN_VALOR) return 1;
    if (b.valor === SIN_VALOR) return -1;
    return a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true });
  });
  return opciones;
}

/** ¿La fila pasa el filtro de UNA columna? */
export function filaPasaFiltroColumna(col, filtro, row) {
  if (!filtroActivo(filtro)) return true;
  const bruto = valorDeFiltro(col, row);

  switch (filtro.tipo) {
    case "valores": {
      const clave = esVacio(bruto) ? SIN_VALOR : String(bruto);
      return filtro.seleccion.includes(clave);
    }
    case "texto": {
      // Una celda vacía nunca contiene lo que se busca. Devolver `true` acá haría que buscar
      // "MUT" en Comentario trajera además las 128 órdenes que no tienen comentario.
      if (esVacio(bruto)) return false;
      return normalizar(bruto).includes(normalizar(filtro.q).trim());
    }
    case "numero": {
      const n = numero(bruto);
      if (n == null) return false;
      const min = numero(filtro.min);
      const max = numero(filtro.max);
      if (min != null && n < min) return false;
      if (max != null && n > max) return false;
      return true;
    }
    case "fecha": {
      const d = dia(bruto);
      // ⚠️ Una fila sin fecha queda fuera de cualquier rango, a propósito: si pasara, filtrar
      // "esta semana" devolvería además todo lo que no tiene fecha y el filtro no serviría
      // para planificar nada.
      if (!d) return false;
      if (filtro.desde && d < filtro.desde) return false;
      if (filtro.hasta && d > filtro.hasta) return false;
      return true;
    }
    default:
      return true;
  }
}

/** ¿La fila pasa TODOS los filtros de columna puestos? */
export function filaPasaFiltros(columns, filtros, row) {
  for (const col of columns ?? []) {
    const f = filtros?.[col.accessor];
    if (!filtroActivo(f)) continue;
    if (!filaPasaFiltroColumna(col, f, row)) return false;
  }
  return true;
}

/** El filtro vacío que corresponde al tipo declarado por la columna. */
export function filtroVacio(tipo) {
  switch (tipo) {
    case "valores": return { tipo: "valores", seleccion: [] };
    case "texto":   return { tipo: "texto", q: "" };
    case "numero":  return { tipo: "numero", min: "", max: "" };
    case "fecha":   return { tipo: "fecha", desde: "", hasta: "" };
    default:        return null;
  }
}
