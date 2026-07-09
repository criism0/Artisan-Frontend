import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const ESTADOS_SOLICITUD = [
  "Creada",
  "Pendiente",
  "Validada",
  "En preparación",
  "Lista para despacho",
  "En tránsito",
  "Recepción Completa",
  "Recepción Completa con Pérdida",
  "Recepción Parcial",
  "Recepción Parcial con Pérdida",
  "Cancelada",
];

const ESTADOS_ACTIVOS = new Set([
  "Creada",
  "Pendiente",
  "Validada",
  "En preparación",
  "Lista para despacho",
  "En tránsito",
]);

const COLOR_POR_ESTADO_SOLICITUD = {
  "Creada": "bg-gray-400",
  "Pendiente": "bg-orange-400",
  "Validada": "bg-sky-500",
  "En preparación": "bg-amber-500",
  "Lista para despacho": "bg-lime-500",
  "En tránsito": "bg-indigo-500",
  "Recepción Completa": "bg-green-500",
  "Recepción Completa con Pérdida": "bg-amber-600",
  "Recepción Parcial": "bg-yellow-500",
  "Recepción Parcial con Pérdida": "bg-orange-600",
  "Cancelada": "bg-rose-500",
};

export function colorEstadoSolicitud(estado) {
  return COLOR_POR_ESTADO_SOLICITUD[estado] || "bg-gray-300";
}

function normalizeEstadoSolicitud(estado) {
  if (!estado) return estado;
  switch (estado) {
    case "Recepcionada Completa":
      return "Recepción Completa";
    case "Recepcionada Parcial Falta Stock":
      return "Recepción Parcial";
    case "Recepcionada Parcial Perdida":
      return "Recepción Parcial con Pérdida";
    default:
      return estado;
  }
}

export async function cargarDatosLogistica(api) {
  if (!checkScope(ModelType.INVENTARIO, ScopeType.READ)) {
    toast.error("No tienes permisos para ver logística");
    return null;
  }
  const [solicitudesRes, palletsRes] = await Promise.all([
    api(`/solicitudes-mercaderia`, { method: "GET" }).catch(() => []),
    api(`/pallets`, { method: "GET" }).catch(() => []),
  ]);

  const solicitudes = (Array.isArray(solicitudesRes) ? solicitudesRes : []).map((s) => ({
    ...s,
    estado: normalizeEstadoSolicitud(s.estado),
  }));
  const pallets = Array.isArray(palletsRes) ? palletsRes : [];

  return { solicitudes, pallets };
}

function parseFecha(o, ...keys) {
  for (const k of keys) {
    if (o?.[k]) {
      const d = new Date(o[k]);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function diasDesde(fecha, ahora = new Date()) {
  if (!fecha) return null;
  return Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function bultosDePallet(p) {
  const arr = p.bultos || p.Bultos;
  return Array.isArray(arr) ? arr.length : 0;
}

function palletAbierto(p) {
  const e = (p.estado || "").toLowerCase();
  return e !== "completado" && e !== "cerrado" && e !== "enviado";
}

export function calcularKpisLogistica(solicitudes, pallets) {
  let activos = 0;
  let enTransito = 0;
  let pendientesDespacho = 0;
  let completados = 0;

  for (const s of solicitudes) {
    if (s.estado === "En tránsito") enTransito += 1;
    if (s.estado === "Lista para despacho" || s.estado === "Validada")
      pendientesDespacho += 1;
    if (ESTADOS_ACTIVOS.has(s.estado)) activos += 1;
    if (s.estado === "Recepción Completa" || s.estado === "Recepción Completa con Pérdida")
      completados += 1;
  }

  const palletsAbiertos = pallets.filter(palletAbierto).length;
  const bultosEnPallets = pallets.reduce((acc, p) => acc + bultosDePallet(p), 0);

  return {
    total_solicitudes: solicitudes.length,
    activos,
    en_transito: enTransito,
    pendientes_despacho: pendientesDespacho,
    completados,
    total_pallets: pallets.length,
    pallets_abiertos: palletsAbiertos,
    bultos_en_pallets: bultosEnPallets,
  };
}

export function solicitudesPorEstado(solicitudes) {
  const conteo = new Map();
  for (const est of ESTADOS_SOLICITUD) conteo.set(est, { estado: est, cantidad: 0 });
  for (const s of solicitudes) {
    const est = s.estado || "Otro";
    const ref = conteo.get(est) || conteo.set(est, { estado: est, cantidad: 0 }).get(est);
    ref.cantidad += 1;
  }
  return Array.from(conteo.values());
}

export function tendenciaSolicitudes(solicitudes, meses = 6) {
  const ahora = new Date();
  const buckets = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
      cantidad: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  for (const s of solicitudes) {
    const f =
      parseFecha(s, "fecha_envio", "createdAt", "created_at") ||
      parseFecha(s, "fecha_recepcion");
    if (!f) continue;
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx == null) continue;
    buckets[idx].cantidad += 1;
  }
  return buckets;
}

export function topRutas(solicitudes, limit = 5) {
  const map = new Map();
  for (const s of solicitudes) {
    const origen = s.bodegaProveedora?.nombre || "Origen desconocido";
    const destino = s.bodegaSolicitante?.nombre || "Destino desconocido";
    const key = `${origen}→${destino}`;
    const ref = map.get(key) || map.set(key, { origen, destino, cantidad: 0 }).get(key);
    ref.cantidad += 1;
  }
  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit);
}

export function alertasLogistica(solicitudes, pallets, limit = 8) {
  const ahora = new Date();
  const items = [];

  for (const s of solicitudes) {
    if (!ESTADOS_ACTIVOS.has(s.estado)) continue;
    const f =
      parseFecha(s, "fecha_envio", "createdAt", "created_at") ||
      parseFecha(s, "fecha_recepcion");
    const dias = diasDesde(f, ahora);
    items.push({
      tipo: "solicitud",
      id: s.id,
      titulo: `Solicitud SM${s.id}`,
      subtitulo: `${s.bodegaProveedora?.nombre || "?"} → ${s.bodegaSolicitante?.nombre || "?"}`,
      estado: s.estado,
      dias_antiguedad: dias,
    });
  }

  for (const p of pallets) {
    if (!palletAbierto(p)) continue;
    const f = parseFecha(p, "createdAt", "created_at", "fecha");
    const dias = diasDesde(f, ahora);
    items.push({
      tipo: "pallet",
      id: p.id,
      titulo: `Pallet ${p.identificador || `#${p.id}`}`,
      subtitulo: `${bultosDePallet(p)} bulto${bultosDePallet(p) === 1 ? "" : "s"} · ${p.estado || "Abierto"}`,
      estado: p.estado || "Abierto",
      dias_antiguedad: dias,
    });
  }

  items.sort((a, b) => (b.dias_antiguedad ?? -1) - (a.dias_antiguedad ?? -1));
  return items.slice(0, limit);
}
