/**
 * Header de columna con un "(?)" que despliega un tooltip explicativo.
 * Se usa en las listas de Insumos y PIP para Stock Crítico / Semanas de Seguridad.
 */
export default function HeaderConTooltip({ label, tooltip }) {
  return (
    <div className="flex items-center gap-2 relative group">
      {label}
      <span className="cursor-help text-primary hover:text-hover">(?)</span>

      <span
        className="absolute top-full left-1/2 -translate-x-1/2 mt-2
                  bg-white text-gray-800 text-xs px-4 py-2 rounded-lg shadow-lg
                  border border-gray-200 w-64 text-center
                  opacity-0 group-hover:opacity-100
                  transform scale-95 group-hover:scale-100
                  transition-all duration-200 z-10 leading-snug break-words"
      >
        {tooltip}
        <span
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2
                    bg-white border-l border-t border-gray-200 rotate-45"
        ></span>
      </span>
    </div>
  );
}
