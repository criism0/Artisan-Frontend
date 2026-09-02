import { useEffect, useMemo, useRef, useState } from "react";
import { leerGuardado, escribirGuardado } from "../../hooks/useTablaPersistida";
import FiltroColumna from "./FiltroColumna";
import { filaPasaFiltros, contarFiltrosColumna } from "../../utils/filtrosColumna";
import Table from "./Table";
import SearchBar from "../UI/SearchBar";
import RowsPerPageSelector from "../UI/RowsPerPageSelector";
import Pagination from "../UI/Pagination";
import { PageLoader } from "../UI/PageLoader.jsx";

/**
 * Lista estándar de la app: header (título + acciones), toolbar (filas por
 * página + filtros colapsables + búsqueda), tabla con orden por columnas y
 * paginación. Encapsula la lógica de búsqueda/orden/paginación que antes se
 * copiaba en cada página, para que todas las listas se vean y se comporten
 * igual.
 *
 * Uso mínimo:
 *   <DataTable title="Proveedores" data={rows} columns={cols} actions={fn} />
 *
 * Columnas: { header, accessor, sortable, align, Cell, sortValue }
 *   - `Cell({ row, value })` renderiza la celda (opcional).
 *   - `sortValue(row)` da el valor de orden cuando el accessor no sirve
 *     directamente (p.ej. objetos anidados). Por defecto usa row[accessor].
 *   - `align`: "left" | "center" | "right" (default "left").
 *   - `hideable: false` deja la columna siempre visible (identificador, estado…).
 *   - `defaultHidden: true` la deja apagada hasta que alguien la encienda.
 *   - `filtro`: "valores" | "texto" | "numero" | "fecha" pone un embudo en su cabecera, al
 *     estilo de una planilla (pedido de Cristóbal, 2026-09-02). `filtroValor(row)` da el valor
 *     con el que se filtra cuando no sirve el accessor; si no está, se usa `sortValue`.
 *
 * `persistKey` hace que la lista RECUERDE cómo la dejaron: búsqueda, orden, filas por página,
 * panel de filtros y columnas visibles. Es lo que pidió Hernán —«que los filtros se mantengan
 * al volver del detalle»— y hasta ahora sólo lo hacía Inventario de Bultos, con su propio
 * código porque no usa este componente. Sin `persistKey` el comportamiento es exactamente el
 * de antes: nada se guarda.
 *
 * ⚠️ Los filtros PROPIOS de cada página (los del slot `filters`) los persiste la página, que es
 * la que sabe qué significan: para eso está `usePersistedState` en `hooks/useTablaPersistida`,
 * que usa el mismo `persistKey` para que todo se guarde y se borre junto.
 */
export default function DataTable({
  title,
  data = [],
  columns = [],
  actions,
  getSearchText,
  filterFn,
  headerActions = null,
  headerExtra = null,
  toolbarStart = null,
  filters = null,
  loading = false,
  loadingMessage = "Cargando…",
  initialSort = { key: null, direction: null },
  defaultRowsPerPage = 10,
  emptyMessage = "No hay elementos para mostrar.",
  stickyActions = false,
  renderExpandedRow,
  persistKey = null,
}) {
  // Se lee UNA vez, al montar. Si se leyera en cada render, volver de un detalle pisaría lo que
  // el usuario acaba de escribir con lo que había guardado antes.
  const guardado = useRef(leerGuardado(persistKey)).current;

  const [searchQuery, setSearchQuery] = useState(guardado?.q ?? "");
  const [sortConfig, setSortConfig] = useState(() => {
    const s = guardado?.sort;
    return s && typeof s.key === "string" && (s.direction === "asc" || s.direction === "desc")
      ? s
      : initialSort;
  });
  const [rowsPerPage, setRowsPerPage] = useState(
    Number.isFinite(guardado?.rows) ? guardado.rows : defaultRowsPerPage,
  );
  const [page, setPage] = useState(1);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(Boolean(guardado?.filtrosAbiertos));
  // Se guardan las OCULTAS y no las visibles: así una columna nueva aparece encendida para todos
  // en vez de quedar escondida para quien ya tenía preferencias guardadas.
  const [ocultas, setOcultas] = useState(() =>
    Array.isArray(guardado?.ocultas)
      ? new Set(guardado.ocultas)
      : new Set(columns.filter((c) => c.defaultHidden).map((c) => c.accessor)),
  );
  const [selectorColumnas, setSelectorColumnas] = useState(false);
  const [filtrosColumna, setFiltrosColumna] = useState(() =>
    guardado?.filtrosColumna && typeof guardado.filtrosColumna === "object"
      ? guardado.filtrosColumna
      : {},
  );

  useEffect(() => {
    escribirGuardado(persistKey, {
      q: searchQuery,
      sort: sortConfig,
      rows: rowsPerPage,
      filtrosAbiertos,
      ocultas: [...ocultas],
      filtrosColumna,
    });
  }, [persistKey, searchQuery, sortConfig, rowsPerPage, filtrosAbiertos, ocultas, filtrosColumna]);

  const nFiltrosColumna = contarFiltrosColumna(filtrosColumna);

  const cambiarFiltroColumna = (accessor, valor) => {
    setFiltrosColumna((prev) => ({ ...prev, [accessor]: valor }));
    setPage(1);
  };

  const ocultables = columns.filter((c) => c.hideable !== false);
  const columnasVisibles = useMemo(
    () => columns.filter((c) => c.hideable === false || !ocultas.has(c.accessor)),
    [columns, ocultas],
  );

  const normalize = (text) =>
    (text ?? "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  const columnByAccessor = useMemo(() => {
    const m = new Map();
    for (const c of columns) m.set(c.accessor, c);
    return m;
  }, [columns]);

  const sortValueFor = (row, key) => {
    const col = columnByAccessor.get(key);
    if (col?.sortValue) return col.sortValue(row);
    return row?.[key];
  };

  // 1) Filtros de columna, y DESPUÉS la búsqueda.
  //
  // En este orden a propósito: la búsqueda es un cedazo grueso sobre el texto de toda la fila y
  // los filtros de columna son precisos. Al revés, buscar "Renca" dentro de un filtro de comuna
  // ya puesto daría el mismo resultado, pero el conteo de valores del embudo se calcularía
  // sobre lo ya buscado y las opciones aparecerían y desaparecerían al escribir.
  const porColumna = useMemo(() => {
    if (nFiltrosColumna === 0) return data;
    return data.filter((row) => filaPasaFiltros(columns, filtrosColumna, row));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filtrosColumna, nFiltrosColumna]);

  const filtered = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return porColumna;
    if (typeof filterFn === "function") return porColumna.filter((row) => filterFn(row, searchQuery));
    return porColumna.filter((row) => {
      const text = getSearchText ? getSearchText(row) : JSON.stringify(row);
      return normalize(text).includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porColumna, searchQuery]);

  // 2) Orden
  const sorted = useMemo(() => {
    if (!sortConfig.key) return filtered;
    const { key, direction } = sortConfig;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = sortValueFor(a, key);
      const bVal = sortValueFor(b, key);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortConfig]);

  // 3) Paginación
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageRows = sorted.slice(startIndex, startIndex + rowsPerPage);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  };

  const alignClass = (align) =>
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "";

  const embudo = (col) =>
    col.filtro ? (
      <FiltroColumna
        col={col}
        // Las opciones del embudo se calculan sobre TODOS los datos, no sobre lo ya filtrado:
        // si se calcularan sobre el resultado, al marcar "Renca" desaparecerían las demás
        // comunas de la lista y no habría cómo agregar una segunda.
        data={data}
        filtro={filtrosColumna[col.accessor]}
        onChange={(v) => cambiarFiltroColumna(col.accessor, v)}
      />
    ) : null;

  const renderHeader = (col) => {
    // Una columna puede filtrarse sin ser ordenable (Comentario es el caso): sin esta rama, su
    // embudo no se dibujaría nunca.
    if (!col.sortable) {
      return col.filtro ? (
        <div className={`flex items-center gap-1 ${alignClass(col.align)}`}>
          {typeof col.header === "string" ? <span>{col.header}</span> : col.header}
          {embudo(col)}
        </div>
      ) : (
        col.header
      );
    }
    const active = sortConfig.key === col.accessor;
    const asc = active && sortConfig.direction === "asc";
    const desc = active && sortConfig.direction === "desc";
    return (
      <div
        className={`flex items-center gap-1 cursor-pointer select-none ${alignClass(col.align)}`}
        onClick={() => handleSort(col.accessor)}
      >
        {typeof col.header === "string" ? <span>{col.header}</span> : col.header}
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={asc ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={desc ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
        {embudo(col)}
      </div>
    );
  };

  // 🔴 `align` sólo se aplicaba al contenedor de la CABECERA, así que una columna numérica
  // mostraba el título a la derecha y los valores a la izquierda — se veía desalineada y
  // los montos no se podían comparar de un vistazo, que es justo para lo que sirve alinearlos.
  //
  // Va en DataTable y no en cada página porque `align` es su contrato: toda tabla que lo declare
  // debería alinear la columna entera.
  const claseTexto = (align) =>
    align === "center" ? "text-center" : align === "right" ? "text-right" : "";

  const renderedColumns = columnasVisibles.map((col) => ({
    ...col,
    header: renderHeader(col),
    headerClassName: [col.headerClassName, claseTexto(col.align)].filter(Boolean).join(" "),
    cellClassName: [col.cellClassName, claseTexto(col.align)].filter(Boolean).join(" "),
  }));

  if (loading) return <PageLoader message={loadingMessage} />;

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>

      {/* Contenido extra bajo el header (p. ej. tabs + KPIs) */}
      {headerExtra}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <RowsPerPageSelector
              value={rowsPerPage}
              onRowsChange={(v) => { setRowsPerPage(v); setPage(1); }}
            />
            {toolbarStart}
          </div>
          <div className="flex items-center gap-2">
            {/* 🔴 UN FILTRO QUE SE RECUERDA TIENE QUE VERSE SIEMPRE. Con `persistKey`, un filtro
                de columna sobrevive a cerrar la pestaña: sin este chip, alguien vuelve al día
                siguiente, ve 3 filas donde había 220 y no tiene forma de saber por qué. El
                embudo de la columna se marca, pero puede estar fuera de la pantalla — la tabla
                scrollea horizontal. */}
            {nFiltrosColumna > 0 && (
              <button
                type="button"
                onClick={() => setFiltrosColumna({})}
                className="px-3 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg text-sm hover:bg-amber-100 transition-colors"
                title="Quitar los filtros puestos en las columnas"
              >
                {nFiltrosColumna} columna{nFiltrosColumna > 1 ? "s" : ""} filtrada
                {nFiltrosColumna > 1 ? "s" : ""} ✕
              </button>
            )}
            {filters && (
              <button
                type="button"
                className="px-3 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
                onClick={() => setFiltrosAbiertos((v) => !v)}
              >
                {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
              </button>
            )}
            {/* Selector de columnas. Aparece sólo si alguna se puede ocultar, así que ninguna
                lista existente cambia hasta que declare columnas ocultables.

                🔴 Es la respuesta al ancho, no un adorno: la vista de OV pasó de 9 a 12
                columnas para poder mostrar lo que pidió Hernán, y el criterio rector de
                Cristóbal es «poco scroll». Sin esto, agregar una columna útil para una persona
                se la impone a todas. */}
            {ocultables.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  className="px-3 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectorColumnas((v) => !v)}
                >
                  Columnas{ocultas.size > 0 ? ` (${ocultables.length - ocultas.size}/${ocultables.length})` : ""}
                </button>
                {selectorColumnas && (
                  <>
                    {/* Capa transparente para cerrar al hacer clic afuera: sin ella el panel
                        queda abierto tapando la tabla que uno acaba de ir a mirar. */}
                    <div className="fixed inset-0 z-10" onClick={() => setSelectorColumnas(false)} />
                    <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[220px] max-h-[60vh] overflow-y-auto">
                      {ocultables.map((col) => (
                        <label
                          key={col.accessor}
                          className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!ocultas.has(col.accessor)}
                            onChange={() =>
                              setOcultas((prev) => {
                                const next = new Set(prev);
                                if (next.has(col.accessor)) next.delete(col.accessor);
                                else next.add(col.accessor);
                                return next;
                              })
                            }
                            className="accent-primary"
                          />
                          <span>{col.headerLabel ?? (typeof col.header === "string" ? col.header : col.accessor)}</span>
                        </label>
                      ))}
                      {ocultas.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setOcultas(new Set())}
                          className="w-full mt-1 pt-1.5 border-t border-gray-100 text-xs text-primary hover:underline"
                        >
                          Mostrar todas
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <SearchBar
              initialValue={searchQuery}
              onSearch={(q) => { setSearchQuery(q); setPage(1); }}
            />
          </div>
        </div>

        {filters && filtrosAbiertos && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            {filters}
          </div>
        )}
      </div>

      {/* Tabla */}
      {pageRows.length === 0 ? (
        <div className="bg-white rounded-lg shadow px-6 py-10 text-center text-gray-400">
          {searchQuery
            ? "No hay resultados para la búsqueda."
            : nFiltrosColumna > 0
              ? "Ninguna fila pasa los filtros puestos en las columnas."
              : emptyMessage}
        </div>
      ) : (
        <Table
          columns={renderedColumns}
          data={pageRows}
          actions={actions}
          stickyActions={stickyActions}
          renderExpandedRow={renderExpandedRow}
        />
      )}

      {/* Paginación */}
      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
