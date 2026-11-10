import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const cantidad = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });
const nombreLinea = (p) => p?.NombreFacturacion?.nombre || p?.ProductoBase?.nombre || "Producto";

// Lo ya pedido no se vuelve a pedir al pasar el mouse otra vez por la misma tarjeta.
const cache = new Map();

const ANCHO = 288;
const ALTO_ESTIMADO = 220;

/**
 * Lo que pidió una OV, como lista, flotando junto a su tarjeta mientras el mouse está encima. Sale
 * hacia arriba y, si arriba no hay espacio, hacia abajo. No captura el mouse: no estorba al
 * arrastre ni a los clics.
 */
export default function HoverProductosOrden({ orden, rect }) {
  const [productos, setProductos] = useState(cache.get(orden.id) ?? null);

  useEffect(() => {
    if (cache.has(orden.id)) {
      setProductos(cache.get(orden.id));
      return undefined;
    }
    let vivo = true;
    setProductos(null);
    api(`/ordenes-venta/${orden.id}/info`)
      .then((o) => {
        const lista = Array.isArray(o?.productos) ? o.productos : [];
        cache.set(orden.id, lista);
        if (vivo) setProductos(lista);
      })
      .catch(() => vivo && setProductos([]));
    return () => { vivo = false; };
  }, [orden.id]);

  const izquierda = Math.max(8, Math.min(rect.left, window.innerWidth - ANCHO - 8));
  const arriba = rect.top > ALTO_ESTIMADO + 12 || rect.top > window.innerHeight - rect.bottom;
  const posicion = arriba
    ? { left: izquierda, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(120, rect.top - 16) }
    : { left: izquierda, top: rect.bottom + 6, maxHeight: Math.max(120, window.innerHeight - rect.bottom - 16) };
  const total = (productos ?? []).reduce((s, p) => s + Number(p.cantidad || 0), 0);

  return (
    <div
      className="fixed z-30 rounded-lg border border-gray-200 bg-white shadow-lg overflow-y-auto pointer-events-none"
      style={{ width: ANCHO, ...posicion }}
      role="tooltip"
    >
      <div className="px-3 py-1.5 border-b border-gray-100 text-xs font-semibold text-gray-700 truncate">
        OV #{orden.id} · {orden.cliente.nombre}
      </div>
      <ul className="divide-y divide-gray-50">
        {productos === null && <li className="px-3 py-2 text-xs text-gray-500">Cargando…</li>}
        {productos?.length === 0 && <li className="px-3 py-2 text-xs text-gray-500">Sin productos.</li>}
        {(productos ?? []).map((p, i) => (
          <li key={p.id ?? i} className="flex items-baseline justify-between gap-3 px-3 py-1 text-xs">
            <span className="text-gray-800 min-w-0">{nombreLinea(p)}</span>
            <span className="tabular-nums text-gray-700 shrink-0">{cantidad(p.cantidad)}</span>
          </li>
        ))}
      </ul>
      {productos?.length > 0 && (
        <div className="px-3 py-1 border-t border-gray-100 text-[11px] text-gray-500 text-right">
          {productos.length} líneas · {cantidad(total)} unidades
        </div>
      )}
    </div>
  );
}
