import { useEffect, useState, useCallback, Fragment } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";

// ── Badges ─────────────────────────────────────────────────────────────────

function BadgeEstado({ value }) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border";
  const v = (value || "").toLowerCase();
  if (v === "bien")
    return <span className={`${base} border-green-200 bg-green-50 text-green-800`}>Bien</span>;
  if (v === "peligro")
    return <span className={`${base} border-red-200 bg-red-50 text-red-800`}>Peligro</span>;
  return <span className={`${base} border-gray-200 bg-gray-50 text-gray-700`}>{value || "—"}</span>;
}

function BadgeCategoria({ value }) {
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";
  const v = value || "";
  if (v === "Producto Final")
    return <span className={`${base} bg-green-100 text-green-700`}>PT</span>;
  if (v.includes("Merma") || v === "M")
    return <span className={`${base} bg-red-100 text-red-700`}>Merma</span>;
  if (v === "PIP" || v === "En proceso")
    return <span className={`${base} bg-amber-100 text-amber-800`}>PIP</span>;
  return <span className={`${base} bg-blue-100 text-blue-700`}>{v || "—"}</span>;
}

function BadgeClaveCat({ value }) {
  const base = "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold";
  const v = value || "";
  if (v === "M") return <span className={`${base} bg-red-100 text-red-700`}>M</span>;
  if (v === "PT") return <span className={`${base} bg-green-100 text-green-700`}>PT</span>;
  if (v === "PIP") return <span className={`${base} bg-amber-100 text-amber-800`}>PIP</span>;
  if (v === "I") return <span className={`${base} bg-blue-100 text-blue-700`}>I</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
}

// ── Helpers de bultos (sub-tabla) ──────────────────────────────────────────

function getBodegaNombre(b) {
  return b?.Bodega?.nombre ?? b?.bodega?.nombre ?? "(sin bodega)";
}

function getUnidadMedida(b) {
  return (
    b?.materiaPrima?.unidad_medida ??
    b?.loteProductoFinal?.productoBase?.unidad_medida ??
    ""
  );
}

function getClaveCategoria(b) {
  return b?.clave_categoria ?? (b?.es_merma ? "M" : b?.categoria) ?? "";
}

// ── Componente principal ───────────────────────────────────────────────────

export default function Inventario() {
  const [inventario, setInventario] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [bodegaFilter, setBodegaFilter] = useState(0);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Accordion
  const [expandedKey, setExpandedKey] = useState(null);
  const [bultosCache, setBultosCache] = useState({});
  const [loadingBultosKey, setLoadingBultosKey] = useState(null);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const renderHeader = useCallback(
    (label, accessor) => {
      const isActive = sortConfig.key === accessor;
      const ascActive = isActive && sortConfig.direction === "asc";
      const descActive = isActive && sortConfig.direction === "desc";
      return (
        <div
          className="flex items-center gap-1 cursor-pointer select-none"
          onClick={() => handleSort(accessor)}
        >
          <span>{label}</span>
          <div className="flex flex-col leading-none text-xs ml-1">
            <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
            <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
          </div>
        </div>
      );
    },
    [sortConfig, handleSort]
  );

  // Carga inicial: inventario general + bodegas en paralelo
  useEffect(() => {
    setIsLoading(true);
    const controller = new AbortController();
    const { signal } = controller;

    const fetchAll = async () => {
      try {
        const [inv, bodRes] = await Promise.all([
          api("/inventario/general", { signal }),
          api("/bodegas", { signal }),
        ]);
        setInventario(Array.isArray(inv) ? inv : []);
        setFiltered(Array.isArray(inv) ? inv : []);
        const bods = Array.isArray(bodRes?.bodegas)
          ? bodRes.bodegas
          : Array.isArray(bodRes)
          ? bodRes
          : [];
        setBodegas(bods);
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Error cargando inventario:", error);
        toast.error("No se pudo cargar el inventario");
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    fetchAll();
    return () => controller.abort();
  }, []);

  // Aplicar filtros con AbortController (Fix 2 heredado)
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const applyFilters = async () => {
      try {
        let data = inventario;

        if (bodegaFilter && +bodegaFilter > 0) {
          const res = await api(`/inventario/${bodegaFilter}`, { signal });
          data = Array.isArray(res) ? res : [];
        }

        if (tipoFilter && tipoFilter !== "todos") {
          try {
            const idB =
              bodegaFilter && +bodegaFilter > 0 ? `&id_bodega=${bodegaFilter}` : "";
            if (tipoFilter === "materia_prima") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_materia_prima${idB}`,
                { signal }
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "pip") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_lote_producto_en_proceso${idB}`,
                { signal }
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "merma") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=merma_produccion${idB}`,
                { signal }
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "subproducto") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_registro_subproducto${idB}`,
                { signal }
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "producto_terminado") {
              const res = await api(
                `/inventario/productosFinales?id_bodega=${
                  bodegaFilter && +bodegaFilter > 0 ? bodegaFilter : ""
                }`,
                { signal }
              );
              data = Array.isArray(res) ? res : [];
            }
          } catch (e) {
            if (e?.name === "AbortError") return;
            data = [];
          }
        }

        if (query && query.trim().length > 0) {
          const q = query.toLowerCase();
          data = data.filter(
            (d) =>
              (d.materiaPrima?.nombre || "").toLowerCase().includes(q) ||
              (d.materiaPrima?.categoria?.nombre || "").toLowerCase().includes(q)
          );
        }

        if (sortConfig.key) {
          data = [...data].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (typeof aVal === "number" && typeof bVal === "number") {
              return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
            }
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            return sortConfig.direction === "asc"
              ? aStr.localeCompare(bStr)
              : bStr.localeCompare(aStr);
          });
        }

        setFiltered(data);
        setExpandedKey(null);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Error aplicando filtros:", err);
      }
    };

    applyFilters();
    return () => controller.abort();
  }, [bodegaFilter, tipoFilter, query, inventario, sortConfig]);

  // Accordion — carga bultos on demand al expandir una fila
  const handleExpandRow = useCallback(
    async (item) => {
      const key = item.materiaPrima?.id;
      if (!key) return;

      if (expandedKey === key) {
        setExpandedKey(null);
        return;
      }

      setExpandedKey(key);

      // Usar caché si ya fueron cargados
      if (bultosCache[key] !== undefined) return;

      setLoadingBultosKey(key);
      try {
        const qs = new URLSearchParams();
        if (bodegaFilter && +bodegaFilter > 0) qs.set("id_bodega", String(bodegaFilter));
        qs.set("id_materia_prima", String(key));
        const data = await api(`/inventario/bultos?${qs.toString()}`);
        setBultosCache((prev) => ({
          ...prev,
          [key]: Array.isArray(data) ? data : [],
        }));
      } catch {
        toast.error("No se pudieron cargar los bultos del insumo");
        setBultosCache((prev) => ({ ...prev, [key]: [] }));
      } finally {
        setLoadingBultosKey(null);
      }
    },
    [expandedKey, bultosCache, bodegaFilter]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Inventario</h1>
      </div>

      {/* Panel de filtros */}
      <div className="bg-white shadow rounded p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-semibold mb-1">Bodega</label>
            <select
              value={bodegaFilter}
              onChange={(e) => setBodegaFilter(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value={0}>Todas</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Tipo</label>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="todos">Todos</option>
              <option value="materia_prima">Materias Primas</option>
              <option value="pip">Productos en Proceso (PIP)</option>
              <option value="producto_terminado">Productos Terminados</option>
              <option value="merma">Mermas</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nombre, categoría…"
              className="border rounded px-3 py-2 w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3">
          Mostrando <span className="font-semibold">{filtered.length}</span> ítems
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 bg-white rounded shadow">
          <p className="text-gray-500">Cargando inventario...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Tabla desktop */}
          <div className="hidden md:block overflow-x-auto bg-white shadow rounded">
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border w-8"></th>
                  <th className="p-2 border text-left font-semibold">
                    {renderHeader("Nombre", "nombre")}
                  </th>
                  <th className="p-2 border text-left font-semibold">Categoría</th>
                  <th className="p-2 border text-left font-semibold">
                    {renderHeader("Stock disponible", "unidades_disponibles")}
                  </th>
                  <th className="p-2 border text-left font-semibold">
                    {renderHeader("Estado", "estado_stock")}
                  </th>
                  <th className="p-2 border text-left font-semibold">
                    {renderHeader("Costo total", "precio_total")}
                  </th>
                  <th className="p-2 border text-left font-semibold">
                    {renderHeader("Último mov.", "ultimo_movimiento")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No hay ítems para los filtros actuales.
                    </td>
                  </tr>
                )}

                {filtered.map((item, idx) => {
                  const key = item.materiaPrima?.id ?? idx;
                  const nombre = item.materiaPrima?.nombre || item.nombre_producto || "—";
                  const categoria =
                    item.categoria || item.materiaPrima?.categoria?.nombre || "—";
                  const isExpanded = expandedKey === key;
                  const expandible =
                    !!item.materiaPrima?.id && categoria !== "Producto Final";
                  const bultos = bultosCache[key] || [];
                  const isLoadingBultos = loadingBultosKey === key;

                  return (
                    <Fragment key={`row-${key}`}>
                      <tr
                        className={`hover:bg-gray-50 ${expandible ? "cursor-pointer" : ""}`}
                        onClick={() => expandible && handleExpandRow(item)}
                      >
                        <td className="p-2 border text-center">
                          {expandible ? (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400 inline" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400 inline" />
                            )
                          ) : null}
                        </td>
                        <td className="p-2 border font-medium">{nombre}</td>
                        <td className="p-2 border">
                          <BadgeCategoria value={categoria} />
                        </td>
                        <td className="p-2 border">{item.unidades_disponibles ?? "—"}</td>
                        <td className="p-2 border">
                          <BadgeEstado value={item.estado_stock} />
                        </td>
                        <td className="p-2 border">
                          {item.precio_total != null
                            ? formatCLP(item.precio_total, 0)
                            : "—"}
                        </td>
                        <td className="p-2 border text-gray-500 text-xs">
                          {item.ultimo_movimiento
                            ? new Date(item.ultimo_movimiento).toLocaleString("es-CL")
                            : "—"}
                        </td>
                      </tr>

                      {/* Sub-tabla accordion */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-gray-200">
                            <div className="bg-blue-50/30 px-6 py-3 border-t border-blue-100">
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                Bultos en inventario — {nombre}
                              </p>

                              {isLoadingBultos ? (
                                <p className="text-sm text-gray-500 py-2">
                                  Cargando bultos…
                                </p>
                              ) : bultos.length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">
                                  No hay bultos disponibles para este insumo con los
                                  filtros actuales.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded border border-gray-200">
                                  <table className="w-full text-xs bg-white">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Cat
                                        </th>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Identificador
                                        </th>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Bodega
                                        </th>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Formato
                                        </th>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Disponible
                                        </th>
                                        <th className="px-3 py-2 border text-left font-semibold">
                                          Costo total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bultos.map((b) => {
                                        const unidad = getUnidadMedida(b);
                                        const disponible =
                                          Number(b.unidades_disponibles || 0) *
                                          Number(b.peso_unitario || 0);
                                        const costo =
                                          Number(b.costo_unitario || 0) *
                                          Number(b.unidades_disponibles || 0);
                                        return (
                                          <tr key={b.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 border text-center">
                                              <BadgeClaveCat
                                                value={getClaveCategoria(b)}
                                              />
                                            </td>
                                            <td className="px-3 py-2 border font-mono">
                                              {b.identificador}
                                            </td>
                                            <td className="px-3 py-2 border">
                                              {getBodegaNombre(b)}
                                            </td>
                                            <td className="px-3 py-2 border">
                                              {formatNumberCL(b.peso_unitario, 2)}{" "}
                                              {unidad}
                                            </td>
                                            <td className="px-3 py-2 border">
                                              <span className="font-medium">
                                                {formatNumberCL(disponible, 2)} {unidad}
                                              </span>
                                              <span className="text-gray-400 ml-1 text-[10px]">
                                                ({b.unidades_disponibles}/
                                                {b.cantidad_unidades} un.)
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 border">
                                              {formatCLP(costo, 0)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && (
              <div className="text-sm text-gray-500">No hay datos</div>
            )}
            {filtered.map((item, idx) => {
              const nombre = item.materiaPrima?.nombre || item.nombre_producto || "—";
              const categoria =
                item.categoria || item.materiaPrima?.categoria?.nombre || "—";
              return (
                <div
                  key={item.materiaPrima?.id ?? idx}
                  className="bg-white p-4 rounded shadow"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-base font-semibold">{nombre}</div>
                      <div className="mt-1">
                        <BadgeCategoria value={categoria} />
                      </div>
                    </div>
                    <BadgeEstado value={item.estado_stock} />
                  </div>
                  <div className="mt-3 text-sm text-gray-700 space-y-1">
                    <div>
                      Stock:{" "}
                      <span className="font-medium">
                        {item.unidades_disponibles ?? "—"}
                      </span>
                    </div>
                    <div>
                      Costo:{" "}
                      <span className="font-medium">
                        {item.precio_total != null
                          ? formatCLP(item.precio_total, 0)
                          : "—"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Último mov.:{" "}
                      {item.ultimo_movimiento
                        ? new Date(item.ultimo_movimiento).toLocaleString("es-CL")
                        : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
