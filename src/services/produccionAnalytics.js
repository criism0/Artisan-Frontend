import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const ESTADOS_OM = [
  "Borrador",
  "Insumos asignados",
  "Esperando salidas",
  "En ejecución",
  "Esperando PVAs",
  "Cerrada",
];

const ESTADOS_ACTIVOS = new Set([
  "Insumos asignados",
  "Esperando salidas",
  "En ejecución",
  "Esperando PVAs",
]);

const COLOR_POR_ESTADO_OM = {
  "Borrador": "bg-gray-400",
  "Insumos asignados": "bg-blue-500",
  "Esperando salidas": "bg-orange-500",
  "En ejecución": "bg-cyan-500",
  "Esperando PVAs": "bg-purple-500",
  "Cerrada": "bg-green-500",
};

export function colorEstadoOM(estado) {
  return COLOR_POR_ESTADO_OM[estado] || "bg-gray-300";
}

function toNum(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

function nombreProductoOM(om) {
  return (
    om?.productoBase?.nombre ||
    om?.materiaPrima?.nombre ||
    om?.receta?.nombre ||
    "Sin producto"
  );
}

export async function cargarDatosProduccion(api) {
  const canReadManufactureOrder = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.READ);
  const canReadInProgressLot = checkScope(ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ);
  const canReadFinishedLot = checkScope(ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ);
  const allPermissionsNeeded =
    canReadManufactureOrder ||
    canReadInProgressLot ||
    canReadFinishedLot;

  if (!allPermissionsNeeded) {
    toast.permissionError(
      [ModelType.ORDEN_MANUFACTURA, ScopeType.READ],
      [ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ],
      [ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ]
    );
    return null;
  }
  const safeGet = async (path) => {
    try {
      const data = await api(path, { method: "GET" });
      return data;
    } catch {
      return [];
    }
  };

  const [omRes, lotesPipRes, lotesFinalRes] = await Promise.all([
    safeGet(`/ordenes_manufactura`),
    safeGet(`/lotes-producto-en-proceso/`),
    safeGet(`/lotes-producto-final/`),
  ]);

  const ordenes = Array.isArray(omRes)
    ? omRes
    : Array.isArray(omRes?.ordenes_manufactura)
      ? omRes.ordenes_manufactura
      : [];
  const lotesPip = Array.isArray(lotesPipRes?.lotes || lotesPipRes)
    ? lotesPipRes?.lotes || lotesPipRes
    : [];
  const lotesFinal = Array.isArray(lotesFinalRes?.lotes || lotesFinalRes)
    ? lotesFinalRes?.lotes || lotesFinalRes
    : [];

  return { ordenes, lotesPip, lotesFinal };
}

export async function cargarEficienciaLote(api, filtros={}) {
  const params = new URLSearchParams();
  if (filtros.id_producto_base) params.set("id_producto_base", String(filtros.id_producto_base));
  if (filtros.id_bodega) params.set("id_bodega", String(filtros.id_bodega));
  if (filtros.anio) params.set("anio", String(filtros.anio));
  if (filtros.mes) params.set("mes", String(filtros.mes));
  const qs = params.toString();
  const res = await api(`/produccion-dashboard/eficiencia-lote${qs ? `?${qs}` : ""}`);
  return Array.isArray(res) ? res : res?.data || [];
}

export async function cargarRendimiento(api, filtros={}, agrupacion = "mes") {
  const params = new URLSearchParams({ agrupacion });
  if (filtros.id_producto_base) params.set("id_producto_base", String(filtros.id_producto_base));
  if (filtros.id_bodega) params.set("id_bodega", String(filtros.id_bodega));
  if (filtros.anio) params.set("anio", String(filtros.anio));
  if (filtros.mes) params.set("mes", String(filtros.mes));
  const res = await api(`/produccion-dashboard/rendimiento?${params.toString()}`);
  return Array.isArray(res) ? res : res?.data || []; 
}

export async function cargarRendimientoDetalle(api, filtros={}) {
  const params = new URLSearchParams();
  if (filtros.id_producto_base) params.set("id_producto_base", String(filtros.id_producto_base));
  if (filtros.id_bodega) params.set("id_bodega", String(filtros.id_bodega));
  if (filtros.anio) params.set("anio", String(filtros.anio));
  if (filtros.mes) params.set("mes", String(filtros.mes));
  const qs = params.toString();
  const res = await api(`/produccion-dashboard/rendimiento/detalle${qs ? `?${qs}` : ""}`);
  return Array.isArray(res) ? res : res?.data || [];
}

export function calcularKpisProduccion(ordenes, lotesPip, lotesFinal) {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  let activas = 0;
  let enEjecucion = 0;
  let cerradasMes = 0;
  let pesoMes = 0;

  for (const om of ordenes) {
    if (ESTADOS_ACTIVOS.has(om.estado)) activas += 1;
    if (om.estado === "En ejecución") enEjecucion += 1;
    const f = parseFecha(om, "fecha", "createdAt", "created_at");
    if (om.estado === "Cerrada" && f && f >= inicioMes) {
      cerradasMes += 1;
      pesoMes += toNum(om.peso_objetivo);
    }
  }

  return {
    total_oms: ordenes.length,
    activas,
    en_ejecucion: enEjecucion,
    cerradas_mes: cerradasMes,
    peso_objetivo_mes: pesoMes,
    lotes_pip: lotesPip.length,
    lotes_final: lotesFinal.length,
    lotes_totales: lotesPip.length + lotesFinal.length,
  };
}

export function omsPorEstado(ordenes) {
  const conteo = new Map();
  for (const est of ESTADOS_OM) conteo.set(est, { estado: est, cantidad: 0 });
  for (const om of ordenes) {
    const est = om.estado || "Otro";
    const ref = conteo.get(est) || conteo.set(est, { estado: est, cantidad: 0 }).get(est);
    ref.cantidad += 1;
  }
  return Array.from(conteo.values());
}

export function tendenciaOMs(ordenes, meses = 6) {
  const ahora = new Date();
  const buckets = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }),
      cantidad: 0,
      peso: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  for (const om of ordenes) {
    const f = parseFecha(om, "fecha", "createdAt", "created_at");
    if (!f) continue;
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx == null) continue;
    buckets[idx].cantidad += 1;
    buckets[idx].peso += toNum(om.peso_objetivo);
  }
  return buckets;
}

export function topProductosElaborados(ordenes, limit = 5) {
  const map = new Map();
  for (const om of ordenes) {
    const nombre = nombreProductoOM(om);
    const ref =
      map.get(nombre) ||
      map.set(nombre, { nombre, cantidad: 0, peso: 0 }).get(nombre);
    ref.cantidad += 1;
    ref.peso += toNum(om.peso_objetivo);
  }
  return Array.from(map.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit);
}

export function alertasProduccion(ordenes, limit = 8) {
  const ahora = new Date();
  const items = [];
  for (const om of ordenes) {
    if (!ESTADOS_ACTIVOS.has(om.estado)) continue;
    const f = parseFecha(om, "fecha", "createdAt", "created_at");
    const dias = diasDesde(f, ahora);
    items.push({
      id: om.id,
      estado: om.estado,
      producto: nombreProductoOM(om),
      bodega: om.bodega?.nombre || "—",
      peso_objetivo: toNum(om.peso_objetivo),
      fecha: f,
      dias_antiguedad: dias,
    });
  }
  items.sort((a, b) => (b.dias_antiguedad ?? -1) - (a.dias_antiguedad ?? -1));
  return items.slice(0, limit);
}

export function opcionesFiltrosProduccion(ordenes) {
  const productosMap = new Map();
  const plantasMap = new Map();
  const aniosSet = new Set();

  for (const om of ordenes) {
    const idProd = om.id_producto_base;
    const nomProd = nombreProductoOM(om);
    if (idProd) productosMap.set(idProd, { id: idProd, nombre: nomProd });

    const idBod = om.id_bodega;
    const nomBod = om.bodega?.nombre;
    if (idBod && nomBod) plantasMap.set(idBod, { id:idBod, nombre: nomBod });

    const f = parseFecha(om, "fecha", "createdAt", "created_at");
    if (f) aniosSet.add(f.getFullYear());
  }

  return {
    productos: Array.from(productosMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    plantas: Array.from(plantasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    anios: Array.from(aniosSet).sort((a, b) => b- a),
  };
}
