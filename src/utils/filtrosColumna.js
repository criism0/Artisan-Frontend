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
 * sutilezas que no se ven mirando la pantalla —qué significa una celda vacía, cuál de los dos
 * valores de una columna es el que la persona lee— y son justo las que se rompen sin que nadie
 * se entere.
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

/** Fechas que la app muestra formateadas: `toLocaleDateString()` en es-CL da «13-08-2026». */
const ES_FECHA_LOCAL = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

/**
 * Un día ISO `AAAA-MM-DD` a partir de cualquiera de las formas en que las listas guardan una
 * fecha.
 *
 * 🔴 Nunca se construye un `Date` a partir de un texto que ya viene como día: eso es lo que
 * introduce el corrimiento de zona horaria que ya costó un día de desvío en el vencimiento de
 * una factura (§0-centies-ter). Acá se vería como una fila que se sale del rango del día.
 *
 * Acepta también el `dd-mm-aaaa` YA FORMATEADO que algunas vistas dejan en la fila —Órdenes de
 * Compra guarda `fecha` formateada y el ISO aparte en `fecha_raw`—, porque si no, esas columnas
 * no se pueden filtrar por rango.
 */
export function aDiaIso(v) {
  if (esVacio(v)) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = ES_FECHA_LOCAL.exec(t);
  if (!m) return null;
  const [, d, mes, anio] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${anio}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Un número a partir de lo que muestre la celda, incluido el formato chileno con signo peso y
 * puntos de miles (`"$1.234.567"`, `"1.234,50"`).
 *
 * ⚠️ Sólo si TODO el texto es un número con su formato. «Bodega 3» tiene un dígito y no es un
 * número: tratarlo como tal pondría un filtro de rango sobre una columna de nombres.
 */
export function aNumero(v) {
  if (esVacio(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/\d/.test(t)) return null;
  if (!/^[-+]?\s*\$?\s*[\d.,\s]+%?$/.test(t)) return null;
  const limpio = t.replace(/[^\d.,-]/g, "");
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normal;
  if (ultimaComa >= 0) {
    // Formato es-CL completo: el punto es de miles y la coma es la decimal.
    normal = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    // 🔴 Sin coma, el punto es AMBIGUO: «$1.234» son mil doscientos treinta y cuatro pesos,
    // pero «2832.5» es lo que Sequelize entrega para un DOUBLE. Se resuelve por la forma:
    // más de un punto sólo puede ser separador de miles, y uno solo con exactamente tres
    // dígitos detrás lo es cuando el texto venía con signo peso.
    //
    // ⚠️ Y hay que separarlo: dejar `1.234.567` como estaba daba `Number(...)` → NaN, o sea que
    // el total de una lista formateada NO se reconocía como número.
    const puntos = (limpio.match(/\./g) || []).length;
    const sonMiles =
      puntos > 1 || (puntos === 1 && limpio.slice(ultimoPunto + 1).length === 3 && t.includes("$"));
    normal = sonMiles ? limpio.replace(/\./g, "") : limpio;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** ¿Este filtro de columna está puesto? Un filtro vacío no debe contar ni filtrar. */
export function filtroActivo(filtro) {
  if (!filtro) return false;
  switch (filtro.tipo) {
    case "valores":
      return Array.isArray(filtro.seleccion) && filtro.seleccion.length > 0;
    case "texto":
      return Boolean(filtro.q && filtro.q.trim());
    case "numero":
      return (filtro.min !== "" && filtro.min != null) || (filtro.max !== "" && filtro.max != null);
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
 * `col.valor` lo deja resuelto `resolverColumna`, que es quien decide cuál de las dos fuentes de
 * la columna representa lo que se ve en pantalla. El resto es el respaldo para quien llame esto
 * con una columna sin resolver.
 */
export function valorDeFiltro(col, row) {
  if (typeof col?.valor === "function") return col.valor(row);
  if (typeof col?.filtroValor === "function") return col.filtroValor(row);

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
    return String(a.etiqueta).localeCompare(String(b.etiqueta), "es", { numeric: true });
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
      // 🔴 DIFUSO, NO SUBSTRING (pedido de Cristóbal, 2026-09-02): *«por si alguien se equivoca
      // en alguna letra al buscar, que igual salga»*. Se reutiliza el `fuzzyMatch` que ya usan
      // Insumos y los `Selector` con `useFuzzy` en vez de escribir otro: un segundo criterio de
      // parecido haría que la misma consulta encontrara cosas distintas según dónde se escriba.
      return fuzzyMatch(normalizar(bruto), filtro.q);
    }
    case "numero": {
      const n = aNumero(bruto);
      if (n == null) return false;
      const min = aNumero(filtro.min);
      const max = aNumero(filtro.max);
      if (min != null && n < min) return false;
      if (max != null && n > max) return false;
      return true;
    }
    case "fecha": {
      const d = aDiaIso(bruto);
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

// ─── Inferencia ──────────────────────────────────────────────────────────────

/** Qué clase de dato es un valor suelto. */
function claseDeValor(v) {
  if (esVacio(v)) return "vacio";
  if (v instanceof Date) return "fecha";
  if (typeof v === "boolean") return "booleano";
  if (typeof v === "object" || typeof v === "function") return "objeto";
  if (aDiaIso(v) != null) return "fecha";
  if (aNumero(v) != null) return "numero";
  return "texto";
}

/** La clase que comparten TODOS los valores no vacíos de una muestra. */
function claseDominante(valores) {
  const clases = new Set(valores.map(claseDeValor));
  clases.delete("vacio");
  if (clases.size === 0) return "vacio";
  if (clases.size === 1) return [...clases][0];
  // Mezclado no es ni una cosa ni la otra; si hay objetos, la columna no es filtrable.
  return clases.has("objeto") ? "objeto" : "texto";
}

const MAX_MUESTRA = 400;

function muestraDe(obtener, data) {
  const out = [];
  for (const row of data ?? []) {
    let v;
    try { v = obtener(row); } catch { v = undefined; }
    out.push(v);
    if (out.length >= MAX_MUESTRA) break;
  }
  return out;
}

/**
 * ¿Los valores de esta columna se pueden ofrecer como lista para marcar?
 *
 * Pedido de Cristóbal (2026-09-02): *«que puedan ir seleccionando distintos valores de la
 * columna… tal como se hace en ventas, que si filtro los clientes sale para seleccionar algunas
 * opciones»*. Por eso el umbral es generoso: el embudo trae su propio buscador difuso y la lista
 * tiene scroll, así que unos cientos de nombres se manejan bien.
 *
 * Lo que NO sirve como lista es el texto libre y largo —comentarios, descripciones— donde cada
 * fila trae algo distinto y de doscientos caracteres: ahí «contiene» es lo único usable.
 */
function esListable(obtener, data) {
  // 🔴 NO se limita por cuántos valores distintos haya. La primera versión cortaba en 500 y eso
  // dejaba justo a Clientes fuera de la lista —hay 456 en producción y más en la copia local—,
  // que es EL ejemplo que pidió Cristóbal. La lista tiene su buscador difuso y su scroll, y el
  // embudo muestra sólo un tramo: la cantidad no es el problema.
  //
  // Lo que sí descalifica es el largo: un comentario de 200 caracteres no se puede leer como
  // opción de una lista, y ahí «contiene» es lo único usable.
  let suma = 0;
  let n = 0;
  for (const row of data ?? []) {
    let v;
    try { v = obtener(row); } catch { continue; }
    if (esVacio(v)) continue;
    suma += String(v).length;
    n += 1;
  }
  if (n === 0) return false;
  return suma / n <= 60;
}

function tipoDeMuestra(obtener, data) {
  const clase = claseDominante(muestraDe(obtener, data));
  if (clase === "vacio" || clase === "objeto") return null;
  if (clase === "fecha" || clase === "numero") return clase;
  return esListable(obtener, data) ? "valores" : "texto";
}

/**
 * ¿Esta columna numérica es una CANTIDAD (con la que tiene sentido un rango) o un
 * IDENTIFICADOR escrito con dígitos (teléfono, RUT, código de barras)?
 *
 * Dos señales, ninguna adivinada: la columna alineada a la derecha es como estas listas marcan
 * montos y cantidades, y un identificador es largo — un teléfono chileno tiene 9 dígitos, un
 * `id` o un número de orden rara vez pasa de 6.
 */
function esColumnaDeCantidad(col, muestras) {
  // La columna alineada a la derecha es como estas listas marcan montos y cantidades.
  if (col?.align === "right") return true;

  const valores = muestras.flat().filter((v) => !esVacio(v));
  // Signo peso, porcentaje o decimales: nadie escribe así un identificador.
  if (valores.some((v) => typeof v === "string" && /[$%]/.test(v))) return true;
  if (valores.some((v) => { const n = aNumero(v); return n != null && !Number.isInteger(n); })) return true;

  // Y si no, el largo: un teléfono chileno tiene 9 dígitos y un RUT 8; un id, un folio o una
  // cantidad rara vez pasan de 6.
  const digitos = valores
    .map((v) => String(aNumero(v) ?? "").replace("-", "").replace(".", "").length)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (digitos.length === 0) return true;
  return digitos[Math.floor(digitos.length / 2)] <= 6;
}

function elegirPara(tipo, utiles) {
  if (tipo === "fecha") return utiles.find((c) => c.clase === "fecha") ?? utiles[0];
  if (tipo === "numero") {
    return (
      utiles.find((c) => c.clase === "numero" && c.muestra.some((v) => typeof v === "number")) ??
      utiles.find((c) => c.clase === "numero") ??
      utiles[0]
    );
  }
  return utiles.find((c) => c.clase === "texto") ?? utiles[0];
}

/**
 * Qué filtro le corresponde a una columna y CON QUÉ VALOR se compara cada fila.
 *
 * 🔴 EL CRITERIO ES «QUÉ MUESTRA LA CELDA», y hay que decirlo porque ninguna de las dos fuentes
 * obvias sirve sola. Los tres casos los encontramos probando las listas reales el 2026-09-02,
 * no leyendo el código:
 *
 *   · **Solicitudes** ordena sus fechas con `new Date(x).getTime()`, así que su `sortValue` es
 *     un timestamp: tomándolo, las tres columnas de fecha pedían milisegundos.
 *   · **Órdenes de Compra** guarda en la fila la fecha YA FORMATEADA («13-08-2026») y el total
 *     con signo peso, con los valores comparables aparte en `fecha_raw` / `total_neto_raw`:
 *     tomando el accessor, esas dos columnas quedaban como texto.
 *   · **Usuarios** es el caso inverso: el accessor es `role_id` —un número— y el nombre legible
 *     del rol está en `sortValue`. Tomando el accessor se filtraba por ids.
 *
 * Por eso se miran LOS DOS candidatos y se elige por lo que representan: si alguno es una fecha,
 * la columna es de fechas; si los dos son números, es de rango; y si no, se filtra por el
 * candidato legible, que es el que la persona ve en pantalla.
 *
 * ⚠️ Y ante la duda NO pone filtro: un embudo que filtra por algo distinto de lo que muestra la
 * celda es peor que no tener embudo, porque el usuario no tiene cómo darse cuenta.
 *
 * Se puede forzar con `filtro: "texto" | "valores" | "numero" | "fecha"`, apagar con
 * `filtro: false`, y `filtroValor` gana siempre.
 */
export function resolverColumna(col, data) {
  if (!col || col.filtro === false) return null;

  if (typeof col.filtroValor === "function") {
    const tipo = col.filtro ?? tipoDeMuestra(col.filtroValor, data);
    return tipo ? { tipo, valor: col.filtroValor } : null;
  }

  const candidatos = [];
  const tieneClave =
    col.accessor != null &&
    (data ?? []).some((r) => r != null && Object.prototype.hasOwnProperty.call(r, col.accessor));
  if (tieneClave) {
    const get = (row) => row?.[col.accessor];
    const muestra = muestraDe(get, data);
    candidatos.push({ get, muestra, clase: claseDominante(muestra) });
  }
  if (typeof col.sortValue === "function") {
    const muestra = muestraDe(col.sortValue, data);
    candidatos.push({ get: col.sortValue, muestra, clase: claseDominante(muestra) });
  }

  const utiles = candidatos.filter((c) => c.clase !== "objeto" && c.clase !== "vacio");
  if (utiles.length === 0) return null;

  if (col.filtro) return { tipo: col.filtro, valor: elegirPara(col.filtro, utiles).get };

  const fecha = utiles.find((c) => c.clase === "fecha");
  if (fecha) return { tipo: "fecha", valor: fecha.get };

  if (utiles.every((c) => c.clase === "numero")) {
    // Se prefiere el candidato que YA es un número: comparar contra «$1.234» obliga a
    // re-parsearlo en cada fila y en cada tecla.
    const puro = utiles.find((c) => c.muestra.some((v) => typeof v === "number"));
    const elegido = puro ?? utiles[0];
    // ⚠️ NO TODO LO QUE SE ESCRIBE CON DÍGITOS ES UNA CANTIDAD. Un teléfono se reconocía como
    // número y quedaba con un filtro «desde / hasta», que sobre un teléfono no significa nada
    // — visto en Proveedores el 2026-09-02. La señal la da la propia columna: en estas listas
    // los montos y las cantidades se declaran `align: "right"`, y los identificadores no.
    if (!esColumnaDeCantidad(col, utiles.map((c) => c.muestra))) {
      return { tipo: esListable(elegido.get, data) ? "valores" : "texto", valor: elegido.get };
    }
    return { tipo: "numero", valor: elegido.get };
  }

  if (utiles.every((c) => c.clase === "booleano")) return { tipo: "valores", valor: utiles[0].get };

  const legible = utiles.find((c) => c.clase === "texto") ?? utiles[0];
  return { tipo: esListable(legible.get, data) ? "valores" : "texto", valor: legible.get };
}
