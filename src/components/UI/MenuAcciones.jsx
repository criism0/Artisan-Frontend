import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

/**
 * Menú «⋯» de acciones: el de cada fila de una tabla y el de la cabecera de un detalle.
 *
 * Se dibuja en un portal con posición fija porque las tablas scrollean en horizontal
 * (`overflow-x-auto`): un menú absoluto dentro de la celda quedaba cortado por el borde de la
 * tabla, justo en la última columna, que es donde van las acciones.
 *
 * items: [{ label, onClick, icon?, disabled?, title?, peligro?, separador? }]
 *   · `separador: true` dibuja una línea (agrupa lo destructivo al final).
 *   · Una acción que no aplica se pasa `disabled` con el motivo en `title`: se ve en gris y
 *     dice por qué, en vez de desaparecer y dejar a la persona buscándola.
 *
 * variante: "fila" (ícono suelto, como los demás de la tabla) o "boton" (con borde, cabecera).
 */
export default function MenuAcciones({ items, variante = "fila", etiqueta = "Más acciones" }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const menu = useRef(null);

  const lista = (items || []).filter(Boolean);
  // Un separador al principio, al final o repetido no separa nada.
  const visibles = lista.filter(
    (it, i) => !it.separador || (i > 0 && i < lista.length - 1 && !lista[i - 1].separador),
  );

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const alto = menu.current?.offsetHeight ?? 0;
    // Se abre hacia arriba si no cabe bajo el botón (las últimas filas de la tabla).
    const arriba = r.bottom + alto + 8 > window.innerHeight && r.top > alto + 8;
    setPos({
      top: arriba ? r.top - alto - 4 : r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
    });
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (boton.current?.contains(e.target) || menu.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const escape = (e) => e.key === "Escape" && setAbierto(false);
    const cerrar = () => setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", cerrar);
    // `true`: también el scroll de la tabla, no sólo el de la página.
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierto]);

  if (!visibles.some((it) => !it.separador)) return null;

  const claseBoton =
    variante === "boton"
      ? "p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
      : "p-1 rounded-md text-gray-400 hover:text-primary hover:bg-gray-100";

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => {
          setPos(null);
          setAbierto((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={etiqueta}
        title={etiqueta}
        className={claseBoton}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {abierto &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={pos ? { top: pos.top, right: pos.right } : { visibility: "hidden", top: 0, right: 0 }}
            className="fixed z-50 min-w-[13rem] max-w-xs bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-left"
          >
            {visibles.map((it, i) =>
              it.separador ? (
                <div key={`sep-${i}`} className="my-1 border-t border-gray-100" />
              ) : (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  disabled={it.disabled}
                  title={it.title}
                  onClick={() => {
                    setAbierto(false);
                    it.onClick?.();
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent ${
                    it.peligro ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {it.icon}
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
