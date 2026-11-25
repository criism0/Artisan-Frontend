import { useState } from "react";
import MenuAcciones from "./MenuAcciones.jsx";

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

/**
 * `menu`: lo ocasional, en el «⋯» y en gris (marcar documento externo, quitar del
 * planificador…). Así no compite con lo frecuente, que queda a la vista en `secundarias`.
 * `destructivas` van en el mismo «⋯», debajo de una línea y en rojo.
 */
export default function PanelAcciones({ principal, secundarias = [], menu = [], destructivas = [] }) {
  const [porConfirmar, setPorConfirmar] = useState(null);

  const acciones = [principal, ...secundarias, ...menu, ...destructivas].filter(Boolean);
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

        <MenuAcciones
          variante="boton"
          items={[
            ...menu.filter(Boolean).map((a) => ({ ...a, onClick: () => ejecutar(a) })),
            { separador: true },
            ...destructivas
              .filter(Boolean)
              .map((a) => ({ ...a, peligro: true, onClick: () => ejecutar({ ...a, destructiva: true }) })),
          ]}
        />
      </div>

      <ModalConfirmacion accion={porConfirmar} onCerrar={() => setPorConfirmar(null)} />
    </>
  );
}
