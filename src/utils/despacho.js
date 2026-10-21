/**
 * Bultos de despacho en la web (plan de rutas §17): cuentas puras para la preparación y cómo se
 * nombra cada bulto. Espejo de `Mobile/artisan/utils/bultosDespacho.ts`.
 */

const redondear = (n) => Math.round(n * 1000) / 1000;
const cant = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });

/** «Caja 2 de 3 · 12 Yogur Griego…» */
export function describirBulto(b) {
  const cabeza = b.tipo === "Suelto" ? "Suelto" : b.tipo === "Caja cerrada" ? `Caja cerrada ${b.numero} de ${b.total}` : `Caja ${b.numero} de ${b.total}`;
  return `${cabeza} · ${(b.lineas ?? []).map((l) => `${cant(l.cantidad)} ${l.nombre}`).join(", ")}`;
}

/** Tono de la insignia de un bulto de despacho según su estado. */
export const TONO_BULTO = {
  Preparado: "bg-blue-50 text-blue-700 border-blue-200",
  "En ruta": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Entregado: "bg-green-50 text-green-700 border-green-200",
  "No entregado": "bg-amber-50 text-amber-800 border-amber-200",
  Devuelto: "bg-amber-50 text-amber-800 border-amber-200",
  Faltante: "bg-red-50 text-red-700 border-red-200",
  Reintegrado: "bg-gray-50 text-gray-600 border-gray-200",
  Merma: "bg-red-50 text-red-700 border-red-200",
  Anulado: "bg-gray-50 text-gray-400 border-gray-200",
};

/** Lo que falta preparar repartido parejo en `n` cajas (entero; lo fraccionado, en la primera). */
export function repartirParejo(lineas, n) {
  const cajas = Math.max(1, Math.floor(n));
  return lineas.map((l) => {
    const total = l.por_preparar;
    if (!Number.isInteger(total)) return Array.from({ length: cajas }, (_, i) => (i === 0 ? total : 0));
    const base = Math.floor(total / cajas);
    const resto = total - base * cajas;
    return Array.from({ length: cajas }, (_, i) => base + (i < resto ? 1 : 0));
  });
}

/** Lo que queda sin caja de cada producto, descontando las cajas cerradas. Debe quedar en 0. */
export function sinCaja(lineas, reparto, enCajasCerradas = {}) {
  return lineas.map((l, i) =>
    redondear(l.por_preparar - (enCajasCerradas[l.id_nombre_facturacion] ?? 0) - (reparto[i] ?? []).reduce((s, n) => s + (Number(n) || 0), 0)),
  );
}
