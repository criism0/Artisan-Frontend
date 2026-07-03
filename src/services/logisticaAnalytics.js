import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const ESTADOS_ENVIO = [
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

const COLOR_POR_ESTADO_ENVIO = {
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

export function colorEstadoEnvio(estado) {
  return COLOR_POR_ESTADO_ENVIO[estado] || "bg-gray-300";
}

export function estadoActivoEnvio(estado) {
  return ESTADOS_ACTIVOS.has(estado);
}

export function estadosEnvioConocidos() {
  return ESTADOS_ENVIO.slice();
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
  const [enviosRes, palletsRes] = await Promise.all([
    api(`/solicitudes-mercaderia`, { method: "GET" }).catch(() => []),
    api(`/pallets`, { method: "GET" }).catch(() => []),
  ]);

  const envios = (Array.isArray(enviosRes) ? enviosRes : []).map((s) => ({
    ...s,
    estado: normalizeEstadoSolicitud(s.estado),
  }));
  const pallets = Array.isArray(palletsRes) ? palletsRes : [];

  return { envios, pallets };
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

export function calcularKpisLogistica(envios, pallets) {
  let activos = 0;
  let enTransito = 0;
  let pendientesDespacho = 0;
  let completados = 0;

  for (const e of envios) {
    if (e.estado === "En tránsito") enTransito += 1;
    if (e.estado === "Lista para despacho" || e.estado === "Validada")
      pendientesDespacho += 1;
    if (ESTADOS_ACTIVOS.has(e.estado)) activos += 1;
    if (e.estado === "Recepción Completa" || e.estado === "Recepción Completa con Pérdida")
      completados += 1;
  }

  const palletsAbiertos = pallets.filter(palletAbierto).length;
  const bultosEnPallets = pallets.reduce((acc, p) => acc + bultosDePallet(p), 0);

  return {
    total_envios: envios.length,
    activos,
    en_transito: enTransito,
    pendientes_despacho: pendientesDespacho,
    completados,
    total_pallets: pallets.length,
    pallets_abiertos: palletsAbiertos,
    bultos_en_pallets: bultosEnPallets,
  };
}

export function enviosPorEstado(envios) {
  const conteo = new Map();
  for (const est of ESTADOS_ENVIO) conteo.set(est, { estado: est, cantidad: 0 });
  for (const e of envios) {
    const est = e.estado || "Otro";
    const ref = conteo.get(est) || conteo.set(est, { estado: est, cantidad: 0 }).get(est);
    ref.cantidad += 1;
  }
  return Array.from(conteo.values());
}

export function tendenciaEnvios(envios, meses = 6) {
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
  for (const e of envios) {
    const f =
      parseFecha(e, "fecha_envio", "createdAt", "created_at") ||
      parseFecha(e, "fecha_recepcion");
    if (!f) continue;
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx == null) continue;
    buckets[idx].cantidad += 1;
  }
  return buckets;
}

export function topRutas(envios, limit = 5) {
  const map = new Map();
  for (const e of envios) {
    const origen = e.bodegaProveedora?.nombre || "Origen desconocido";
    const destino = e.bodegaSolicitante?.nombre || "Destino desconocido";
    const key = `${origen}→${destino}`;
    const ref = map.get(key) || map.set(key, { origen, destino, cantidad: 0 }).get(key);
    ref.cantidad += 1;
  }
  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit);
}

export function alertasLogistica(envios, pallets, limit = 8) {
  const ahora = new Date();
  const items = [];

  for (const e of envios) {
    if (!ESTADOS_ACTIVOS.has(e.estado)) continue;
    const f =
      parseFecha(e, "fecha_envio", "createdAt", "created_at") ||
      parseFecha(e, "fecha_recepcion");
    const dias = diasDesde(f, ahora);
    items.push({
      tipo: "envio",
      id: e.id,
      titulo: `Envío SM${e.id}`,
      subtitulo: `${e.bodegaProveedora?.nombre || "?"} → ${e.bodegaSolicitante?.nombre || "?"}`,
      estado: e.estado,
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
