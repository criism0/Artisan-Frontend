/**
 * Qué pasó DESPUÉS de facturar — pedido de Cristóbal, 2026-08-24: *«cuando una factura tenga
 * nota de crédito, que indique en estado NC Parcial o NC total según aplique. Pero la NC
 * debería ir en segundo círculo para poder buscar después»*.
 *
 * Es un badge APARTE del de Estado, no fusionado con él: la orden sigue "Facturada" como paso
 * del flujo (así se sigue filtrando/buscando por eso); lo que este badge dice es si ese
 * documento conserva valor comercial. Compartido entre la lista de OV y su detalle para no
 * duplicar el mapeo de colores.
 *
 * Ver `Backend/src/services/libredte/estadoPosteriorFactura.ts` para por qué es un dato
 * DERIVADO (calculado al leer, desde la propia Nota de Crédito/Débito) y no un estado nuevo de
 * `OrdenDeVenta` — tocar esa máquina de estados rompería las decenas de guardas que comparan
 * contra "Facturada" en todo el sistema.
 */

import { POSTERIOR_LABEL } from "../../utils/estadoPosteriorFactura.js";

const POSTERIOR_CLASE = {
  // Roja: la factura quedó SIN valor comercial — es la señal de alerta real.
  NC_TOTAL: "bg-red-100 text-red-700",
  // Ámbar: la factura sigue teniendo valor, pero menor al emitido.
  NC_PARCIAL: "bg-amber-100 text-amber-700",
  // Gris: no cambió ningún monto, es sólo una corrección de texto.
  NC_TEXTO: "bg-gray-100 text-gray-500",
  // Violeta: se corrigió al alza después de una NC — distinto color para no confundirla con una baja.
  ND: "bg-violet-100 text-violet-700",
};

const POSTERIOR_DESCRIPCION = {
  NC_TOTAL: "Anulada por Nota de Crédito: no tiene valor comercial.",
  NC_PARCIAL: "Rebajada por Nota de Crédito: sigue teniendo valor comercial, menor al emitido.",
  NC_TEXTO: "Nota de Crédito de corrección de texto: no cambió ningún monto.",
  ND: "Corregida al alza por Nota de Débito después de una Nota de Crédito.",
};

/**
 * @param info `estado_dte_posterior` tal como lo entrega el backend, o null/undefined.
 * @param size "sm" (por defecto, para tablas) o "md" (para el encabezado del detalle).
 */
export default function EstadoPosteriorBadge({ info, size = "sm" }) {
  if (!info) return null;

  const titulo = [
    `${info.tipo_dte === 61 ? "NC" : "ND"} folio ${info.folio ?? "s/f"}`,
    info.fecha,
    POSTERIOR_DESCRIPCION[info.estado],
    info.motivo && `Motivo: ${info.motivo}`,
  ].filter(Boolean).join(" · ");

  const tamano = size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={`${tamano} rounded-full font-medium whitespace-nowrap ${POSTERIOR_CLASE[info.estado] || "bg-gray-100 text-gray-500"}`}
      title={titulo}
    >
      {POSTERIOR_LABEL[info.estado] || info.estado}
    </span>
  );
}
