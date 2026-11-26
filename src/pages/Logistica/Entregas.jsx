import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, ListPlus, Pencil, Printer, Receipt } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import MenuAcciones from "../../components/UI/MenuAcciones.jsx";
import ChipsEstado from "../../components/UI/ChipsEstado.jsx";
import BarraEntregas from "../../components/Entregas/BarraEntregas";
import EstadoRuta from "../../components/Entregas/EstadoRuta";
import ModalCancelarRuta from "../../components/Entregas/ModalCancelarRuta";
import { toast } from "../../lib/toast.js";
import { api } from "../../lib/api";
import { generarNotasVentaPDF } from "../../services/notaVentaPdf.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { abrirEtiquetasDespacho, listarRutas } from "../../services/rutasService";
import {
  avanceDeRuta,
  formatearCLP,
  formatearFecha,
  formatearKm,
  paradasDeRutaGuardada,
  pedidosDeRuta,
} from "../../utils/rutas";

const nombreCliente = (p) => p.cliente?.nombre_empresa || p.cliente?.razon_social || "";

/** Estados de una ruta en orden, con el color de `EstadoRuta` en un punto. */
const ESTADOS = [
  ["Planificada", "bg-sky-400"],
  ["En curso", "bg-amber-400"],
  ["Cerrada", "bg-green-500"],
  ["Cancelada", "bg-gray-400"],
];

function Avance({ ruta }) {
  if (ruta.estado === "Cancelada") return <span className="text-gray-400">—</span>;
  const { total, conResultado, problemas } = avanceDeRuta(ruta);
  if (ruta.estado === "Planificada") return <span className="text-gray-400 tabular-nums">0/{total}</span>;
  const pct = total ? Math.round((conResultado / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums text-sm text-gray-700">
      <span className="h-1.5 w-14 overflow-hidden rounded bg-gray-200" aria-hidden="true">
        <span className="block h-full bg-green-500" style={{ width: `${pct}%` }} />
      </span>
      {conResultado}/{total}
      {problemas > 0 && (
        <span className="text-xs font-semibold text-amber-700" title={`${problemas} parcial(es) o no entregada(s)`}>
          ⚠ {problemas}
        </span>
      )}
    </span>
  );
}

/**
 * Logística → Entregas → Rutas: la lista de rutas de entrega. Planificar una nueva vive en su
 * propia vista; cada ruta se abre en su detalle, donde también se edita.
 */
export default function Entregas() {
  const navigate = useNavigate();
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cancelando, setCancelando] = useState(null);
  const [descargando, setDescargando] = useState(null);

  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    try {
      const r = await listarRutas();
      setRutas(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const columns = [
    { header: "N°", accessor: "id", sortable: true, sortValue: (r) => Number(r.id) || 0 },
    {
      header: "Día",
      accessor: "fecha",
      sortable: true,
      sortValue: (r) => r.fecha ?? "",
      Cell: ({ value }) => formatearFecha(value),
    },
    {
      header: "Encargado",
      accessor: "transportista",
      sortable: true,
      sortValue: (r) => r.transportista?.nombre ?? "",
      Cell: ({ row }) => row.transportista?.nombre ?? <span className="text-gray-400">Sin encargado</span>,
    },
    {
      header: "Estado",
      accessor: "estado",
      align: "center",
      sortable: true,
      filtro: "valores",
      sortValue: (r) => r.estado ?? "",
      Cell: ({ value }) => (
        <div className="flex justify-center">
          <EstadoRuta estado={value} />
        </div>
      ),
    },
    {
      header: "Avance",
      accessor: "avance",
      sortable: true,
      filtro: false,
      sortValue: (r) => {
        const a = avanceDeRuta(r);
        return a.total ? a.conResultado / a.total : 0;
      },
      Cell: ({ row }) => <Avance ruta={row} />,
    },
    {
      header: "Recorrido",
      accessor: "paradas",
      sortable: false,
      filtro: false,
      Cell: ({ row }) => (
        <span className="block max-w-xs truncate text-sm text-gray-700" title={row.paradas.map(nombreCliente).join(" → ")}>
          {row.paradas.length ? row.paradas.map(nombreCliente).join(" → ") : "—"}
        </span>
      ),
    },
    {
      header: "Pedidos",
      accessor: "n_pedidos",
      align: "right",
      sortable: true,
      sortValue: (r) => pedidosDeRuta(r),
      Cell: ({ row }) => pedidosDeRuta(row),
    },
    {
      header: "Km",
      accessor: "km_planificados",
      align: "right",
      sortable: true,
      sortValue: (r) => Number(r.km_planificados) || 0,
      Cell: ({ row, value }) =>
        row.vuelve_a_bodega === false ? (
          <span title="Termina en la última parada: no incluye la vuelta a la bodega">
            {formatearKm(value)} <span className="text-[11px] text-gray-400">sin vuelta</span>
          </span>
        ) : (
          formatearKm(value)
        ),
    },
    {
      header: "Costo",
      accessor: "costo_estimado",
      align: "right",
      sortable: true,
      sortValue: (r) => Number(r.costo_estimado) || 0,
      Cell: ({ value }) => formatearCLP(value),
    },
    {
      header: "Sale de",
      accessor: "bodega",
      sortable: true,
      sortValue: (r) => r.bodega?.nombre ?? "",
      Cell: ({ row }) => row.bodega?.nombre ?? "—",
    },
  ];

  // Todas las notas de venta de la ruta en un PDF, en el orden de las paradas (igual que el detalle).
  const descargarNotas = async (ruta) => {
    const ids = paradasDeRutaGuardada(ruta).flatMap((p) => p.ordenes.map((o) => o.id));
    setDescargando(ruta.id);
    try {
      await generarNotasVentaPDF({ api, ordenIds: ids, nombre: `Ruta-${ruta.id}-${formatearFecha(ruta.fecha)}-notas-de-venta.pdf` });
    } catch (e) {
      toast.error(`No se pudieron generar las notas de venta: ${e?.message ?? "error desconocido"}`);
    } finally {
      setDescargando(null);
    }
  };

  // «Ver» y un «⋯» con nombres, como en Órdenes de venta (antes, hasta tres íconos sueltos).
  const actions = (row) => {
    const editable = puedeEscribir && row.estado === "Planificada";
    const conPedidos = pedidosDeRuta(row) > 0;
    return (
      <div className="flex gap-2 justify-end items-center">
        <ViewDetailButton onClick={() => navigate(`/logistica/entregas/rutas/${row.id}`)} tooltipText="Ver detalle" />
        {/* Sin acciones en una cancelada: el hueco mantiene el ojo alineado con las demás filas. */}
        {row.estado === "Cancelada" && <span className="w-7" aria-hidden="true" />}
        {row.estado !== "Cancelada" && (
          <MenuAcciones
            etiqueta={`Más acciones de la ruta #${row.id}`}
            items={[
              editable && {
                label: "Editar",
                icon: <Pencil className="w-4 h-4" />,
                onClick: () => navigate(`/logistica/entregas/rutas/${row.id}?editar=1`),
              },
              editable && {
                label: "Agregar o quitar pedidos",
                icon: <ListPlus className="w-4 h-4" />,
                onClick: () => navigate(`/logistica/entregas/planificar?ruta=${row.id}`),
              },
              {
                label: "Notas de venta (PDF)",
                icon: <Receipt className="w-4 h-4" />,
                disabled: !conPedidos || descargando === row.id,
                onClick: () => descargarNotas(row),
              },
              row.estado !== "Cerrada" && {
                label: "Etiquetas de despacho",
                icon: <Printer className="w-4 h-4" />,
                onClick: () => abrirEtiquetasDespacho({ id_ruta: row.id }).catch((e) => toast.error(e.message)),
              },
              { separador: true },
              editable && {
                label: "Cancelar ruta",
                icon: <Ban className="w-4 h-4" />,
                peligro: true,
                onClick: () => setCancelando(row),
              },
            ]}
          />
        )}
      </div>
    );
  };

  const getSearchText = (r) =>
    [
      r.id,
      formatearFecha(r.fecha),
      r.transportista?.nombre,
      r.estado,
      r.bodega?.nombre,
      ...r.paradas.map(nombreCliente),
      ...r.paradas.flatMap((p) => (p.ordenes ?? []).map((o) => `OV ${o.id_orden_venta} ${o.orden?.numero_oc ?? ""}`)),
    ].join(" ");

  return (
    <>
      <div className="px-6 pt-6">
        <BarraEntregas />
      </div>
      <DataTable
        title="Rutas de entrega"
        data={rutas}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        headerExtra={({ filtrosColumna, cambiarFiltroColumna }) => (
          <ChipsEstado
            filas={rutas}
            estados={ESTADOS}
            filtro={filtrosColumna.estado}
            onCambiar={(f) => cambiarFiltroColumna("estado", f)}
          />
        )}
        // Por número, la más nueva arriba (pedido de Cristóbal, 2026-10-01). La clave nueva descarta
        // el orden por fecha que la lista ya tenía guardado en cada navegador.
        initialSort={{ key: "id", direction: "desc" }}
        persistKey="rutas_entregas_v2"
        loading={cargando}
        loadingMessage="Cargando rutas"
        emptyMessage="Todavía no hay rutas. Arma la primera con «Planificar ruta»."
      />
      <ModalCancelarRuta ruta={cancelando} onCerrar={() => setCancelando(null)} onCancelada={cargar} />
    </>
  );
}
