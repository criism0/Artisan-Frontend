import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import ChipsEstado from "../../components/UI/ChipsEstado.jsx";
import Ayuda from "../../components/UI/Ayuda.jsx";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatFecha } from "../../lib/dateUtils";
import {
  ESTADOS_SOLICITUD_CHIPS,
  EstadoSolicitudBadge,
  MarcasSolicitud,
  marcasSolicitud,
  normalizeEstadoSolicitud,
  tienePerdida,
} from "../../utils/estadoSolicitud.jsx";
import { fechaDelPaso, DIAS_TRANSITO_LARGO } from "../../utils/solicitudesVista.js";

const CLAVE_UI = "solicitudes_v2";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [soloPerdida, setSoloPerdida] = useState(false);
  const navigate = useNavigate();
  const api = useApi();

  useEffect(() => {
    const fetchSolicitudes = async () => {
      try {
        const data = await api(`/solicitudes-mercaderia`);
        setSolicitudes(
          (Array.isArray(data) ? data : []).map((s) => ({
            ...s,
            estado: normalizeEstadoSolicitud(s.estado),
            usuarioSolicitante: s.usuarioSolicitante ?? s.Usuario,
          }))
        );
      } catch (err) {
        console.error("Error cargando solicitudes:", err);
        toast.error("No se pudieron cargar las solicitudes");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSolicitudes();
  }, [api]);

  const opcionesBodega = (clave) => {
    const map = new Map();
    for (const s of solicitudes) {
      const b = s[clave];
      if (b?.id != null && !map.has(String(b.id))) map.set(String(b.id), b.nombre || `Bodega ${b.id}`);
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1], "es"));
  };
  const origenes = useMemo(() => opcionesBodega("bodegaProveedora"), [solicitudes]); // eslint-disable-line react-hooks/exhaustive-deps
  const destinos = useMemo(() => opcionesBodega("bodegaSolicitante"), [solicitudes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Origen y destino filtran antes de los chips, así los conteos son de esa ruta.
  const porRuta = useMemo(
    () =>
      solicitudes.filter(
        (s) =>
          (!origen || String(s.bodegaProveedora?.id) === origen) &&
          (!destino || String(s.bodegaSolicitante?.id) === destino)
      ),
    [solicitudes, origen, destino]
  );
  const conPerdida = useMemo(() => porRuta.filter((s) => tienePerdida(s.resultado)).length, [porRuta]);
  const datos = useMemo(() => (soloPerdida ? porRuta.filter((s) => tienePerdida(s.resultado)) : porRuta), [porRuta, soloPerdida]);

  const columns = [
    { header: "N°", accessor: "id", sortable: true, hideable: false, filtro: "numero" },
    {
      header: "Ruta",
      accessor: "ruta",
      sortable: true,
      sortValue: (row) => `${row.bodegaProveedora?.nombre ?? ""} ${row.bodegaSolicitante?.nombre ?? ""}`,
      // Con nombres de bodega largos la ruta pasa a dos líneas en vez de ensanchar la tabla.
      cellClassName: "!whitespace-normal min-w-[9rem] max-w-[13rem]",
      Cell: ({ row }) => (
        <span>
          {row.bodegaProveedora?.nombre ?? "—"} <span className="text-gray-400">→</span> {row.bodegaSolicitante?.nombre ?? "—"}
        </span>
      ),
    },
    {
      header: "Solicita",
      accessor: "usuarioSolicitante",
      sortable: true,
      sortValue: (row) => row?.usuarioSolicitante?.nombre || row?.usuarioSolicitante?.email || "",
      cellClassName: "!whitespace-normal max-w-[10rem]",
      Cell: ({ value }) => value?.nombre || value?.email || "—",
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      filtro: "valores",
      Cell: ({ value }) => <EstadoSolicitudBadge estado={value} />,
    },
    {
      header: (
        <span className="inline-flex items-center gap-1">
          Envío · Recepción
          <Ayuda titulo="Envío y recepción">
            <div className="space-y-1.5 normal-case tracking-normal font-normal">
              <p><b>Envío</b>: lo enviado contra lo pedido, línea por línea. «= pedido» si salió todo, «▼» cuántas líneas salieron con menos y «▲» con más.</p>
              <p><b>Recepción</b>: lo recibido contra lo enviado. «= enviado» si llegó todo y «▼ pérdida» cuántas líneas llegaron con menos.</p>
            </div>
          </Ayuda>
        </span>
      ),
      headerLabel: "Envío · Recepción",
      headerClassName: "!whitespace-normal",
      cellClassName: "!whitespace-normal min-w-[8rem] max-w-[11rem]",
      accessor: "resultado",
      filtro: "valores",
      filtroValor: (row) => marcasSolicitud(row.resultado, { corto: true }).map((m) => m.texto).join(" · ") || "—",
      Cell: ({ value }) => <MarcasSolicitud resultado={value} corto />,
    },
    {
      header: "Guía",
      accessor: "numero_guia_despacho",
      sortable: true,
      cellClassName: "!whitespace-normal break-all max-w-[8rem]",
      Cell: ({ value }) => (value ? value : <span className="text-gray-400">—</span>),
    },
    {
      header: "Fecha",
      accessor: "fecha_paso",
      sortable: true,
      cellClassName: "!whitespace-normal max-w-[8rem]",
      sortValue: (row) => fechaDelPaso(row).fecha?.getTime() ?? 0,
      Cell: ({ row }) => {
        const { fecha, etiqueta, dias } = fechaDelPaso(row);
        if (!fecha) return <span className="text-gray-400">—</span>;
        const largo = row.estado === "En tránsito" && dias > DIAS_TRANSITO_LARGO;
        return (
          <span className="text-sm">
            <span className="whitespace-nowrap">{formatFecha(fecha)}</span>{" "}
            {largo ? (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" title={`Lleva ${dias} días en tránsito`}>
                hace {dias} d
              </span>
            ) : (
              <span className="text-xs text-gray-500">{etiqueta}</span>
            )}
          </span>
        );
      },
    },
    // Las tres fechas por separado siguen disponibles en «Columnas».
    { header: "Creada", accessor: "createdAt", sortable: true, defaultHidden: true, filtro: "fecha", Cell: ({ value }) => formatFecha(value) },
    { header: "Enviada", accessor: "fecha_envio", sortable: true, defaultHidden: true, filtro: "fecha", Cell: ({ value }) => formatFecha(value) },
    { header: "Recibida", accessor: "fecha_recepcion", sortable: true, defaultHidden: true, filtro: "fecha", Cell: ({ value }) => formatFecha(value) },
    { header: "Transporte", accessor: "medio_transporte", sortable: true, defaultHidden: true },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton onClick={() => navigate(`/logistica/solicitudes/${row.id}`)} tooltipText="Ver detalle" />
    </div>
  );

  const getSearchText = (s) =>
    [
      s.id,
      s.bodegaProveedora?.nombre,
      s.bodegaSolicitante?.nombre,
      s.usuarioSolicitante?.nombre,
      s.usuarioSolicitante?.email,
      s.estado,
      s.numero_guia_despacho,
      s.medio_transporte,
    ]
      .filter(Boolean)
      .join(" ");

  const selectClase = "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white";

  return (
    <DataTable
      title="Solicitudes"
      data={datos}
      headerExtra={({ filtrosColumna, cambiarFiltroColumna }) => (
        <div className="flex flex-wrap items-start gap-2">
          <ChipsEstado
            filas={porRuta}
            estados={ESTADOS_SOLICITUD_CHIPS}
            filtro={filtrosColumna.estado}
            onCambiar={(f) => cambiarFiltroColumna("estado", f)}
          />
          {conPerdida > 0 && (
            <button
              type="button"
              aria-pressed={soloPerdida}
              onClick={() => setSoloPerdida((v) => !v)}
              title="Llegó menos de lo enviado"
              className={`${chipBase} ${
                soloPerdida ? "border-red-500 bg-red-50 text-red-700 font-medium" : "border-red-200 bg-white text-red-700 hover:bg-red-50"
              }`}
            >
              ⚠ Con pérdida <b className="font-semibold">{conPerdida}</b>
            </button>
          )}
        </div>
      )}
      toolbarStart={
        <div className="flex items-center gap-2">
          <select aria-label="Bodega de origen" value={origen} onChange={(e) => setOrigen(e.target.value)} className={selectClase}>
            <option value="">Todos los orígenes</option>
            {origenes.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
          <span className="text-gray-400">→</span>
          <select aria-label="Bodega de destino" value={destino} onChange={(e) => setDestino(e.target.value)} className={selectClase}>
            <option value="">Todos los destinos</option>
            {destinos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>
      }
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando solicitudes"
      defaultRowsPerPage={25}
      initialSort={{ key: "id", direction: "desc" }}
      persistKey={CLAVE_UI}
      emptyMessage="No hay solicitudes que calcen."
      headerActions={
        <button className="btn btn-primario" onClick={() => navigate("/logistica/solicitudes/nuevo")}>
          + Nueva solicitud
        </button>
      }
    />
  );
}
