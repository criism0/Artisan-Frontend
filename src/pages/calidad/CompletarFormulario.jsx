import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { obtenerFormulario, crearRespuesta } from "../../services/calidad";
import { PageLoader } from "../../components/UI/PageLoader";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

/* Tipos soportados por el backend:
   texto, texto_largo, numero, seleccion_unica, seleccion_multiple,
   booleano, fecha, imagen                                                */

function valorInicial(tipo) {
  if (tipo === "booleano") return null;
  if (tipo === "seleccion_multiple") return [];
  if (tipo === "imagen") return null;
  return "";
}

function buildInitialValues(secciones) {
  const values = {};
  for (const sec of secciones || []) {
    for (const campo of sec.campos || []) {
      values[campo.id] = valorInicial(campo.tipo);
    }
  }
  return values;
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

export default function CompletarFormulario() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState(null);
  const [values, setValues] = useState({});
  const [estado, setEstado] = useState("conforme");
  const [detalle, setDetalle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canCreateResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE);

  useEffect(() => {
    if (!canReadForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    obtenerFormulario(id)
      .then((data) => {
        if (cancelled) return;
        setFormulario(data);
        setValues(buildInitialValues(data.secciones));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.message || "No se pudo cargar el formulario.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div>
        <BackButton to="/calidad/formularios" />
        <PageLoader message="Cargando formulario"/>
      </div>
    );
  }

  if (!formulario) {
    return (
      <div>
        <BackButton to="/calidad/formularios" />
        <p className="mt-4 text-gray-600">Formulario no encontrado.</p>
      </div>
    );
  }

  const secciones = formulario.secciones || [];
  const hayCampos = secciones.some((s) => (s.campos || []).length > 0);

  if (!hayCampos) {
    return (
      <div>
        <BackButton to="/calidad/formularios" />
        <h1 className="text-2xl font-bold text-text mt-4">{formulario.nombre}</h1>
        <p className="mt-4 text-gray-600">
          Este formulario aún no tiene campos definidos. Edítalo primero.
        </p>
      </div>
    );
  }

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
        const val = values[campo.id];

        if (campo.requerido && esVacio(campo, val)) {
          toast.error(`El campo "${campo.etiqueta}" es requerido.`);
          return false;
        }

        const v = campo.validaciones;
        if (v && !esVacio(campo, val)) {
          // Los rangos numéricos (min/max) NO bloquean el envío: un valor
          // fuera de rango es una señal válida (p. ej. una no conformidad) y
          // se reporta como alerta en el dashboard. Solo se valida el tipo.
          if (campo.tipo === "numero") {
            if (Number.isNaN(Number(val))) {
              toast.error(`"${campo.etiqueta}" debe ser un número.`);
              return false;
            }
          } else if (campo.tipo === "texto" || campo.tipo === "texto_largo") {
            const len = String(val).length;
            if (v.min_length != null && len < v.min_length) {
              toast.error(
                `"${campo.etiqueta}" debe tener al menos ${v.min_length} caracteres.`
              );
              return false;
            }
            if (v.max_length != null && len > v.max_length) {
              toast.error(
                `"${campo.etiqueta}" debe tener máximo ${v.max_length} caracteres.`
              );
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!canCreateResponses){
      toast.permissionError([ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE]);
      setSaving(false);
      return;
    }

    if (!formulario.aprobado) {
      toast.error("Este formulario aún no ha sido aprobado, por lo que no puede ser respondido.");
      return;
    }

    if (!validar()) return;

    if (estado !== "conforme" && !detalle.trim()) {
      toast.error('El detalle es obligatorio si el registro es "desvío" o "no conforme".');
      return;
    }

    // El backend espera { respuestas: { "campo-id": valor, ... }, estado, detalle }.
    // Solo incluir campos visibles (según condición) y no-vacíos opcionales.
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
      await crearRespuesta(formulario.id, {
        respuestas,
        estado,
        detalle: estado === "conforme" ? "" : detalle.trim(),
      });
      toast.success("Registro guardado correctamente.");
      navigate("/calidad/formularios");
    } catch (err) {
      toast.error(err?.message || "Error al guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <BackButton to="/calidad/formularios" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Spinner size="sm"/>}
            {saving ? "Guardando..." : "Enviar registro"}
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">{formulario.nombre}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formulario.codigo} · v{formulario.version}
            {formulario.frecuencia_esperada
              ? ` · ${formulario.frecuencia_esperada}`
              : ""}
          </p>
          {formulario.descripcion && (
            <p className="text-sm text-gray-600 mt-2">{formulario.descripcion}</p>
          )}
        </div>

        <div className="space-y-6">
          {secciones.map((seccion) => (
            <SeccionBlock
              key={seccion.id}
              seccion={seccion}
              values={values}
              onChangeValue={setValue}
            />
          ))}
        </div>

        {/* Estado de conformidad del registro */}
        <div className="bg-white p-6 rounded-lg shadow mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Estado del registro</h2>
            <p className="text-sm text-gray-500">
              Indica si la inspección termina conforme, con desvío o como no conforme.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EstadoOption
              value="conforme"
              label="Conforme"
              description="Todo dentro de norma."
              selected={estado === "conforme"}
              colorClass="border-green-500 bg-green-50 text-green-800"
              onSelect={() => {
                setEstado("conforme");
                setDetalle("");
              }}
            />
            <EstadoOption
              value="desvio"
              label="Desvío"
              description="Hay una desviación menor que se debe documentar."
              selected={estado === "desvio"}
              colorClass="border-yellow-500 bg-yellow-50 text-yellow-800"
              onSelect={() => setEstado("desvio")}
            />
            <EstadoOption
              value="no-conforme"
              label="No conforme"
              description="Resultado fuera de los criterios aceptables."
              selected={estado === "no-conforme"}
              colorClass="border-red-500 bg-red-50 text-red-800"
              onSelect={() => setEstado("no-conforme")}
            />
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
        </div>

        {/* Nota de firma: el backend asocia id_usuario automáticamente desde el JWT */}
        <div className="bg-white p-4 rounded-lg shadow mt-6 text-sm text-gray-600">
          Este registro se asociará a tu usuario autenticado (
          <span className="font-medium">{formulario.tipo_firma || "digital"}</span>
          ) al enviarlo.
        </div>
      </div>
    </div>
  );
}

/* ---------- Sección visual ---------- */

function SeccionBlock({ seccion, values, onChangeValue }) {
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
              onChange={(val) => onChangeValue(campo.id, val)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Renderizador por tipo ---------- */

function CampoInput({ campo, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {campo.etiqueta}
        {campo.requerido && <span className="text-red-500 ml-1">*</span>}
      </label>

      {campo.tipo === "texto" && (
        <input
          type="text"
          value={value ?? ""}
          placeholder={campo.placeholder || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
      )}

      {campo.tipo === "texto_largo" && (
        <textarea
          value={value ?? ""}
          placeholder={campo.placeholder || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
      )}

      {campo.tipo === "numero" && (
        <NumeroInput campo={campo} value={value} onChange={onChange} />
      )}

      {campo.tipo === "seleccion_unica" && (
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
      )}

      {campo.tipo === "seleccion_multiple" && (
        <SeleccionMultipleInput
          opciones={campo.opciones || []}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )}

      {campo.tipo === "booleano" && (
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
      )}

      {campo.tipo === "fecha" && (
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
      )}

      {campo.tipo === "imagen" && (
        <ImagenInput value={value} onChange={onChange} />
      )}
    </div>
  );
}

function NumeroInput({ campo, value, onChange }) {
  const v = campo.validaciones;
  const tieneRango = v && (v.min != null || v.max != null);
  const num = value === "" || value == null ? null : Number(value);
  const fueraDeRango =
    num != null &&
    !Number.isNaN(num) &&
    ((v?.min != null && num < v.min) || (v?.max != null && num > v.max));

  return (
    <div>
      {/* Sin min/max: se permite ingresar valores fuera de rango a propósito. */}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={fueraDeRango || undefined}
        className={`w-full border rounded px-3 py-2 ${
          fueraDeRango
            ? "border-yellow-400 bg-yellow-50"
            : "border-gray-300"
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
            Rango: {v.min != null ? v.min : "—"} a {v.max != null ? v.max : "—"}
          </p>
        ))}
    </div>
  );
}

function SeleccionMultipleInput({ opciones, value, onChange }) {
  const toggle = (val) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val));
    else onChange([...value, val]);
  };
  return (
    <div className="flex flex-wrap gap-3">
      {opciones.map((op) => {
        const val = typeof op === "object" ? op.valor : op;
        const label = typeof op === "object" ? op.etiqueta : op;
        return (
          <label
            key={val}
            className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={value.includes(val)}
              onChange={() => toggle(val)}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

function EstadoOption({ label, description, selected, colorClass, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left border-2 rounded-lg p-3 transition-colors ${
        selected
          ? colorClass
          : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs mt-1 opacity-80">{description}</p>
    </button>
  );
}

function ImagenInput({ value, onChange }) {
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
