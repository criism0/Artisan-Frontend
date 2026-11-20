import { useEffect } from "react";

/**
 * Menú pequeño que sale donde se hizo clic derecho sobre una OV del planificador. Se cierra con
 * Escape, con un clic afuera o al hacer scroll.
 */
export default function MenuContextualOrden({ x, y, opciones, onCerrar }) {
  useEffect(() => {
    const cerrar = () => onCerrar();
    const alEscape = (e) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alEscape);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("keydown", alEscape);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [onCerrar]);

  // Que no se salga de la pantalla.
  const izquierda = Math.min(x, window.innerWidth - 220);
  const arriba = Math.min(y, window.innerHeight - 10 - opciones.length * 36);

  return (
    <div className="fixed inset-0 z-40" onMouseDown={onCerrar} onContextMenu={(e) => { e.preventDefault(); onCerrar(); }}>
      <div
        role="menu"
        className="absolute w-52 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
        style={{ left: izquierda, top: arriba }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {opciones.map((o) => (
          <button
            key={o.texto}
            type="button"
            role="menuitem"
            onClick={() => { onCerrar(); o.onClick(); }}
            className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 ${o.tono ?? "text-gray-800"}`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
