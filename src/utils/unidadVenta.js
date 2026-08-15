/**
 * La unidad en que se transa un nombre de facturación. Espejo de `services/unidadVentaOV.ts`.
 *
 * 🔴 Manda las cuatro etapas: cómo se pide en la OV, cómo se pickea, qué dice la guía y qué dice
 * la factura. Casi todo se vende por PIEZA y está estandarizado —un «Yogur Griego 360 g» es UNA
 * unidad—; `Kilogramos` y `Litros` son para lo que se vende a granel.
 *
 * ⚠️ La unidad se lee del catálogo (`unidad_venta`), NUNCA del texto del nombre. Que un producto
 * se llame «… x Kg» no es prueba de nada: es una marca que alguien puso en la ficha.
 *
 * Las dos implementaciones tienen que dar lo mismo. Si la pantalla acepta 1,5 y el backend lo
 * rechaza, el operario llena el formulario para nada; si la pantalla lo rechaza y el backend lo
 * acepta, el pedido no se puede ingresar aunque el sistema lo soporte.
 */

export const UNIDADES_VENTA = ["Unidades", "Kilogramos", "Litros"];

/** Etiqueta corta, la que va al lado de un número. */
const ABREVIATURA = { Unidades: "un", Kilogramos: "kg", Litros: "L" };

/** La unidad de venta de una línea o de un nombre de facturación. `Unidades` si no se sabe. */
export function unidadVentaDe(origen) {
  const bruto =
    origen?.unidad_venta ??
    origen?.NombreFacturacion?.unidad_venta ??
    origen?.nombreFacturacion?.unidad_venta;
  return UNIDADES_VENTA.includes(bruto) ? bruto : "Unidades";
}

/** ¿Admite decimales? Un kilo se parte; una pieza no. */
export function admiteFraccion(unidad) {
  return unidad !== "Unidades";
}

/** «kg», «un», «L» — para pegar a un número. */
export function abreviaturaUnidad(unidad) {
  return ABREVIATURA[unidad] ?? ABREVIATURA.Unidades;
}

/**
 * Cantidad con su unidad, lista para mostrar: «1,5 kg», «12 un».
 *
 * 🔴 La unidad va SIEMPRE, también en unidades. Un número sin unidad se lee en la que el lector
 * espera, y ésa es exactamente la confusión que este campo viene a resolver.
 */
export function cantidadConUnidad(cantidad, unidad, opciones = {}) {
  const texto = formatearCantidad(cantidad);
  if (texto === "—") return texto;
  if (opciones.sinUnidad) return texto;
  return `${texto} ${abreviaturaUnidad(unidad)}`;
}

/**
 * Coma decimal y sin ceros de relleno, que es como se lee en Chile.
 *
 * ⚠️ `null` y `""` son AUSENCIA, no cero. `Number(null)` es 0 y es finito, así que sin esta
 * guarda una cantidad que no llegó se pinta como «0 kg» — un número con pinta de dato, que es
 * peor que un guión.
 */
export function formatearCantidad(valor) {
  if (valor == null || valor === "") return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toLocaleString("es-CL");
  return n.toLocaleString("es-CL", { maximumFractionDigits: 6 });
}

/** El `step` del input: los enteros no deben poder escribirse con coma. */
export function stepDeUnidad(unidad) {
  return admiteFraccion(unidad) ? "0.001" : "1";
}

/**
 * El problema de una cantidad, o `null` si está bien. Mismo criterio que el backend, para que
 * el formulario no deje escribir algo que el servidor va a rechazar.
 */
export function problemaDeCantidad(cantidad, unidad) {
  const n = Number(cantidad);
  if (cantidad === "" || cantidad == null || !Number.isFinite(n)) return "Ingresa una cantidad.";
  if (n <= 0) return "La cantidad debe ser mayor a 0.";
  if (!admiteFraccion(unidad) && !Number.isInteger(n)) {
    return "Este producto se vende por unidad: la cantidad tiene que ser un número entero.";
  }
  return null;
}
