import Ayuda from "../UI/Ayuda.jsx";

/**
 * Header de columna con su «(?)». Se usa en las listas de Insumos y PIP para Stock Crítico /
 * Semanas de Seguridad.
 *
 * Antes era un tooltip que aparecía sólo al pasar el mouse: en una pantalla táctil no se podía
 * leer, y el texto se cortaba contra el borde de la tabla. Ahora es el mismo «(?)» del resto de la
 * app, que se abre con un clic y no ordena la columna.
 */
export default function HeaderConTooltip({ label, tooltip }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Ayuda titulo={typeof label === "string" ? label : undefined}>{tooltip}</Ayuda>
    </span>
  );
}
