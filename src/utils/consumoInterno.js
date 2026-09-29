/**
 * Formato del consumo interno de insumos (2026-09-24), compartido por la lista, el detalle y el
 * panel del dashboard. La unidad llega del backend en minúscula (`kilogramos`, `litros`,
 * `unidades`), que es como la guarda `MateriaPrima`.
 */

const ABREVIATURA = { kilogramos: "kg", litros: "L", unidades: "un" };

export const abreviaturaUnidad = (unidad) =>
  ABREVIATURA[String(unidad ?? "").toLowerCase()] ?? unidad ?? "";

/** «2,5 kg», «40 un». */
export function cantidadConUnidad(n, unidad) {
  const texto = Number(n ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 4 });
  return `${texto} ${abreviaturaUnidad(unidad)}`.trim();
}

export const fmtFechaHora = (d) =>
  d ? new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";
