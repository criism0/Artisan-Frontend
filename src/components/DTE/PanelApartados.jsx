import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Mail, RotateCcw } from "lucide-react";

/**
 * Los correos que la Cola IA apartó sin poder crear la orden.
 *
 * 🔴 POR QUÉ EXISTE ESTA PANTALLA. Hasta el 2026-08-07 estos correos se descartaban en
 * silencio: se etiquetaban como procesados, no se creaba nada y nadie se enteraba. Se midieron
 * **79 en producción**, incluidos pedidos de Jumbo y WalMart. El worker ya no los pierde —los
 * aparta y deja el correo sin leer— pero hasta acá no había forma de verlos desde la app.
 *
 * Se muestra la EVIDENCIA (el texto del correo y lo que devolvió la IA) porque el problema
 * original no era sólo perder el pedido: era que el log tampoco permitía ubicar la falla.
 */

function Fecha({ valor }) {
  if (!valor) return <span className="text-gray-400">—</span>;
  try {
    return (
      <span>
        {new Date(valor).toLocaleString("es-CL", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </span>
    );
  } catch {
    return <span>{String(valor)}</span>;
  }
}

function TarjetaApartado({ a }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3"
      >
        {abierto ? (
          <ChevronDown size={16} className="text-gray-400 mt-1 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 mt-1 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm truncate">
            {a.email_asunto || "(sin asunto)"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
            <Mail size={12} /> {a.email_remitente || "remitente desconocido"}
            <span className="text-gray-300">·</span>
            <Fecha valor={a.procesado_en} />
          </p>
          <p className="text-sm text-amber-800 mt-1.5">{a.error_detalle || "Sin detalle"}</p>
        </div>
        {a.intentos > 1 && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            <RotateCcw size={12} /> {a.intentos} intentos
          </span>
        )}
      </button>

      {abierto && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Texto del correo</p>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-56 overflow-auto whitespace-pre-wrap break-words">
              {a.raw_email_texto || "(vacío)"}
            </pre>
            {/*
              106 caracteres es el largo del aviso "Archivo enviado automáticamente desde la
              carpeta Drive de OC" con el que llegan las OC de Jumbo y WalMart. Cuando el
              cuerpo es sólo eso, el pedido venía en el adjunto — la causa de 50 de los 79
              descartes. Decirlo acá ahorra abrir Gmail para descubrirlo.
            */}
            {a.raw_email_texto && a.raw_email_texto.trim().length < 200 && (
              <p className="text-xs text-gray-500 mt-1">
                El cuerpo es muy corto ({a.raw_email_texto.trim().length} caracteres): puede que
                el pedido venga en un adjunto.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Respuesta de la IA</p>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-56 overflow-auto whitespace-pre-wrap break-words">
              {a.raw_ai_response ? JSON.stringify(a.raw_ai_response, null, 2) : "(no se guardó)"}
            </pre>
          </div>

          <p className="text-xs text-gray-500">
            El correo quedó <strong>sin leer</strong> en la bandeja con la etiqueta{" "}
            <code className="bg-gray-100 px-1 rounded">artisan-ov-requiere-revision</code>. Se
            carga a mano desde Gmail y después se crea la orden.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PanelApartados({ apartados, loading, error }) {
  if (loading) return <div className="text-center py-20 text-gray-400">Cargando…</div>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900">
        No se pudieron cargar los correos apartados: {error}
      </div>
    );
  }

  if (!apartados?.length) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-gray-500 font-medium">Ningún correo quedó apartado</p>
        <p className="text-xs text-gray-400 mt-1">
          Todos los correos recibidos se pudieron convertir en orden o se descartaron por no ser
          un pedido.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium">Estos correos no se convirtieron en orden.</p>
          <p className="mt-0.5">
            No se perdieron: quedaron sin leer en la bandeja, etiquetados. Hay que revisarlos y
            cargar el pedido a mano.
          </p>
        </div>
      </div>

      {apartados.map((a) => (
        <TarjetaApartado key={a.id} a={a} />
      ))}
    </div>
  );
}
