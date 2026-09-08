/**
 * En qué estados se puede editar el CONTENIDO de una orden de venta (agregar, corregir o
 * quitar una línea) — espejo de `ESTADOS_CON_LINEAS_EDITABLES` en
 * `Backend/src/controllers/ventas/orden_venta/_helpers.ts`, que es quien de verdad lo hace
 * cumplir. Esto es sólo para no ofrecer un botón que el backend va a rechazar con 409.
 *
 * Pedido de Hernán (2026-09-07): antes sólo se podía editar mientras la orden seguía `Creada`,
 * y una vez validada había que rehacer la nota de venta entera. Decisión de Cristóbal: se
 * extiende hasta que EMPIEZA el picking — en `Validada` no hay nada comprometido todavía.
 *
 * `PendienteIA` queda afuera a propósito: esas órdenes se editan desde la Cola IA, no desde
 * este formulario.
 */
export function puedeEditarLineasOV(estado) {
  return estado === "Creada" || estado === "Validada";
}
