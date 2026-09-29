/**
 * Lo contado en una toma de inventario, agrupado y exportable (2026-09-29).
 *
 * Reporte de Logística: «al validar desaparece toda la información». La vista de una sesión
 * validada sólo mostraba los cambios aplicados y, si todo cuadraba, quedaba en blanco. Lo
 * contado viene de `GET /sesiones-inventariado/:id/conteo`, que responde igual antes y después
 * de validar.
 */

const UNIDAD = { kilogramos: "kg", litros: "L", unidades: "un" };
export const abreviaturaUnidad = (u) => UNIDAD[String(u ?? "").toLowerCase()] ?? u ?? "";

const r4 = (n) => Math.round(n * 10000) / 10000;

/** Una fila por ítem, con sus bultos adentro. Ordenado por nombre. */
export function agruparConteo(conteo) {
  const grupos = new Map();
  for (const c of conteo) {
    const clave = `${c.es_producto ? "pt" : "mp"}:${c.id_item ?? c.item}`;
    let g = grupos.get(clave);
    if (!g) {
      g = { clave, item: c.item, unidad_medida: c.unidad_medida, bultos: 0, contado: 0, en_sistema: 0, filas: [] };
      grupos.set(clave, g);
    }
    g.bultos += 1;
    g.contado += Number(c.contado || 0);
    g.en_sistema += Number(c.en_sistema || 0);
    g.filas.push(c);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, contado: r4(g.contado), en_sistema: r4(g.en_sistema), diferencia: r4(g.contado - g.en_sistema) }))
    .sort((a, b) => a.item.localeCompare(b.item, "es"));
}

/** Número con coma decimal, como lo lee una planilla en Chile. */
const num = (n) => String(r4(Number(n || 0))).replace(".", ",");
const celda = (v) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * El conteo bulto por bulto como CSV con `;`, que es lo que Excel en Chile abre en columnas.
 * Lleva BOM para que los acentos no salgan rotos.
 */
export function conteoACsv(conteo) {
  const encabezado = [
    "Ítem", "Bulto", "Contado", "En sistema al escanear", "Diferencia", "Unidad",
    "Bodega registrada", "Escaneado por", "Fecha de escaneo",
  ];
  const filas = conteo.map((c) => [
    c.item,
    c.identificador,
    num(c.contado),
    num(c.en_sistema),
    num(Number(c.contado || 0) - Number(c.en_sistema || 0)),
    abreviaturaUnidad(c.unidad_medida),
    c.bodega_original ?? "",
    c.escaneado_por ?? "",
    c.fecha_escaneo ? new Date(c.fecha_escaneo).toLocaleString("es-CL") : "",
  ]);
  return "﻿" + [encabezado, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
}
