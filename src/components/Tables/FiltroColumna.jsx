import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import {
  filtroActivo,
  filtroVacio,
  opcionesDeColumna,
  normalizar,
  SIN_VALOR,
} from "../../utils/filtrosColumna";
import { fuzzyMatch } from "../../services/fuzzyMatch";

/**
 * El embudo que abre el filtro de una columna, al estilo de una planilla.
 *
 * Cuatro formas según lo que declare la columna en `filtro`:
 *   - `valores` → lista de los valores que existen, con su conteo
 *   - `texto`   → contiene
 *   - `numero`  → desde / hasta
 *   - `fecha`   → desde / hasta
 *
 * ⚠️ El popover NO va dentro del `<th>` con `overflow` recortado: se posiciona absoluto sobre
 * la cabecera y por eso el `th` lleva `relative`. Dentro de la celda quedaría cortado por el
 * `overflow-x-auto` de la tabla justo en las columnas de la derecha, que son las que más se
 * filtran.
 */
/** Cuántas opciones se pintan de una vez. El resto se alcanza escribiendo en el buscador. */
const MAX_OPCIONES = 200;

export default function FiltroColumna({ col, data, filtro, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const activo = filtroActivo(filtro);
  const actual = filtro ?? filtroVacio(col.filtro);

  const opciones = useMemo(
    () => (col.filtro === "valores" ? opcionesDeColumna(col, data) : []),
    [col, data],
  );

  // Difuso también acá: la lista de valores es donde más se tipea a ciegas —125 clientes— y
  // errarle a una letra dejaba la lista vacía como si el cliente no existiera.
  const coincidencias = useMemo(() => {
    if (!busqueda.trim()) return opciones;
    return opciones.filter((o) => fuzzyMatch(normalizar(String(o.etiqueta)), busqueda));
  }, [opciones, busqueda]);

  // Se pinta sólo un tramo: una columna de códigos puede tener miles de valores distintos y
  // construir miles de checkboxes al abrir el embudo cuelga la pestaña. Lo ya marcado se
  // muestra SIEMPRE aunque quede fuera del tramo — si no, marcar algo y después escribir en el
  // buscador lo haría desaparecer de la lista y parecería que se desmarcó.
  const visibles = useMemo(() => {
    const marcados = new Set(actual.seleccion ?? []);
    const dentro = coincidencias.slice(0, MAX_OPCIONES);
    const yaEstan = new Set(dentro.map((o) => o.valor));
    const faltantes = coincidencias.filter((o) => marcados.has(o.valor) && !yaEstan.has(o.valor));
    return [...faltantes, ...dentro];
  }, [coincidencias, actual.seleccion]);

  const ocultas = Math.max(0, coincidencias.length - MAX_OPCIONES);

  const alternarValor = (valor) => {
    const seleccion = actual.seleccion ?? [];
    onChange({
      ...actual,
      seleccion: seleccion.includes(valor)
        ? seleccion.filter((v) => v !== valor)
        : [...seleccion, valor],
    });
  };

  const limpiar = () => {
    onChange(filtroVacio(col.filtro));
    setBusqueda("");
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        // `stopPropagation` porque la cabecera entera ordena al hacer clic: sin esto, abrir el
        // filtro reordenaría la tabla debajo del popover que uno acaba de abrir.
        onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v); }}
        className={`p-0.5 rounded transition-colors ${
          activo ? "text-primary bg-primary/10" : "text-gray-300 hover:text-gray-500"
        }`}
        // Queda en el DOM para poder auditar de una pasada qué tipo de filtro le tocó a cada
        // columna de cada lista, sin abrir 200 embudos a mano.
        data-filtro={col.filtro}
        title={activo ? "Filtro puesto en esta columna" : "Filtrar por esta columna"}
        aria-label={`Filtrar por ${typeof col.header === "string" ? col.header : col.accessor}`}
      >
        <Filter className="w-3 h-3" />
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar al hacer clic afuera. Sin ella el panel queda tapando la tabla
              que uno acaba de ir a mirar. */}
          <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[210px] font-normal normal-case text-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {col.filtro === "valores" && (
              <>
                {/* El buscador aparece recién cuando la lista deja de leerse de un vistazo:
                    Cliente tiene 125 valores distintos, Estado tiene 6. */}
                {opciones.length > 8 && (
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar valor…"
                    title="Tolera errores de tipeo"
                    className="w-full mb-1.5 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
                <div className="max-h-[240px] overflow-y-auto">
                  {visibles.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-gray-400">Sin coincidencias</div>
                  )}
                  {visibles.map((o) => (
                    <label
                      // `o.valor` es `null` para el vacío, que no sirve de key de React.
                      key={o.valor === SIN_VALOR ? "__vacio__" : o.valor}
                      className="flex items-center gap-2 px-1.5 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(actual.seleccion ?? []).includes(o.valor)}
                        onChange={() => alternarValor(o.valor)}
                        className="accent-primary shrink-0"
                      />
                      <span className={`truncate ${o.valor === SIN_VALOR ? "italic text-gray-400" : ""}`}>
                        {o.etiqueta}
                      </span>
                      <span className="ml-auto text-[10px] text-gray-400 shrink-0">{o.n}</span>
                    </label>
                  ))}
                  {ocultas > 0 && (
                    <div className="px-2 py-1.5 text-[11px] text-gray-400 border-t border-gray-100 mt-1">
                      y {ocultas} valor{ocultas > 1 ? "es" : ""} más — escribe arriba para
                      encontrarlo
                    </div>
                  )}
                </div>
              </>
            )}

            {col.filtro === "texto" && (
              <input
                type="text"
                autoFocus
                value={actual.q ?? ""}
                onChange={(e) => onChange({ ...actual, q: e.target.value })}
                placeholder="Contiene… (tolera errores de tipeo)"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}

            {col.filtro === "numero" && (
              <div className="flex flex-col gap-1.5">
                {[["min", "Desde"], ["max", "Hasta"]].map(([campo, etiqueta]) => (
                  <label key={campo} className="flex items-center gap-2 text-xs">
                    <span className="w-10 text-gray-500">{etiqueta}</span>
                    <input
                      type="number"
                      value={actual[campo] ?? ""}
                      onChange={(e) => onChange({ ...actual, [campo]: e.target.value })}
                      className="w-28 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                ))}
              </div>
            )}

            {col.filtro === "fecha" && (
              <div className="flex flex-col gap-1.5">
                {[["desde", "Desde"], ["hasta", "Hasta"]].map(([campo, etiqueta]) => (
                  <label key={campo} className="flex items-center gap-2 text-xs">
                    <span className="w-10 text-gray-500">{etiqueta}</span>
                    <input
                      type="date"
                      value={actual[campo] ?? ""}
                      onChange={(e) => onChange({ ...actual, [campo]: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                ))}
              </div>
            )}

            {activo && (
              <button
                type="button"
                onClick={limpiar}
                className="w-full mt-1.5 pt-1.5 border-t border-gray-100 text-xs text-primary hover:underline"
              >
                Quitar filtro
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}
