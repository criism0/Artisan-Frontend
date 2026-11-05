/**
 * Cantidad de un producto sin QR en su unidad de venta. Por unidad y con caja: «18 un · 3 cj»;
 * por kilo: «9,5 kg».
 */
export function cantidadSinQr(n, producto) {
  const v = Number(n) || 0;
  const unidad = producto?.unidad_venta;
  if (unidad === "Kilogramos" || unidad === "Litros") {
    return `${v.toLocaleString("es-CL", { maximumFractionDigits: 3 })} ${unidad === "Litros" ? "L" : "kg"}`;
  }
  const porCaja = Number(producto?.unidades_por_caja) || 0;
  const base = `${v.toLocaleString("es-CL")} un`;
  if (porCaja <= 1 || Math.abs(v) < porCaja) return base;
  const cajas = Math.trunc(v / porCaja);
  const sueltas = Math.abs(v - cajas * porCaja);
  return `${base} · ${cajas} cj${sueltas ? ` + ${sueltas}` : ""}`;
}

/** Un color por tipo de movimiento: lo que entra en verde, lo que sale en ámbar, la toma en morado. */
export const TONO_MOVIMIENTO_SIN_QR = {
  Toma: "bg-violet-100 text-violet-800",
  "Producción no registrada": "bg-green-100 text-green-800",
  Ajuste: "bg-gray-100 text-gray-700",
  "Picking OV": "bg-amber-100 text-amber-800",
  "Despacho solicitud": "bg-orange-100 text-orange-800",
  "Recepción solicitud": "bg-sky-100 text-sky-800",
};
