import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import DataTable from "../../components/Tables/DataTable";
import Selector from "../../components/Forms/Selector";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";

// Mismo criterio que el detalle: por validar es lo único que pide a alguien hacer algo.
const ESTADO_STYLES = {
  "Activa": { cls: "border-violet-200 bg-violet-50 text-violet-700", label: "Activa" },
  "Terminada": { cls: "border-amber-200 bg-amber-50 text-amber-800", label: "Por validar" },
  "Validada": { cls: "border-green-200 bg-green-50 text-green-700", label: "Validada" },
};

function getEstadoChip(estado) {
  const base = "px-2.5 py-0.5 rounded-full text-xs font-medium border text-center whitespace-nowrap";
  const s = ESTADO_STYLES[estado] ?? { cls: "border-gray-200 bg-gray-50 text-gray-700", label: estado };
  return <span className={`${base} ${s.cls}`}>{s.label}</span>;
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
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroBodega, setFiltroBodega] = useState("Todas");

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

  const bodegaOptions = useMemo(() => {
    const map = new Map();
    sesiones.forEach((s) => {
      const b = s?.bodega;
      if (b?.id && !map.has(String(b.id))) map.set(String(b.id), b.nombre || `Bodega ${b.id}`);
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [sesiones]);

  // Filtros de negocio (estado + bodega) sobre la data; la búsqueda, el orden y la
  // paginación las maneja DataTable.
  const filtradas = useMemo(() => {
    let list = sesiones;
    if (filtroEstado !== "Todos") list = list.filter((s) => s.estado === filtroEstado);
    if (filtroBodega !== "Todas") list = list.filter((s) => String(s.bodega?.id ?? s.id_bodega) === String(filtroBodega));
    return list;
  }, [sesiones, filtroEstado, filtroBodega]);

  const columns = [
    {
      header: "ID",
      accessor: "id",
      sortable: true,
      sortValue: (s) => Number(s.id) || 0,
    },
    {
      header: "Bodega",
      accessor: "bodega",
      sortable: true,
      sortValue: (s) => s?.bodega?.nombre ?? "",
      Cell: ({ row }) => row.bodega?.nombre ?? row.id_bodega ?? "—",
    },
    {
      header: "Estado",
      accessor: "estado",
      align: "center",
      sortable: true,
      sortValue: (s) => s?.estado ?? "",
      Cell: ({ value }) => <div className="flex justify-center">{getEstadoChip(value)}</div>,
    },
    {
      header: "Bultos escaneados",
      accessor: "cantidad_bultos",
      align: "center",
      sortable: true,
      sortValue: (s) => Number(s?.cantidad_bultos) || 0,
      Cell: ({ value }) => <div className="text-center">{value ?? "—"}</div>,
    },
    {
      header: "Iniciada por",
      accessor: "creador",
      sortable: true,
      sortValue: (s) => s?.creador?.nombre ?? "",
      Cell: ({ row }) => row.creador?.nombre ?? "—",
    },
    {
      header: "Fecha",
      accessor: "createdAt",
      align: "center",
      sortable: true,
      sortValue: (s) => s?.createdAt ?? "",
      Cell: ({ value }) => (
        <div className="text-center text-sm text-gray-700">
          {value ? new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
        </div>
      ),
    },
    {
      header: "Validada por",
      accessor: "validador",
      sortable: true,
      sortValue: (s) => s?.validador?.nombre ?? "",
      Cell: ({ row }) =>
        row.validador?.nombre
          ? `${row.validador.nombre} (${new Date(row.fecha_validacion).toLocaleDateString("es-CL")})`
          : "—",
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Inventario/tomas/${row.id}`)}
        tooltipText="Ver detalle"
      />
    </div>
  );

  const getSearchText = (s) =>
    [s.id, s.bodega?.nombre, s.estado, s.creador?.nombre, s.validador?.nombre].join(" ");

  const filtros = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-sm text-gray-600 p-1">Estado</label>
        <div className="flex flex-wrap gap-2 px-1">
          {["Todos", "Activa", "Terminada", "Validada"].map((opt) => {
            const isActive = filtroEstado === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFiltroEstado(opt)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
                aria-pressed={isActive}
              >
                {ESTADO_STYLES[opt]?.label ?? opt}
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
          className="px-3 py-2 text-sm text-gray-700 hover:text-primary"
          onClick={() => {
            setFiltroEstado("Todos");
            setFiltroBodega("Todas");
          }}
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );

  return (
    <DataTable
      // El título de esta lista es un elemento y no texto, así que la clave de memoria va
      // explícita: `DataTable` sólo la deriva sola cuando el título es una cadena.
      persistKey="tomas_inventario"
      title={
        <span>
          Tomas de Inventario
          <span className="block text-sm font-normal text-gray-500 mt-1">
            Las sesiones se crean y escanean desde la app móvil; al validar una sesión terminada,
            los conteos se aplican a la bodega.
          </span>
        </span>
      }
      data={filtradas}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      filters={filtros}
      initialSort={{ key: "createdAt", direction: "desc" }}
      loading={isLoading}
      loadingMessage="Cargando sesiones de inventariado"
      emptyMessage="No hay sesiones registradas."
    />
  );
}
