/**
 * Comparación del formato (gramaje / volumen) entre lo que pidió el cliente y el producto que
 * el fuzzy matching sugiere.
 *
 * 🔴 POR QUÉ EXISTE. Medido en producción el 2026-08-11: el matching sugiere productos con
 * **100% de similitud** cuando el gramaje NO coincide —"Queso Camembert 100 g" → "Queso
 * Camembert 150 g" (5 veces), "…Finas Hierbas 100 g" → "…Finas Hierbas 180 g"—. El puntaje se
 * calcula sobre el texto e ignora los números, así que un formato distinto no lo baja nada.
 *
 * Es el peor tipo de error: alta confianza, producto distinto y PRECIO DISTINTO. Un operario
 * que confía en el 100% factura otra cosa. Acá no se cambia el puntaje —eso es del backend—:
 * se detecta el desacuerdo para poder avisarlo en pantalla.
 */

// Se listan los sufijos largos antes que los cortos: si `k` se probara primero, "kg" quedaría
// partido y "g" capturaría la sobra.
const UNIDADES = [
  ["kilogramos", 1000], ["kilogramo", 1000], ["kilos", 1000], ["kilo", 1000], ["kg", 1000], ["k", 1000],
  ["gramos", 1], ["gramo", 1], ["grs", 1], ["gr", 1], ["g", 1],
  ["litros", 1000], ["litro", 1000], ["lts", 1000], ["lt", 1000], ["l", 1000],
  ["ml", 1], ["cc", 1],
];

const PESO = new Set(["kilogramos", "kilogramo", "kilos", "kilo", "kg", "k", "gramos", "gramo", "grs", "gr", "g"]);

const PATRON = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES.map(([u]) => u).join("|")})(?![a-záéíóúñ])`,
  "gi",
);

/**
 * Última medida que aparece en el texto, normalizada. Se toma la última porque el formato va
 * al final del nombre comercial ("Queso Cabra Ahumado Lingote 3.5 k").
 * Devuelve `null` si el texto no declara ninguna.
 */
export function medirFormato(texto) {
  if (!texto || typeof texto !== "string") return null;
  const encontrados = [...texto.matchAll(PATRON)];
  if (encontrados.length === 0) return null;

  const [, numero, unidad] = encontrados[encontrados.length - 1];
  const u = unidad.toLowerCase();
  const factor = UNIDADES.find(([nombre]) => nombre === u)?.[1] ?? 1;
  const valor = Number(numero.replace(",", ".")) * factor;
  if (!Number.isFinite(valor) || valor <= 0) return null;

  return { valor, magnitud: PESO.has(u) ? "peso" : "volumen", texto: `${numero} ${unidad}` };
}

/**
 * Compara el formato pedido con el sugerido.
 *
 * - `coincide`   → los dos declaran formato y es el mismo
 * - `difiere`    → los dos declaran formato y NO es el mismo (el caso peligroso)
 * - `incompleto` → sólo uno lo declara: no se puede confirmar, conviene mirarlo
 * - `sin_datos`  → ninguno lo declara
 */
export function compararFormato(descripcionPedida, nombreSugerido) {
  const pedido = medirFormato(descripcionPedida);
  const sugerido = medirFormato(nombreSugerido);

  if (!pedido && !sugerido) return { estado: "sin_datos", pedido: null, sugerido: null };
  if (!pedido || !sugerido) return { estado: "incompleto", pedido, sugerido };

  // Peso contra volumen no es comparable: 150 g y 150 ml no son el mismo formato aunque el
  // número calce, así que se trata como distinto.
  const mismo = pedido.magnitud === sugerido.magnitud && pedido.valor === sugerido.valor;
  return { estado: mismo ? "coincide" : "difiere", pedido, sugerido };
}
