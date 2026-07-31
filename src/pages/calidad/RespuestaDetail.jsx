import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BackButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import {
  obtenerRespuesta,
  actualizarRespuesta,
  eliminarRespuesta,
  obtenerFormulario,
} from "../../services/calidad";
import { enriquecerRespuesta } from "../../services/calidadAnalytics";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const ESTADO_CONFIG = {
  conforme: {
    label: "Conforme",
    badgeClass: "bg-green-100 text-green-800",
    optionClass: "border-green-500 bg-green-50 text-green-800",
    description: "Todo dentro de norma.",
  },
  desvio: {
    label: "Desvío",
    badgeClass: "bg-yellow-100 text-yellow-800",
    optionClass: "border-yellow-500 bg-yellow-50 text-yellow-800",
    description: "Hay una desviación menor que se debe documentar.",
  },
  "no-conforme": {
    label: "No conforme",
    badgeClass: "bg-red-100 text-red-800",
    optionClass: "border-red-500 bg-red-50 text-red-800",
    description: "Resultado fuera de los criterios aceptables.",
  },
};

function valorInicial(tipo) {
  if (tipo === "booleano") return null;
  if (tipo === "seleccion_multiple") return [];
  if (tipo === "imagen") return null;
  return "";
}

function evaluaCondicion(condicion, values) {
  if (!condicion) return true;
  const { campo_id, operador, valor } = condicion;
  const actual = values[campo_id];
  switch (operador) {
    case "igual":
      return actual === valor;
    case "distinto":
      return actual !== valor;
    case "mayor":
      return Number(actual) > Number(valor);
    case "menor":
      return Number(actual) < Number(valor);
    case "contiene":
      return Array.isArray(actual) ? actual.includes(valor) : false;
    default:
      return true;
  }
}

function buildValuesFromRespuesta(secciones, respuestas) {
  const values = {};
  for (const sec of secciones || []) {
    for (const campo of sec.campos || []) {
      const raw = respuestas?.[campo.id];
      if (raw === undefined || raw === null) {
        values[campo.id] = valorInicial(campo.tipo);
      } else {
        values[campo.id] = raw;
      }
    }
  }
  return values;
}

export default function RespuestaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [respuesta, setRespuesta] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [values, setValues] = useState({});
  const [estado, setEstado] = useState("conforme");
  const [detalle, setDetalle] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canReadResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ);
  const canUpdateResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE);
  const canDeleteResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE);

  const cargar = async () => {
    if (!canReadForms || !canReadResponses) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ], [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await obtenerRespuesta(id);
      const form = await obtenerFormulario(raw.id_formulario_calidad);
      // El backend no persiste estado/detalle: se derivan del JSONB.
      const resp = enriquecerRespuesta(form, raw);
      setRespuesta(resp);
      setEstado(resp.estado || "conforme");
      setDetalle(resp.detalle || "");
      setFormulario(form);
      setValues(buildValuesFromRespuesta(form.secciones, resp.respuestas));
    } catch (err) {
      toast.error(err?.message || "Error al cargar la respuesta.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div>
        <BackButton />
        <PageLoader message="Cargando respuesta"/>
      </div>
    );
  }

  if (!respuesta || !formulario) {
    return (
      <div>
        <BackButton />
        <p className="mt-4 text-gray-600">Respuesta no encontrada.</p>
      </div>
    );
  }

  const secciones = formulario.secciones || [];

  const setValue = (campoId, value) =>
    setValues((prev) => ({ ...prev, [campoId]: value }));

  const esVacio = (campo, val) => {
    if (campo.tipo === "booleano") return val === null || val === undefined;
    if (campo.tipo === "seleccion_multiple")
      return !Array.isArray(val) || val.length === 0;
    if (campo.tipo === "imagen") return !val;
    return val === null || val === undefined || (typeof val === "string" && !val.trim());
  };

  const validar = () => {
    for (const sec of secciones) {
      for (const campo of sec.campos || []) {
        if (!evaluaCondicion(campo.condicion, values)) continue;
        if (campo.requerido && esVacio(campo, values[campo.id])) {
          toast.error(`El campo "${campo.etiqueta}" es requerido.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!canUpdateResponses) {
      toast.permissionError([ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE]);
      setSaving(false);
      return;
    }
    if (!validar()) return;

    if (estado !== "conforme" && !detalle.trim()) {
      toast.error('El detalle es obligatorio si el estado es "desvío" o "no conforme".');
      return;
    }

    const respuestas = {};
    for (const sec of secciones) {
      for (const campo of sec.campos || []) {
        if (!evaluaCondicion(campo.condicion, values)) continue;
        const val = values[campo.id];
        if (esVacio(campo, val)) continue;
        respuestas[campo.id] = campo.tipo === "numero" ? Number(val) : val;
      }
    }

    setSaving(true);
    try {
      const actualizada = enriquecerRespuesta(
        formulario,
        await actualizarRespuesta(respuesta.id, {
          respuestas,
          estado,
          detalle: estado === "conforme" ? "" : detalle.trim(),
        })
      );
      setRespuesta(actualizada);
      setEstado(actualizada.estado || estado);
      setDetalle(actualizada.detalle || "");
      setEditMode(false);
      toast.success("Respuesta actualizada.");
    } catch (err) {
      toast.error(err?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    if (!canDeleteResponses) {
      toast.permissionError([ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE]);
      return;
    }
    try {
      await eliminarRespuesta(respuesta.id);
      toast.success("Respuesta eliminada.");
      navigate(`/calidad/formularios/${formulario.id}/respuestas`);
    } catch (err) {
      toast.error(err?.message || "No se pudo eliminar.");
    }
  };

  const cancelarEdicion = () => {
    setValues(buildValuesFromRespuesta(secciones, respuesta.respuestas));
    setEstado(respuesta.estado || "conforme");
    setDetalle(respuesta.detalle || "");
    setEditMode(false);
  };

  const estadoCfg = ESTADO_CONFIG[respuesta.estado] || null;

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <BackButton
            to={`/calidad/formularios/${formulario.id}/respuestas`}
            label="Volver al historial"
          />
          <div className="flex gap-2 items-center">
            {editMode ? (
              <>
                <button
                  onClick={cancelarEdicion}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Spinner size="sm" />}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
                >
                  Editar
                </button>
                <TrashButton
                  onConfirmDelete={handleEliminar}
                  tooltipText="Eliminar respuesta"
                  entityName="respuesta"
                />
              </>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-text">
              Respuesta #{respuesta.id}
            </h1>
            {estadoCfg && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${estadoCfg.badgeClass}`}
              >
                {estadoCfg.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formulario.codigo} · v{formulario.version} · {formulario.nombre}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Completado: {formatoFecha(respuesta.completado_en)} · Usuario #
            {respuesta.id_usuario ?? "—"}
          </p>
        </div>

        {/* Estado del registro: lectura o edición */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Estado del registro</h2>
            <p className="text-sm text-gray-500">
              {editMode
                ? "Actualiza el estado y, si corresponde, su detalle."
                : "Estado declarado al completar el formulario."}
            </p>
          </div>

          {editMode ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setEstado(key);
                      if (key === "conforme") setDetalle("");
                    }}
                    className={`text-left border-2 rounded-lg p-3 transition-colors ${
                      estado === key
                        ? cfg.optionClass
                        : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    <p className="text-sm font-semibold">{cfg.label}</p>
                    <p className="text-xs mt-1 opacity-80">{cfg.description}</p>
                  </button>
                ))}
              </div>
              {estado !== "conforme" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detalle <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={detalle}
                    onChange={(e) => setDetalle(e.target.value)}
                    placeholder="Describe brevemente el desvío o la no conformidad."
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              )}
            </>
          ) : (
            <div>
              {respuesta.detalle ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {respuesta.detalle}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {respuesta.estado === "conforme"
                    ? "Sin observaciones."
                    : "Sin detalle registrado."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {secciones.map((seccion) => (
            <SeccionBlock
              key={seccion.id}
              seccion={seccion}
              values={values}
              readOnly={!editMode}
              onChangeValue={setValue}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Sección ---------- */

function SeccionBlock({ seccion, values, readOnly, onChangeValue }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-text">{seccion.titulo}</h2>
      {seccion.descripcion && (
        <p className="text-sm text-gray-500 mb-4">{seccion.descripcion}</p>
      )}
      <div className="space-y-4">
        {(seccion.campos || []).map((campo) => {
          if (!evaluaCondicion(campo.condicion, values)) return null;
          return (
            <CampoInput
              key={campo.id}
              campo={campo}
              value={values[campo.id]}
              readOnly={readOnly}
              onChange={(val) => onChangeValue(campo.id, val)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Renderizador por tipo ---------- */

function CampoInput({ campo, value, readOnly, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {campo.etiqueta}
        {campo.requerido && <span className="text-red-500 ml-1">*</span>}
      </label>

      {readOnly ? (
        <ReadOnlyValue campo={campo} value={value} />
      ) : (
        <EditableInput campo={campo} value={value} onChange={onChange} />
      )}
    </div>
  );
}

function ReadOnlyValue({ campo, value }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    return <p className="text-sm text-gray-400 italic">Sin respuesta</p>;
  }

  if (campo.tipo === "booleano") {
    return (
      <p className="text-sm text-gray-800 font-medium">
        {value === true ? "Sí" : value === false ? "No" : "—"}
      </p>
    );
  }
  if (campo.tipo === "seleccion_multiple") {
    return (
      <div className="flex flex-wrap gap-2">
        {(Array.isArray(value) ? value : []).map((v) => (
          <span
            key={v}
            className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }
  if (campo.tipo === "imagen") {
    return (
      <img
        src={value}
        alt={campo.etiqueta}
        className="max-h-48 rounded border border-gray-200"
      />
    );
  }
  if (campo.tipo === "texto_largo") {
    return (
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(value)}</p>
    );
  }
  return <p className="text-sm text-gray-800">{String(value)}</p>;
}

function EditableInput({ campo, value, onChange }) {
  if (campo.tipo === "texto") {
    return (
      <input
        type="text"
        value={value ?? ""}
        placeholder={campo.placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
    );
  }
  if (campo.tipo === "texto_largo") {
    return (
      <textarea
        value={value ?? ""}
        placeholder={campo.placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
    );
  }
  if (campo.tipo === "numero") {
    const v = campo.validaciones;
    const tieneRango = v && (v.min != null || v.max != null);
    const num = value === "" || value == null ? null : Number(value);
    const fueraDeRango =
      num != null &&
      !Number.isNaN(num) &&
      ((v?.min != null && num < v.min) || (v?.max != null && num > v.max));
    return (
      <div>
        {/* Sin min/max: se permite editar a valores fuera de rango. */}
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={fueraDeRango || undefined}
          className={`w-full border rounded px-3 py-2 ${
            fueraDeRango ? "border-yellow-400 bg-yellow-50" : "border-gray-300"
          }`}
        />
        {tieneRango &&
          (fueraDeRango ? (
            <p className="text-xs text-yellow-700 mt-1">
              ⚠ Fuera del rango esperado ({v.min != null ? v.min : "—"} a{" "}
              {v.max != null ? v.max : "—"}). Se registrará como alerta.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Rango: {v.min != null ? v.min : "—"} a{" "}
              {v.max != null ? v.max : "—"}
            </p>
          ))}
      </div>
    );
  }
  if (campo.tipo === "seleccion_unica") {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
      >
        <option value="">Selecciona una opción</option>
        {(campo.opciones || []).map((op) => {
          const val = typeof op === "object" ? op.valor : op;
          const label = typeof op === "object" ? op.etiqueta : op;
          return (
            <option key={val} value={val}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }
  if (campo.tipo === "seleccion_multiple") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (op) =>
      onChange(arr.includes(op) ? arr.filter((v) => v !== op) : [...arr, op]);
    return (
      <div className="flex flex-wrap gap-3">
        {(campo.opciones || []).map((op) => {
          const val = typeof op === "object" ? op.valor : op;
          const label = typeof op === "object" ? op.etiqueta : op;
          return (
            <label
              key={val}
              className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={arr.includes(val)}
                onChange={() => toggle(val)}
              />
              {label}
            </label>
          );
        })}
      </div>
    );
  }
  if (campo.tipo === "booleano") {
    return (
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`bool-${campo.id}`}
            checked={value === true}
            onChange={() => onChange(true)}
          />
          Sí
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`bool-${campo.id}`}
            checked={value === false}
            onChange={() => onChange(false)}
          />
          No
        </label>
      </div>
    );
  }
  if (campo.tipo === "fecha") {
    return (
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2"
      />
    );
  }
  if (campo.tipo === "imagen") {
    const handleFile = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result);
      reader.readAsDataURL(file);
    };
    return (
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="text-sm"
        />
        {value && (
          <div className="mt-2">
            <img
              src={value}
              alt="Preview"
              className="max-h-40 rounded border border-gray-200"
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-red-600 mt-1 hover:underline block"
            >
              Eliminar imagen
            </button>
          </div>
        )}
      </div>
    );
  }
  return null;
}
