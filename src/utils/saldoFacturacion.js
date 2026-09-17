/**
 * Facturación parcial de una OV (pedido de Cristóbal, 2026-09-16): una orden puede tener varias
 * facturas, la siguiente sobre lo que faltó.
 *
 * El backend manda por línea `cantidad_facturada`, `cantidad_por_facturar` y `cantidad_saldo`
 * (ver `services/saldoFacturacionOV.ts`). Esto sólo los resume para la pantalla: el cálculo de
 * verdad vive allá, y acá no se recalcula nada que pueda divergir.
 */

export const ESTADO_FACTURADA_PARCIAL = "Facturada parcial";

function neto(cantidad, linea) {
  const precio = Number(linea?.precio_venta || 0);
  const descuento = Number(linea?.porcentaje_descuento || 0);
  return Number(cantidad || 0) * precio * (1 - descuento / 100);
}

function nombreDe(l) {
  return l?.NombreFacturacion?.nombre || l?.ProductoBase?.nombre || `Producto #${l?.id_producto ?? "—"}`;
}

/**
 * @returns {{
 *   hayFacturaPrevia: boolean,     // alguna línea ya tiene algo facturado
 *   netoFacturado: number,         // lo que cubren las facturas vigentes
 *   netoPorFacturar: number,       // lo que va en la PRÓXIMA factura
 *   quedaSaldoTras: boolean,       // tras esa factura, todavía falta parte del pedido
 *   lineasConSaldo: Array<{nombre, pedida, facturada, por_facturar, saldo_tras}>,
 * }}
 */
export function resumenSaldo(lineas) {
  const items = Array.isArray(lineas) ? lineas : [];
  const conDatos = items.filter((l) => l?.cantidad_facturada != null);

  const lineasConSaldo = conDatos
    .map((l) => {
      const pedida = Number(l.cantidad ?? 0);
      const facturada = Number(l.cantidad_facturada ?? 0);
      const porFacturar = Number(l.cantidad_por_facturar ?? 0);
      return {
        nombre: nombreDe(l),
        pedida,
        facturada,
        por_facturar: porFacturar,
        saldo_tras: Math.max(0, Math.round((pedida - facturada - porFacturar) * 1e6) / 1e6),
      };
    })
    .filter((l) => l.saldo_tras > 1e-6);

  return {
    hayFacturaPrevia: conDatos.some((l) => Number(l.cantidad_facturada) > 0),
    netoFacturado: conDatos.reduce((s, l) => s + neto(l.cantidad_facturada, l), 0),
    netoPorFacturar: conDatos.reduce((s, l) => s + neto(l.cantidad_por_facturar, l), 0),
    quedaSaldoTras: lineasConSaldo.length > 0,
    lineasConSaldo,
  };
}

/**
 * ¿La tabla de líneas muestra la columna «Facturado»?
 *
 * 🔴 NO se decide por «alguna línea tiene saldo». Medido en producción el 2026-09-16: 72 OV
 * Facturada tienen picking bajo lo pedido, y ese faltante se resolvió en su momento creando OTRA
 * OV. Mostrarles «falta 40» en ámbar sería afirmar un pendiente que no existe. Sólo se muestra
 * cuando la orden se factura en partes de verdad: está en Facturada parcial, tiene más de una
 * factura vigente, o se le cerró el saldo.
 */
export function muestraColumnaFacturado(orden) {
  return (
    orden?.estado === ESTADO_FACTURADA_PARCIAL ||
    (orden?.saldo_facturacion?.facturas_vigentes ?? 0) > 1 ||
    Boolean(orden?.saldo_cerrado_en)
  );
}

/** ¿Se puede cerrar el saldo? Sólo en Facturada parcial y sin nada pickeado esperando factura. */
export function puedeCerrarSaldo(orden) {
  return (
    orden?.estado === ESTADO_FACTURADA_PARCIAL &&
    orden?.saldo_facturacion?.hay_por_facturar === false
  );
}
