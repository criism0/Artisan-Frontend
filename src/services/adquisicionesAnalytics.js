import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const ESTADOS = [
  "Creada",
  "Validada",
  "Recepcionada",
  "Parcialmente recepcionada",
  "Rechazada",
  "Pagada",
];

const COLOR_POR_ESTADO = {
  "Creada": "bg-gray-400",
  "Validada": "bg-sky-500",
  "Recepcionada": "bg-green-500",
  "Parcialmente recepcionada": "bg-amber-500",
  "Rechazada": "bg-rose-500",
  "Pagada": "bg-lime-500",
};

export function colorEstado(estado) {
  return COLOR_POR_ESTADO[estado] || "bg-gray-300";
}

export function estadosConocidos() {
  return ESTADOS.slice();
}

export async function cargarDatosAdquisiciones(api) {
  if (!checkScope(ModelType.ORDEN_COMPRA, ScopeType.READ)) {
    toast.error("No tienes permisos para ver las órdenes de compra");
    return null;
  }
  const res = await api(`/proceso-compra/ordenes`, { method: "GET" });
  const ordenes = Array.isArray(res) ? res : [];
  return { ordenes };
}

export async function cargarAlertasReposicion(api, filtros={}) {
  const params = new URLSearchParams();
  if (filtros.id_bodega) params.set("id_bodega", String(filtros.id_bodega));
  const qs = params.toString();
  const res = await api(`/alertas-reposicion${qs ? `?${qs}` : ""}`);
  return Array.isArray(res) ? res : res?.data || [];
}

export async function cargarVariacionCosto(api, insumoId) {
  const res = await api(`/variacion-costo-insumo?insumo_id=${insumoId}`);
  return res?.data || res || null;
}

export function urlExportVariacionCosto(insumoId) {
  return `/variacion-costo-insumo/export?insumo_id=${insumoId}`;
}

function toNum(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseFecha(o) {
  const raw = o.fecha || o.fecha_creacion || o.createdAt || o.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function calcularKpis(ordenes) {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalComprometido = 0;
  let totalPagado = 0;
  let montoMes = 0;
  let pendientesValidar = 0;
  let pendientesPago = 0;

  for (const o of ordenes) {
    const total = toNum(o.total_pago) || toNum(o.total_neto);
    totalComprometido += total;
    if (o.pagada) totalPagado += total;
    if (o.estado === "Creada") pendientesValidar += 1;
    if (!o.pagada && o.estado !== "Rechazada") pendientesPago += 1;
    const f = parseFecha(o);
    if (f && f >= inicioMes) montoMes += total;
  }

  return {
    total_ocs: ordenes.length,
    pendientes_validar: pendientesValidar,
    pendientes_pago: pendientesPago,
    monto_comprometido: totalComprometido,
    monto_pagado: totalPagado,
    monto_mes_actual: montoMes,
  };
}

export function ocsPorEstado(ordenes) {
  const conteo = new Map();
  for (const e of ESTADOS) conteo.set(e, { estado: e, cantidad: 0, monto: 0 });
  for (const o of ordenes) {
    const e = o.estado || "Otro";
    const ref =
      conteo.get(e) || conteo.set(e, { estado: e, cantidad: 0, monto: 0 }).get(e);
    ref.cantidad += 1;
    ref.monto += toNum(o.total_pago) || toNum(o.total_neto);
  }
  return Array.from(conteo.values());
}

export function tendenciaMensual(ordenes, meses = 6) {
  const ahora = new Date();
  const buckets = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
      cantidad: 0,
      monto: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  for (const o of ordenes) {
    const f = parseFecha(o);
    if (!f) continue;
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx == null) continue;
    buckets[idx].cantidad += 1;
    buckets[idx].monto += toNum(o.total_pago) || toNum(o.total_neto);
  }
  return buckets;
}

export function topProveedores(ordenes, limit = 5) {
  const map = new Map();
  for (const o of ordenes) {
    const nombre =
      o.proveedor?.nombre_empresa ||
      o.Proveedor?.nombre_empresa ||
      (o.id_proveedor != null ? `Proveedor #${o.id_proveedor}` : "Sin proveedor");
    const id = o.proveedor?.id || o.Proveedor?.id || o.id_proveedor || nombre;
    const key = String(id);
    const monto = toNum(o.total_pago) || toNum(o.total_neto);
    const ref =
      map.get(key) ||
      map.set(key, { id, nombre, cantidad: 0, monto: 0 }).get(key);
    ref.cantidad += 1;
    ref.monto += monto;
  }
  return Array.from(map.values())
    .sort((a, b) => b.monto - a.monto)
    .slice(0, limit);
}

export function pendientesAlertas(ordenes, limit = 8) {
  const ahora = new Date();
  const items = [];
  for (const o of ordenes) {
    const f = parseFecha(o);
    const diasAntig = f
      ? Math.floor((ahora.getTime() - f.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const estado = o.estado;
    let tipo = null;
    if (estado === "Creada") tipo = "Pendiente de validación";
    else if (estado === "Validada") tipo = "Pendiente de recepción";
    else if (estado === "Parcialmente recepcionada") tipo = "Recepción incompleta";
    else if (
      (estado === "Recepcionada" || estado === "Parcialmente recepcionada") &&
      !o.pagada
    )
      tipo = "Pendiente de pago";
    if (!tipo) continue;
    items.push({
      id: o.id,
      estado,
      tipo,
      proveedor:
        o.proveedor?.nombre_empresa ||
        o.Proveedor?.nombre_empresa ||
        "Sin proveedor",
      fecha: f,
      dias_antiguedad: diasAntig,
      monto: toNum(o.total_pago) || toNum(o.total_neto),
    });
  }
  items.sort((a, b) => (b.dias_antiguedad ?? -1) - (a.dias_antiguedad ?? -1));
  return items.slice(0, limit);
}

export function opcionesProveedores(ordenes) {
  const map = new Map();
  for (const o of ordenes) {
    const id = o.proveedor?.id || o.Proveedor?.id || o.id_proveedor;
    const nombre = o.proveedor?.nombre_empresa || o.Proveedor?.nombre_empresa;
    if (id && nombre) map.set(id, { id, nombre });
  }
  return Array.from(map.values()).sort((a,b) => a.nombre.localeCompare(b.nombre));
}
