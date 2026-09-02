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

import { fuzzyMatch, normalizeText } from "../services/fuzzyMatch";

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

/**
 * Texto comparable.
 *
 * Es el MISMO normalizador que usa `fuzzyMatch`, no uno parecido: si los dos lados normalizan
 * distinto, el atajo de coincidencia directa falla justo en los casos que deberían acertar.
 */
export const normalizar = normalizeText;

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

/**
 * El valor con el que se filtra una fila en una columna.
 *
 * 🔴 EL ORDEN IMPORTA, Y NO ES EL OBVIO. `sortValue` existe para ORDENAR, no para filtrar, y la
 * forma idiomática de ordenar fechas en estas listas es devolver un timestamp
 * (`new Date(x).getTime()`). Tomándolo como valor de filtro, las tres columnas de fecha de
 * Solicitudes quedaron con un filtro NUMÉRICO que pedía milisegundos — cazado probando la lista
 * en vivo el 2026-09-02, no leyendo el código.
 *
 * Por eso manda el valor crudo de la celda cuando sirve para mostrarse, y `sortValue` queda
 * como respaldo para las columnas que pintan un objeto (cliente, bodega, usuario), que es el
 * caso para el que hace falta. `filtroValor` gana siempre: es la declaración explícita.
 */
export function valorDeFiltro(col, row) {
  if (typeof col?.filtroValor === "function") return col.filtroValor(row);

  // 🔴 «La fila NO TRAE el campo» y «el campo viene vacío» son dos cosas distintas, y
  // confundirlas rompió la inferencia. Las columnas de fecha ordenan con
  // `row.x ? new Date(row.x).getTime() : 0`, así que una fila sin fecha devolvía **0** por
  // `sortValue`: la muestra quedaba con ceros y strings ISO mezclados, no era «todo fechas», y
  // las columnas de Solicitudes terminaban con un filtro de TEXTO sobre fechas.
  //
  // Si la clave existe, manda la celda —vacía incluida—. `sortValue` es el respaldo sólo para
  // las columnas que pintan un objeto o que ni siquiera tienen esa clave en la fila.
  const tieneClave =
    row != null && col?.accessor != null &&
    Object.prototype.hasOwnProperty.call(row, col.accessor);

  if (tieneClave) {
    const crudo = row[col.accessor];
    if (crudo == null) return null;
    if (crudo instanceof Date) return crudo;
    if (typeof crudo !== "object" && typeof crudo !== "function") return crudo;
  }

  if (typeof col?.sortValue === "function") return col.sortValue(row);
  return tieneClave ? row[col.accessor] : undefined;
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
    etiqueta: etiquetaDeValor(col, valor),
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

/**
 * Cómo se lee un valor en la lista de opciones.
 *
 * Los booleanos se muestran como «Sí»/«No» y no como `true`/`false`: la columna en pantalla dice
 * una cosa y el embudo tiene que decir la misma. `filtroEtiqueta` deja que una columna traduzca
 * sus propios códigos.
 */
function etiquetaDeValor(col, valor) {
  if (valor === SIN_VALOR) return ETIQUETA_SIN_VALOR;
  if (typeof col?.filtroEtiqueta === "function") return String(col.filtroEtiqueta(valor));
  if (valor === "true") return "Sí";
  if (valor === "false") return "No";
  return valor;
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
      // 🔴 DIFUSO, NO SUBSTRING (pedido de Cristóbal, 2026-09-02): *«por si alguien se equivoca
      // en alguna letra al buscar, que igual salga»*. Se reutiliza el `fuzzyMatch` que ya usan
      // Insumos y los `Selector` con `useFuzzy` en vez de escribir otro: un segundo criterio de
      // parecido haría que la misma consulta encontrara cosas distintas según dónde se escriba.
      //
      // Primero intenta la coincidencia directa y sólo si falla mide distancia de edición, con
      // tolerancia proporcional al largo (1 para tokens cortos, 25% para los largos), así que
      // una consulta larga y bien escrita no arrastra ruido.
      return fuzzyMatch(normalizar(bruto), filtro.q);
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

const ES_NUMERO = /^-?\d+([.,]\d+)?$/;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}([T ]|$)/;

/**
 * Qué filtro le corresponde a una columna que NO lo declara.
 *
 * 🔴 POR QUÉ SE INFIERE Y NO SE DECLARA EN CADA LISTA. Son 29 listas en la app y el pedido de
 * Cristóbal (2026-09-02) es que todas se comporten igual. Declarar el tipo columna por columna
 * significaba tocar 29 archivos hoy y acordarse de hacerlo en cada columna nueva para siempre —
 * o sea, garantizar que con el tiempo unas listas filtren y otras no.
 *
 * ⚠️ LA INFERENCIA ES CONSERVADORA A PROPÓSITO: ante la duda NO pone filtro. Un embudo que
 * filtra por algo distinto de lo que muestra la celda es peor que no tener embudo, porque el
 * usuario no tiene cómo darse cuenta. Por eso se descarta todo lo que no sea un valor simple:
 * una columna que pinta un objeto (`[object Object]`) o que no tiene con qué compararse queda
 * sin filtro hasta que alguien le declare un `filtroValor`.
 *
 * Se puede forzar con `filtro: "texto" | "valores" | "numero" | "fecha"` o apagar con
 * `filtro: false`.
 */
export function inferirFiltro(col, data) {
  if (col?.filtro === false) return null;
  if (col?.filtro) return col.filtro;

  // Una muestra alcanza: se busca de qué TIPO son los valores, no cuántos hay.
  const muestra = [];
  for (const row of data ?? []) {
    const v = valorDeFiltro(col, row);
    if (esVacio(v)) continue;
    muestra.push(v);
    if (muestra.length >= 80) break;
  }
  // Sin un solo valor no se puede saber nada, y una columna vacía tampoco tiene qué filtrar.
  if (muestra.length === 0) return null;

  // Las fechas se miran ANTES de descartar objetos: un `Date` es un objeto, y una columna que
  // declara `sortValue: (r) => new Date(...)` es un caso legítimo que se quedaba sin filtro.
  if (muestra.every((v) => v instanceof Date)) return "fecha";

  // El resto de los objetos, los arreglos y las funciones: no hay forma de mostrarlos como
  // opción ni de compararlos.
  if (muestra.some((v) => typeof v === "object" || typeof v === "function")) return null;

  if (muestra.every((v) => typeof v === "boolean")) return "valores";
  if (muestra.every((v) => typeof v === "number" || ES_NUMERO.test(String(v)))) return "numero";
  if (muestra.every((v) => ES_FECHA.test(String(v)))) return "fecha";

  // Texto: lista de valores cuando se repiten lo suficiente como para leerse (estados,
  // categorías, unidades), y "contiene" cuando cada fila trae algo distinto (nombres, códigos).
  const distintos = new Set(muestra.map(String)).size;
  return distintos <= 15 && distintos < muestra.length ? "valores" : "texto";
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
