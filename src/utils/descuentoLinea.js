/**
 * El descuento de una línea de venta. Espejo de `normalizarDescuento` del backend.
 *
 * 🔴 POR QUÉ VIVE APARTE. El descuento entra en la misma cuenta en cuatro lugares —la tabla del
 * formulario de crear, la de editar, la Cola IA y el detalle de la orden— y si cada uno la
 * escribe por su cuenta terminan discrepando. Es lo que pasó con la conversión a cajas: la tabla
 * calculaba el total con la cantidad sin convertir y mostraba lo correcto mientras se guardaba
 * otra cosa.
 *
 * La regla que ordena todo esto: **el total que se muestra se calcula desde lo que se va a
 * guardar.** Si difieren, tiene que notarse en pantalla y no en la base.
 */

/**
 * El neto de una línea: cantidad × precio, menos el descuento.
 *
 * Es literalmente la cuenta de `recalcIngresoVenta` y de `buildDetalleFromProducts`. Sin
 * redondear: quien muestra decide cómo, y el backend redondea una sola vez al final. Redondear
 * acá haría que la suma de las líneas no calzara con el total de la orden.
 */
export function netoLinea(cantidad, precioUnitario, porcentajeDescuento = 0) {
  const c = Number(cantidad) || 0;
  const p = Number(precioUnitario) || 0;
  const d = Number(porcentajeDescuento) || 0;
  return c * p * (1 - d / 100);
}

/** Cuánto se descuenta en pesos. Para mostrarlo al lado del neto, no para guardarlo. */
export function montoDescontado(cantidad, precioUnitario, porcentajeDescuento = 0) {
  const c = Number(cantidad) || 0;
  const p = Number(precioUnitario) || 0;
  const d = Number(porcentajeDescuento) || 0;
  return c * p * (d / 100);
}

/**
 * El problema de un descuento, o `null` si está bien. Mismo criterio que el servidor.
 *
 * 🔴 EL RANGO NO ES DECORATIVO: la cuenta es `precio × (1 − pct/100)`, así que un 130 deja la
 * línea en monto NEGATIVO y un −5 la convierte en un recargo. Ninguno revienta y ninguno se ve
 * raro en la tabla. El 100 se acepta: regalar una línea es una operación real.
 */
export function problemaDeDescuento(valor) {
  if (valor === "" || valor == null) return null; // sin descuento es lo normal
  const n = Number(valor);
  if (!Number.isFinite(n)) return "El descuento tiene que ser un número.";
  if (n < 0) return "El descuento no puede ser negativo: sería un recargo.";
  if (n > 100) return "El descuento no puede pasar de 100%: dejaría la línea en monto negativo.";
  return null;
}

/** Lo que se manda al backend: siempre un número, 0 cuando no hay descuento. */
export function descuentoAGuardar(valor) {
  if (valor === "" || valor == null) return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * «13%», «13,5%», o «—» cuando no hay descuento.
 *
 * ⚠️ El guión es a propósito: un «0%» en la columna se lee como un descuento que alguien puso
 * en cero, y no es lo mismo que una línea sin descuento.
 */
export function formatearDescuento(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}
