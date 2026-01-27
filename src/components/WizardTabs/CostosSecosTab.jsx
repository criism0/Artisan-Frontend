import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../../lib/api";
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
          // Nota: se permite crear formato sin insumos.
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
    if (!recetaId || !editDraft) return;
    if (!editDraft.nombre?.trim()) return toast.error("El nombre del formato es requerido");

    setLoading(true);
    try {
      await api(`/recetas/${recetaId}/formatos-empaque/${editDraft.id}`, {
        method: "PUT",
        body: {
          nombre: editDraft.nombre.trim(),
          opcional: Boolean(editDraft.opcional),
          insumos: editDraft.insumos.map((x) => ({
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
      toast.error("No se pudo actualizar el formato");
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
            <div className="border rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-800 mb-3">Crear formato</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  className="border rounded-lg px-3 py-2"
                  placeholder="Nombre"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                  <label className="text-sm text-gray-700">Opcional</label>
                  <input type="checkbox" checked={nuevoOpcional} onChange={(e) => setNuevoOpcional(e.target.checked)} />
                </div>
              </div>

              <div className="mt-3 border rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-800 mb-2">Insumos del formato</div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <Selector
                      options={mpOptions.filter((opt) => {
                        const already = new Set((nuevoInsumos || []).map((x) => String(x.id_materia_prima)));
                        return String(opt.value) === String(nuevoSelectedMpId || "") || !already.has(String(opt.value));
                      })}
                      selectedValue={nuevoSelectedMpId}
                      onSelect={(value) => setNuevoSelectedMpId(value)}
                      useFuzzy
                      groupBy="category"
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder="Cantidad sugerida por unidad (opcional)"
                    value={nuevoSelectedMpCantidad}
                    onChange={(e) => setNuevoSelectedMpCantidad(e.target.value)}
                  />

                  <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    <label className="text-sm text-gray-700">Opcional</label>
                    <input
                      type="checkbox"
                      checked={Boolean(nuevoSelectedMpOpcional)}
                      onChange={(e) => setNuevoSelectedMpOpcional(e.target.checked)}
                    />
                  </div>

                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                      onClick={handleAddInsumoToNuevo}
                      disabled={loading}
                    >
                      Agregar insumo
                    </button>
                  </div>
                </div>

                {nuevoInsumos.length === 0 ? (
                  <div className="text-sm text-gray-600 mt-3">Sin insumos por ahora (puedes crear el formato igual).</div>
                ) : (
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mt-3">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Insumo</th>
                        <th className="px-3 py-2 text-left">Opcional</th>
                        <th className="px-3 py-2 text-left">Sugerido/unidad</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nuevoInsumos.map((mp) => (
                        <tr key={mp.id_materia_prima} className="border-t">
                          <td className="px-3 py-2">{mp.nombre}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(mp.opcional)}
                              onChange={(e) => {
                                mp.opcional = e.target.checked;
                                setNuevoInsumos([...(nuevoInsumos || [])]);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="border rounded px-2 py-1 w-40"
                              value={mp.cantidad_sugerida_por_unidad}
                              onChange={(e) => {
                                mp.cantidad_sugerida_por_unidad = e.target.value;
                                setNuevoInsumos([...(nuevoInsumos || [])]);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => handleRemoveInsumoFromNuevo(mp.id_materia_prima)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                  onClick={handleCreateFormato}
                  disabled={loading}
                >
                  Crear formato
                </button>
              </div>
            </div>

            <div className="mt-4 border rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-800 mb-3">Formatos definidos</div>
              {loading && <div className="text-sm text-gray-500">Cargando...</div>}
              {!loading && formatos.length === 0 ? (
                <div className="text-sm text-gray-600">Sin formatos por ahora.</div>
              ) : (
                <div className="space-y-3">
                  {formatos.map((f) => (
                    <div key={f.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {f.nombre}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {f.opcional ? "Opcional" : "Requerido"}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                            onClick={() => (Number(editId) === Number(f.id) ? cancelEdit() : startEdit(f))}
                          >
                            {Number(editId) === Number(f.id) ? "Cerrar" : "Editar"}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-red-600"
                            onClick={() => handleDeleteFormato(f.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {Number(editId) === Number(f.id) && editDraft ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                              className="border rounded-lg px-3 py-2"
                              value={editDraft.nombre}
                              onChange={(e) => setEditDraft({ ...editDraft, nombre: e.target.value })}
                              placeholder="Nombre"
                            />
                            <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                              <label className="text-sm text-gray-700">Opcional</label>
                              <input
                                type="checkbox"
                                checked={Boolean(editDraft.opcional)}
                                onChange={(e) => setEditDraft({ ...editDraft, opcional: e.target.checked })}
                              />
                            </div>
                          </div>

                          <div className="border rounded-lg p-3">
                            <div className="text-sm font-semibold text-gray-800 mb-2">Insumos del formato</div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div className="md:col-span-2">
                                <Selector
                                  options={mpOptions.filter((opt) => {
                                    const already = new Set(
                                      (editDraft.insumos || []).map((x) => String(x.id_materia_prima))
                                    );
                                    return (
                                      String(opt.value) === String(selectedMpId || "") || !already.has(String(opt.value))
                                    );
                                  })}
                                  selectedValue={selectedMpId}
                                  onSelect={(value) => setSelectedMpId(value)}
                                  useFuzzy
                                  groupBy="category"
                                  className="w-full border rounded-lg px-3 py-2"
                                />
                              </div>
                              <input
                                className="border rounded-lg px-3 py-2"
                                placeholder="Cantidad sugerida por unidad (opcional)"
                                value={selectedMpCantidad}
                                onChange={(e) => setSelectedMpCantidad(e.target.value)}
                              />
                              <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                                <label className="text-sm text-gray-700">Opcional</label>
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedMpOpcional)}
                                  onChange={(e) => setSelectedMpOpcional(e.target.checked)}
                                />
                              </div>
                              <button
                                type="button"
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                                onClick={handleAddInsumoToDraft}
                              >
                                Agregar
                              </button>
                            </div>

                            {editDraft.insumos.length === 0 ? (
                              <div className="text-sm text-gray-600 mt-3">Sin insumos en este formato.</div>
                            ) : (
                              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mt-3">
                                <thead className="bg-gray-50 text-gray-700">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Insumo</th>
                                    <th className="px-3 py-2 text-left">Opcional</th>
                                    <th className="px-3 py-2 text-left">Sugerido/unidad</th>
                                    <th className="px-3 py-2"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {editDraft.insumos.map((mp) => (
                                    <tr key={mp.id_materia_prima} className="border-t">
                                      <td className="px-3 py-2">{mp.nombre}</td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(mp.opcional)}
                                          onChange={(e) => {
                                            mp.opcional = e.target.checked;
                                            setEditDraft({ ...editDraft, insumos: [...editDraft.insumos] });
                                          }}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          className="border rounded px-2 py-1 w-40"
                                          value={mp.cantidad_sugerida_por_unidad}
                                          onChange={(e) => {
                                            mp.cantidad_sugerida_por_unidad = e.target.value;
                                            setEditDraft({ ...editDraft, insumos: [...editDraft.insumos] });
                                          }}
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          type="button"
                                          className="text-red-600 hover:underline"
                                          onClick={() => handleRemoveInsumoFromDraft(mp.id_materia_prima)}
                                        >
                                          Quitar
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                              onClick={cancelEdit}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                              onClick={handleSaveEdit}
                              disabled={loading}
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
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
