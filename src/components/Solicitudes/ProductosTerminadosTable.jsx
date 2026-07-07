import { useEffect, useMemo, useRef, useState } from "react";
import { Trash } from "lucide-react";
import Selector from "../Forms/Selector";
import { useApi } from "../../lib/api";

/**
 * Tabla de productos terminados a solicitar (B4). Complementa a InsumosTable:
 * los PT no tienen formatos de compra — se solicitan por unidades. Emite via
 * onChange filas válidas: { id_producto_base, cantidad_solicitada, comentario }.
 */
export default function ProductosTerminadosTable({
  bodegaId,
  disabled = false,
  onChange,
  initialProductos = null,
}) {
  const api = useApi();
  const [productos, setProductos] = useState([]);
  const [filas, setFilas] = useState([]);
  // Stock PT en la bodega proveedora: Map id_producto_base -> unidades disponibles
  const [stockMap, setStockMap] = useState(new Map());
  const didInitRef = useRef(false);

  const makeRowId = () => `pt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/productos-base");
        const list = Array.isArray(res) ? res : res?.productos ?? [];
        setProductos(list.filter((p) => p?.id));
      } catch (e) {
        console.error("Error cargando productos base:", e);
        setProductos([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stock PT por producto en la bodega proveedora (bultos sin pallet)
  useEffect(() => {
    (async () => {
      if (!bodegaId) {
        setStockMap(new Map());
        return;
      }
      try {
        const res = await api(`/inventario/bultos?clave_categoria=PT&id_bodega=${bodegaId}`);
        const rows = Array.isArray(res) ? res : res?.rows ?? [];
        const map = new Map();
        for (const b of rows) {
          if (b?.id_pallet || b?.Pallet || b?.pallet) continue;
          const pbId = b?.loteProductoFinal?.productoBase?.id ?? b?.loteProductoFinal?.id_producto_base;
          if (!pbId) continue;
          const key = String(pbId);
          map.set(key, (map.get(key) ?? 0) + (Number(b?.unidades_disponibles) || 0));
        }
        setStockMap(map);
      } catch (e) {
        console.error("Error cargando stock PT por bodega:", e);
        setStockMap(new Map());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId]);

  // Limpiar al cambiar la bodega de origen (igual que InsumosTable)
  useEffect(() => {
    setFilas([]);
    didInitRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId]);

  // Precarga para modo edición
  useEffect(() => {
    if (didInitRef.current) return;
    if (!Array.isArray(initialProductos) || initialProductos.length === 0) return;
    setFilas(
      initialProductos
        .filter((x) => x?.id_producto_base)
        .map((x) => ({
          _rowId: makeRowId(),
          id_producto_base: String(x.id_producto_base),
          cantidad: x?.cantidad_solicitada != null ? String(x.cantidad_solicitada) : "",
          comentario: x?.comentario ?? "",
        }))
    );
    didInitRef.current = true;
  }, [initialProductos]);

  const opciones = useMemo(
    () =>
      productos.map((p) => ({
        value: String(p.id),
        label: p.nombre,
      })),
    [productos]
  );

  useEffect(() => {
    const validas = filas
      .filter((f) => f.id_producto_base && Number(f.cantidad) > 0)
      .map((f) => ({
        id_producto_base: Number(f.id_producto_base),
        cantidad_solicitada: Math.round(Number(f.cantidad)),
        comentario: f.comentario || "",
      }));
    onChange?.(validas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas]);

  const setFila = (rowId, patch) => {
    setFilas((prev) => prev.map((f) => (f._rowId === rowId ? { ...f, ...patch } : f)));
  };

  const seleccionados = new Set(filas.map((f) => f.id_producto_base).filter(Boolean));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          Los productos terminados se solicitan por unidades (cajas ya inventariadas en la bodega proveedora).
        </p>
        <button
          type="button"
          onClick={() => setFilas((prev) => [{ _rowId: makeRowId(), id_producto_base: "", cantidad: "", comentario: "" }, ...prev])}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${disabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-primary text-white hover:bg-hover"}`}
        >
          Añadir Producto
        </button>
      </div>

      {filas.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-visible">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Cantidad (unidades)</th>
                <th className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Comentario</th>
                <th className="pr-3 py-3 text-center text-s font-medium text-text uppercase tracking-wider">Opciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {filas.map((fila) => {
                const stock = fila.id_producto_base ? (stockMap.get(fila.id_producto_base) ?? 0) : null;
                const cantidad = Number(fila.cantidad) || 0;
                const optionsForRow = opciones.filter(
                  (o) => o.value === fila.id_producto_base || !seleccionados.has(o.value)
                );
                return (
                  <tr key={fila._rowId}>
                    <td className="px-6 py-2 whitespace-nowrap align-top">
                      <Selector
                        options={optionsForRow}
                        selectedValue={fila.id_producto_base}
                        onSelect={(v) => setFila(fila._rowId, { id_producto_base: v })}
                        disabled={disabled}
                        useFuzzy
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap align-top">
                      <input
                        type="number"
                        min="1"
                        step={1}
                        value={fila.cantidad}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") return setFila(fila._rowId, { cantidad: "" });
                          const n = Math.floor(Number(v));
                          if (!Number.isFinite(n) || n <= 0) return;
                          setFila(fila._rowId, { cantidad: String(n) });
                        }}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Unidades"
                      />
                      {fila.id_producto_base && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">
                          Disponibles (sin pallet): {stock ?? 0} un.
                        </p>
                      )}
                      {fila.id_producto_base && stock != null && cantidad > stock && (
                        <p className="mt-0.5 text-xs text-red-600 leading-tight">
                          Solicitas {cantidad} un., pero hay {stock} disponibles.
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap align-top">
                      <input
                        type="text"
                        value={fila.comentario}
                        onChange={(e) => setFila(fila._rowId, { comentario: e.target.value })}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Ingrese comentario"
                      />
                    </td>
                    <td className="pr-3 whitespace-nowrap text-sm font-medium align-middle">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setFilas((prev) => prev.filter((f) => f._rowId !== fila._rowId))}
                          disabled={disabled}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash className="w-6 h-6" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
