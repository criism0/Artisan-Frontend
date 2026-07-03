import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { crearFormulario, actualizarFormulario } from "../../services/calidad";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const TIPOS_CAMPO = [
  { value: "texto", label: "Texto corto" },
  { value: "texto_largo", label: "Texto largo" },
  { value: "numero", label: "Número" },
  { value: "seleccion_unica", label: "Selección única (dropdown)" },
  { value: "seleccion_multiple", label: "Selección múltiple" },
  { value: "booleano", label: "Sí / No" },
  { value: "fecha", label: "Fecha" },
  { value: "imagen", label: "Imagen" },
];

const TIPOS_FIRMA = [
  { value: "digital", label: "Digital" },
  { value: "manual", label: "Manual" },
  { value: "no_requiere", label: "No requiere" },
];

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const campoVacio = () => ({
  id: `campo-${uid()}`,
  etiqueta: "",
  tipo: "texto",
  requerido: false,
  placeholder: "",
  opciones: null,
  validaciones: null,
});

const seccionVacia = () => ({
  id: `sec-${uid()}`,
  titulo: "",
  descripcion: "",
  campos: [],
});

export default function FormularioBuilder({ initialData = null }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const canCreateForm = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE);

  const [formulario, setFormulario] = useState(
    initialData || {
      codigo: "",
      version: 1,
      nombre: "",
      descripcion: "",
      frecuencia_esperada: "",
      tipo_firma: "digital",
      aprobado: false,
      activo: true,
      secciones: [],
    }
  );

  const updateMeta = (patch) =>
    setFormulario((prev) => ({ ...prev, ...patch }));

  /* ---------- Secciones ---------- */

  const addSeccion = () =>
    setFormulario((prev) => ({
      ...prev,
      secciones: [...prev.secciones, seccionVacia()],
    }));

  const updateSeccion = (secId, patch) =>
    setFormulario((prev) => ({
      ...prev,
      secciones: prev.secciones.map((s) =>
        s.id === secId ? { ...s, ...patch } : s
      ),
    }));

  const removeSeccion = (secId) =>
    setFormulario((prev) => ({
      ...prev,
      secciones: prev.secciones.filter((s) => s.id !== secId),
    }));

  const moveSeccion = (secId, dir) =>
    setFormulario((prev) => {
      const idx = prev.secciones.findIndex((s) => s.id === secId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.secciones.length) return prev;
      const next = [...prev.secciones];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, secciones: next };
    });

  /* ---------- Campos dentro de una sección ---------- */

  const addCampo = (secId) =>
    updateSeccion(
      secId,
      {
        campos: [
          ...(formulario.secciones.find((s) => s.id === secId)?.campos || []),
          campoVacio(),
        ],
      }
    );

  const updateCampo = (secId, campoId, patch) =>
    setFormulario((prev) => ({
      ...prev,
      secciones: prev.secciones.map((s) =>
        s.id !== secId
          ? s
          : {
              ...s,
              campos: s.campos.map((c) =>
                c.id === campoId ? { ...c, ...patch } : c
              ),
            }
      ),
    }));

  const removeCampo = (secId, campoId) =>
    setFormulario((prev) => ({
      ...prev,
      secciones: prev.secciones.map((s) =>
        s.id !== secId
          ? s
          : { ...s, campos: s.campos.filter((c) => c.id !== campoId) }
      ),
    }));

  const moveCampo = (secId, campoId, dir) =>
    setFormulario((prev) => ({
      ...prev,
      secciones: prev.secciones.map((s) => {
        if (s.id !== secId) return s;
        const idx = s.campos.findIndex((c) => c.id === campoId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= s.campos.length) return s;
        const next = [...s.campos];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...s, campos: next };
      }),
    }));

  const onChangeTipo = (secId, campoId, nuevoTipo) => {
    const patch = { tipo: nuevoTipo };
    patch.opciones =
      nuevoTipo === "seleccion_unica" || nuevoTipo === "seleccion_multiple"
        ? [{ valor: "", etiqueta: "" }]
        : null;
    if (nuevoTipo === "numero") {
      patch.validaciones = { min: null, max: null };
    } else if (nuevoTipo === "texto" || nuevoTipo === "texto_largo") {
      patch.validaciones = { min_length: null, max_length: null };
    } else {
      patch.validaciones = null;
    }
    updateCampo(secId, campoId, patch);
  };

  /* ---------- Validación + payload ---------- */

  const validarYObtenerPayload = () => {
    if (!formulario.codigo.trim()) {
      toast.error("Falta el código del formulario.");
      return null;
    }
    if (!formulario.nombre.trim()) {
      toast.error("Falta el nombre del formulario.");
      return null;
    }
    if (formulario.secciones.length === 0) {
      toast.error("Agrega al menos una sección.");
      return null;
    }
    for (const sec of formulario.secciones) {
      if (!sec.titulo.trim()) {
        toast.error("Todas las secciones deben tener un título.");
        return null;
      }
      if (sec.campos.length === 0) {
        toast.error(`La sección "${sec.titulo}" no tiene campos.`);
        return null;
      }
      for (const c of sec.campos) {
        if (!c.etiqueta.trim()) {
          toast.error("Todos los campos deben tener una etiqueta.");
          return null;
        }
        const esSeleccion =
          c.tipo === "seleccion_unica" || c.tipo === "seleccion_multiple";
        if (
          esSeleccion &&
          (!c.opciones || c.opciones.filter((o) => o?.valor?.trim() || o?.etiqueta?.trim()).length === 0)
        ) {
          toast.error(`El campo "${c.etiqueta}" necesita al menos una opción.`);
          return null;
        }
      }
    }

    return {
      ...formulario,
      version: Number(formulario.version) || 1,
      aprobado: false, // siempre requiere aprobación admin tras crear/editar
      secciones: formulario.secciones.map((s) => ({
        ...s,
        campos: s.campos.map((c) => ({
          ...c,
          opciones:
            c.tipo === "seleccion_unica" || c.tipo === "seleccion_multiple"
              ? (c.opciones || [])
                  .filter((o) => o?.valor?.trim() || o?.etiqueta?.trim())
                  .map((o) => ({
                    valor: o.valor?.trim() || "",
                    etiqueta: o.etiqueta?.trim() || "",
                  }))
              : undefined,
        })),
      })),
    };
  };

  const handleGuardar = async () => {
    if (!canCreateForm) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE]);
      setSaving(false);
      return;
    }
    const payload = validarYObtenerPayload();
    if (!payload) return;

    setSaving(true);
    try {
      if (initialData?.id) {
        await actualizarFormulario(initialData.id, payload);
        toast.success("Formulario actualizado.");
      } else {
        await crearFormulario(payload);
        toast.success("Formulario creado.");
      }
      navigate("/calidad/formularios");
    } catch (err) {
      toast.error(err?.message || "Error al guardar el formulario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <BackButton to="/calidad/formularios" />
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Spinner size="sm" />}
            {saving
              ? "Guardando..."
              : initialData?.id
              ? "Guardar cambios"
              : "Guardar formulario"}
          </button>
        </div>

        <h1 className="text-2xl font-bold text-text mb-6">
          {initialData?.id ? "Editar Formulario" : "Nuevo Formulario"}
        </h1>

        {/* Datos generales */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-text">Datos Generales</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Código" required>
              <input
                type="text"
                value={formulario.codigo}
                onChange={(e) => updateMeta({ codigo: e.target.value })}
                placeholder="Ej: FORM-INSP-CAL-001"
                readOnly={!!initialData}
                className={`w-full border border-gray-300 rounded px-3 py-2 ${
                  initialData ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                }`}
              />
            </Field>

            {/* No debería ser editable la versión, y tampoco es necesario que sea visible 
            <Field label="Versión">
              <input
                type="number"
                min="1"
                value={formulario.version}
                onChange={(e) =>
                  updateMeta({ version: Number(e.target.value) || 1 })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </Field> */}

            <Field label="Nombre" required>
              <input
                type="text"
                value={formulario.nombre}
                onChange={(e) => updateMeta({ nombre: e.target.value })}
                placeholder="Ej: Inspección de Calidad"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </Field>

            <Field label="Frecuencia esperada">
              <input
                type="text"
                value={formulario.frecuencia_esperada}
                onChange={(e) =>
                  updateMeta({ frecuencia_esperada: e.target.value })
                }
                placeholder="Ej: Diaria, Por cada lote producido"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </Field>

            <Field label="Tipo de firma">
              <select
                value={formulario.tipo_firma}
                onChange={(e) => updateMeta({ tipo_firma: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
              >
                {TIPOS_FIRMA.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Descripción">
                <textarea
                  value={formulario.descripcion}
                  onChange={(e) => updateMeta({ descripcion: e.target.value })}
                  rows={2}
                  placeholder="Describe el propósito del formulario"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Secciones */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-text">
              Secciones del formulario
            </h2>
            <button
              onClick={addSeccion}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
            >
              Agregar sección
            </button>
          </div>

          {formulario.secciones.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-500 text-sm">
                Aún no hay secciones. Agrega la primera con el botón de arriba.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {formulario.secciones.map((sec, idx) => (
                <SeccionCard
                  key={sec.id}
                  seccion={sec}
                  index={idx}
                  total={formulario.secciones.length}
                  onChange={(patch) => updateSeccion(sec.id, patch)}
                  onRemove={() => removeSeccion(sec.id)}
                  onMove={(dir) => moveSeccion(sec.id, dir)}
                  onAddCampo={() => addCampo(sec.id)}
                  onUpdateCampo={(campoId, patch) =>
                    updateCampo(sec.id, campoId, patch)
                  }
                  onChangeTipoCampo={(campoId, tipo) =>
                    onChangeTipo(sec.id, campoId, tipo)
                  }
                  onRemoveCampo={(campoId) => removeCampo(sec.id, campoId)}
                  onMoveCampo={(campoId, dir) =>
                    moveCampo(sec.id, campoId, dir)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ---------- Card de Sección ---------- */

function SeccionCard({
  seccion,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onAddCampo,
  onUpdateCampo,
  onChangeTipoCampo,
  onRemoveCampo,
  onMoveCampo,
}) {
  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          Sección {index + 1}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="px-2 py-1 text-xs rounded border border-red-300 bg-white text-red-700 hover:bg-red-50"
          >
            × Sección
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Título" required>
          <input
            type="text"
            value={seccion.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            placeholder="Ej: Datos Generales"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
        <Field label="Descripción">
          <input
            type="text"
            value={seccion.descripcion}
            onChange={(e) => onChange({ descripcion: e.target.value })}
            placeholder="Breve descripción de la sección"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Campos</h3>
          <button
            type="button"
            onClick={onAddCampo}
            className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark"
          >
            + Campo
          </button>
        </div>

        {seccion.campos.length === 0 ? (
          <p className="text-xs text-gray-500">
            Aún no hay campos en esta sección.
          </p>
        ) : (
          <div className="space-y-3">
            {seccion.campos.map((campo, cIdx) => (
              <CampoCard
                key={campo.id}
                campo={campo}
                index={cIdx}
                total={seccion.campos.length}
                onChange={(patch) => onUpdateCampo(campo.id, patch)}
                onChangeTipo={(t) => onChangeTipoCampo(campo.id, t)}
                onRemove={() => onRemoveCampo(campo.id)}
                onMove={(dir) => onMoveCampo(campo.id, dir)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Card de Campo ---------- */

function CampoCard({ campo, index, total, onChange, onChangeTipo, onRemove, onMove }) {
  const esSeleccion =
    campo.tipo === "seleccion_unica" || campo.tipo === "seleccion_multiple";
  const esTexto = campo.tipo === "texto" || campo.tipo === "texto_largo";

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          Campo {index + 1}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Etiqueta" required>
          <input
            type="text"
            value={campo.etiqueta}
            onChange={(e) => onChange({ etiqueta: e.target.value })}
            placeholder="Ej: Temperatura medida"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>

        <Field label="Tipo">
          <select
            value={campo.tipo}
            onChange={(e) => onChangeTipo(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
          >
            {TIPOS_CAMPO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {(campo.tipo === "texto" || campo.tipo === "texto_largo") && (
        <Field label="Placeholder">
          <input
            type="text"
            value={campo.placeholder || ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={campo.requerido}
          onChange={(e) => onChange({ requerido: e.target.checked })}
        />
        Campo requerido
      </label>

      {campo.tipo === "numero" && (
        <NumeroValidacion
          validaciones={campo.validaciones}
          onChange={(v) => onChange({ validaciones: v })}
        />
      )}

      {esTexto && (
        <TextoValidacion
          validaciones={campo.validaciones}
          onChange={(v) => onChange({ validaciones: v })}
        />
      )}

      {esSeleccion && (
        <OpcionesEditor
          opciones={campo.opciones || []}
          onChange={(opts) => onChange({ opciones: opts })}
        />
      )}
    </div>
  );
}

function NumeroValidacion({ validaciones, onChange }) {
  const v = validaciones || { min: null, max: null };
  const toNum = (s) => (s === "" ? null : Number(s));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">Validación numérica</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mínimo">
          <input
            type="number"
            value={v.min ?? ""}
            onChange={(e) => onChange({ ...v, min: toNum(e.target.value) })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
        <Field label="Máximo">
          <input
            type="number"
            value={v.max ?? ""}
            onChange={(e) => onChange({ ...v, max: toNum(e.target.value) })}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
      </div>
    </div>
  );
}

function TextoValidacion({ validaciones, onChange }) {
  const v = validaciones || { min_length: null, max_length: null };
  const toNum = (s) => (s === "" ? null : Number(s));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
      <p className="text-xs font-medium text-gray-700">Validación de texto</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Largo mínimo">
          <input
            type="number"
            min="0"
            value={v.min_length ?? ""}
            onChange={(e) =>
              onChange({ ...v, min_length: toNum(e.target.value) })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
        <Field label="Largo máximo">
          <input
            type="number"
            min="0"
            value={v.max_length ?? ""}
            onChange={(e) =>
              onChange({ ...v, max_length: toNum(e.target.value) })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </Field>
      </div>
    </div>
  );
}

function OpcionesEditor({ opciones, onChange }) {
  const setValorAt = (i, valor) => {
    const next = [...opciones];
    next[i] = { ...next[i], valor };
    onChange(next);
  };
  const setEtiquetaAt = (i, etiqueta) => {
    const next = [...opciones];
    next[i] = { ...next[i], etiqueta };
    onChange(next);
  };
  const add = () => onChange([...opciones, { valor: "", etiqueta: "" }]);
  const remove = (i) => onChange(opciones.filter((_, j) => j !== i));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">Opciones</p>
        <button
          type="button"
          onClick={add}
          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white"
        >
          + Opción
        </button>
      </div>
      {opciones.length === 0 ? (
        <p className="text-xs text-gray-500">Agrega al menos una opción.</p>
      ) : (
        <div className="space-y-2">
          {opciones.map((op, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={op.valor || ""}
                onChange={(e) => setValorAt(i, e.target.value)}
                placeholder={`Valor ${i + 1}`}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={op.etiqueta || ""}
                onChange={(e) => setEtiquetaAt(i, e.target.value)}
                placeholder={`Etiqueta ${i + 1}`}
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
