import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { api, apiBlob } from "../../lib/api";
import DividirBultoModal from "../../components/DividirBultoModal";
import { toast } from "../../lib/toast";
import { Download, FileDown, FileSpreadsheet, Pencil, Scissors, X } from "lucide-react";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";
import {
  checkScope,
  isAdminOrSuperAdmin,
  ModelType,
  ScopeType,
} from "../../services/scopeCheck";

const CATEGORIAS = [
  { value: "", label: "Todas" },
  { value: "I", label: "Insumos (I)" },
  { value: "PIP", label: "PIP" },
  { value: "PT", label: "PT" },
  { value: "M", label: "Merma (M)" },
];

const STORAGE_KEY = "inventario_bultos_ui_v1";

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getBodegaNombre(b) {
  return b?.Bodega?.nombre ?? b?.bodega?.nombre ?? "(sin bodega)";
}

function getPalletIdentificador(b) {
  return b?.Pallet?.identificador ?? b?.pallet?.identificador ?? "";
}

function getItemNombre(b) {
  return (
    b?.materiaPrima?.nombre ??
    b?.loteProductoFinal?.productoBase?.nombre ??
    b?.ProductoBase?.nombre ??
    "Desconocido"
  );
}

function getUnidadMedida(b) {
  return (
    b?.materiaPrima?.unidad_medida ??
    b?.loteProductoFinal?.productoBase?.unidad_medida ??
    ""
  );
}

function getClaveCategoria(b) {
  return b?.clave_categoria ?? (b?.es_merma ? "M" : b?.categoria) ?? "";
}

function BadgeCategoria({ value }) {
  const v = value || "";
  const base = "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold";
  if (v === "M") return <span className={`${base} bg-red-100 text-red-700`}>M</span>;
  if (v === "PT") return <span className={`${base} bg-green-100 text-green-700`}>PT</span>;
  if (v === "PIP") return <span className={`${base} bg-amber-100 text-amber-800`}>PIP</span>;
  if (v === "I") return <span className={`${base} bg-blue-100 text-blue-700`}>I</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
}

export default function InventarioBultos() {
  const navigate = useNavigate();
  const [bodegas, setBodegas] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [bultoADividir, setBultoADividir] = useState(null);

  const [filters, setFilters] = useState({
    id_bodega: "",
    clave_categoria: "",
    id: "",
    identificador: "",
    item: "",
    pallet: "",
    peso_min: "",
    peso_max: "",
    disp_min: "",
    disp_max: "",
    costo_min: "",
    costo_max: "",
  });

  const [sort, setSort] = useState({ key: "updatedAt", dir: "desc" });

  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const canEditBulto =
    checkScope(ModelType.BULTO, ScopeType.WRITE) || isAdminOrSuperAdmin();

  // Restaurar filtros/orden desde localStorage (experiencia tipo Excel)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === "object") {
        if (typeof parsed.busqueda === "string") setBusqueda(parsed.busqueda);
        if (parsed.filters && typeof parsed.filters === "object") {
          setFilters((prev) => ({ ...prev, ...parsed.filters }));
        }
        if (parsed.sort && typeof parsed.sort === "object") {
          if (typeof parsed.sort.key === "string" && (parsed.sort.dir === "asc" || parsed.sort.dir === "desc")) {
            setSort({ key: parsed.sort.key, dir: parsed.sort.dir });
          }
        }
      }
    } catch {
      // Si el storage está corrupto, lo ignoramos.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir filtros/orden
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          busqueda,
          filters,
          sort,
        })
      );
    } catch {
      // Sin storage disponible: no bloquea la UI.
    }
  }, [busqueda, filters, sort]);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await api("/bodegas");
        if (res && Array.isArray(res.bodegas)) {
          setBodegas(res.bodegas);
        }
      } catch (error) {
        console.error("Error al obtener bodegas:", error);
      }
    };
    fetchBodegas();
  }, []);

  const fetchBultos = async () => {
    setCargando(true);
    try {
      const qs = new URLSearchParams();
      if (filters.id_bodega) qs.set("id_bodega", filters.id_bodega);
      const path = qs.toString() ? `/inventario/bultos?${qs.toString()}` : "/inventario/bultos";
      const res = await api(path);
      setBultos(Array.isArray(res) ? res : []);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error al obtener bultos:", error);
      toast.error("No se pudieron cargar los bultos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchBultos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.id_bodega]);

  const bultosFiltrados = useMemo(() => {
    const q = (busqueda || "").toLowerCase().trim();

    const idNeedle = (filters.id || "").trim();
    const identNeedle = (filters.identificador || "").toLowerCase().trim();
    const itemNeedle = (filters.item || "").toLowerCase().trim();
    const palletNeedle = (filters.pallet || "").toLowerCase().trim();
    const categoriaNeedle = (filters.clave_categoria || "").trim();

    const pesoMin = toNumberOrNull(filters.peso_min);
    const pesoMax = toNumberOrNull(filters.peso_max);
    const dispMin = toNumberOrNull(filters.disp_min);
    const dispMax = toNumberOrNull(filters.disp_max);
    const costoMin = toNumberOrNull(filters.costo_min);
    const costoMax = toNumberOrNull(filters.costo_max);

    return (bultos || []).filter((b) => {
      if (idNeedle) {
        if (!String(b?.id ?? "").includes(idNeedle)) return false;
      }

      if (identNeedle) {
        if (!String(b?.identificador ?? "").toLowerCase().includes(identNeedle)) return false;
      }

      const itemNombre = getItemNombre(b).toLowerCase();
      if (itemNeedle && !itemNombre.includes(itemNeedle)) return false;

      const palletId = getPalletIdentificador(b).toLowerCase();
      if (palletNeedle && !palletId.includes(palletNeedle)) return false;

      const clave = getClaveCategoria(b);
      if (categoriaNeedle && clave !== categoriaNeedle) return false;

      const peso = Number(b?.peso_unitario ?? 0);
      if (pesoMin != null && !(peso >= pesoMin)) return false;
      if (pesoMax != null && !(peso <= pesoMax)) return false;

      const disponible = Number(b?.unidades_disponibles ?? 0) * Number(b?.peso_unitario ?? 0);
      if (dispMin != null && !(disponible >= dispMin)) return false;
      if (dispMax != null && !(disponible <= dispMax)) return false;

      const costoTotal = Number(b?.costo_unitario ?? 0) * Number(b?.unidades_disponibles ?? 0);
      if (costoMin != null && !(costoTotal >= costoMin)) return false;
      if (costoMax != null && !(costoTotal <= costoMax)) return false;

      if (q) {
        const hay = `${b?.identificador ?? ""} ${itemNombre} ${getBodegaNombre(b)} ${palletId}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [bultos, busqueda, filters]);

  const bultosOrdenados = useMemo(() => {
    const list = [...bultosFiltrados];
    const dir = sort.dir === "asc" ? 1 : -1;

    const getSortable = (b) => {
      switch (sort.key) {
        case "clave_categoria":
          return getClaveCategoria(b) || "";
        case "id":
          return Number(b?.id ?? 0);
        case "identificador":
          return String(b?.identificador ?? "");
        case "item":
          return getItemNombre(b);
        case "bodega":
          return getBodegaNombre(b);
        case "pallet":
          return getPalletIdentificador(b);
        case "peso_unitario":
          return Number(b?.peso_unitario ?? 0);
        case "disponible":
          return Number(b?.unidades_disponibles ?? 0) * Number(b?.peso_unitario ?? 0);
        case "costo":
          return Number(b?.costo_unitario ?? 0) * Number(b?.unidades_disponibles ?? 0);
        case "updatedAt":
        default:
          return new Date(b?.updatedAt ?? b?.createdAt ?? 0).getTime();
      }
    };

    list.sort((a, b) => {
      const va = getSortable(a);
      const vb = getSortable(b);

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb), "es", { numeric: true, sensitivity: "base" }) * dir;
    });

    return list;
  }, [bultosFiltrados, sort]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const SortHeader = ({ label, sortKey, className }) => {
    const active = sort.key === sortKey;
    const arrow = !active ? "" : sort.dir === "asc" ? "▲" : "▼";
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className={`w-full text-left font-semibold ${className || ""}`}
        title="Ordenar"
      >
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          <span className={`text-[10px] ${active ? "text-gray-700" : "text-gray-300"}`}>{arrow || "▲"}</span>
        </span>
      </button>
    );
  };

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
      toast.error("No se pudo descargar la etiqueta. Revisa la consola.");
    }
  };

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    const next = new Set();
    bultosOrdenados.forEach((b) => next.add(b.id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const exportToExcel = (rows, fileName) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Bultos");
    XLSX.writeFile(book, fileName);
  };

  const buildExportRows = (list) => {
    return list.map((b) => {
      const unidad = getUnidadMedida(b);
      const item = getItemNombre(b);
      const bodega = getBodegaNombre(b);
      const pallet = getPalletIdentificador(b);
      const clave = getClaveCategoria(b);

      const pesoUnit = Number(b?.peso_unitario ?? 0);
      const unidadesDisp = Number(b?.unidades_disponibles ?? 0);
      const unidadesTot = Number(b?.cantidad_unidades ?? 0);
      const totalDisp = unidadesDisp * pesoUnit;
      const totalTot = unidadesTot * pesoUnit;
      const costoUnit = Number(b?.costo_unitario ?? 0);
      const costoTot = costoUnit * unidadesDisp;

      return {
        id: b?.id ?? "",
        identificador: b?.identificador ?? "",
        clave_categoria: clave,
        bodega,
        pallet,
        item,
        unidad_medida: unidad,
        peso_unitario: pesoUnit,
        unidades_disponibles: unidadesDisp,
        cantidad_unidades: unidadesTot,
        total_disponible: totalDisp,
        total_cantidad: totalTot,
        costo_unitario: costoUnit,
        costo_total: costoTot,
        updatedAt: b?.updatedAt ?? "",
      };
    });
  };

  const exportSelected = () => {
    const sel = bultosOrdenados.filter((b) => selectedIds.has(b.id));
    if (sel.length === 0) {
      toast.error("No hay filas seleccionadas");
      return;
    }
    exportToExcel(buildExportRows(sel), `inventario_bultos_seleccionados.xlsx`);
  };

  const exportFiltered = () => {
    if (bultosOrdenados.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    exportToExcel(buildExportRows(bultosOrdenados), `inventario_bultos_filtrados.xlsx`);
  };

  const clearFilters = () => {
    setBusqueda("");
    setFilters((prev) => ({
      ...prev,
      clave_categoria: "",
      id: "",
      identificador: "",
      item: "",
      pallet: "",
      peso_min: "",
      peso_max: "",
      disp_min: "",
      disp_max: "",
      costo_min: "",
      costo_max: "",
    }));
  };



  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Inventario de Bultos</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={exportSelected}
            className="text-gray-500 hover:text-green-700"
            title="Exportar seleccionados (Excel)"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
          <button
            onClick={exportFiltered}
            className="text-gray-500 hover:text-green-700"
            title="Exportar filtrados (Excel)"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={clearFilters}
            className="text-gray-500 hover:text-red-600"
            title="Limpiar filtros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-semibold mb-1">Bodega</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={filters.id_bodega}
              onChange={(e) => setFilters((p) => ({ ...p, id_bodega: e.target.value }))}
            >
              <option value="">Todas las bodegas</option>
              {bodegas.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nombre} — {b.comuna}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Categoría</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={filters.clave_categoria}
              onChange={(e) => setFilters((p) => ({ ...p, clave_categoria: e.target.value }))}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1">Búsqueda</label>
            <input
              type="text"
              placeholder="Identificador, item, bodega, pallet…"
              className="border rounded px-3 py-2 w-full"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3 flex flex-wrap gap-4">
          <div>
            Filas: <span className="font-semibold">{bultosOrdenados.length}</span> / {bultos.length}
          </div>
          <div>
            Seleccionadas: <span className="font-semibold">{selectedIds.size}</span>
          </div>
        </div>
      </div>

      {cargando ? (
        <p className="text-gray-600">Cargando bultos...</p>
      ) : null}

      <div className="overflow-x-auto bg-white shadow rounded">
        <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border w-10 text-center">
                  <input
                    type="checkbox"
                    checked={bultosOrdenados.length > 0 && selectedIds.size === bultosOrdenados.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label="Seleccionar todo"
                  />
                </th>
                <th className="p-2 border"><SortHeader label="Cat" sortKey="clave_categoria" /></th>
                <th className="p-2 border"><SortHeader label="ID" sortKey="id" /></th>
                <th className="p-2 border"><SortHeader label="Identificador" sortKey="identificador" /></th>
                <th className="p-2 border"><SortHeader label="Item" sortKey="item" /></th>
                <th className="p-2 border"><SortHeader label="Bodega" sortKey="bodega" /></th>
                <th className="p-2 border"><SortHeader label="Pallet" sortKey="pallet" /></th>
                <th className="p-2 border"><SortHeader label="Formato" sortKey="peso_unitario" /></th>
                <th className="p-2 border"><SortHeader label="Disponible" sortKey="disponible" /></th>
                <th className="p-2 border"><SortHeader label="Costo" sortKey="costo" /></th>
                <th className="p-2 border w-28 text-center">Acciones</th>
              </tr>

              <tr className="bg-white">
                <th className="p-1 border"></th>
                <th className="p-1 border"></th>
                <th className="p-1 border">
                  <input
                    className="border rounded px-2 py-1 w-24"
                    placeholder="filtrar"
                    value={filters.id}
                    onChange={(e) => setFilters((p) => ({ ...p, id: e.target.value }))}
                  />
                </th>
                <th className="p-1 border">
                  <input
                    className="border rounded px-2 py-1 w-52"
                    placeholder="filtrar"
                    value={filters.identificador}
                    onChange={(e) => setFilters((p) => ({ ...p, identificador: e.target.value }))}
                  />
                </th>
                <th className="p-1 border">
                  <input
                    className="border rounded px-2 py-1 w-56"
                    placeholder="filtrar"
                    value={filters.item}
                    onChange={(e) => setFilters((p) => ({ ...p, item: e.target.value }))}
                  />
                </th>
                <th className="p-1 border"></th>
                <th className="p-1 border">
                  <input
                    className="border rounded px-2 py-1 w-32"
                    placeholder="filtrar"
                    value={filters.pallet}
                    onChange={(e) => setFilters((p) => ({ ...p, pallet: e.target.value }))}
                  />
                </th>
                <th className="p-1 border">
                  <div className="flex gap-1">
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="min"
                      value={filters.peso_min}
                      onChange={(e) => setFilters((p) => ({ ...p, peso_min: e.target.value }))}
                    />
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="max"
                      value={filters.peso_max}
                      onChange={(e) => setFilters((p) => ({ ...p, peso_max: e.target.value }))}
                    />
                  </div>
                </th>
                <th className="p-1 border">
                  <div className="flex gap-1">
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="min"
                      value={filters.disp_min}
                      onChange={(e) => setFilters((p) => ({ ...p, disp_min: e.target.value }))}
                    />
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="max"
                      value={filters.disp_max}
                      onChange={(e) => setFilters((p) => ({ ...p, disp_max: e.target.value }))}
                    />
                  </div>
                </th>
                <th className="p-1 border">
                  <div className="flex gap-1">
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="min"
                      value={filters.costo_min}
                      onChange={(e) => setFilters((p) => ({ ...p, costo_min: e.target.value }))}
                    />
                    <input
                      className="border rounded px-2 py-1 w-20"
                      placeholder="max"
                      value={filters.costo_max}
                      onChange={(e) => setFilters((p) => ({ ...p, costo_max: e.target.value }))}
                    />
                  </div>
                </th>
                <th className="p-1 border"></th>
              </tr>
            </thead>
            <tbody>
              {!cargando && bultosOrdenados.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-600" colSpan={11}>
                    No hay bultos para los filtros actuales.
                  </td>
                </tr>
              ) : null}

              {bultosOrdenados.map((b) => {
                const unidad = getUnidadMedida(b);
                const nombre = getItemNombre(b);
                const bodegaNombre = getBodegaNombre(b);
                const palletIdent = getPalletIdentificador(b);

                const cantidadDisponibleNum =
                  Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0);
                const cantidadDisponible = formatNumberCL(cantidadDisponibleNum, 2);

                const costoTotal =
                  Number(b.costo_unitario || 0) * Number(b.unidades_disponibles || 0);
                const checked = selectedIds.has(b.id);
                
                return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleSelectOne(b.id, e.target.checked)}
                      aria-label={`Seleccionar bulto ${b.identificador || b.id}`}
                    />
                  </td>
                  <td className="p-2 border text-center">
                    <BadgeCategoria value={getClaveCategoria(b)} />
                  </td>
                  <td className="p-2 border">{b.id}</td>
                  <td className="p-2 border font-mono text-xs">{b.identificador}</td>
                  <td className="p-2 border">{nombre}</td>
                  <td className="p-2 border">{bodegaNombre}</td>
                  <td className="p-2 border">{palletIdent || <span className="text-gray-400">—</span>}</td>

                  <td className="p-2 border">
                    {formatNumberCL(b.peso_unitario, 2)} {unidad}
                  </td>
                  <td className="p-2 border">
                    <div className="font-medium">{cantidadDisponible} {unidad}</div>
                    <div className="text-xs text-gray-500">({b.unidades_disponibles}/{b.cantidad_unidades} un.)</div>
                  </td>
                  <td className="p-2 border">
                    <div className="font-medium">{formatCLP(costoTotal, 0)}</div>
                  </td>
                  <td className="p-2 border text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => generarEtiqueta(b)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Descargar etiqueta"
                      >
                        <FileDown className="w-5 h-5" />
                      </button>

                      {canEditBulto && (
                        <button
                          onClick={() => navigate(`/Inventario/bultos/editar/${b.id}`)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Editar bulto"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                      )}

                      <button
                        onClick={() => setBultoADividir(b)}
                        className="text-gray-400 hover:text-orange-600"
                        title="Dividir bulto"
                      >
                        <Scissors className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>

      </div>

      {bultoADividir && (
        <DividirBultoModal
          bulto={bultoADividir}
          onClose={() => setBultoADividir(null)}
          onSuccess={fetchBultos}
        />
      )}
    </div>
  );
}