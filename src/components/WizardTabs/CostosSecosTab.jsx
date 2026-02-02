import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../../lib/api";
import FormField from "../FormField";
import Selector from "../Selector";

function parseMaybeNumber(v) {
  if (v === "" || v == null) return null;
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeInsumosFromFormato(formato) {
  const insumos = Array.isArray(formato?.insumos) ? formato.insumos : [];
  return insumos.map((mp) => {
    const through = mp?.FormatoEmpaqueInsumo;
    return {
      id_materia_prima: Number(mp?.id),
      nombre: mp?.nombre,
      unidad_medida: mp?.unidad_medida,
      opcional: Boolean(through?.opcional),
      cantidad_sugerida_por_unidad:
        through?.cantidad_sugerida_por_unidad != null ? String(through.cantidad_sugerida_por_unidad) : "",
    };
  });
}

export default function CostosSecosTab({ recetaId, opcionesMateriaPrima, onNext }) {
  const [loading, setLoading] = useState(false);
  const [formatos, setFormatos] = useState([]);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoOpcional, setNuevoOpcional] = useState(true);

  const [nuevoInsumos, setNuevoInsumos] = useState([]);
  const [nuevoSelectedMpId, setNuevoSelectedMpId] = useState("");
  const [nuevoSelectedMpOpcional, setNuevoSelectedMpOpcional] = useState(false);
  const [nuevoSelectedMpCantidad, setNuevoSelectedMpCantidad] = useState("");

  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [selectedMpId, setSelectedMpId] = useState("");
  const [selectedMpOpcional, setSelectedMpOpcional] = useState(false);
  const [selectedMpCantidad, setSelectedMpCantidad] = useState("");

  const mpOptions = useMemo(() => Array.isArray(opcionesMateriaPrima) ? opcionesMateriaPrima : [], [opcionesMateriaPrima]);

  const loadFormatos = async () => {
    if (!recetaId) {
      setFormatos([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api(`/recetas/${recetaId}/formatos-empaque`);
      setFormatos(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los Costos Secos (formatos)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recetaId]);

  const startEdit = (formato) => {
    setEditId(Number(formato?.id));
    setEditDraft({
      id: Number(formato?.id),
      nombre: formato?.nombre ?? "",
      opcional: Boolean(formato?.opcional),
      insumos: normalizeInsumosFromFormato(formato),
    });
    setSelectedMpId("");
    setSelectedMpOpcional(false);
    setSelectedMpCantidad("");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditDraft(null);
    setSelectedMpId("");
    setSelectedMpOpcional(false);
    setSelectedMpCantidad("");
  };

  const handleAddInsumoToNuevo = () => {
    if (!nuevoSelectedMpId) return toast.error("Selecciona un insumo");
    const idMp = Number(nuevoSelectedMpId);
    if (!Number.isFinite(idMp) || idMp <= 0) return;

    const exists = (nuevoInsumos || []).some((x) => Number(x.id_materia_prima) === idMp);
    if (exists) return toast.error("Ese insumo ya está agregado");

    const opt = mpOptions.find((o) => String(o.value) === String(nuevoSelectedMpId));
    const next = [
      ...(nuevoInsumos || []),
      {
        id_materia_prima: idMp,
        nombre: opt?.label ?? "",
        unidad_medida: "",
        opcional: Boolean(nuevoSelectedMpOpcional),
        cantidad_sugerida_por_unidad: nuevoSelectedMpCantidad,
      },
    ];
    setNuevoInsumos(next);
    setNuevoSelectedMpId("");
    setNuevoSelectedMpOpcional(false);
    setNuevoSelectedMpCantidad("");
  };

  const handleRemoveInsumoFromNuevo = (idMateriaPrima) => {
    setNuevoInsumos((prev) => (prev || []).filter((x) => Number(x.id_materia_prima) !== Number(idMateriaPrima)));
  };

  const handleCreateFormato = async () => {
    if (!recetaId) return;
    if (!nuevoNombre.trim()) return toast.error("Debes ingresar un nombre para el formato");

    setLoading(true);
    try {
      await api(`/recetas/${recetaId}/formatos-empaque`, {
        method: "POST",
        body: {
          nombre: nuevoNombre.trim(),
          opcional: Boolean(nuevoOpcional),
          insumos: (nuevoInsumos || []).map((x) => ({
            id_materia_prima: Number(x.id_materia_prima),
            opcional: Boolean(x.opcional),
            cantidad_sugerida_por_unidad: parseMaybeNumber(x.cantidad_sugerida_por_unidad),
          })),
        },
      });

      setNuevoNombre("");
      setNuevoOpcional(true);
      setNuevoInsumos([]);
      setNuevoSelectedMpId("");
      setNuevoSelectedMpOpcional(false);
      setNuevoSelectedMpCantidad("");
      toast.success("Formato creado");
      await loadFormatos();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear el formato");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFormato = async (formatoId) => {
    if (!recetaId) return;

    const ok = window.confirm(
      "¿Eliminar este Formato de Empaque? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    setLoading(true);
    try {
      await api(`/recetas/${recetaId}/formatos-empaque/${formatoId}`, { method: "DELETE" });
      toast.success("Formato eliminado");
      await loadFormatos();
      if (Number(editId) === Number(formatoId)) cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el formato");
    } finally {
      setLoading(false);
    }
  };

  const handleAddInsumoToDraft = () => {
    if (!editDraft) return;
    if (!selectedMpId) return toast.error("Selecciona un insumo");
    const idMp = Number(selectedMpId);
    if (!Number.isFinite(idMp) || idMp <= 0) return;

    const exists = editDraft.insumos.some((x) => Number(x.id_materia_prima) === idMp);
    if (exists) return toast.error("Ese insumo ya está agregado");

    const opt = mpOptions.find((o) => String(o.value) === String(selectedMpId));
    editDraft.insumos.push({
      id_materia_prima: idMp,
      nombre: opt?.label ?? "",
      unidad_medida: "",
      opcional: Boolean(selectedMpOpcional),
      cantidad_sugerida_por_unidad: selectedMpCantidad,
    });
    setEditDraft({ ...editDraft, insumos: [...editDraft.insumos] });
    setSelectedMpId("");
    setSelectedMpOpcional(false);
    setSelectedMpCantidad("");
  };

  const handleRemoveInsumoFromDraft = (idMateriaPrima) => {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      insumos: editDraft.insumos.filter((x) => Number(x.id_materia_prima) !== Number(idMateriaPrima)),
    });
  };

  const handleSaveEdit = async () => {
    if (!recetaId) return;
    if (!editDraft || !editId) return;

    const nombre = String(editDraft?.nombre || "").trim();
    if (!nombre) return toast.error("Debes ingresar un nombre para el formato");

    setLoading(true);
    try {
      await api(`/recetas/${recetaId}/formatos-empaque/${editId}`, {
        method: "PUT",
        body: {
          nombre,
          opcional: Boolean(editDraft?.opcional),
          insumos: (editDraft?.insumos || []).map((x) => ({
            id_materia_prima: Number(x.id_materia_prima),
            opcional: Boolean(x.opcional),
            cantidad_sugerida_por_unidad: parseMaybeNumber(x.cantidad_sugerida_por_unidad),
          })),
        },
      });

      toast.success("Formato actualizado");
      await loadFormatos();
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el formato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-1">Costos Secos</div>
        <div className="text-sm text-gray-600 mb-4">
          Aquí defines <span className="font-semibold">Formatos de Empaque</span> (sets de insumos) dentro de la receta.
          En producción se selecciona un formato y se declara el consumo real de sus insumos.
        </div>

        {!recetaId ? (
          <div className="text-sm text-gray-600">Primero crea la receta para poder definir Costos Secos.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Columna izquierda: Crear/Editar formato */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">
                  {editId ? "Editar formato" : "Crear formato"}
                </div>

                <div className="space-y-3">
                  <FormField
                    label="Nombre del formato"
                    type="text"
                    placeholder="Ej: Empaque Estándar"
                    value={editId ? editDraft?.nombre || "" : nuevoNombre}
                    onChange={(e) =>
                      editId
                        ? setEditDraft({ ...editDraft, nombre: e.target.value })
                        : setNuevoNombre(e.target.value)
                    }
                    required
                  />

                  <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      id="formatoOpcional"
                      checked={editId ? Boolean(editDraft?.opcional) : nuevoOpcional}
                      onChange={(e) =>
                        editId
                          ? setEditDraft({ ...editDraft, opcional: e.target.checked })
                          : setNuevoOpcional(e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="formatoOpcional" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Formato opcional
                    </label>
                  </div>

                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium mb-2">Insumos del formato</label>
                    
                    <div className="space-y-2 mb-3">
                      <Selector
                        options={mpOptions.filter((opt) => {
                          const already = new Set(
                            (editId ? editDraft?.insumos || [] : nuevoInsumos || []).map((x) =>
                              String(x.id_materia_prima)
                            )
                          );
                          const selectedId = editId ? selectedMpId : nuevoSelectedMpId;
                          return String(opt.value) === String(selectedId || "") || !already.has(String(opt.value));
                        })}
                        selectedValue={editId ? selectedMpId : nuevoSelectedMpId}
                        onSelect={(value) => (editId ? setSelectedMpId(value) : setNuevoSelectedMpId(value))}
                        useFuzzy
                        groupBy="category"
                        className="w-full border rounded-lg px-3 py-2"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          className="border rounded-lg px-3 py-2"
                          placeholder="Cantidad/unidad"
                          value={editId ? selectedMpCantidad : nuevoSelectedMpCantidad}
                          onChange={(e) =>
                            editId
                              ? setSelectedMpCantidad(e.target.value)
                              : setNuevoSelectedMpCantidad(e.target.value)
                          }
                        />
                        <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                          <input
                            type="checkbox"
                            id="insumoOpcional"
                            checked={editId ? Boolean(selectedMpOpcional) : Boolean(nuevoSelectedMpOpcional)}
                            onChange={(e) =>
                              editId
                                ? setSelectedMpOpcional(e.target.checked)
                                : setNuevoSelectedMpOpcional(e.target.checked)
                            }
                            className="w-4 h-4"
                          />
                          <label htmlFor="insumoOpcional" className="text-sm text-gray-700 cursor-pointer">
                            Opcional
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        onClick={editId ? handleAddInsumoToDraft : handleAddInsumoToNuevo}
                        disabled={loading}
                      >
                        Agregar insumo
                      </button>
                    </div>

                    {((editId ? editDraft?.insumos : nuevoInsumos) || []).length === 0 ? (
                      <div className="text-sm text-gray-600 italic">Sin insumos agregados</div>
                    ) : (
                      <div className="space-y-1">
                        {((editId ? editDraft?.insumos : nuevoInsumos) || []).map((mp) => (
                          <div
                            key={mp.id_materia_prima}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium">{mp.nombre}</div>
                              <div className="text-xs text-gray-600">
                                {mp.cantidad_sugerida_por_unidad
                                  ? `${mp.cantidad_sugerida_por_unidad}/unidad`
                                  : "Sin cantidad"}
                                {mp.opcional ? " • Opcional" : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                              onClick={() =>
                                editId
                                  ? handleRemoveInsumoFromDraft(mp.id_materia_prima)
                                  : handleRemoveInsumoFromNuevo(mp.id_materia_prima)
                              }
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3">
                    {editId ? (
                      <>
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium"
                          onClick={handleSaveEdit}
                          disabled={loading}
                        >
                          Guardar cambios
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium"
                        onClick={handleCreateFormato}
                        disabled={loading}
                      >
                        Crear formato
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Columna derecha: Formatos definidos */}
              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">Formatos definidos</div>
                {loading && <div className="text-sm text-gray-500">Cargando...</div>}
                {!loading && formatos.length === 0 ? (
                  <div className="text-sm text-gray-600 italic">Sin formatos creados aún</div>
                ) : (
                  <div className="space-y-2">
                    {formatos.map((f) => (
                      <div
                        key={f.id}
                        className={`border rounded-lg p-3 transition-all ${
                          Number(editId) === Number(f.id)
                            ? "border-primary bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{f.nombre}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {(f.insumos || []).length} insumo{(f.insumos || []).length !== 1 ? "s" : ""}
                              {f.opcional && " • Opcional"}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              type="button"
                              className={`px-3 py-1 text-sm rounded border font-medium transition-colors ${
                                Number(editId) === Number(f.id)
                                  ? "bg-primary text-white border-primary"
                                  : "border-gray-300 hover:bg-gray-100"
                              }`}
                              onClick={() => (Number(editId) === Number(f.id) ? cancelEdit() : startEdit(f))}
                            >
                              {Number(editId) === Number(f.id) ? "✓" : "Editar"}
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium"
                              onClick={() => handleDeleteFormato(f.id)}
                              title="Eliminar formato"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Mostrar lista de insumos solo si NO está en modo edición */}
                        {Number(editId) !== Number(f.id) && (f.insumos || []).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="text-xs text-gray-600 space-y-1">
                              {(f.insumos || []).slice(0, 3).map((ins) => (
                                <div key={ins.id} className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                  <span className="truncate">{ins.nombre}</span>
                                  {ins.FormatoEmpaqueInsumo?.cantidad_sugerida_por_unidad && (
                                    <span className="text-gray-500">
                                      ({ins.FormatoEmpaqueInsumo.cantidad_sugerida_por_unidad})
                                    </span>
                                  )}
                                </div>
                              ))}
                              {(f.insumos || []).length > 3 && (
                                <div className="text-gray-500 italic">
                                  +{(f.insumos || []).length - 3} más...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="bg-primary hover:bg-hover text-white px-6 py-2 rounded font-medium"
            onClick={onNext}
            disabled={!recetaId}
          >
            Continuar a Pauta
          </button>
        </div>
      </div>
    </div>
  );
}