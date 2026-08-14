/**
 * Cajas ↔ unidades en la web. Espejo de `services/formatoCantidadOV.ts` del backend.
 *
 * 🔴 LA INVARIANTE NO SE TOCA: la orden guarda SIEMPRE unidades y precio por unidad. Esto sólo
 * traduce para mostrar. Guardar cajas en la columna de unidades es el bug del parser EDI del
 * 2026-08-12 — el monto de la línea salía bien y a bodega le pedía 31 unidades en vez de 620.
 *
 * Las dos implementaciones tienen que dar lo mismo: si la pantalla dice 31 cajas y el DTE dice
 * otra cosa, el operario confirma algo que no es lo que se emite.
 */

export function esFormatoCajas(formato) {
  return String(formato ?? "").toUpperCase() === "CAJAS";
}

/** Un tamaño de caja utilizable. 0 y 1 no lo son: el 0 es una ficha sin llenar y "caja de 1"
 *  es una unidad con otro nombre. */
export function tamanoCajaValido(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && Number.isInteger(n) && n > 1;
}

/**
 * @returns {{cajas: number|null, unidades_sueltas: number, unidades_por_caja: number|null,
 *            precio_caja: number|null}}
 */
export function lineaEnCajas(cantidadUnidades, precioUnitario, unidadesPorCaja) {
  if (!tamanoCajaValido(unidadesPorCaja)) {
    return {
      cajas: null,
      unidades_sueltas: Number(cantidadUnidades) || 0,
      unidades_por_caja: null,
      precio_caja: null,
    };
  }
  const porCaja = Number(unidadesPorCaja);
  const unidades = Number(cantidadUnidades) || 0;
  const cajas = Math.floor(unidades / porCaja);
  return {
    cajas,
    unidades_sueltas: unidades - cajas * porCaja,
    unidades_por_caja: porCaja,
    precio_caja: Number(precioUnitario || 0) * porCaja,
  };
}

/** El tamaño de caja de una línea. El nombre de facturación manda: es como se vende. */
export function unidadesPorCajaDeLinea(linea) {
  const candidatos = [
    linea?.NombreFacturacion?.unidades_por_caja,
    linea?.nombreFacturacion?.unidades_por_caja,
    linea?.ProductoBase?.unidades_por_caja,
    linea?.productoBase?.unidades_por_caja,
    linea?.cantidad_por_caja,
  ];
  for (const c of candidatos) if (tamanoCajaValido(c)) return Number(c);
  return null;
}
