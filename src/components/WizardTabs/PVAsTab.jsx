import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { insumoToSearchText } from "../../services/fuzzyMatch";
import Selector from "../Selector";

function toPosInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const ni = Math.trunc(n);
  return ni > 0 ? ni : null;
}

export default function PVAsTab({
  productoBaseId,
  materiaPrimaId,
  onNext,
}) {
  const api = useApi();

  const targetProductoBaseId = toPosInt(productoBaseId);
  const targetMateriaPrimaId = toPosInt(materiaPrimaId);

  const hasTarget = Boolean(targetProductoBaseId || targetMateriaPrimaId);

  const [loading, setLoading] = useState(false);
  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [pvas, setPvas] = useState([]);

  const [nuevoProcesoId, setNuevoProcesoId] = useState("");

  const [showCrearProceso, setShowCrearProceso] = useState(false);
  const [creandoProceso, setCreandoProceso] = useState(false);
  const [nuevoProcesoForm, setNuevoProcesoForm] = useState({
    descripcion: "",
    costo_estimado: "0",
    tiempo_estimado: "0",
    unidad_tiempo: "Minutos",
    utiliza_insumos: false,
    genera_bultos_nuevos: false,
  });

  const [expandedPvaId, setExpandedPvaId] = useState(null);
  const [insumosByPvaId, setInsumosByPvaId] = useState({});

  const [draftNuevoInsumoByPvaId, setDraftNuevoInsumoByPvaId] = useState({});

  const procesosById = useMemo(() => {
    const map = new Map();
    for (const p of procesos || []) {
      if (!p?.id) continue;
      map.set(Number(p.id), p);
    }
    return map;
  }, [procesos]);

  const opcionesProcesos = useMemo(() => {
    const list = Array.isArray(procesos) ? procesos : [];
    return list
      .filter((p) => p && p.id)
      .map((p) => {
        const cat = p?.utiliza_insumos ? "Usa insumos" : "Sin insumos";
        return {
          value: String(p.id),
          label: `${p.id} — ${p.descripcion}`,
          category: cat,
          searchText: `${p.id} ${p.descripcion}`,
        };
      });
  }, [procesos]);

  const opcionesMateriaPrima = useMemo(() => {
    const list = Array.isArray(materiasPrimas) ? materiasPrimas : [];
    return list
      .filter((mp) => mp && mp.id)
      .filter((mp) => mp?.activo !== false)
      .map((mp) => {
        const categoria = mp?.categoria?.nombre || "Sin categoría";
        return {
          value: String(mp.id),
          label: mp.nombre,
          category: categoria,
          unidad: mp?.unidad_medida ? String(mp.unidad_medida) : "",
          searchText: insumoToSearchText(mp),
        };
      });
  }, [materiasPrimas]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [procRes, mpRes] = await Promise.all([
        api(`/procesos-de-valor-agregado`, { method: "GET" }),
        api(`/materias-primas`, { method: "GET" }),
      ]);
      setProcesos(Array.isArray(procRes) ? procRes : []);
      setMateriasPrimas(Array.isArray(mpRes) ? mpRes : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar procesos/materias primas");
    } finally {
      setLoading(false);
    }
  };

  const loadPVAs = async () => {
    if (!hasTarget) {
      setPvas([]);
      return;
    }

    setLoading(true);
    try {
      const qs = targetProductoBaseId
        ? `id_producto_base=${encodeURIComponent(String(targetProductoBaseId))}`
        : `id_materia_prima=${encodeURIComponent(String(targetMateriaPrimaId))}`;

      const res = await api(`/pva-por-producto/producto?${qs}`, { method: "GET" });
      const list = Array.isArray(res) ? res : [];
      list.sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0));
      setPvas(list);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los PVAs asociados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadPVAs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetProductoBaseId, targetMateriaPrimaId]);

  const handleCrearPVA = async () => {
    if (!hasTarget) return;

    const idProceso = toPosInt(nuevoProcesoId);
    if (!idProceso) return toast.error("Debes seleccionar un Proceso de Valor Agregado");

    setLoading(true);
    try {
      const payload = {
        id_proceso: idProceso,
        id_producto_base: targetProductoBaseId ?? null,
        id_materia_prima: targetMateriaPrimaId ?? null,
      };

      await api(`/pva-por-producto/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNuevoProcesoId("");
      toast.success("PVA agregado al producto");
      await loadPVAs();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo agregar el PVA");
    } finally {
      setLoading(false);
    }
  };

  const validateNuevoProceso = () => {
    const descripcion = String(nuevoProcesoForm.descripcion || "").trim();
    if (!descripcion) return { ok: false, msg: "La descripción del proceso es obligatoria" };

    const unidad = String(nuevoProcesoForm.unidad_tiempo || "").trim();
    if (!unidad) return { ok: false, msg: "Debes seleccionar una unidad de tiempo" };

    const costo = Number(nuevoProcesoForm.costo_estimado);
    if (!Number.isFinite(costo) || costo < 0) return { ok: false, msg: "Costo estimado inválido" };

    const tiempo = Number(nuevoProcesoForm.tiempo_estimado);
    if (!Number.isFinite(tiempo) || tiempo < 0) return { ok: false, msg: "Tiempo estimado inválido" };

    return { ok: true };
  };

  const handleCrearProcesoYAgregar = async () => {
    if (!hasTarget) return;

    const v = validateNuevoProceso();
    if (!v.ok) return toast.error(v.msg);

    setCreandoProceso(true);
    setLoading(true);
    try {
      const procesoBody = {
        descripcion: String(nuevoProcesoForm.descripcion || "").trim(),
        costo_estimado: Number(nuevoProcesoForm.costo_estimado || 0),
        tiempo_estimado: Number(nuevoProcesoForm.tiempo_estimado || 0),
        unidad_tiempo: String(nuevoProcesoForm.unidad_tiempo || ""),
        tiene_pasos: false,
        genera_bultos_nuevos: Boolean(nuevoProcesoForm.genera_bultos_nuevos),
        utiliza_insumos: Boolean(nuevoProcesoForm.utiliza_insumos),
      };

      const createdProceso = await api(`/procesos-de-valor-agregado`, {
        method: "POST",
        body: JSON.stringify(procesoBody),
      });

      const idProceso = createdProceso?.id ? Number(createdProceso.id) : null;
      if (!idProceso) throw new Error("No se pudo crear el Proceso de Valor Agregado");

      await api(`/pva-por-producto/`, {
        method: "POST",
        body: JSON.stringify({
          id_proceso: idProceso,
          id_producto_base: targetProductoBaseId ?? null,
          id_materia_prima: targetMateriaPrimaId ?? null,
        }),
      });

      toast.success("Proceso creado y agregado al producto");

      setNuevoProcesoForm({
        descripcion: "",
        costo_estimado: "0",
        tiempo_estimado: "0",
        unidad_tiempo: "Minutos",
        utiliza_insumos: false,
        genera_bultos_nuevos: false,
      });
      setShowCrearProceso(false);
      setNuevoProcesoId("");

      await loadBaseData();
      await loadPVAs();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo crear el proceso y agregarlo");
    } finally {
      setCreandoProceso(false);
      setLoading(false);
    }
  };

  const handleEliminarPVA = async (pva) => {
    const ok = window.confirm("¿Eliminar este PVA del producto? Esto reordena automáticamente.");
    if (!ok) return;

    setLoading(true);
    try {
      await api(`/pva-por-producto/${pva.id}`, { method: "DELETE" });
      toast.success("PVA eliminado");
      setExpandedPvaId((prev) => (Number(prev) === Number(pva.id) ? null : prev));
      await loadPVAs();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el PVA");
    } finally {
      setLoading(false);
    }
  };

  const handleReordenarSwap = async (fromIndex, toIndex) => {
    const list = Array.isArray(pvas) ? pvas.slice() : [];
    if (toIndex < 0 || toIndex >= list.length) return;

    const tmp = list[fromIndex];
    list[fromIndex] = list[toIndex];
    list[toIndex] = tmp;

    const registros = list.map((r, idx) => ({ id: r.id, orden: idx + 1 }));
    const qs = targetProductoBaseId
      ? `id_producto_base=${encodeURIComponent(String(targetProductoBaseId))}`
      : `id_materia_prima=${encodeURIComponent(String(targetMateriaPrimaId))}`;

    setLoading(true);
    try {
      const updated = await api(`/pva-por-producto/reordenar?${qs}`, {
        method: "PUT",
        body: JSON.stringify({ registros }),
      });

      const next = Array.isArray(updated) ? updated : list;
      next.sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0));
      setPvas(next);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo reordenar");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (pvaId) => {
    const idNum = toPosInt(pvaId);
    if (!idNum) return;

    if (Number(expandedPvaId) === Number(idNum)) {
      setExpandedPvaId(null);
      return;
    }

    setExpandedPvaId(idNum);

    if (insumosByPvaId[idNum]) return;

    try {
      const insRes = await api(`/insumo-pva-producto/pvaProd/${idNum}`, { method: "GET" });
      setInsumosByPvaId((prev) => ({ ...prev, [idNum]: Array.isArray(insRes) ? insRes : [] }));
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los insumos del PVA");
    }
  };

  const getDraftNuevoInsumo = (pvaId) => {
    const idNum = Number(pvaId);
    const current = draftNuevoInsumoByPvaId?.[idNum] || { id_materia_prima: "", cantidad_por_bulto: "" };
    return current;
  };

  const setDraftNuevoInsumo = (pvaId, next) => {
    const idNum = Number(pvaId);
    setDraftNuevoInsumoByPvaId((prev) => ({ ...prev, [idNum]: next }));
  };

  const refreshInsumos = async (pvaId) => {
    const idNum = toPosInt(pvaId);
    if (!idNum) return;
    const insRes = await api(`/insumo-pva-producto/pvaProd/${idNum}`, { method: "GET" });
    setInsumosByPvaId((prev) => ({ ...prev, [idNum]: Array.isArray(insRes) ? insRes : [] }));
  };

  const handleAddInsumo = async (pvaId) => {
    const idNum = toPosInt(pvaId);
    if (!idNum) return;

    const draft = getDraftNuevoInsumo(idNum);
    const idMp = toPosInt(draft.id_materia_prima);
    const qty = Number(draft.cantidad_por_bulto);

    if (!idMp) return toast.error("Selecciona una Materia Prima");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Cantidad por bulto debe ser mayor a 0");

    setLoading(true);
    try {
      await api(`/insumo-pva-producto`, {
        method: "POST",
        body: JSON.stringify({
          id_pva_por_producto: idNum,
          id_materia_prima: idMp,
          cantidad_por_bulto: qty,
        }),
      });

      toast.success("Insumo agregado");
      setDraftNuevoInsumo(idNum, { id_materia_prima: "", cantidad_por_bulto: "" });
      await refreshInsumos(idNum);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo agregar el insumo");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInsumoQty = async (insumoId, qty) => {
    const idNum = toPosInt(insumoId);
    const cantidad = Number(qty);
    if (!idNum) return;
    if (!Number.isFinite(cantidad) || cantidad <= 0) return toast.error("Cantidad por bulto debe ser mayor a 0");

    setLoading(true);
    try {
      await api(`/insumo-pva-producto/${idNum}`, {
        method: "PUT",
        body: JSON.stringify({ cantidad_por_bulto: cantidad }),
      });
      toast.success("Insumo actualizado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el insumo");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInsumo = async (pvaId, insumoId) => {
    const ok = window.confirm("¿Eliminar este insumo del PVA?");
    if (!ok) return;

    const idNum = toPosInt(insumoId);
    if (!idNum) return;

    setLoading(true);
    try {
      await api(`/insumo-pva-producto/${idNum}`, { method: "DELETE" });
      toast.success("Insumo eliminado");
      await refreshInsumos(pvaId);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el insumo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-1">Procesos de Valor Agregado (PVAs)</div>
        <div className="text-sm text-gray-600">
          Aquí defines qué PVAs se ejecutan para este producto y, si aplica, sus insumos por bulto.
        </div>

        {!hasTarget ? (
          <div className="mt-4 text-sm text-gray-600">
            Primero guarda la Receta/Producto para poder asociar PVAs.
          </div>
        ) : (
          <>
            <div className="mt-4 border rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-800 mb-2">Agregar PVA</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Proceso</label>
                  <Selector
                    options={opcionesProcesos}
                    selectedValue={nuevoProcesoId}
                    onSelect={(v) => setNuevoProcesoId(v)}
                    useFuzzy
                    groupBy="category"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                  onClick={handleCrearPVA}
                  disabled={loading}
                >
                  Agregar
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => setShowCrearProceso((v) => !v)}
                  disabled={loading}
                >
                  {showCrearProceso ? "Ocultar creación de proceso" : "Crear nuevo proceso"}
                </button>
                <div className="text-xs text-gray-500">
                  Si no existe el proceso, créalo aquí y se agregará automáticamente.
                </div>
              </div>

              {showCrearProceso ? (
                <div className="mt-3 border rounded-lg p-3 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-800 mb-2">Nuevo Proceso de Valor Agregado</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">Nombre</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2"
                        value={nuevoProcesoForm.descripcion}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, descripcion: e.target.value }))
                        }
                        placeholder="Ej: Maduración"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Unidad de tiempo</label>
                      <select
                        className="w-full border rounded-lg px-3 py-2"
                        value={nuevoProcesoForm.unidad_tiempo}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, unidad_tiempo: e.target.value }))
                        }
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Minutos">Minutos</option>
                        <option value="Horas">Horas</option>
                        <option value="Dias">Dias</option>
                        <option value="Semanas">Semanas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Tiempo estimado</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-3 py-2"
                        value={nuevoProcesoForm.tiempo_estimado}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, tiempo_estimado: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Costo estimado referencial</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border rounded-lg px-3 py-2"
                        value={nuevoProcesoForm.costo_estimado}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, costo_estimado: e.target.value }))
                        }
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                        id="pva_utiliza_insumos"
                        type="checkbox"
                        checked={nuevoProcesoForm.utiliza_insumos}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, utiliza_insumos: e.target.checked }))
                        }
                      />
                      <label htmlFor="pva_utiliza_insumos" className="text-sm">
                        Utiliza insumos
                      </label>
                      <input
                        id="pva_genera_bultos"
                        type="checkbox"
                        checked={nuevoProcesoForm.genera_bultos_nuevos}
                        onChange={(e) =>
                          setNuevoProcesoForm((prev) => ({ ...prev, genera_bultos_nuevos: e.target.checked }))
                        }
                      />
                      <label htmlFor="pva_genera_bultos" className="text-sm">
                        Genera nuevos bultos
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                      onClick={() => setShowCrearProceso(false)}
                      disabled={creandoProceso || loading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                      onClick={handleCrearProcesoYAgregar}
                      disabled={creandoProceso || loading}
                    >
                      Crear y agregar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="text-xs text-gray-500 mt-2">
                Nota: el orden se gestiona con ↑/↓. Si el proceso utiliza insumos, podrás agregarlos abajo.
              </div>
            </div>

            <div className="mt-4 border rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-800 mb-2">PVAs asociados</div>

              {loading ? <div className="text-sm text-gray-500">Cargando...</div> : null}

              {!loading && pvas.length === 0 ? (
                <div className="text-sm text-gray-600">Sin PVAs asociados por ahora.</div>
              ) : (
                <div className="space-y-3">
                  {pvas.map((pva, idx) => {
                    const proceso = procesosById.get(Number(pva?.id_proceso)) || null;
                    const utilizaInsumos = Boolean(proceso?.utiliza_insumos);
                    const generaBultos = Boolean(proceso?.genera_bultos_nuevos);
                    const isExpanded = Number(expandedPvaId) === Number(pva.id);

                    const insumos = insumosByPvaId?.[Number(pva.id)] || [];
                    const draftNuevo = getDraftNuevoInsumo(pva.id);

                    return (
                      <div key={pva.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-semibold text-gray-900">
                              #{Number(pva.orden || idx + 1)} — {proceso?.descripcion || `Proceso #${pva.id_proceso}`}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {utilizaInsumos ? "Usa insumos" : "Sin insumos"}
                              {generaBultos ? " · Genera bultos" : ""}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                              onClick={() => handleReordenarSwap(idx, idx - 1)}
                              disabled={loading || idx === 0}
                              title="Subir"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                              onClick={() => handleReordenarSwap(idx, idx + 1)}
                              disabled={loading || idx === pvas.length - 1}
                              title="Bajar"
                            >
                              ↓
                            </button>

                            {utilizaInsumos ? (
                              <button
                                type="button"
                                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                                onClick={() => toggleExpand(pva.id)}
                              >
                                {isExpanded ? "Ocultar insumos" : "Insumos"}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-red-600"
                              onClick={() => handleEliminarPVA(pva)}
                              disabled={loading}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {utilizaInsumos && isExpanded ? (
                          <div className="mt-4 border rounded-lg p-3">
                            <div className="text-sm font-semibold text-gray-800 mb-2">Insumos por bulto</div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                              <div>
                                <label className="block text-sm font-medium mb-1">Materia prima</label>
                                <Selector
                                  options={opcionesMateriaPrima}
                                  selectedValue={draftNuevo.id_materia_prima}
                                  onSelect={(v) =>
                                    setDraftNuevoInsumo(pva.id, {
                                      ...draftNuevo,
                                      id_materia_prima: v,
                                    })
                                  }
                                  useFuzzy
                                  groupBy="category"
                                  className="w-full border rounded-lg px-3 py-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Cantidad por bulto</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-full border rounded-lg px-3 py-2"
                                  value={draftNuevo.cantidad_por_bulto}
                                  onChange={(e) =>
                                    setDraftNuevoInsumo(pva.id, {
                                      ...draftNuevo,
                                      cantidad_por_bulto: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                                onClick={() => handleAddInsumo(pva.id)}
                                disabled={loading}
                              >
                                Agregar insumo
                              </button>
                            </div>

                            {Array.isArray(insumos) && insumos.length > 0 ? (
                              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mt-3">
                                <thead className="bg-gray-50 text-gray-700">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Insumo</th>
                                    <th className="px-3 py-2 text-left">Cantidad por bulto</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {insumos.map((ins) => (
                                    <tr key={ins.id} className="border-t">
                                      <td className="px-3 py-2">
                                        {ins?.materiaPrima?.nombre || `MP #${ins?.id_materia_prima}`}
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          className="border rounded px-2 py-1 w-40"
                                          defaultValue={
                                            ins?.cantidad_por_bulto != null ? String(ins.cantidad_por_bulto) : ""
                                          }
                                          onBlur={(e) => handleUpdateInsumoQty(ins.id, e.target.value)}
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          type="button"
                                          className="text-red-600 hover:underline"
                                          onClick={() => handleDeleteInsumo(pva.id, ins.id)}
                                        >
                                          Quitar
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="text-sm text-gray-600 mt-3">Sin insumos registrados.</div>
                            )}

                            <div className="text-xs text-gray-500 mt-2">
                              Tip: edita cantidades y sal del campo para guardar.
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
                onClick={onNext}
              >
                Continuar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
