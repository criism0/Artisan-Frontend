import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

const MONEDAS_POSIBLES = ["CLP", "USD", "EUR", "UF"];

function normalizeArrayResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.proveedores)) return response.data.proveedores;
  if (Array.isArray(response?.proveedores)) return response.proveedores;
  return [];
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatNumberCL(value) {
  const n = toNumber(value);
  return n.toLocaleString("es-CL");
}

export default function InsumosPorProveedor() {
  const api = useApi();

  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState("");

  const [asociaciones, setAsociaciones] = useState([]);
  const [draftById, setDraftById] = useState({});
  const [dirtyIds, setDirtyIds] = useState(() => new Set());

  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [loadingAsociaciones, setLoadingAsociaciones] = useState(false);

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        setLoadingProveedores(true);
        const resp = await api(`/proveedores`, { method: "GET" });
        const lista = normalizeArrayResponse(resp);
        const ordenados = [...lista].sort((a, b) =>
          String(a?.nombre_empresa || "").localeCompare(String(b?.nombre_empresa || ""))
        );
        setProveedores(ordenados);
      } catch (error) {
        console.error(error);
        toast.error("No se pudieron cargar proveedores");
      } finally {
        setLoadingProveedores(false);
      }
    };

    void fetchProveedores();
  }, [api]);

  const proveedorSeleccionado = useMemo(() => {
    const idNum = Number(proveedorId);
    return proveedores.find((p) => Number(p?.id) === idNum) || null;
  }, [proveedorId, proveedores]);

  const grouped = useMemo(() => {
    const map = groupBy(asociaciones, (a) => String(a?.materiaPrima?.id ?? a?.id_materia_prima ?? ""));
    const entries = Array.from(map.entries()).map(([k, v]) => ({
      key: k,
      materiaPrimaNombre: String(v?.[0]?.materiaPrima?.nombre || v?.[0]?.materiaPrima?.name || "Insumo"),
      rows: v,
    }));

    entries.sort((a, b) => a.materiaPrimaNombre.localeCompare(b.materiaPrimaNombre));
    return entries;
  }, [asociaciones]);

  const formatoPorId = useMemo(() => {
    const map = new Map();
    for (const a of asociaciones) {
      if (a?.id == null) continue;
      map.set(Number(a.id), String(a?.formato || ""));
    }
    return map;
  }, [asociaciones]);

  const getNombreFormato = (rowId) => {
    const d = draftById?.[rowId];
    const fromDraft = d?.formato != null ? String(d.formato) : "";
    if (fromDraft.trim()) return fromDraft;
    const fromApi = formatoPorId.get(Number(rowId));
    return String(fromApi || "");
  };

  const getNombreFormatoHijo = (draftRow) => {
    const idHijo = draftRow?.id_formato_hijo;
    if (!idHijo) return "";
    return getNombreFormato(Number(idHijo));
  };

  const derivedById = useMemo(() => {
    const cache = new Map();

    const compute = (rowId, visiting = new Set()) => {
      const idNum = Number(rowId);
      if (!Number.isFinite(idNum)) return null;
      if (cache.has(idNum)) return cache.get(idNum);
      if (visiting.has(idNum)) return null;
      visiting.add(idNum);

      const d = draftById?.[idNum];
      if (!d) {
        visiting.delete(idNum);
        return null;
      }

      const esUC = !!d.es_unidad_consumo;
      if (esUC) {
        const moneda = String(d.moneda || "");
        const precio = toNumber(d.precio_unitario);
        const cantidadPorFormato = toNumber(d.cantidad_por_formato);
        const unidad = String(d.unidad_medida || "");
        const result = { precio, moneda, cantidadPorFormato, unidad };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const idHijo = d.id_formato_hijo;
      const cantidadHijos = toNumber(d.cantidad_hijos);
      if (!idHijo) {
        const moneda = String(d.moneda || "");
        const precio = toNumber(d.precio_unitario);
        const cantidadPorFormato = toNumber(d.cantidad_por_formato);
        const unidad = String(d.unidad_medida || "");
        const result = { precio, moneda, cantidadPorFormato, unidad };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const child = compute(idHijo, visiting);
      if (!child) {
        const moneda = String(d.moneda || "");
        const precio = toNumber(d.precio_unitario);
        const cantidadPorFormato = toNumber(d.cantidad_por_formato);
        const unidad = String(d.unidad_medida || "");
        const result = { precio, moneda, cantidadPorFormato, unidad };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const result = {
        precio: child.precio * cantidadHijos,
        moneda: child.moneda,
        cantidadPorFormato: child.cantidadPorFormato * cantidadHijos,
        unidad: child.unidad,
      };
      cache.set(idNum, result);
      visiting.delete(idNum);
      return result;
    };

    for (const id of Object.keys(draftById || {})) {
      compute(id);
    }
    return cache;
  }, [draftById]);

  const resumen = useMemo(() => {
    return {
      asociaciones: asociaciones.length,
      materiasPrimas: grouped.length,
      cambiosPendientes: dirtyIds.size,
    };
  }, [asociaciones.length, grouped.length, dirtyIds.size]);

  const loadAsociaciones = async (idProveedor) => {
    if (!idProveedor) {
      setAsociaciones([]);
      setDraftById({});
      setDirtyIds(new Set());
      return;
    }

    try {
      setLoadingAsociaciones(true);
      const resp = await api(`/proveedor-materia-prima?id_proveedor=${encodeURIComponent(idProveedor)}`, {
        method: "GET",
      });

      const lista = Array.isArray(resp) ? resp : [];
      const ordenadas = [...lista].sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0));
      setAsociaciones(ordenadas);

      const draft = {};
      for (const row of ordenadas) {
        draft[row.id] = {
          id: row.id,
          id_proveedor: row.id_proveedor,
          id_materia_prima: row.id_materia_prima,
          formato: String(row.formato || ""),
          unidad_medida: String(row.unidad_medida || ""),
          es_unidad_consumo: !!row.es_unidad_consumo,
          cantidad_por_formato: row.cantidad_por_formato ?? 0,
          precio_unitario: row.precio_unitario ?? 0,
          moneda: String(row.moneda || ""),
          id_formato_hijo: row.id_formato_hijo ?? null,
          cantidad_hijos: row.cantidad_hijos ?? 1,
        };
      }
      setDraftById(draft);
      setDirtyIds(new Set());
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar asociaciones del proveedor");
      setAsociaciones([]);
      setDraftById({});
      setDirtyIds(new Set());
    } finally {
      setLoadingAsociaciones(false);
    }
  };

  useEffect(() => {
    void loadAsociaciones(proveedorId);
  }, [proveedorId]);

  const setDraftField = (id, field, value) => {
    setDraftById((prev) => {
      const next = { ...prev };
      const current = next[id] || {};
      next[id] = { ...current, [field]: value };
      return next;
    });

    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleGuardarCambios = async () => {
    if (!proveedorId) return;
    const ids = Array.from(dirtyIds);
    if (ids.length === 0) {
      toast.info("No hay cambios pendientes");
      return;
    }

    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const draft = draftById[id];
          if (!draft) return;

          const bodyBase = {
            id_proveedor: draft.id_proveedor,
            id_materia_prima: draft.id_materia_prima,
            formato: String(draft.formato || ""),
            unidad_medida: String(draft.unidad_medida || ""),
            es_unidad_consumo: !!draft.es_unidad_consumo,
          };

          const body = draft.es_unidad_consumo
            ? {
                ...bodyBase,
                peso_unitario: toNumber(draft.cantidad_por_formato),
                precio_unitario: toNumber(draft.precio_unitario),
                moneda: String(draft.moneda || ""),
              }
            : {
                ...bodyBase,
                id_formato_hijo: draft.id_formato_hijo,
                cantidad_hijos: toNumber(draft.cantidad_hijos),
              };

          await api(`/proveedor-materia-prima/por-materia-prima/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        })
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error("Fallos guardando cambios:", failed);
        toast.error(`Se guardaron algunos cambios, pero fallaron ${failed.length}`);
      } else {
        toast.success("Cambios guardados");
      }

      await loadAsociaciones(proveedorId);
    } catch (error) {
      console.error(error);
      toast.error("Error guardando cambios");
    }
  };

  const handleDescartarCambios = async () => {
    await loadAsociaciones(proveedorId);
    toast.info("Cambios descartados");
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Insumos por Proveedor</h1>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 disabled:opacity-60"
            onClick={handleDescartarCambios}
            disabled={!proveedorId || resumen.cambiosPendientes === 0 || loadingAsociaciones}
          >
            Descartar cambios
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-60"
            onClick={handleGuardarCambios}
            disabled={!proveedorId || resumen.cambiosPendientes === 0 || loadingAsociaciones}
          >
            Guardar cambios ({resumen.cambiosPendientes})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">Resumen</div>

            <label className="block text-sm text-gray-700 mb-2">Proveedor</label>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              disabled={loadingProveedores}
            >
              <option value="">{loadingProveedores ? "Cargando..." : "Selecciona un proveedor"}</option>
              {proveedores.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nombre_empresa}
                </option>
              ))}
            </select>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-xs text-gray-500">Insumos</div>
                <div className="text-lg font-semibold text-gray-900">{resumen.materiasPrimas}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-xs text-gray-500">Formatos</div>
                <div className="text-lg font-semibold text-gray-900">{resumen.asociaciones}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-xs text-gray-500">Pendientes</div>
                <div className="text-lg font-semibold text-gray-900">{resumen.cambiosPendientes}</div>
              </div>
            </div>

            {proveedorSeleccionado && (
              <div className="mt-4 text-sm text-gray-700">
                <div className="font-medium text-gray-900">{proveedorSeleccionado.nombre_empresa}</div>
                <div className="text-gray-600">ID: {proveedorSeleccionado.id}</div>
              </div>
            )}
          </div>
        </aside>

        <main className="lg:col-span-8">
          {!proveedorId ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-gray-700">
              Selecciona un proveedor para ver y editar sus insumos.
            </div>
          ) : loadingAsociaciones ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-gray-700">Cargando asociaciones...</div>
          ) : asociaciones.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-gray-700">
              Este proveedor no tiene asociaciones de insumos.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.key} className="bg-white rounded-xl border shadow-sm">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div className="font-semibold text-gray-900">{g.materiaPrimaNombre}</div>
                    <div className="text-sm text-gray-600">{g.rows.length} formato(s)</div>
                  </div>

                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-3">Nombre Formato</th>
                          <th className="py-2 pr-3">Cantidad Por Formato</th>
                          <th className="py-2 pr-3">Precio</th>
                          <th className="py-2 pr-3">Moneda</th>
                          <th className="py-2 pr-3">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((row) => {
                          const d = draftById[row.id];
                          const isDirty = dirtyIds.has(row.id);
                          const esUC = !!d?.es_unidad_consumo;
                          const nombreEsteFormato = getNombreFormato(row.id) || "este formato";
                          const nombreFormatoHijo = getNombreFormatoHijo(d);
                          const derived = derivedById.get(Number(row.id));
                          const displayPrecio = esUC ? toNumber(d?.precio_unitario) : (derived?.precio ?? row.precio_unitario ?? 0);
                          const displayMoneda = esUC
                            ? String(d?.moneda ?? "")
                            : String(derived?.moneda ?? row.moneda ?? "");
                          const displayUnidad = String(d?.unidad_medida ?? "").trim();

                          return (
                            <tr key={row.id} className="border-t">
                              <td className="py-2 pr-3 min-w-[220px]">
                                <input
                                  value={d?.formato ?? ""}
                                  onChange={(e) => setDraftField(row.id, "formato", e.target.value)}
                                  className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                                />
                                <div className="text-xs text-gray-500 mt-1">ID: {row.id}</div>
                              </td>

                              <td className="py-2 pr-3 min-w-[140px]">
                                {esUC ? (
                                  <input
                                    type="number"
                                    value={d?.cantidad_por_formato ?? 0}
                                    onChange={(e) => setDraftField(row.id, "cantidad_por_formato", e.target.value)}
                                    className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                                  />
                                ) : (
                                  <input
                                    type="number"
                                    value={d?.cantidad_hijos ?? 1}
                                    onChange={(e) => setDraftField(row.id, "cantidad_hijos", e.target.value)}
                                    className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                                  />
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {esUC
                                    ? `Cantidad de ${displayUnidad || "(sin unidad)"}`
                                    : `Cantidad de ${nombreFormatoHijo || "formato hijo"} por ${nombreEsteFormato}`}
                                </div>
                              </td>

                              <td className="py-2 pr-3 min-w-[140px]">
                                {esUC ? (
                                  <input
                                    type="number"
                                    value={d?.precio_unitario ?? 0}
                                    onChange={(e) => setDraftField(row.id, "precio_unitario", e.target.value)}
                                    className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                                  />
                                ) : (
                                  <div className="text-gray-900">{formatNumberCL(displayPrecio)}</div>
                                )}
                              </td>

                              <td className="py-2 pr-3 min-w-[120px]">
                                {esUC ? (
                                  <select
                                    value={d?.moneda ?? ""}
                                    onChange={(e) => setDraftField(row.id, "moneda", e.target.value)}
                                    className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                                  >
                                    <option value="">Seleccionar</option>
                                    {MONEDAS_POSIBLES.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="text-gray-900">{displayMoneda}</div>
                                )}
                              </td>

                              <td className="py-2 pr-3 min-w-[160px]">
                                <label className="inline-flex items-center gap-2 text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={!!d?.es_unidad_consumo}
                                    onChange={(e) => setDraftField(row.id, "es_unidad_consumo", e.target.checked)}
                                  />
                                  <span className="text-sm">Unidad consumo</span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
