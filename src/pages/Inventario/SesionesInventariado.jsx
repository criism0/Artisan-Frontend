import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import Table from "../../components/Tables/Table";
import SearchBar from "../../components/UI/SearchBar";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
import Pagination from "../../components/UI/Pagination";
import Selector from "../../components/Forms/Selector";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";

const ESTADO_STYLES = {
  "Activa": { bg: "bg-sky-200", text: "text-sky-800", label: "Activa" },
  "Terminada": { bg: "bg-amber-200", text: "text-amber-800", label: "Por validar" },
  "Validada": { bg: "bg-green-400", text: "text-green-900", label: "Validada" },
};

function getEstadoChip(estado) {
  const base = "px-3 py-1 rounded-full text-xs font-medium text-center";
  const s = ESTADO_STYLES[estado] ?? { bg: "bg-gray-100", text: "text-gray-700", label: estado };
  return <span className={`${base} ${s.bg} ${s.text}`}>{s.label}</span>;
}

/**
 * Listado de sesiones de toma de inventario (se crean y escanean desde la app móvil).
 * Desde aquí se revisa y valida cada sesión contra la realidad de la bodega.
 */
export default function SesionesInventariado() {
  const api = useApi();
  const navigate = useNavigate();

  const [sesiones, setSesiones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroBodega, setFiltroBodega] = useState("Todas");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/sesiones-inventariado");
        const arr = res?.data ?? res;
        setSesiones(Array.isArray(arr) ? arr : arr?.sesiones ?? []);
      } catch {
        toast.error("No se pudieron cargar las sesiones de inventariado");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalize = (text) =>
    (text ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const SORT_ACCESSORS = {
    id: (s) => Number(s.id) || 0,
    bodega: (s) => s?.bodega?.nombre ?? "",
    estado: (s) => s?.estado ?? "",
    cantidad_bultos: (s) => Number(s?.cantidad_bultos) || 0,
    creador: (s) => s?.creador?.nombre ?? "",
    createdAt: (s) => s?.createdAt ?? "",
    validador: (s) => s?.validador?.nombre ?? "",
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderHeader = (label, accessor, align = "left") => {
    const isActive = sortConfig.key === accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    return (
      <div
        className={`flex items-center gap-1 cursor-pointer select-none ${align === "center" ? "justify-center" : ""}`}
        onClick={() => handleSort(accessor)}
      >
        <span>{label}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  const bodegaOptions = useMemo(() => {
    const map = new Map();
    sesiones.forEach((s) => {
      const b = s?.bodega;
      if (b?.id && !map.has(String(b.id))) map.set(String(b.id), b.nombre || `Bodega ${b.id}`);
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [sesiones]);

  const filtradas = useMemo(() => {
    let list = [...sesiones];

    const q = normalize(searchQuery);
    if (q) {
      list = list.filter((s) =>
        normalize(
          [s.id, s.bodega?.nombre, s.estado, s.creador?.nombre, s.validador?.nombre].join(" ")
        ).includes(q)
      );
    }
    if (filtroEstado !== "Todos") list = list.filter((s) => s.estado === filtroEstado);
    if (filtroBodega !== "Todas") list = list.filter((s) => String(s.bodega?.id ?? s.id_bodega) === String(filtroBodega));

    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      const accessor = SORT_ACCESSORS[key] ?? ((s) => s?.[key] ?? "");
      list.sort((a, b) => {
        const aVal = accessor(a);
        const bVal = accessor(b);
        if (typeof aVal === "number" && typeof bVal === "number") {
          return direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        const aStr = (aVal ?? "").toString().toLowerCase();
        const bStr = (bVal ?? "").toString().toLowerCase();
        return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesiones, searchQuery, filtroEstado, filtroBodega, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filtroEstado, filtroBodega]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filtradas.slice(startIndex, startIndex + rowsPerPage);

  const columns = [
    { header: renderHeader("ID", "id"), accessor: "id" },
    {
      header: renderHeader("Bodega", "bodega"),
      accessor: "bodega",
      Cell: ({ row }) => row.bodega?.nombre ?? row.id_bodega ?? "—",
    },
    {
      header: renderHeader("Estado", "estado", "center"),
      accessor: "estado",
      Cell: ({ value }) => <div className="flex justify-center">{getEstadoChip(value)}</div>,
    },
    {
      header: renderHeader("Bultos escaneados", "cantidad_bultos", "center"),
      accessor: "cantidad_bultos",
      Cell: ({ value }) => <div className="text-center">{value ?? "—"}</div>,
    },
    {
      header: renderHeader("Iniciada por", "creador"),
      accessor: "creador",
      Cell: ({ row }) => row.creador?.nombre ?? "—",
    },
    {
      header: renderHeader("Fecha", "createdAt", "center"),
      accessor: "createdAt",
      Cell: ({ value }) => (
        <div className="text-center text-sm text-gray-700">
          {value ? new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
        </div>
      ),
    },
    {
      header: renderHeader("Validada por", "validador"),
      accessor: "validador",
      Cell: ({ row }) =>
        row.validador?.nombre
          ? `${row.validador.nombre} (${new Date(row.fecha_validacion).toLocaleDateString("es-CL")})`
          : "—",
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton
        onClick={() => navigate(`/Inventario/tomas/${row.id}`)}
        tooltipText="Ver detalle"
      />
    </div>
  );

  if (isLoading) return <PageLoader message="Cargando sesiones de inventariado" />;

  return (
    <div className="px-5 py-1 bg-background min-h-screen">
      <div className="flex justify-between items-center m-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Tomas de Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">
            Las sesiones se crean y escanean desde la app móvil; al validar una sesión terminada,
            los conteos se aplican a la bodega.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 m-3">
        <div className="flex justify-between items-center gap-3">
          <RowsPerPageSelector onRowsChange={(v) => { setRowsPerPage(v); setCurrentPage(1); }} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
              onClick={() => setFiltrosAbiertos((v) => !v)}
            >
              {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
            </button>
            <SearchBar onSearch={setSearchQuery} />
          </div>
        </div>

        {filtrosAbiertos && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-border">
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600 p-1">Estado</label>
              <div className="flex flex-wrap gap-2 px-1">
                {["Todos", "Activa", "Terminada", "Validada"].map((opt) => {
                  const isActive = filtroEstado === opt;
                  const style =
                    opt === "Todos"
                      ? { bg: "bg-gray-100", text: "text-gray-700", label: "Todos" }
                      : (ESTADO_STYLES[opt] ?? { bg: "bg-gray-100", text: "text-gray-700", label: opt });
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFiltroEstado(opt)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${style.bg} ${style.text} ${
                        isActive ? "ring-2 ring-offset-1 ring-primary" : "opacity-80 hover:opacity-100"
                      }`}
                      aria-pressed={isActive}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600">Bodega</label>
              <Selector
                options={bodegaOptions}
                selectedValue={filtroBodega}
                onSelect={setFiltroBodega}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-700 hover:text-purple-600"
                onClick={() => {
                  setFiltroEstado("Todos");
                  setFiltroBodega("Todas");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {paginatedData.length === 0 ? (
        <div className="bg-white rounded-lg shadow px-6 py-10 text-center text-gray-400 m-3">
          No hay sesiones {filtroEstado !== "Todos" || filtroBodega !== "Todas" || searchQuery ? "para los filtros actuales" : "registradas"}.
        </div>
      ) : (
        <Table columns={columns} data={paginatedData} actions={actions} />
      )}

      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
