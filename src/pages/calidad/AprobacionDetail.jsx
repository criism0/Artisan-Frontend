import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BackButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import {
  obtenerFormulario,
  actualizarFormulario,
  eliminarFormulario,
} from "../../services/calidad";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const TIPO_LABEL = {
  texto: "Texto corto",
  texto_largo: "Texto largo",
  numero: "Número",
  seleccion_unica: "Selección única",
  seleccion_multiple: "Selección múltiple",
  booleano: "Sí / No",
  fecha: "Fecha",
  imagen: "Imagen",
};

export default function AprobacionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canUpdateForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE);
  const canDeleteForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.DELETE);

  useEffect(() => {
    if (!canReadForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    obtenerFormulario(id)
      .then((data) => !cancelled && setFormulario(data))
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.message || "No se pudo cargar el formulario.");
        navigate("/calidad/formularios/aprobaciones");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div>
        <BackButton to="/calidad/formularios/aprobaciones" />
        <PageLoader message="Cargando formulario"/>
      </div>
    );
  }

  if (!formulario) return null;

  const handleAprobar = async () => {
    if (!canUpdateForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE]);
      setSaving(false);
      return;
    }
    setSaving(true);
    try {
      // PUT crea una nueva versión con aprobado=true y archiva la actual.
      await actualizarFormulario(formulario.id, {
        nombre: formulario.nombre,
        descripcion: formulario.descripcion,
        frecuencia_esperada: formulario.frecuencia_esperada,
        tipo_firma: formulario.tipo_firma,
        aprobado: true,
        secciones: formulario.secciones,
      });
      toast.success("Formulario aprobado.");
      navigate("/calidad/formularios/aprobaciones");
    } catch (err) {
      toast.error(err?.message || "No se pudo aprobar el formulario.");
    } finally {
      setSaving(false);
    }
  };

  const handleRechazar = async () => {
    if (!canDeleteForms){
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.DELETE]);
      return;
    }
    try {
      await eliminarFormulario(formulario.id);
      toast.success("Formulario rechazado y eliminado.");
      navigate("/calidad/formularios/aprobaciones");
    } catch (err) {
      toast.error(err?.message || "No se pudo rechazar el formulario.");
    }
  };

  const secciones = formulario.secciones || [];

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <BackButton to="/calidad/formularios/aprobaciones" />
          <div className="flex gap-2 items-center">
            <TrashButton
              onConfirmDelete={handleRechazar}
              tooltipText="Rechazar formulario"
              entityName="formulario"
            />
            <button
              onClick={handleAprobar}
              disabled={saving || formulario.aprobado }
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Spinner size="sm"/>}
              {saving ? "Aprobando..." : "Aprobar"}
            </button>
          </div>
        </div>

        <div className="mb-4">
          {formulario.aprobado ? (
            <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              Ya aprobado
            </span>
          ) : (
            <span className="inline-block px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
            Pendiente de aprobación
          </span>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h1 className="text-2xl font-bold text-text mb-4">
            {formulario.nombre}
          </h1>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <MetaRow label="Código" value={formulario.codigo} />
            <MetaRow label="Versión" value={`v${formulario.version}`} />
            <MetaRow
              label="Frecuencia esperada"
              value={formulario.frecuencia_esperada || "—"}
            />
            <MetaRow
              label="Tipo de firma"
              value={formulario.tipo_firma || "—"}
            />
          </dl>
          {formulario.descripcion && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Descripción
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {formulario.descripcion}
              </p>
            </div>
          )}
        </div>

        {/* Preview de secciones y campos */}
        <h2 className="text-lg font-semibold text-text mb-3">
          Contenido del formulario
        </h2>

        {secciones.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <p className="text-gray-500 text-sm">
              Este formulario no tiene secciones.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {secciones.map((sec, sIdx) => (
              <SeccionPreview key={sec.id || sIdx} seccion={sec} index={sIdx} />
            ))}
          </div>
        )}

        {/* Botones sticky abajo para formularios largos */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <TrashButton
            onConfirmDelete={handleRechazar}
            tooltipText="Rechazar formulario"
            entityName="formulario"
          />
          <button
            onClick={handleAprobar}
            disabled={saving || formulario.aprobado}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
          >
            {saving ? "Aprobando..." : "Aprobar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}

function SeccionPreview({ seccion, index }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          Sección {index + 1}
        </span>
        <h3 className="text-lg font-semibold text-text">
          {seccion.titulo || "Sin título"}
        </h3>
        {seccion.descripcion && (
          <p className="text-sm text-gray-500 mt-0.5">{seccion.descripcion}</p>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {(seccion.campos || []).map((campo, cIdx) => (
          <CampoPreview key={campo.id || cIdx} campo={campo} index={cIdx} />
        ))}
      </div>
    </div>
  );
}

function CampoPreview({ campo, index }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">
            {index + 1}. {campo.etiqueta || "Sin etiqueta"}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </p>
          {campo.placeholder && (
            <p className="text-xs text-gray-500 mt-0.5 italic">
              Placeholder: {campo.placeholder}
            </p>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600 whitespace-nowrap">
          {TIPO_LABEL[campo.tipo] || campo.tipo}
        </span>
      </div>

      {Array.isArray(campo.opciones) && campo.opciones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {campo.opciones.map((op, i) => {
            const label = typeof op === "object" ? op.etiqueta : op;
            return (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {campo.validaciones && Object.keys(campo.validaciones).length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Validaciones:{" "}
          {Object.entries(campo.validaciones)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
