import { useEffect, useMemo, useRef, useState } from "react";
import { Trash } from "lucide-react";
import Selector from "../Forms/Selector";
import { useApi } from "../../lib/api";

/**
 * Tabla de productos terminados a solicitar (B4, M4): los PT se piden POR
 * NOMBRE DE FACTURACIÓN (el picking admite cualquier producto físico del
 * grupo) y en CAJAS por defecto (unidades por caja efectivas del nombre).
 * Emite via onChange filas válidas:
 * { id_nombre_facturacion, cantidad_solicitada (unidades totales),
 *   producto_por_cajas, cantidad_por_caja, comentario }.
 */
export default function ProductosTerminadosTable({
  bodegaId,
  disabled = false,
  onChange,
  initialProductos = null,
}) {
  const api = useApi();
  const [nombres, setNombres] = useState([]);
  const [filas, setFilas] = useState([]);
  // Stock PT en la bodega proveedora: Map id_nombre_facturacion -> unidades (bultos sin pallet)
  const [stockMap, setStockMap] = useState(new Map());
  const didInitRef = useRef(false);

  const makeRowId = () => `pt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/nombres-facturacion");
        const list = Array.isArray(res) ? res : res?.data ?? [];
        // Solo nombres con productos físicos (sin productos no hay nada que mover).
        setNombres(list.filter((n) => n?.id && (n.productos?.length ?? 0) > 0));
      } catch (e) {
        console.error("Error cargando nombres de facturación:", e);
        setNombres([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // producto físico -> nombre de facturación (para agregar stock por nombre)
  const nfPorProducto = useMemo(() => {
    const map = new Map();
    for (const n of nombres) {
      for (const p of n.productos ?? []) map.set(Number(p.id), Number(n.id));
    }
    return map;
  }, [nombres]);

  // Unidades por caja efectivas del nombre (NF.unidades_por_caja ?? primer producto).
  const unidadesPorCajaDeNombre = (nombreId) => {
    const n = nombres.find((x) => String(x.id) === String(nombreId));
    if (!n) return 1;
    return Number(n.unidades_por_caja) > 0
      ? Number(n.unidades_por_caja)
      : Number(n.productos?.[0]?.unidades_por_caja) > 0
        ? Number(n.productos[0].unidades_por_caja)
        : 1;
  };

  // Stock PT por nombre de facturación en la bodega proveedora (bultos sin pallet)
  useEffect(() => {
    (async () => {
      if (!bodegaId || nombres.length === 0) {
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
          const nfId = pbId != null ? nfPorProducto.get(Number(pbId)) : null;
          if (!nfId) continue;
          const key = String(nfId);
          map.set(key, (map.get(key) ?? 0) + (Number(b?.unidades_disponibles) || 0));
        }
        setStockMap(map);
      } catch (e) {
        console.error("Error cargando stock PT por bodega:", e);
        setStockMap(new Map());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, nfPorProducto]);

  // Limpiar al cambiar la bodega de origen (igual que InsumosTable)
  useEffect(() => {
    setFilas([]);
    didInitRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId]);

  // Precarga para modo edición (detalles con id_nombre_facturacion)
  useEffect(() => {
    if (didInitRef.current) return;
    if (!Array.isArray(initialProductos) || initialProductos.length === 0) return;
    setFilas(
      initialProductos
        .filter((x) => x?.id_nombre_facturacion)
        .map((x) => {
          const porCajas = Boolean(x?.producto_por_cajas) && Number(x?.cantidad_por_caja) > 0;
          const cantidadUnidades = Number(x?.cantidad_solicitada) || 0;
          return {
            _rowId: makeRowId(),
            id_nombre_facturacion: String(x.id_nombre_facturacion),
            formato: porCajas ? "cajas" : "unidades",
            cantidad: porCajas
              ? String(Math.round(cantidadUnidades / Number(x.cantidad_por_caja)))
              : cantidadUnidades
                ? String(cantidadUnidades)
                : "",
            comentario: x?.comentario ?? "",
          };
        })
    );
    didInitRef.current = true;
  }, [initialProductos]);

  const opciones = useMemo(
    () =>
      nombres.map((n) => ({
        value: String(n.id),
        label: n.nombre,
      })),
    [nombres]
  );

  useEffect(() => {
    const validas = filas
      .filter((f) => f.id_nombre_facturacion && Number(f.cantidad) > 0)
      .map((f) => {
        const cantidad = Math.round(Number(f.cantidad));
        const porCajas = f.formato === "cajas";
        const upc = unidadesPorCajaDeNombre(f.id_nombre_facturacion);
        return {
          id_nombre_facturacion: Number(f.id_nombre_facturacion),
          cantidad_solicitada: porCajas ? cantidad * upc : cantidad,
          producto_por_cajas: porCajas,
          cantidad_por_caja: porCajas ? upc : null,
          comentario: f.comentario || "",
        };
      });
    onChange?.(validas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, nombres]);

  const setFila = (rowId, patch) => {
    setFilas((prev) => prev.map((f) => (f._rowId === rowId ? { ...f, ...patch } : f)));
  };

  const seleccionados = new Set(filas.map((f) => f.id_nombre_facturacion).filter(Boolean));

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-2">
        <button
          type="button"
          onClick={() =>
            setFilas((prev) => [
              { _rowId: makeRowId(), id_nombre_facturacion: "", formato: "cajas", cantidad: "", comentario: "" },
              ...prev,
            ])
          }
          disabled={disabled}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${disabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-primary text-white hover:bg-hover"}`}
        >
          Añadir Producto
        </button>
      </div>

      {/* `table-fixed` + anchos por columna: sin eso la columna del producto crece con el
          nombre y empuja la tabla fuera de la tarjeta. Los nombres de facturación de PT son
          largos, y el desborde se veía como que la vista entera se corría hacia la derecha.
          El `overflow-x-auto` es la red: en el peor caso desplaza dentro de la tarjeta.
          El menú del Selector va en un portal `fixed`, así que no lo recorta. */}
      {filas.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-[30%] px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Producto</th>
                <th className="w-[20%] px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Formato</th>
                <th className="w-[18%] px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Cantidad</th>
                <th className="w-[22%] px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">Comentario</th>
                <th className="w-[10%] pr-3 py-3 text-center text-s font-medium text-text uppercase tracking-wider">Opciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              {filas.map((fila) => {
                const stock = fila.id_nombre_facturacion
                  ? (stockMap.get(fila.id_nombre_facturacion) ?? 0)
                  : null;
                const upc = fila.id_nombre_facturacion
                  ? unidadesPorCajaDeNombre(fila.id_nombre_facturacion)
                  : 1;
                const cantidad = Number(fila.cantidad) || 0;
                const unidadesTotales = fila.formato === "cajas" ? cantidad * upc : cantidad;
                const optionsForRow = opciones.filter(
                  (o) => o.value === fila.id_nombre_facturacion || !seleccionados.has(o.value)
                );
                return (
                  <tr key={fila._rowId}>
                    <td className="px-6 py-2 align-top">
                      <Selector
                        options={optionsForRow}
                        selectedValue={fila.id_nombre_facturacion}
                        onSelect={(v) => setFila(fila._rowId, { id_nombre_facturacion: v })}
                        disabled={disabled}
                        useFuzzy
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </td>
                    <td className="px-6 py-2 align-top">
                      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                        {[
                          { value: "cajas", label: "Cajas" },
                          { value: "unidades", label: "Unidades" },
                        ].map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setFila(fila._rowId, { formato: m.value })}
                            disabled={disabled}
                            className={`px-3 py-2 text-sm transition-colors ${
                              fila.formato === m.value
                                ? "bg-primary text-white"
                                : "bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {fila.id_nombre_facturacion && fila.formato === "cajas" && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">{upc} unid. por caja</p>
                      )}
                    </td>
                    <td className="px-6 py-2 align-top">
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
                        placeholder={fila.formato === "cajas" ? "Cajas" : "Unidades"}
                      />
                      {fila.id_nombre_facturacion && fila.formato === "cajas" && cantidad > 0 && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">= {unidadesTotales} unidades</p>
                      )}
                      {fila.id_nombre_facturacion && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">
                          Disponibles (sin pallet): {stock ?? 0} un.
                          {upc > 1 && stock != null ? ` (~${Math.floor(stock / upc)} cajas)` : ""}
                        </p>
                      )}
                      {fila.id_nombre_facturacion && stock != null && unidadesTotales > stock && (
                        <p className="mt-0.5 text-xs text-red-600 leading-tight">
                          Solicitas {unidadesTotales} un., pero hay {stock} disponibles.
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-2 align-top">
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
