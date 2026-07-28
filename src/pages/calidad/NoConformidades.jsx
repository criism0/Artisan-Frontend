import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import { fuzzyMatch } from "../../services/fuzzyMatch";
import { cargarDatosCalidad } from "../../services/calidadAnalytics";
import { toast } from "../../lib/toast";

const ESTADO_CONFIG = {
  "no-conforme": {
    label: "No conforme",
    className: "bg-red-100 text-red-800",
  },
  desvio: {
    label: "Desvío",
    className: "bg-yellow-100 text-yellow-800",
  },
};

const SEVERIDAD_CONFIG = {
  critica: { label: "Crítica", className: "bg-red-100 text-red-800" },
  media: { label: "Media", className: "bg-yellow-100 text-yellow-800" },
};

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// Muestra el nombre del usuario; si el backend no lo resolvió, cae a "#id".
const nombreUsuario = (row) => {
  if (row?.usuario_nombre) return row.usuario_nombre;
  return row?.id_usuario != null ? `#${row.id_usuario}` : "—";
};

const TAB = {
  ESTADO: "estado",
  RANGOS: "rangos",
};

export default function NoConformidades() {
  const navigate = useNavigate();
  const [formularios, setFormularios] = useState([]);
  const [respuestas, setRespuestas] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState(TAB.ESTADO);

  // Filtros específicos por tab + filtro de formulario compartido
  const [formularioFilter, setFormularioFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [severidadFilter, setSeveridadFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cargarDatosCalidad()
      .then((d) => {
        if (cancelled || !d) return;
        setFormularios(d.formularios);
        setRespuestas(d.respuestas);
        setAlertas(d.alertas);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Error al cargar datos de calidad.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const formulariosPorId = useMemo(
    () => new Map(formularios.map((f) => [f.id, f])),
    [formularios]
  );

  // --- Tab 1: estado del registro ---
  const itemsEstado = useMemo(() => {
    return respuestas
      .filter((r) => r.estado === "desvio" || r.estado === "no-conforme")
      .map((r) => {
        const f = formulariosPorId.get(r.formulario_id ?? r.id_formulario_calidad);
        return {
          id: r.id,
          respuesta_id: r.id,
          formulario_id: r.formulario_id ?? r.id_formulario_calidad,
          formulario_codigo: f?.codigo || "—",
          formulario_nombre: f?.nombre || "—",
          estado: r.estado,
          detalle: r.detalle || "",
          fecha: r.completado_en || r.created_at || null,
          id_usuario: r.id_usuario ?? null,
          usuario_nombre: r.usuario_nombre ?? null,
        };
      })
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [respuestas, formulariosPorId]);

  const kpisEstado = useMemo(() => {
    const noConformes = itemsEstado.filter((i) => i.estado === "no-conforme").length;
    const desvios = itemsEstado.filter((i) => i.estado === "desvio").length;
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ultimas24h = itemsEstado.filter(
      (i) => i.fecha && new Date(i.fecha) >= ayer
    ).length;
    return {
      total: itemsEstado.length,
      noConformes,
      desvios,
      ultimas24h,
    };
  }, [itemsEstado]);

  const formulariosDisponibles = useMemo(() => {
    const fuente = tab === TAB.ESTADO ? itemsEstado : alertas;
    const map = new Map();
    for (const i of fuente) {
      if (!map.has(i.formulario_codigo)) {
        map.set(i.formulario_codigo, i.formulario_nombre);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tab, itemsEstado, alertas]);

  // --- Tab 2: alertas por valor fuera de rango (legado) ---
  const kpisRangos = useMemo(() => {
    const criticas = alertas.filter((a) => a.severidad === "critica").length;
    const medias = alertas.filter((a) => a.severidad === "media").length;
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ultimas24h = alertas.filter(
      (a) => a.fecha && new Date(a.fecha) >= ayer
    ).length;
    return { total: alertas.length, criticas, medias, ultimas24h };
  }, [alertas]);

  // Datos del tab activo tras aplicar los filtros de negocio (estado/severidad + formulario).
  // La búsqueda difusa y la paginación las maneja DataTable.
  const dataActual = useMemo(() => {
    if (tab === TAB.ESTADO) {
      let result = itemsEstado;
      if (estadoFilter) result = result.filter((i) => i.estado === estadoFilter);
      if (formularioFilter) result = result.filter((i) => i.formulario_codigo === formularioFilter);
      return result;
    }
    let result = alertas;
    if (severidadFilter) result = result.filter((a) => a.severidad === severidadFilter);
    if (formularioFilter) result = result.filter((a) => a.formulario_codigo === formularioFilter);
    return result;
  }, [tab, itemsEstado, alertas, estadoFilter, severidadFilter, formularioFilter]);

  const filterFn = (row, query) => {
    if (tab === TAB.ESTADO) {
      return fuzzyMatch(
        [row.formulario_codigo, row.formulario_nombre, row.detalle, row.estado]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        query
      );
    }
    return fuzzyMatch(
      [row.formulario_codigo, row.formulario_nombre, row.seccion_titulo, row.campo_etiqueta, String(row.valor)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      query
    );
  };

  const columnasEstado = [
    {
      header: "Fecha",
      accessor: "fecha",
      Cell: ({ value }) => formatoFecha(value),
    },
    {
      header: "Formulario",
      accessor: "formulario_codigo",
      Cell: ({ row }) => (
        <div>
          <p className="text-xs font-mono text-gray-500">{row.formulario_codigo}</p>
          <p className="text-sm text-gray-800 truncate">{row.formulario_nombre}</p>
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      Cell: ({ value }) => {
        const cfg = ESTADO_CONFIG[value] || ESTADO_CONFIG.desvio;
        return (
          <span className={`px-2 py-1 rounded-full text-xs ${cfg.className}`}>
            {cfg.label}
          </span>
        );
      },
    },
    {
      header: "Detalle",
      accessor: "detalle",
      Cell: ({ value }) =>
        value ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">
            {value}
          </p>
        ) : (
          <span className="text-xs text-gray-400 italic">—</span>
        ),
    },
    {
      header: "Usuario",
      accessor: "usuario_nombre",
      Cell: ({ row }) => nombreUsuario(row),
    },
  ];

  const columnasRangos = [
    {
      header: "Fecha",
      accessor: "fecha",
      Cell: ({ value }) => formatoFecha(value),
    },
    {
      header: "Formulario",
      accessor: "formulario_codigo",
      Cell: ({ row }) => (
        <div>
          <p className="text-xs font-mono text-gray-500">{row.formulario_codigo}</p>
          <p className="text-sm text-gray-800 truncate">{row.formulario_nombre}</p>
        </div>
      ),
    },
    {
      header: "Campo",
      accessor: "campo_etiqueta",
      Cell: ({ row }) => (
        <div>
          <p className="text-sm text-gray-800">{row.campo_etiqueta}</p>
          {row.seccion_titulo && (
            <p className="text-xs text-gray-500">{row.seccion_titulo}</p>
          )}
        </div>
      ),
    },
    {
      header: "Valor",
      accessor: "valor",
      Cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold text-red-700">{row.valor}</p>
          <p className="text-xs text-gray-500">
            rango {row.min ?? "—"} a {row.max ?? "—"}
          </p>
        </div>
      ),
    },
    {
      header: "Usuario",
      accessor: "usuario_nombre",
      Cell: ({ row }) => nombreUsuario(row),
    },
    {
      header: "Severidad",
      accessor: "severidad",
      Cell: ({ value }) => {
        const cfg = SEVERIDAD_CONFIG[value] || SEVERIDAD_CONFIG.media;
        return (
          <span className={`px-2 py-1 rounded-full text-xs ${cfg.className}`}>
            {cfg.label}
          </span>
        );
      },
    },
  ];

  const columns = tab === TAB.ESTADO ? columnasEstado : columnasRangos;

  const actions = (row) => (
    <button
      onClick={() => navigate(`/calidad/respuestas/${row.respuesta_id}`)}
      className="text-primary hover:underline text-xs"
    >
      Ver respuesta
    </button>
  );

  const emptyMessage =
    tab === TAB.ESTADO
      ? itemsEstado.length === 0
        ? "Sin desvíos ni no conformidades registradas. Todas las respuestas están conformes."
        : "No se encontraron registros con los filtros actuales."
      : alertas.length === 0
      ? "Sin alertas. Todos los valores numéricos registrados están dentro de rango."
      : "No se encontraron alertas con los filtros actuales.";

  const headerExtra = (
    <>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <TabButton
          active={tab === TAB.ESTADO}
          onClick={() => setTab(TAB.ESTADO)}
          label="Estado del registro"
          badge={kpisEstado.total}
        />
        <TabButton
          active={tab === TAB.RANGOS}
          onClick={() => setTab(TAB.RANGOS)}
          label="Valores fuera de rango"
          badge={kpisRangos.total}
        />
      </div>

      {/* KPIs por tab */}
      {tab === TAB.ESTADO ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MiniKpi
            label="Total"
            value={kpisEstado.total}
            borderClass="border-l-gray-400"
            valueClass="text-gray-800"
          />
          <MiniKpi
            label="No conformes"
            value={kpisEstado.noConformes}
            borderClass="border-l-red-500"
            valueClass="text-red-700"
          />
          <MiniKpi
            label="Desvíos"
            value={kpisEstado.desvios}
            borderClass="border-l-yellow-500"
            valueClass="text-yellow-700"
          />
          <MiniKpi
            label="Últimas 24h"
            value={kpisEstado.ultimas24h}
            borderClass="border-l-blue-500"
            valueClass="text-gray-800"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MiniKpi
            label="Total alertas"
            value={kpisRangos.total}
            borderClass="border-l-gray-400"
            valueClass="text-gray-800"
          />
          <MiniKpi
            label="Críticas"
            value={kpisRangos.criticas}
            borderClass="border-l-red-500"
            valueClass="text-red-700"
          />
          <MiniKpi
            label="Medias"
            value={kpisRangos.medias}
            borderClass="border-l-yellow-500"
            valueClass="text-gray-800"
          />
          <MiniKpi
            label="Últimas 24h"
            value={kpisRangos.ultimas24h}
            borderClass="border-l-blue-500"
            valueClass="text-gray-800"
          />
        </div>
      )}
    </>
  );

  const toolbarStart = (
    <div className="flex items-center gap-3 flex-wrap">
      {tab === TAB.ESTADO ? (
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 bg-white text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="no-conforme">No conformes</option>
          <option value="desvio">Desvíos</option>
        </select>
      ) : (
        <select
          value={severidadFilter}
          onChange={(e) => setSeveridadFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 bg-white text-sm"
        >
          <option value="">Todas las severidades</option>
          <option value="critica">Críticas</option>
          <option value="media">Medias</option>
        </select>
      )}
      <select
        value={formularioFilter}
        onChange={(e) => setFormularioFilter(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 bg-white text-sm"
      >
        <option value="">Todos los formularios</option>
        {formulariosDisponibles.map(([codigo, nombre]) => (
          <option key={codigo} value={codigo}>
            {codigo} — {nombre}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <DataTable
      title={
        <span>
          No conformidades y desvíos
          <span className="block text-sm font-normal text-gray-500 mt-1">
            Registros marcados como desvío o no conforme al completar el formulario,
            junto con valores numéricos fuera del rango definido en las validaciones.
          </span>
        </span>
      }
      headerActions={
        <button
          onClick={() => navigate("/calidad/dashboard")}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
        >
          ← Volver al Dashboard
        </button>
      }
      headerExtra={headerExtra}
      toolbarStart={toolbarStart}
      data={dataActual}
      columns={columns}
      actions={actions}
      filterFn={filterFn}
      loading={loading}
      loadingMessage="Cargando datos de calidad"
      emptyMessage={emptyMessage}
      defaultRowsPerPage={10}
    />
  );
}

function TabButton({ active, onClick, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
      {badge != null && (
        <span
          className={`ml-2 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-xs ${
            active ? "bg-primary text-white" : "bg-gray-200 text-gray-700"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MiniKpi({ label, value, borderClass, valueClass }) {
  return (
    <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${borderClass}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
