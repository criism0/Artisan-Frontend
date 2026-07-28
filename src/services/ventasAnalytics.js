import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const ESTADOS = [
  "Pendiente",
  "Asignado",
  "Listo-para-despacho",
  "Facturado",
  "Enviado",
  "Entregado",
];

const COLOR_POR_ESTADO = {
  "Pendiente": "bg-gray-400",
  "Asignado": "bg-blue-500",
  "Listo-para-despacho": "bg-cyan-500",
  "Facturado": "bg-yellow-500",
  "Enviado": "bg-purple-500",
  "Entregado": "bg-green-500",
};

export function colorEstadoVenta(estado) {
  return COLOR_POR_ESTADO[estado] || "bg-gray-300";
}

export async function cargarDatosVentas(api) {
  if (!checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)) {
    toast.error("No tienes permisos para ver las órdenes de venta");
    return null;
  }
  const [ordRes, clientesRes, bodegaRes] = await Promise.all([
    api(`/ordenes-venta`, { method: "GET" }),
    api(`/clientes`, { method: "GET" }),
    api(`/bodegas`, { method: "GET" }).catch(() => ({ bodegas: [] })),
  ]);

  const ordenes = Array.isArray(ordRes) ? ordRes : ordRes?.data || [];
  const clientes = Array.isArray(clientesRes) ? clientesRes : clientesRes?.data || [];
  const bodegas = Array.isArray(bodegaRes?.bodegas) ? bodegaRes.bodegas : Array.isArray(bodegaRes) ? bodegaRes : [];

  const direccionToCliente = new Map();
  for (const c of clientes) {
    if (Array.isArray(c.direcciones)) {
      for (const d of c.direcciones) {
        direccionToCliente.set(d.id, {
          id: c.id,
          nombre: c.nombre_empresa,
          id_canal: c.id_canal ?? null,
          canal: c.canalInfo?.nombre || null,
        });
      }
    }
  }

  return { ordenes, clientes, bodegas, direccionToCliente };
}

export async function cargarQuiebres(api, filtros={}) {
  const params = new URLSearchParams();
  if (filtros.id_cliente) params.set("id_cliente", String(filtros.id_cliente));
  if (filtros.id_canal) params.set("id_canal", String(filtros.id_canal));
  if (filtros.id_producto) params.set("id_producto", String(filtros.id_producto));
  if (filtros.id_bodega) params.set("id_bodega", String(filtros.id_bodega));

  const qs = params.toString();
  const url = `/ventas-dashboard/quiebres-pre-picking${qs ? `?${qs}` : ""}`;
  const res = await api(url);
  const data = Array.isArray(res) ? res : res?.data || [];
  return data;
}

function toNum(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseFecha(o) {
  const raw = o.fecha_orden || o.fecha || o.createdAt || o.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function montoOV(o) {
  return toNum(o.ingreso_venta) || toNum(o.total) || toNum(o.monto);
}

export function calcularKpisVentas(ordenes) {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalFacturado = 0;
  let totalMes = 0;
  let pendientes = 0;
  let entregadas = 0;

  for (const o of ordenes) {
    const monto = montoOV(o);
    totalFacturado += monto;
    if (o.estado === "Pendiente" || o.estado === "Asignado") pendientes += 1;
    if (o.estado === "Entregado") entregadas += 1;
    const f = parseFecha(o);
    if (f && f >= inicioMes) totalMes += monto;
  }

  return {
    total_ovs: ordenes.length,
    pendientes,
    entregadas,
    monto_total: totalFacturado,
    monto_mes_actual: totalMes,
  };
}

export function ovsPorEstado(ordenes) {
  const conteo = new Map();
  for (const e of ESTADOS) conteo.set(e, { estado: e, cantidad: 0, monto: 0 });
  for (const o of ordenes) {
    const e = o.estado || "Otro";
    const ref =
      conteo.get(e) || conteo.set(e, { estado: e, cantidad: 0, monto: 0 }).get(e);
    ref.cantidad += 1;
    ref.monto += montoOV(o);
  }
  return Array.from(conteo.values());
}

export function tendenciaMensualVentas(ordenes, meses = 6) {
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
    buckets[idx].monto += montoOV(o);
  }
  return buckets;
}

export function topClientes(ordenes, direccionToCliente, limit = 5) {
  const map = new Map();
  for (const o of ordenes) {
    const cliente = direccionToCliente.get(o.id_local);
    const id = cliente?.id ?? `dir-${o.id_local ?? "desc"}`;
    const nombre = cliente?.nombre || "Cliente desconocido";
    const key = String(id);
    const ref =
      map.get(key) ||
      map.set(key, { id, nombre, cantidad: 0, monto: 0 }).get(key);
    ref.cantidad += 1;
    ref.monto += montoOV(o);
  }
  return Array.from(map.values())
    .sort((a, b) => b.monto - a.monto)
    .slice(0, limit);
}

export function pendientesVentas(ordenes, direccionToCliente, limit = 8) {
  const ahora = new Date();
  const items = [];
  for (const o of ordenes) {
    const estado = o.estado;
    let tipo = null;
    if (estado === "Pendiente") tipo = "Pendiente de asignar";
    else if (estado === "Asignado") tipo = "Por facturar";
    else if (estado === "Facturado") tipo = "Por despachar";
    else if (estado === "Listo-para-despacho") tipo = "Por enviar";
    else if (estado === "Enviado") tipo = "En tránsito";
    if (!tipo) continue;

    const f = parseFecha(o);
    const diasAntig = f
      ? Math.floor((ahora.getTime() - f.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    items.push({
      id: o.id,
      estado,
      tipo,
      cliente: direccionToCliente.get(o.id_local)?.nombre || "Cliente desconocido",
      fecha: f,
      dias_antiguedad: diasAntig,
      monto: montoOV(o),
    });
  }
  items.sort((a, b) => (b.dias_antiguedad ?? -1) - (a.dias_antiguedad ?? -1));
  return items.slice(0, limit);
}

export function opcionesFiltros(ordenes, direccionToCliente) {
  const clientes = new Map();
  const canales = new Map();

  for (const o of ordenes) {
    const c = direccionToCliente.get(o.id_local);
    if (!c) continue;
    if (c.id && c.nombre) clientes.set(c.id, { id: c.id, nombre: c.nombre });
    if (c.id_canal && c.canal) canales.set(c.id_canal, { id: c.id_canal, nombre: c.canal });
  }

  return {
    clientes: Array.from(clientes.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    canales: Array.from(canales.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}
