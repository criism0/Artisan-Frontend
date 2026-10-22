import { Children } from "react";

const COLUMNAS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

/**
 * Los datos de un vistazo bajo la cabecera de un detalle, en una sola caja.
 *
 * Reemplaza las filas de tarjetas con un borde de color cada una: cuatro colores compitiendo por
 * atención sin decir nada con ellos. Ver docs/GUIA_VISUAL.md.
 */
export function FranjaDatos({ children, className = "" }) {
  const n = Children.toArray(children).filter(Boolean).length;
  return (
    <div
      className={`grid grid-cols-2 ${COLUMNAS[n] ?? "md:grid-cols-4"} gap-y-3 rounded-xl border border-gray-200 bg-white py-3 shadow-sm md:divide-x md:divide-gray-100 ${className}`}
    >
      {children}
    </div>
  );
}

export function Dato({ titulo, children, detalle }) {
  return (
    <div className="min-w-0 px-4">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div
        className="truncate text-lg font-semibold text-gray-900"
        title={typeof children === "string" ? children : undefined}
      >
        {children}
      </div>
      {detalle && <div className="truncate text-xs text-gray-400">{detalle}</div>}
    </div>
  );
}
