import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

const ANCHO = 288; // w-72
const MARGEN = 8;

/**
 * El «(?)» de la app: una aclaración que se abre al apretarlo, en vez de un párrafo fijo en la
 * vista. Regla de Cristóbal (2026-10-22): menos mensajes, notas y recuadros que compiten con lo
 * que hay que hacer. Lo que explica cómo funciona algo vive acá; en pantalla quedan sólo los
 * avisos que cambian lo que el operario hace ahora (`Aviso`).
 *
 * Se abre con clic —no con hover— para que sirva en pantallas táctiles y se pueda leer con
 * calma; se cierra con Esc, con un clic fuera o al hacer scroll. Se dibuja en `body` con
 * posición fija: una tarjeta o una tabla con `overflow-hidden` no lo recorta.
 */
export default function Ayuda({ titulo, children, etiqueta, className = "" }) {
  const [abierta, setAbierta] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const panel = useRef(null);
  const id = useId();

  const ubicar = useCallback(() => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const alto = panel.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(r.left - MARGEN, MARGEN), window.innerWidth - ANCHO - MARGEN);
    const abajo = r.bottom + 6;
    const top = alto && abajo + alto > window.innerHeight - MARGEN ? Math.max(MARGEN, r.top - alto - 6) : abajo;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (abierta) ubicar();
  }, [abierta, ubicar]);

  useEffect(() => {
    if (!abierta) return undefined;
    const cerrar = () => setAbierta(false);
    const tecla = (e) => e.key === "Escape" && cerrar();
    const fuera = (e) => {
      if (!panel.current?.contains(e.target) && !boton.current?.contains(e.target)) cerrar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        ref={boton}
        onClick={(e) => {
          e.stopPropagation();
          setAbierta((v) => !v);
        }}
        aria-label={titulo ? `Ayuda: ${titulo}` : "Ayuda"}
        aria-expanded={abierta}
        aria-controls={abierta ? id : undefined}
        className={`inline-flex items-center gap-1 align-middle rounded-full text-gray-400 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
      >
        <CircleHelp className="w-4 h-4" />
        {etiqueta && <span className="text-xs">{etiqueta}</span>}
      </button>
      {abierta &&
        createPortal(
          <div
            id={id}
            ref={panel}
            role="dialog"
            aria-label={titulo || "Ayuda"}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: ANCHO }}
            className="z-[70] max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-700 shadow-lg"
          >
            {titulo && <p className="mb-1 font-medium text-gray-900">{titulo}</p>}
            <div className="space-y-1.5">{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
