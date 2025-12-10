import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Selector from "../../components/Selector";
import Pagination from "../../components/Pagination";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filteredSolicitudes, setFilteredSolicitudes] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroBodegaProv, setFiltroBodegaProv] = useState("Todas");
  const [filtroBodegaSol, setFiltroBodegaSol] = useState("Todas");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const navigate = useNavigate();
  const api = useApi();

  const ESTADO_STYLES = {
    "Creada": { bg: "bg-gray-200", text: "text-gray-800", label: "Creada" },
    "Validada": { bg: "bg-sky-200", text: "text-sky-800", label: "Validada" },
    "En preparación": { bg: "bg-amber-200", text: "text-amber-800", label: "En preparación" },
    "Lista para despacho": { bg: "bg-lime-200", text: "text-lime-800", label: "Lista para despacho" },
    "En tránsito": { bg: "bg-indigo-200", text: "text-indigo-800", label: "En tránsito" },
    "Recepcionada Parcial Falta Stock": { bg: "bg-green-200", text: "text-green-800", label: "Recepcionada Parcial" },
    "Recepcionada Completa": { bg: "bg-green-400", text: "text-green-900", label: "Recepcionada Completa" },
    "Pendiente": { bg: "bg-orange-200", text: "text-orange-800", label: "Pendiente" },
    "Cancelada": { bg: "bg-red-200", text: "text-red-800", label: "Cancelada" },
  };

  const getEstadoChip = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium text-center";
    const s = ESTADO_STYLES[estado] ?? { bg: "bg-gray-100", text: "text-gray-700", label: estado };
    return <span className={`${base} ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const SORT_ACCESSORS = {
    id: (row) => Number(row.id) || 0,
    bodegaProveedora: (row) => row?.bodegaProveedora?.nombre || row?.bodegaProveedora?.id || "",
    bodegaSolicitante: (row) => row?.bodegaSolicitante?.nombre || row?.bodegaSolicitante?.id || "",
    usuarioSolicitante: (row) => row?.usuarioSolicitante?.nombre || row?.usuarioSolicitante?.email || "",
    estado: (row) => row?.estado || "",
  };

  const getSortValue = (row, key) => (SORT_ACCESSORS[key] ? SORT_ACCESSORS[key](row) : row?.[key] ?? "");

  const normalize = (text) =>
    (text ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

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
        className={`flex items-center gap-1 cursor-pointer select-none ${align === 'center' ? 'justify-center' : ''}`}
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

  const columns = [
    { header: renderHeader("ID", "id"), accessor: "id" },
    {
      header: renderHeader("Bodega Proveedora", "bodegaProveedora"),
      accessor: "bodegaProveedora",
      Cell: ({ value }) => value?.nombre || value?.id || "N/A",
    },
    {
      header: renderHeader("Bodega Solicitante", "bodegaSolicitante"),
      accessor: "bodegaSolicitante",
      Cell: ({ value }) => value?.nombre || value?.id || "N/A",
    },
    {
      header: renderHeader("Usuario Solicitante", "usuarioSolicitante"),
      accessor: "usuarioSolicitante",
      Cell: ({ value }) => value?.nombre || value?.email || "N/A",
    },
    {
      header: renderHeader("Estado", "estado", "center"),
      accessor: "estado",
      Cell: ({ value }) => (
        <div className="flex justify-center">
          {getEstadoChip(value)}
        </div>
      ),
    },
  ];

  useEffect(() => {
    const fetchSolicitudes = async () => {
      try {
        const data = await api(`/solicitudes-mercaderia`);
        const list = Array.isArray(data)
          ? data
              .map((s) => ({
                id: s.id,
                bodegaProveedora: s.bodegaProveedora,
                bodegaSolicitante: s.bodegaSolicitante,
                usuarioSolicitante: s.usuarioSolicitante,
                estado: s.estado,
                fecha_envio: s.fecha_envio,
                fecha_recepcion: s.fecha_recepcion,
                numero_guia_despacho: s.numero_guia_despacho,
                medio_transporte: s.medio_transporte,
              }))
              .sort((a, b) => b.id - a.id)
          : [];
        setSolicitudes(list);
        setFilteredSolicitudes(list);
      } catch (err) {
        console.error("Error cargando solicitudes:", err);
        setSolicitudes([]);
        setFilteredSolicitudes([]);
      }
    };
    fetchSolicitudes();
  }, [api]);

  const estadoOptions = useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(solicitudes.map((s) => s.estado).filter(Boolean))),
    ],
    [solicitudes]
  );

  const buildBodegaOptions = (items, key) => {
    const map = new Map();
    items.forEach((s) => {
      const b = s[key];
      if (b?.id && !map.has(String(b.id))) map.set(String(b.id), b.nombre || `Bodega ${b.id}`);
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  };

  const bodegaProvOptions = useMemo(() => buildBodegaOptions(solicitudes, "bodegaProveedora"), [solicitudes]);
  const bodegaSolOptions = useMemo(() => buildBodegaOptions(solicitudes, "bodegaSolicitante"), [solicitudes]);

  // Aplica búsqueda + filtros + ordenamiento
  useEffect(() => {
    let list = [...solicitudes];

    const q = normalize(searchQuery);
    if (q) {
      list = list.filter((s) => normalize(JSON.stringify(s)).includes(q));
    }

    if (filtroEstado !== "Todos") {
      list = list.filter((s) => s.estado === filtroEstado);
    }

    if (filtroBodegaProv !== "Todas") {
      list = list.filter((s) => String(s.bodegaProveedora?.id) === String(filtroBodegaProv));
    }
    if (filtroBodegaSol !== "Todas") {
      list = list.filter((s) => String(s.bodegaSolicitante?.id) === String(filtroBodegaSol));
    }

    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      list.sort((a, b) => {
        const aVal = getSortValue(a, key);
        const bVal = getSortValue(b, key);
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = (aVal ?? '').toString().toLowerCase();
        const bStr = (bVal ?? '').toString().toLowerCase();
        return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    setFilteredSolicitudes(list);
    setCurrentPage(1);
  }, [solicitudes, searchQuery, filtroEstado, filtroBodegaProv, filtroBodegaSol, sortConfig]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredSolicitudes.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredSolicitudes.slice(startIndex, startIndex + rowsPerPage);

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton
        onClick={() => navigate(`/Solicitudes/${row.id}`)}
        tooltipText="Ver detalle"
      />
    </div>
  );

  return (
    <div className="px-5 py-1 bg-background min-h-screen">
      <div className="flex justify-between items-center m-3">
        <h1 className="text-2xl font-bold text-text">Solicitudes</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          onClick={() => navigate("/Solicitudes/add")}
        >
          Nueva Solicitud
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 m-3">
        <div className="flex justify-between items-center gap-3">
          <RowsPerPageSelector onRowsChange={handleRowsChange} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
              onClick={() => setFiltrosAbiertos((v) => !v)}
            >
              {filtrosAbiertos ? 'Ocultar filtros' : 'Filtros'}
            </button>
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
        {filtrosAbiertos && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-border">
            <div className="flex flex-col gap-1 justify-center">
              {/* Estados */}
              <label className="text-sm text-gray-600 p-1">Estado</label>
              <div className="flex flex-wrap gap-2 px-1">
                {estadoOptions.map((opt) => {
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
                        isActive ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-80 hover:opacity-100'
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
              <label className="text-sm text-gray-600">Bodega Proveedora</label>
              <Selector
                options={bodegaProvOptions}
                selectedValue={filtroBodegaProv}
                onSelect={setFiltroBodegaProv}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600">Bodega Solicitante</label>
              <Selector
                options={bodegaSolOptions}
                selectedValue={filtroBodegaSol}
                onSelect={setFiltroBodegaSol}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-700 hover:text-purple-600"
                onClick={() => {
                  setFiltroEstado("Todos");
                  setFiltroBodegaProv("Todas");
                  setFiltroBodegaSol("Todas");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <Table columns={columns} data={paginatedData} actions={actions} />

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
