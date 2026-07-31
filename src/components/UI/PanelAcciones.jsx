import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * Panel de acciones de una vista.
 *
 * Cada módulo tiene acciones propias —facturar una venta, enviar una solicitud, validar una
 * toma— y hasta ahora cada vista las ponía donde le acomodaba: la Solicitud las repartía en
 * cuatro lugares (cabecera, panel desplegable, sección de guías y dentro de la tabla) y la
 * Orden de Venta dejaba la principal al fondo de la página. Este componente es el único
 * lugar donde viven, siempre en la cabecera, con la misma jerarquía en todos los módulos:
 *
 *   principal    → la única acción que corresponde al estado actual (Validar, Facturar…)
 *   secundarias  → lo que siempre se puede hacer (Editar, Descargar PDF, Emitir Guía…)
 *   destructivas → detrás del menú «⋯», nunca sueltas (Eliminar, Cancelar)
 *
 * Regla que sostiene el estándar: una acción NO vive dentro de la sección que muestra sus
 * datos. El botón de PDF no va dentro de la tabla, sube acá.
 *
 * Forma de cada acción:
 *   { label, onClick, icon?, disabled?, title?, confirmar?: { titulo, mensaje?, textoBoton? } }
 */

function ModalConfirmacion({ accion, onCerrar }) {
  if (!accion) return null;
  const { confirmar = {}, label, destructiva } = accion;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {confirmar.titulo || `¿Confirmas «${label}»?`}
        </h2>
        {confirmar.mensaje && (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{confirmar.mensaje}</p>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCerrar}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onCerrar();
              accion.onClick?.();
            }}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
              destructiva ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"
            }`}
          >
            {confirmar.textoBoton || label}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuDestructivas({ acciones, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  // Un menú que solo se cierra con su propio botón queda abierto tapando la vista en cuanto
  // el usuario hace clic en otra parte, que es justo lo que espera que lo cierre.
  useEffect(() => {
    if (!abierto) return undefined;

    const alClicFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    };
    const alEscape = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, [abierto]);

  if (!acciones.length) return null;

  return (
    <div className="relative" ref={contenedor}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Más acciones"
        title="Más acciones"
        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30"
        >
          {acciones.map((accion) => (
            <button
              key={accion.label}
              role="menuitem"
              disabled={accion.disabled}
              title={accion.title}
              onClick={() => {
                setAbierto(false);
                onElegir(accion);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent text-left"
            >
              {accion.icon}
              {accion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PanelAcciones({ principal, secundarias = [], destructivas = [] }) {
  const [porConfirmar, setPorConfirmar] = useState(null);

  const acciones = [principal, ...secundarias, ...destructivas].filter(Boolean);
  if (!acciones.length) return null;

  // Una acción con `confirmar` abre el modal; el resto se ejecuta directo.
  const ejecutar = (accion) => {
    if (accion.confirmar) setPorConfirmar(accion);
    else accion.onClick?.();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {secundarias.filter(Boolean).map((accion) => (
          <button
            key={accion.label}
            onClick={() => ejecutar(accion)}
            disabled={accion.disabled}
            title={accion.title}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {accion.icon}
            {accion.label}
          </button>
        ))}

        {principal && (
          <button
            onClick={() => ejecutar(principal)}
            disabled={principal.disabled}
            title={principal.title}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm hover:bg-primary-dark disabled:opacity-50"
          >
            {principal.icon}
            {principal.label}
          </button>
        )}

        <MenuDestructivas
          acciones={destructivas.filter(Boolean).map((a) => ({ ...a, destructiva: true }))}
          onElegir={ejecutar}
        />
      </div>

      <ModalConfirmacion accion={porConfirmar} onCerrar={() => setPorConfirmar(null)} />
    </>
  );
}
