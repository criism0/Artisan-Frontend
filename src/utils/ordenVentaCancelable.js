/**
 * En qué estados se puede cancelar un pedido — pedido de Hernán por correo, reenviado por
 * Cristóbal (2026-09-09): «necesitamos un botón Pedido Cancelado». Espejo del
 * `ESTADOS_CANCELABLES` en `Backend/src/controllers/ventas/orden_venta/transiciones.ts`, que
 * es quien de verdad lo hace cumplir — esto es sólo para no ofrecer un botón que el backend va
 * a rechazar con 400.
 *
 * Coincide a propósito con `puedeEditarLineasOV` (misma frontera: mientras nada está
 * comprometido con bodega). Se declara aparte porque son dos preguntas distintas — «¿se puede
 * tocar el contenido?» vs. «¿se puede cancelar el pedido entero?» — que hoy responden lo mismo
 * pero no tienen por qué seguir haciéndolo si una de las dos cambia de alcance más adelante.
 *
 * Una vez que el picking comprometió bultos (`En picking`/`Lista para facturación`) hay que
 * anular el picking primero; una orden ya facturada se corrige con una nota de crédito, no
 * cancelándola.
 */
export function puedeCancelarOV(estado) {
  return estado === "Creada" || estado === "Validada";
}

/** La orden está cancelada y se puede reabrir de vuelta a su estado anterior. */
export function puedeReabrirCancelacion(estado) {
  return estado === "Cancelada";
}
