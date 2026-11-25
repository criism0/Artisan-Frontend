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

/**
 * En qué estados se puede ELIMINAR una orden: espejo de `ESTADOS_ELIMINABLES` en
 * `Backend/src/controllers/ventas/orden_venta/orden-base.ts`, que es quien lo hace cumplir (409).
 * Borrar arrastra en cascada pallets, pickeo, despacho y entregas, y deja las facturas sin orden:
 * antes la papelera estaba en todas las filas y borraba hasta una orden Facturada (2026-11-25).
 * Desde «En picking» en adelante se anula el picking, se cancela o se emite una nota de crédito.
 */
export function puedeEliminarOV(estado) {
  return ["PendienteIA", "Creada", "Validada", "Cancelada"].includes(estado);
}

/** Motivo corto para el «Eliminar» deshabilitado. */
export const MOTIVO_NO_ELIMINABLE = "Ya está en picking o facturada: anula el picking o emite una nota de crédito";

/** La orden está cancelada y se puede reabrir de vuelta a su estado anterior. */
export function puedeReabrirCancelacion(estado) {
  return estado === "Cancelada";
}
