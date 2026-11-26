import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, apiBlob } from "../../lib/api";
import { createAndOpenSheet } from "../../lib/googleSheets";
import GoogleSheetsExportButton from "../../components/UI/GoogleSheetsExportButton";
import DividirBultoModal from "../../components/Pallets/DividirBultoModal";
import BarraInventario from "../../components/Inventario/BarraInventario";
import MenuAcciones from "../../components/UI/MenuAcciones";
import { toast } from "../../lib/toast";
import { Pencil, Scissors, SlidersHorizontal, Tag, X } from "lucide-react";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import Pagination from "../../components/UI/Pagination";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";
import { abreviaturaUnidad } from "../../utils/inventarioVista.js";

/**
 * Inventario → Bultos: la lista de bultos, paginada en el servidor (son miles).
 *
 * Rehecha en la Fase 5 de la revisión de UI (2026-11-25, maqueta aprobada por Cristóbal):
 *   · chips «Con stock» (por defecto), «Agotados» y «Mermas» con su conteo. Antes los 685
 *     bultos en cero salían junto a los que tienen stock, y las mermas eran un check aparte;
 *   · la tabla se ve como las demás listas (era una de las 38 hechas a mano), sin el ID interno
 *     (se sigue encontrando escribiéndolo entero en el buscador);
 *   · los rangos (formato, disponible, costo) van en un panel plegable, no en ocho casillas
 *     siempre abiertas;
 *   · al filtrar ya no se tapa la pantalla con un spinner: se atenúa la tabla y se sigue escribiendo;
 *   · `?item=…&bodega=…` llega desde «Ver en Bultos» de la vista de Stock.
 */

const TIPOS = [
  { value: "", label: "Todos los tipos" },
  { value: "I", label: "Insumos" },
  { value: "PIP", label: "En proceso (PIP)" },
  { value: "PT", label: "Terminados (PT)" },
];

const EXISTENCIAS = [
  { id: "con_stock", label: "Con stock", punto: "bg-green-500" },
  { id: "agotados", label: "Agotados", punto: "bg-gray-400" },
  { id: "mermas", label: "Mermas", punto: "bg-red-500" },
];

const RANGOS = [
  { label: "Formato", min: "peso_min", max: "peso_max" },
  { label: "Disponible", min: "disp_min", max: "disp_max" },
  { label: "Costo", min: "costo_min", max: "costo_max" },
];

const FILTROS_VACIOS = {
  id_bodega: "",
  clave_categoria: "",
  item: "",
  peso_min: "",
  peso_max: "",
  disp_min: "",
  disp_max: "",
  costo_min: "",
  costo_max: "",
};

// v2: cambiaron los filtros (salieron ID, identificador y pallet como casillas; entró la existencia).
const STORAGE_KEY = "inventario_bultos_ui_v2";

const TONO_CLAVE = {
  M: "bg-red-100 text-red-700",
  PT: "bg-green-100 text-green-700",
  PIP: "bg-amber-100 text-amber-800",
  I: "bg-blue-100 text-blue-700",
};
const NOMBRE_CLAVE = { M: "Merma", PT: "Producto terminado", PIP: "En proceso", I: "Insumo" };

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";
const chipOn = "border-primary bg-primary-light text-primary font-medium";
const chipOff = "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";
const campo = "border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm";

const getBodegaNombre = (b) => b?.Bodega?.nombre ?? b?.bodega?.nombre ?? "(sin bodega)";
const getPalletIdentificador = (b) => b?.Pallet?.identificador ?? b?.pallet?.identificador ?? "";
const getItemNombre = (b) =>
  b?.materiaPrima?.nombre ?? b?.loteProductoFinal?.productoBase?.nombre ?? b?.ProductoBase?.nombre ?? "Desconocido";
const getUnidadMedida = (b) =>
  b?.materiaPrima?.unidad_medida ?? b?.loteProductoFinal?.productoBase?.unidad_medida ?? "";
const getClaveCategoria = (b) => b?.clave_categoria ?? (b?.es_merma ? "M" : b?.categoria) ?? "";

// Fecha en que el bulto ingresó al sistema (incluye los resultantes de una división), DD/MM/YYYY.
function formatFechaIngreso(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const conUnidad = (n, unidad, dec = 2) => `${formatNumberCL(n, dec)} ${abreviaturaUnidad(unidad)}`.trim();

/**
 * Encabezado que ordena al hacer clic. Vive fuera del componente a propósito: definido adentro,
 * cada render creaba un tipo nuevo y React volvía a montar el `<thead>` entero.
 */
function SortHeader({ label, sortKey, sort, onToggle, align = "left" }) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider ${align === "right" ? "flex-row-reverse" : ""}`}
      title="Ordenar"
    >
      <span>{label}</span>
      <span className={`text-[10px] ${active ? "text-gray-700" : "text-gray-300"}`}>
        {active && sort.dir === "desc" ? "▼" : "▲"}
      </span>
    </button>
  );
}

function leerGuardado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function InventarioBultos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Lo guardado se lee una vez, al montar; un enlace con `?item=` (desde Stock) manda sobre eso.
  const inicial = useRef(null);
  if (inicial.current === null) {
    const g = leerGuardado() ?? {};
    const item = searchParams.get("item");
    const desdeStock = item != null;
    inicial.current = {
      busqueda: desdeStock ? "" : typeof g.busqueda === "string" ? g.busqueda : "",
      filters: desdeStock
        ? { ...FILTROS_VACIOS, item, id_bodega: searchParams.get("bodega") ?? "" }
        : { ...FILTROS_VACIOS, ...(g.filters && typeof g.filters === "object" ? g.filters : {}) },
      existencia: desdeStock ? "con_stock" : EXISTENCIAS.some((e) => e.id === g.existencia) ? g.existencia : "con_stock",
      sort: g.sort?.key && (g.sort.dir === "asc" || g.sort.dir === "desc") ? g.sort : { key: "updatedAt", dir: "desc" },
    };
  }

  const [bodegas, setBodegas] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [busqueda, setBusqueda] = useState(inicial.current.busqueda);
  const [filters, setFilters] = useState(inicial.current.filters);
  const [existencia, setExistencia] = useState(inicial.current.existencia);
  const [sort, setSort] = useState(inicial.current.sort);
  const [rangosAbiertos, setRangosAbiertos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [bultoADividir, setBultoADividir] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [conteos, setConteos] = useState(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isExporting, setIsExporting] = useState(false);

  const canWriteBulk = checkScope(ModelType.BULTO, ScopeType.WRITE);

  // El `?item=` ya se aplicó: se saca de la URL para que recargar no pise lo que se cambie después.
  useEffect(() => {
    if (searchParams.has("item") || searchParams.has("bodega")) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ busqueda, filters, sort, existencia }));
    } catch {
      // Sin storage disponible: no bloquea la UI.
    }
  }, [busqueda, filters, sort, existencia]);

  useEffect(() => {
    api("/bodegas")
      .then((res) => setBodegas(Array.isArray(res?.bodegas) ? res.bodegas : []))
      .catch((error) => console.error("Error al obtener bodegas:", error));
  }, []);

  const buildQueryParams = ({ paginado = true } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== "" && v != null) qs.set(k, String(v).trim());
    }
    // Las mermas no tienen tipo propio (su clave es «M»): con el chip Mermas el tipo no aplica.
    if (existencia === "mermas") qs.delete("clave_categoria");
    if (busqueda.trim()) qs.set("q", busqueda.trim());
    qs.set("existencia", existencia);
    qs.set("sort_key", sort.key);
    qs.set("sort_dir", sort.dir);
    if (paginado) {
      qs.set("page", String(page));
      qs.set("limit", String(limit));
      qs.set("con_conteos", "true");
    }
    return qs;
  };

  const fetchBultos = async () => {
    setCargando(true);
    try {
      const res = await api(`/inventario/bultos?${buildQueryParams().toString()}`);
      setBultos(Array.isArray(res?.rows) ? res.rows : []);
      setTotal(Number(res?.count) || 0);
      setTotalPages(Number(res?.total_pages) || 1);
      setConteos(res?.conteos ?? null);
    } catch (error) {
      console.error("Error al obtener bultos:", error);
      toast.error("No se pudieron cargar los bultos");
    } finally {
      setCargando(false);
      setIsInitialLoading(false);
    }
  };

  // Cambios de filtros/búsqueda/orden: debounce y volver a la página 1.
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) { isFirstFilterRun.current = false; return; }
    const t = setTimeout(() => {
      setSelectedIds(new Set());
      if (page !== 1) setPage(1);
      else fetchBultos();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, busqueda, sort, existencia]);

  // Cambios de página/tamaño: fetch inmediato (también cubre la carga inicial).
  useEffect(() => {
    fetchBultos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const toggleSort = (key) =>
    setSort((prev) => (prev.key !== key ? { key, dir: "asc" } : { key, dir: prev.dir === "asc" ? "desc" : "asc" }));

  const generarEtiqueta = async (bulto) => {
    try {
      const blob = await apiBlob("/bultos/etiquetas", {
        method: "POST",
        body: JSON.stringify({ ids_bultos: [bulto.id] }),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiqueta_${bulto.identificador || bulto.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar etiqueta:", error);
      toast.error("No se pudo descargar la etiqueta");
    }
  };

  const toggleSelectAll = (checked) => setSelectedIds(checked ? new Set(bultos.map((b) => b.id)) : new Set());
  const toggleSelectOne = (id, checked) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });

  const HEADERS_BULTOS = [
    "ID", "Identificador", "Categoría", "Bodega", "Pallet", "Ítem",
    "Unidad medida", "Peso unitario", "Unidades disponibles", "Cantidad unidades",
    "Total disponible", "Total cantidad", "Costo unitario", "Costo total", "Última actualización",
    "Fecha ingreso",
  ];

  const rowsToValues = (list) =>
    list.map((b) => {
      const pesoUnit = Number(b?.peso_unitario ?? 0);
      const unidadesDisp = Number(b?.unidades_disponibles ?? 0);
      const unidadesTot = Number(b?.cantidad_unidades ?? 0);
      const costoUnit = Number(b?.costo_unitario ?? 0);
      return [
        b?.id ?? "", b?.identificador ?? "", getClaveCategoria(b), getBodegaNombre(b), getPalletIdentificador(b),
        getItemNombre(b), getUnidadMedida(b), pesoUnit, unidadesDisp, unidadesTot,
        unidadesDisp * pesoUnit, unidadesTot * pesoUnit, costoUnit, costoUnit * unidadesDisp, b?.updatedAt ?? "",
        formatFechaIngreso(b?.createdAt),
      ];
    });

  const exportarASheets = async ({ access_token }) => {
    const hasSelection = selectedIds.size > 0;
    let data;
    if (hasSelection) {
      data = bultos.filter((b) => selectedIds.has(b.id));
    } else {
      // Export completo: mismo filtro, sin paginar (el server lo resuelve).
      const res = await api(`/inventario/bultos?${buildQueryParams({ paginado: false }).toString()}`);
      data = Array.isArray(res) ? res : [];
    }
    if (data.length === 0) { toast.error("No hay datos para exportar"); return; }
    try {
      setIsExporting(true);
      const title = hasSelection
        ? `Bultos seleccionados ${new Date().toLocaleDateString("es-CL")}`
        : `Inventario Bultos ${new Date().toLocaleDateString("es-CL")}`;
      const url = await createAndOpenSheet(access_token, title, [HEADERS_BULTOS, ...rowsToValues(data)]);
      toast.link("Hoja creada", url);
    } catch {
      toast.error("Error al exportar a Google Sheets");
    } finally {
      setIsExporting(false);
    }
  };

  const setFiltro = (clave, valor) => setFilters((p) => ({ ...p, [clave]: valor }));
  const nRangos = RANGOS.reduce((n, r) => n + (filters[r.min] !== "" ? 1 : 0) + (filters[r.max] !== "" ? 1 : 0), 0);
  const hayFiltros = Boolean(busqueda || filters.id_bodega || filters.clave_categoria || filters.item || nRangos);
  const limpiar = () => { setBusqueda(""); setFilters({ ...FILTROS_VACIOS }); };
  const limpiarRangos = () =>
    setFilters((p) => ({ ...p, ...Object.fromEntries(RANGOS.flatMap((r) => [[r.min, ""], [r.max, ""]])) }));

  if (isInitialLoading) return <PageLoader message="Cargando bultos" />;

  const desde = total === 0 ? 0 : (page - 1) * limit + 1;
  const hasta = Math.min(page * limit, total);
  const th = "px-4 py-3 text-left text-xs font-medium text-text";
  const td = "px-4 py-3 text-sm text-text align-top";

  return (
    <>
      <div className="px-6 pt-6">
        <BarraInventario />
      </div>
      <div className="p-6 bg-background min-h-screen">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-text">Bultos</h1>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="text-xs text-gray-500">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
            )}
            <GoogleSheetsExportButton
              onToken={exportarASheets}
              onError={() => toast.error("No se pudo autenticar con Google")}
              isExporting={isExporting}
              disabled={isExporting || total === 0}
              etiqueta="Exportar"
              title={selectedIds.size ? `Exportar ${selectedIds.size} seleccionado(s) a Google Sheets` : "Exportar lo filtrado a Google Sheets"}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por existencia">
          {EXISTENCIAS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={existencia === e.id}
              onClick={() => setExistencia(e.id)}
              className={`${chipBase} ${existencia === e.id ? chipOn : chipOff}`}
            >
              <span className={`h-2 w-2 rounded-full ${e.punto}`} aria-hidden="true" />
              {e.label}
              {conteos && <b className="font-semibold tabular-nums">{formatNumberCL(conteos[e.id] ?? 0, 0)}</b>}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Bodega" className={campo} value={filters.id_bodega} onChange={(e) => setFiltro("id_bodega", e.target.value)}>
              <option value="">Todas las bodegas</option>
              {bodegas.map((b) => <option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
            </select>
            <select
              aria-label="Tipo"
              className={`${campo} disabled:text-gray-400`}
              value={existencia === "mermas" ? "" : filters.clave_categoria}
              disabled={existencia === "mermas"}
              title={existencia === "mermas" ? "Las mermas no se separan por tipo" : undefined}
              onChange={(e) => setFiltro("clave_categoria", e.target.value)}
            >
              {TIPOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setRangosAbiertos((v) => !v)}
              aria-expanded={rangosAbiertos}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                nRangos || rangosAbiertos ? "border-primary/30 bg-primary-light text-primary" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Rangos{nRangos ? ` · ${nRangos}` : ""}
            </button>
            {filters.item && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-sm text-primary">
                Ítem: {filters.item}
                <button type="button" onClick={() => setFiltro("item", "")} aria-label="Quitar el filtro de ítem" className="hover:text-primary-dark">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {hayFiltros && (
              <button type="button" onClick={limpiar} className="text-sm text-gray-500 hover:text-red-600">
                Limpiar filtros
              </button>
            )}
            {cargando && <span className="text-sm text-primary">Actualizando…</span>}
          </div>
          <input
            type="search"
            aria-label="Buscar bultos"
            placeholder="Identificador, ítem, pallet o ID…"
            className={`${campo} w-72 max-w-full`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {rangosAbiertos && (
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600">
            {RANGOS.map((r) => (
              <label key={r.label} className="flex items-center gap-2">
                <span className="font-medium text-gray-700">{r.label}</span>
                <input inputMode="decimal" aria-label={`${r.label} mínimo`} placeholder="mín" className="w-20 rounded-md border border-gray-300 px-2 py-1" value={filters[r.min]} onChange={(e) => setFiltro(r.min, e.target.value)} />
                a
                <input inputMode="decimal" aria-label={`${r.label} máximo`} placeholder="máx" className="w-20 rounded-md border border-gray-300 px-2 py-1" value={filters[r.max]} onChange={(e) => setFiltro(r.max, e.target.value)} />
              </label>
            ))}
            {nRangos > 0 && (
              <button type="button" onClick={limpiarRangos} className="ml-auto text-sm font-medium text-primary hover:underline">
                Limpiar rangos
              </button>
            )}
          </div>
        )}

        <div className={`bg-white rounded-lg shadow overflow-hidden transition-opacity ${cargando ? "opacity-60" : ""}`}>
          <div className="w-full overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50 uppercase">
                <tr>
                  <th className={`${th} w-10`}>
                    <input
                      type="checkbox"
                      checked={bultos.length > 0 && selectedIds.size === bultos.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      aria-label="Seleccionar la página"
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className={th}><SortHeader label="Tipo" sortKey="clave_categoria" sort={sort} onToggle={toggleSort} /></th>
                  <th className={th}><SortHeader label="Identificador" sortKey="identificador" sort={sort} onToggle={toggleSort} /></th>
                  <th className={th}><SortHeader label="Ítem" sortKey="item" sort={sort} onToggle={toggleSort} /></th>
                  <th className={th}><SortHeader label="Bodega" sortKey="bodega" sort={sort} onToggle={toggleSort} /></th>
                  <th className={`${th} text-right`}><SortHeader label="Formato" sortKey="peso_unitario" sort={sort} onToggle={toggleSort} align="right" /></th>
                  <th className={`${th} text-right`}><SortHeader label="Disponible" sortKey="disponible" sort={sort} onToggle={toggleSort} align="right" /></th>
                  <th className={`${th} text-right`}><SortHeader label="Costo" sortKey="costo" sort={sort} onToggle={toggleSort} align="right" /></th>
                  <th className={th}><SortHeader label="Ingreso" sortKey="fecha_ingreso" sort={sort} onToggle={toggleSort} /></th>
                  <th className={`${th} text-right tracking-wider`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!cargando && bultos.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={10}>
                      No hay bultos para estos filtros.
                    </td>
                  </tr>
                )}
                {bultos.map((b) => {
                  const unidad = getUnidadMedida(b);
                  const clave = getClaveCategoria(b);
                  const pallet = getPalletIdentificador(b);
                  const disponible = Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0);
                  const costoTotal = Number(b.costo_unitario || 0) * Number(b.unidades_disponibles || 0);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className={td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(b.id)}
                          onChange={(e) => toggleSelectOne(b.id, e.target.checked)}
                          aria-label={`Seleccionar bulto ${b.identificador || b.id}`}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className={td}>
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TONO_CLAVE[clave] ?? "bg-gray-100 text-gray-600"}`} title={NOMBRE_CLAVE[clave]}>
                          {clave || "—"}
                        </span>
                      </td>
                      <td className={`${td} font-mono text-xs`} title={`ID ${b.id}`}>{b.identificador}</td>
                      <td className={td}><span className="block max-w-[280px] truncate" title={getItemNombre(b)}>{getItemNombre(b)}</span></td>
                      <td className={td}>
                        {getBodegaNombre(b)}
                        {pallet && <span className="block text-xs text-gray-400">{pallet}</span>}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{conUnidad(b.peso_unitario, unidad)}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        <span className={disponible > 0 ? "font-medium" : "text-gray-400"}>{conUnidad(disponible, unidad)}</span>
                        <span className="block text-xs text-gray-400">{formatNumberCL(b.unidades_disponibles, 2)}/{b.cantidad_unidades} un.</span>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{formatCLP(costoTotal, 0)}</td>
                      <td className={`${td} whitespace-nowrap text-gray-500`}>{formatFechaIngreso(b.createdAt)}</td>
                      <td className={td}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => generarEtiqueta(b)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary"
                            title="Descargar etiqueta"
                            aria-label={`Descargar la etiqueta de ${b.identificador}`}
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <MenuAcciones
                            items={[
                              canWriteBulk && { label: "Editar bulto", icon: <Pencil className="w-4 h-4" />, onClick: () => navigate(`/inventario/bultos/${b.id}/editar`) },
                              { label: "Dividir bulto", icon: <Scissors className="w-4 h-4" />, onClick: () => setBultoADividir(b) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <RowsPerPageSelector
            value={limit}
            options={[10, 25, 50, 100, 200]}
            onRowsChange={(n) => { setLimit(n); setPage(1); }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500 tabular-nums">
              {formatNumberCL(desde, 0)}–{formatNumberCL(hasta, 0)} de {formatNumberCL(total, 0)}
            </span>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
          </div>
        </div>

        {bultoADividir && (
          <DividirBultoModal
            bulto={bultoADividir}
            onClose={() => setBultoADividir(null)}
            onSuccess={fetchBultos}
          />
        )}
      </div>
    </>
  );
}
