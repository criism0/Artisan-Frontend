import { checkScope, ModelType, ScopeType } from "./scopeCheck";
import toast from "../lib/toast";

const COLOR_POR_CATEGORIA = {
  "Producto Final": "bg-green-500",
  "PT": "bg-green-500",
  "PIP": "bg-amber-500",
  "En proceso": "bg-amber-500",
  "Materia Prima": "bg-blue-500",
  "Insumo": "bg-blue-500",
  "I": "bg-blue-500",
  "Merma": "bg-red-500",
  "M": "bg-red-500",
  "Subproducto": "bg-purple-500",
};

export function colorCategoria(cat) {
  return COLOR_POR_CATEGORIA[cat] || "bg-gray-400";
}

function toNum(v) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nombreItem(item) {
  return (
    item?.materiaPrima?.nombre ||
    item?.nombre_producto ||
    item?.nombre ||
    "—"
  );
}

function categoriaItem(item) {
  return (
    item?.categoria ||
    item?.materiaPrima?.categoria?.nombre ||
    "Sin categoría"
  );
}

export async function cargarDatosInventario(api) {
  if (!checkScope(ModelType.INVENTARIO, ScopeType.READ)) {
    toast.error("No tienes permisos para ver inventario");
    return null;
  }

  const [inventarioGeneral, bodegasRes] = await Promise.all([
    api(`/inventario/general`, { method: "GET" }).catch(() => []),
    api(`/bodegas`, { method: "GET" }).catch(() => ({ bodegas: [] })),
  ]);

  const inventario = Array.isArray(inventarioGeneral) ? inventarioGeneral : [];
  const bodegas = Array.isArray(bodegasRes?.bodegas)
    ? bodegasRes.bodegas
    : Array.isArray(bodegasRes)
      ? bodegasRes
      : [];

  // Per-bodega: N llamadas en paralelo (N = nº de bodegas, típicamente <10)
  const porBodega = await Promise.all(
    bodegas.map(async (b) => {
      try {
        const res = await api(`/inventario/${b.id}`, { method: "GET" });
        const items = Array.isArray(res) ? res : [];
        return { id: b.id, nombre: b.nombre, items };
      } catch {
        return { id: b.id, nombre: b.nombre, items: [] };
      }
    })
  );

  return { inventario, bodegas, porBodega };
}

export function calcularKpisInventario(inventario, bodegas) {
  let valorTotal = 0;
  let stockEnPeligro = 0;
  let unidadesTotales = 0;

  for (const item of inventario) {
    valorTotal += toNum(item.precio_total);
    unidadesTotales += toNum(item.unidades_disponibles);
    if ((item.estado_stock || "").toLowerCase() === "peligro") stockEnPeligro += 1;
  }

  return {
    total_items: inventario.length,
    total_bodegas: bodegas.length,
    valor_total: valorTotal,
    unidades_totales: unidadesTotales,
    stock_peligro: stockEnPeligro,
  };
}

export function distribucionPorCategoria(inventario) {
  const map = new Map();
  for (const item of inventario) {
    const cat = categoriaItem(item);
    const ref =
      map.get(cat) ||
      map.set(cat, { categoria: cat, items: 0, valor: 0, unidades: 0 }).get(cat);
    ref.items += 1;
    ref.valor += toNum(item.precio_total);
    ref.unidades += toNum(item.unidades_disponibles);
  }
  return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
}

export function stockPorBodega(porBodega) {
  return porBodega
    .map((b) => {
      let valor = 0;
      let unidades = 0;
      let peligro = 0;
      for (const item of b.items) {
        valor += toNum(item.precio_total);
        unidades += toNum(item.unidades_disponibles);
        if ((item.estado_stock || "").toLowerCase() === "peligro") peligro += 1;
      }
      return {
        id: b.id,
        nombre: b.nombre,
        items: b.items.length,
        valor,
        unidades,
        peligro,
      };
    })
    .sort((a, b) => b.valor - a.valor);
}

export function topProductos(inventario, limit = 5) {
  return [...inventario]
    .map((item) => ({
      id: item?.materiaPrima?.id ?? nombreItem(item),
      nombre: nombreItem(item),
      categoria: categoriaItem(item),
      unidades: toNum(item.unidades_disponibles),
      valor: toNum(item.precio_total),
      estado: item.estado_stock,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

export function alertasStock(inventario, limit = 8) {
  const items = inventario
    .filter((item) => (item.estado_stock || "").toLowerCase() === "peligro")
    .map((item) => ({
      id: item?.materiaPrima?.id ?? nombreItem(item),
      nombre: nombreItem(item),
      categoria: categoriaItem(item),
      unidades: toNum(item.unidades_disponibles),
      unidad_medida:
        item?.materiaPrima?.unidad_medida ||
        item?.loteProductoFinal?.productoBase?.unidad_medida ||
        "",
      valor: toNum(item.precio_total),
      ultimo_movimiento: item.ultimo_movimiento || null,
    }))
    .sort((a, b) => a.unidades - b.unidades);
  return items.slice(0, limit);
}

export async function cargarAlertasInventario(api, idBodega) {
  const params = idBodega ? `?id_bodega=${idBodega}` : "";
  const res = await api(`/inventario-dashboard/alertas${params}`).catch(() => null);
  const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  return data;
}

export async function cargarPipPorBodega(api, idBodega) {
  const params = idBodega ? `?id_bodega=${idBodega}` : "";
  const res = await api(`/inventario-dashboard/pip-por-bodega${params}`, { method: "GET" }).catch(() => null);
  const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  return data;
}
 
export async function cargarProductosTerminadosPorBodega(api, idBodega) {
  const params = idBodega ? `?id_bodega=${idBodega}` : "";
  const res = await api(`/inventario-dashboard/productos-terminados-por-bodega${params}`, { method: "GET" }).catch(() => null);
  const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  return data;
}