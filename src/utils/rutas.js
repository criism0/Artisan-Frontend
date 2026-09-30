/**
 * Reglas puras de la vista Logística → Entregas: cómo se ordena y filtra la lista de pedidos, cómo
 * se etiqueta la fecha y cómo se decodifica la línea de la ruta.
 */

const ddmm = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/** Etiqueta de la fecha de entrega respecto del día que se está planificando. */
export function etiquetaFecha(fechaEntrega, fechaRuta) {
  if (!fechaEntrega) return { texto: "Sin fecha", tono: "gris" };
  const f = String(fechaEntrega).slice(0, 10);
  if (f === fechaRuta) return { texto: "Para este día", tono: "dia" };
  if (f < fechaRuta) return { texto: `Atrasada · ${ddmm(f)}`, tono: "atrasada" };
  return { texto: ddmm(f), tono: "gris" };
}

/**
 * El orden de la lista, pensado para planificar el día elegido: primero lo comprometido para ese
 * día, después lo que viene (lo más cercano primero), después lo atrasado (lo más reciente
 * primero: lo de hace meses ya se entregó por AppSheet) y al final lo sin fecha.
 */
export function ordenarPendientes(ordenes, fechaRuta) {
  const rango = (o) => {
    const f = o.fecha_entrega ? String(o.fecha_entrega).slice(0, 10) : null;
    if (!f) return 3;
    if (f === fechaRuta) return 0;
    return f > fechaRuta ? 1 : 2;
  };
  return [...ordenes].sort((a, b) => {
    const ra = rango(a);
    const rb = rango(b);
    if (ra !== rb) return ra - rb;
    const fa = String(a.fecha_entrega ?? "");
    const fb = String(b.fecha_entrega ?? "");
    if (fa !== fb) return ra === 2 ? (fa < fb ? 1 : -1) : fa < fb ? -1 : 1;
    return b.id - a.id;
  });
}

export const FILTROS_PENDIENTES = [
  { id: "todas", label: "Todas" },
  { id: "falta", label: "Falta dirección" },
  { id: "con_direccion", label: "Con dirección" },
  { id: "en_ruta", label: "En ruta" },
];

const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function filtrarPendientes(ordenes, { filtro = "todas", texto = "" } = {}) {
  const t = normalizar(texto).trim();
  return ordenes.filter((o) => {
    if (filtro === "falta" && o.estado_direccion !== "falta") return false;
    if (filtro === "con_direccion" && o.estado_direccion === "falta") return false;
    if (filtro === "en_ruta" && !o.ruta) return false;
    if (!t) return true;
    return [o.id, o.numero_oc, o.cliente?.nombre, o.punto?.texto].some((v) => normalizar(v).includes(t));
  });
}

export const contarPorFiltro = (ordenes) => ({
  todas: ordenes.length,
  falta: ordenes.filter((o) => o.estado_direccion === "falta").length,
  con_direccion: ordenes.filter((o) => o.estado_direccion !== "falta").length,
  en_ruta: ordenes.filter((o) => o.ruta).length,
});

/** Colores del estado de una ruta (chip de la lista, del detalle y del filtro). */
export const ESTADOS_RUTA = {
  Planificada: { bg: "bg-sky-200", text: "text-sky-800" },
  "En curso": { bg: "bg-amber-200", text: "text-amber-800" },
  Cerrada: { bg: "bg-green-400", text: "text-green-900" },
  Cancelada: { bg: "bg-gray-200", text: "text-gray-600" },
};

/** «2026-09-30» → «30-09-2026», como se muestran las fechas en la app. */
export const formatearFecha = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "—");

export const formatearCLP = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`);

/** Cuántas OV lleva una ruta guardada (sumando todas sus paradas). */
export const pedidosDeRuta = (ruta) => (ruta?.paradas ?? []).reduce((n, p) => n + (p.ordenes?.length ?? 0), 0);

export const formatearKm = (km) => (km == null ? "—" : `${Number(km).toLocaleString("es-CL", { maximumFractionDigits: 1 })} km`);

export function formatearMinutos(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** Polilínea codificada de Google → [{ lat, lng }]. El algoritmo público de Google, sin librería. */
export function decodificarPolilinea(codificada) {
  if (!codificada) return [];
  const puntos = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < codificada.length) {
    for (const eje of ["lat", "lng"]) {
      let resultado = 0;
      let desplazamiento = 0;
      let b;
      do {
        b = codificada.charCodeAt(i++) - 63;
        resultado |= (b & 0x1f) << desplazamiento;
        desplazamiento += 5;
      } while (b >= 0x20);
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
      if (eje === "lat") lat += delta;
      else lng += delta;
    }
    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return puntos;
}

/** Las paradas de una ruta guardada, en la forma que usa el panel (igual que las recomendadas). */
export function paradasDeRutaGuardada(ruta) {
  return (ruta?.paradas ?? []).map((p) => ({
    clave: `guardada:${p.id}`,
    id_cliente: p.id_cliente,
    cliente: p.cliente?.nombre_empresa || p.cliente?.razon_social || "",
    lat: p.lat,
    lng: p.lng,
    etiqueta: p.etiqueta,
    ordenes: (p.ordenes ?? []).map((o) => ({
      id: o.id_orden_venta,
      numero_oc: o.orden?.numero_oc,
      estado: o.orden?.estado,
      fecha_entrega: o.orden?.fecha_entrega,
    })),
  }));
}
