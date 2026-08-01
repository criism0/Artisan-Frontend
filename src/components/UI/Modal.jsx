import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Modal estándar de la app.
 *
 * Los formularios que interrumpen el flujo —confirmar un envío, emitir una guía— se abrían
 * como paneles desplegables en medio de la página: empujaban todo hacia abajo, no se sabía
 * si estaban abiertos sin scrollear, y su botón de confirmar quedaba lejos del que los abrió.
 * En un modal el formulario está donde se lo llamó y se cierra sin dejar rastro.
 *
 * `pie` recibe los botones de acción; van siempre abajo a la derecha.
 */
export default function Modal({ abierto, onCerrar, titulo, descripcion, children, pie, ancho = "max-w-lg" }) {
  useEffect(() => {
    if (!abierto) return undefined;

    const alEscape = (e) => {
      if (e.key === "Escape") onCerrar?.();
    };
    document.addEventListener("keydown", alEscape);

    // Sin esto el fondo sigue scrolleando detrás del modal, que es desorientador.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alEscape);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        // Solo cierra si el clic empezó en el fondo: si empezó dentro y terminó afuera
        // (al seleccionar texto, por ejemplo) el modal no debe desaparecer.
        if (e.target === e.currentTarget) onCerrar?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white rounded-xl shadow-xl w-full ${ancho} max-h-[85vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
            {descripcion && <p className="text-sm text-gray-500 mt-1">{descripcion}</p>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {pie && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">{pie}</div>
        )}
      </div>
    </div>
  );
}
