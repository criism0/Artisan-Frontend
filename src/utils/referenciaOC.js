/**
 * Lo que va a decir la factura sobre la orden de compra y la fecha de pago.
 *
 * Espejo de `services/libredte/referenciaOC.ts` y `condicionPago.ts`. Existe para que el modal
 * de Facturar muestre **exactamente** lo que se va a imprimir, antes de emitir: un DTE mal
 * emitido consume folio y sólo se corrige con nota de crédito.
 *
 * 🔴 Reporte de Hernán, 2026-08-16: *«en las facturas no sale la Orden de Compra. Si no eso nos
 * rechazan»*. El retail casa la factura con su pedido por ese número.
 */

/** Tope del `FolioRef` en el esquema del SII. El campo es alfanumérico, pero acotado. */
export const MAX_FOLIO_REF = 18;

/**
 * El número de OC que va a llevar el documento, o `null` con el motivo.
 *
 * ⚠️ Cuando el `numero_oc` trae una nota pegada —«B202608-04558 - Parmesano 1,5 k»— se toma el
 * PRIMER campo, que en los 10 casos reales de producción es el número. No se trunca a 18: una
 * OC cortada no es una OC más corta, es otra OC, y el cliente no la va a encontrar.
 */
export function derivarFolioOC(numeroOc) {
  const bruto = (numeroOc ?? "").trim();
  if (!bruto) return { folio: null, recortado: false, motivo: "La orden no tiene número de OC." };
  if (bruto.length <= MAX_FOLIO_REF) return { folio: bruto, recortado: false, motivo: null };

  const primero = bruto.split(/\s+/)[0];
  if (primero.length > 0 && primero.length <= MAX_FOLIO_REF) {
    return { folio: primero, recortado: true, motivo: null };
  }
  return {
    folio: null,
    recortado: false,
    motivo:
      `El número de OC tiene ${bruto.length} caracteres y en el documento caben ${MAX_FOLIO_REF}. ` +
      "Déjalo sólo con el número que usa el cliente.",
  };
}

/** minúsculas y sin tildes: «Crédito 30 días» y «Credito 30 dias» son lo mismo. */
function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Días de crédito leídos de la condición de pago del cliente, o `null`.
 *
 * ⚠️ NO adivina. En producción hay valores como «1», «30», «Bloqueado» y
 * «50% Contado; 50% 30 dias» que no son condiciones legibles; convertirlos en una fecha pone
 * un dato inventado en un documento tributario. Lo que no se lee queda vacío y lo escribe quien
 * factura.
 */
export function diasCreditoDe(condicionPago) {
  const texto = normalizar(condicionPago ?? "");
  if (!texto || texto.includes("%") || texto.includes("contado")) return null;
  const m = texto.match(/(\d+)\s*d/);
  if (!m) return null;
  const dias = Number(m[1]);
  return Number.isFinite(dias) && dias > 0 && dias <= 365 ? dias : null;
}

/**
 * La fecha de vencimiento por defecto, en `YYYY-MM-DD`, o `""` si no se pudo derivar.
 *
 * 🔴 La cuenta va en UTC sobre los componentes de la fecha, igual que en el backend.
 * `new Date('2026-08-16')` es medianoche UTC y sumarle días en horario local devuelve el día
 * anterior: la primera versión del backend daba 2026-09-14 donde correspondía el 15. Un día de
 * corrimiento en el vencimiento de una factura es lo que el cliente usa para pagar.
 *
 * Las dos implementaciones tienen que dar lo mismo: si la pantalla propone una fecha y el
 * documento sale con otra, nadie se entera hasta que el cliente reclama.
 */
export function vencimientoPorDefecto(fechaEmision, condicionPago) {
  const dias = diasCreditoDe(condicionPago);
  if (dias == null || !fechaEmision) return "";
  const m = String(fechaEmision).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const vence = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias));
  return vence.toISOString().slice(0, 10);
}
