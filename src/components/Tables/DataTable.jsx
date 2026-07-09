import { useMemo, useState } from "react";
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
 */
export default function DataTable({
  title,
  data = [],
  columns = [],
  actions,
  getSearchText,
  filterFn,
  headerActions = null,
  toolbarStart = null,
  filters = null,
  loading = false,
  loadingMessage = "Cargando…",
  initialSort = { key: null, direction: null },
  defaultRowsPerPage = 10,
  emptyMessage = "No hay elementos para mostrar.",
  stickyActions = false,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [page, setPage] = useState(1);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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

  // 1) Búsqueda
  const filtered = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return data;
    if (typeof filterFn === "function") return data.filter((row) => filterFn(row, searchQuery));
    return data.filter((row) => {
      const text = getSearchText ? getSearchText(row) : JSON.stringify(row);
      return normalize(text).includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, searchQuery]);

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

  const renderHeader = (col) => {
    if (!col.sortable) return col.header;
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
      </div>
    );
  };

  const renderedColumns = columns.map((col) => ({
    ...col,
    header: renderHeader(col),
  }));

  if (loading) return <PageLoader message={loadingMessage} />;

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {headerActions && <div className="flex flex-wrap gap-2">{headerActions}</div>}
      </div>

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
            {filters && (
              <button
                type="button"
                className="px-3 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
                onClick={() => setFiltrosAbiertos((v) => !v)}
              >
                {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
              </button>
            )}
            <SearchBar onSearch={(q) => { setSearchQuery(q); setPage(1); }} />
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
          {searchQuery ? "No hay resultados para la búsqueda." : emptyMessage}
        </div>
      ) : (
        <Table columns={renderedColumns} data={pageRows} actions={actions} stickyActions={stickyActions} />
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
