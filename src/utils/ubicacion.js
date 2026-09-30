/**
 * Ubicación en el mapa (rutas de entrega, Fase 0). Espejo de `services/mapas/precision.ts` del
 * backend: qué precisión sirve para rutear y cómo se dice en palabras.
 *
 * Google devuelve algo para casi cualquier texto chileno, y con una calle que no conoce cae al
 * centro de la comuna diciendo OK igual. «Tiene coordenadas» no es «se puede rutear»: sólo la
 * puerta, la cuadra o un pin que alguien puso a mano.
 */
export const PRECISIONES_CONFIABLES = ["ROOFTOP", "RANGE_INTERPOLATED", "MANUAL"];

export function esUbicacionConfiable(lat, lng, precision) {
  return lat != null && lng != null && PRECISIONES_CONFIABLES.includes(String(precision ?? ""));
}

/** { texto, tono } — tono: "ok" | "duda" | "falta". */
export function describirUbicacion(lat, lng, precision) {
  if (lat == null || lng == null) return { texto: "Sin ubicar", tono: "falta" };
  switch (precision) {
    case "ROOFTOP": return { texto: "Ubicación exacta", tono: "ok" };
    case "RANGE_INTERPOLATED": return { texto: "Ubicada en la cuadra", tono: "ok" };
    case "MANUAL": return { texto: "Ubicada a mano", tono: "ok" };
    case "GEOMETRIC_CENTER": return { texto: "Aproximada (sector)", tono: "duda" };
    case "APPROXIMATE": return { texto: "Aproximada (comuna)", tono: "duda" };
    case "PARCIAL": return { texto: "Dudosa: Google cambió la dirección", tono: "duda" };
    case "COMUNA_DISTINTA": return { texto: "Dudosa: cae en otra comuna", tono: "duda" };
    default: return { texto: "Ubicación sin verificar", tono: "duda" };
  }
}

/** Enlace para abrir un punto en Google Maps (no necesita llave). */
export function enlaceGoogleMaps(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Plaza de Armas: dónde abre el mapa cuando no hay nada que mostrar. */
export const CENTRO_SANTIAGO = { lat: -33.4378, lng: -70.6505 };

/**
 * Lee lo que el usuario escribe a mano: acepta coma decimal y «-33.4, -70.6» pegado de Google
 * Maps en un solo campo. Devuelve `null` si no es un número.
 */
export function leerCoordenada(texto) {
  const s = String(texto ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** «-33.4428, -70.6536» (lo que copia Google Maps) → { lat, lng }, o null. */
export function leerParCoordenadas(texto) {
  const m = String(texto ?? "").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
