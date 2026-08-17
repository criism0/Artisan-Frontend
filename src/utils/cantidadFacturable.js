/**
 * Cuánto de una línea de venta va REALMENTE en el documento — espejo de
 * `services/cantidadFacturable.ts` del backend.
 *
 * 🔴 Reporte de Hernán, 2026-08-17: *«Cuando se carga una Nota de venta y luego se pickea, si hay
 * menor cantidad y se envía, esta no actualiza el valor en el front. Y al momento de facturar sale
 * la factura completa y no lo pickeado»*.
 *
 * Eran DOS problemas, y éste es el segundo: la web **nunca mencionó `cantidad_pickeada`** —cero
 * coincidencias en todo `src`— así que el dato llegaba en la respuesta y no lo miraba nadie. El
 * operario veía el total del pedido y la factura salía con otro número.
 *
 * Las dos implementaciones tienen que dar lo mismo: si la pantalla muestra un total y el documento
 * sale con otro, nadie se entera hasta que el cliente reclama.
 */

/**
 * La cantidad que va al documento.
 *
 * ⚠️ `cantidad_pickeada` en `null` es **sin picking registrado**, no cero: es el picking
 * referencial y la orden que se factura sin pasar por bodega. Ahí manda lo pedido. En producción
 * 99 de 131 líneas están así.
 */
export function cantidadFacturable(linea) {
  const pickeada = linea?.cantidad_pickeada;
  if (pickeada == null) return Number(linea?.cantidad ?? 0);
  const n = Number(pickeada);
  return Number.isFinite(n) ? n : Number(linea?.cantidad ?? 0);
}

/** ¿Se pickeó esta línea y quedó distinta de lo pedido? */
export function tieneDiferenciaDePicking(linea) {
  if (linea?.cantidad_pickeada == null) return false;
  return cantidadFacturable(linea) !== Number(linea?.cantidad ?? 0);
}

/** ¿Alguna línea de la orden tiene picking registrado? Decide si se muestra la columna. */
export function hayPickingRegistrado(lineas) {
  return Array.isArray(lineas) && lineas.some((l) => l?.cantidad_pickeada != null);
}

/** El neto de una línea con la cantidad indicada, aplicando su descuento. */
function neto(cantidad, linea) {
  const precio = Number(linea?.precio_venta || 0);
  const descuento = Number(linea?.porcentaje_descuento || 0);
  return cantidad * precio * (1 - descuento / 100);
}

/** Neto de la línea tal como se va a facturar. */
export function netoFacturable(linea) {
  return neto(cantidadFacturable(linea), linea);
}

/** Neto de la línea según lo PEDIDO, que es lo que la orden acordó. */
export function netoPedido(linea) {
  return neto(Number(linea?.cantidad ?? 0), linea);
}

/**
 * Lo pedido y lo que se va a facturar, para poder mostrar los dos.
 *
 * 🔴 SE MUESTRAN LOS DOS, NO UNO. El pedido es el acuerdo con el cliente y no deja de existir
 * porque haya faltado stock: es lo que permite saber qué quedó pendiente. Lo facturable es lo que
 * va en el documento. Reemplazar uno por el otro pierde información en cualquiera de las dos
 * direcciones.
 */
export function resumenFacturable(lineas) {
  const items = Array.isArray(lineas) ? lineas : [];
  const pedido = items.reduce((s, l) => s + netoPedido(l), 0);
  const facturable = items.reduce((s, l) => s + netoFacturable(l), 0);
  const diferencias = items.filter(tieneDiferenciaDePicking).map((l) => ({
    nombre:
      l?.NombreFacturacion?.nombre || l?.ProductoBase?.nombre || `Producto #${l?.id_producto ?? "—"}`,
    pedida: Number(l?.cantidad ?? 0),
    pickeada: cantidadFacturable(l),
  }));

  return {
    pedido,
    facturable,
    // Comparación en pesos enteros: los dos netos se redondean al emitir, así que una diferencia
    // por debajo del peso no cambiaría el documento y avisar de ella sería ruido.
    difieren: Math.round(pedido) !== Math.round(facturable),
    hayPicking: hayPickingRegistrado(items),
    diferencias,
    /** Líneas que se pickearon en 0: no van en el documento. */
    sinNada: items.filter((l) => l?.cantidad_pickeada != null && cantidadFacturable(l) <= 0).length,
  };
}
