import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import MenuAcciones from "../../components/UI/MenuAcciones.jsx";
import ChipsEstado from "../../components/UI/ChipsEstado.jsx";
import ConfirmDeletePreviewModal from "../../components/Modals/ConfirmDeletePreviewModal";
import { EtapaBadge, ModalAnularElaboracion } from "../../components/Produccion/Elaboracion.jsx";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";
import { formatFecha } from "../../lib/dateUtils";
import { formatNumberCL } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import {
  ETAPAS,
  ORDEN_ETAPAS,
  diasAbierta,
  esAnulable,
  etapaDe,
  nombreProducto,
  siguienteAccion,
  tipoProducto,
} from "../../utils/elaboracionVista.js";

// Lista de elaboraciones (Fase 5, 2026-11-26). Antes: una columna PVA que pedía 2 o 3 cosas al
// servidor por fila, cuatro íconos sin nombre y un «Ejecutar pasos» que nunca aparecía porque la
// lista no traía los pasos. Ahora el backend manda etapa, pasos y valor agregado de una vez.
const CHIPS = ORDEN_ETAPAS.map((e) => [ETAPAS[e].nombre, ETAPAS[e].punto]);

export default function OMList() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bodega, setBodega] = useState("");
  const [porAnular, setPorAnular] = useState(null);
  const [porBorrar, setPorBorrar] = useState(null);

  const puedeLeer = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.READ);
  const puedeEscribir = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.WRITE);
  const puedeBorrar = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.DELETE);

  const cargar = useCallback(async () => {
    try {
      const res = await api(`/ordenes_manufactura`);
      // La etapa con nombre va como campo para que los chips y el filtro de columna la usen.
      setOrdenes((Array.isArray(res) ? res : []).map((o) => ({ ...o, etapa_nombre: ETAPAS[etapaDe(o)].nombre })));
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudieron cargar las elaboraciones");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!puedeLeer) {
      toast.permissionError([ModelType.ORDEN_MANUFACTURA, ScopeType.READ]);
      setIsLoading(false);
      return;
    }
    cargar();
  }, [puedeLeer, cargar]);

  const bodegas = useMemo(() => {
    const m = new Map();
    for (const o of ordenes) if (o.bodega?.id != null) m.set(String(o.bodega.id), o.bodega.nombre);
    return [...m].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"));
  }, [ordenes]);
  const datos = useMemo(
    () => (bodega ? ordenes.filter((o) => String(o.bodega?.id) === bodega) : ordenes),
    [ordenes, bodega]
  );

  const irA = (o, accion) => {
    if (accion.ruta) navigate(`/produccion/elaboraciones/${o.id}/${accion.ruta}`);
    else navigate(`/produccion/elaboraciones/${o.id}`, { state: { tab: accion.tab } });
  };

  const abrirBorrado = async (o) => {
    setPorBorrar({ id: o.id, preview: null, cargando: true, error: null });
    try {
      const preview = await api(`/ordenes_manufactura/${o.id}/delete_preview`);
      setPorBorrar({ id: o.id, preview, cargando: false, error: null });
    } catch (error) {
      setPorBorrar({ id: o.id, preview: null, cargando: false, error });
    }
  };

  const borrar = async () => {
    if (!porBorrar || porBorrar.preview?.canDelete === false) return;
    try {
      await api(`/ordenes_manufactura/${porBorrar.id}`, { method: "DELETE" });
      toast.success(`Elaboración #${porBorrar.id} eliminada`);
      setPorBorrar(null);
      cargar();
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo eliminar la elaboración");
    }
  };

  const columns = [
    { header: "N°", accessor: "id", sortable: true, hideable: false, filtro: "numero" },
    {
      header: "Producto",
      accessor: "producto",
      sortable: true,
      sortValue: nombreProducto,
      cellClassName: "!whitespace-normal min-w-[10rem] max-w-[16rem]",
      Cell: ({ row }) => {
        const tipo = tipoProducto(row);
        return (
          <span>
            {nombreProducto(row)}
            {tipo && <span className="ml-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">{tipo}</span>}
          </span>
        );
      },
    },
    {
      header: "Bodega",
      accessor: "bodega",
      sortable: true,
      sortValue: (o) => o.bodega?.nombre ?? "",
      Cell: ({ row }) => row.bodega?.nombre || "—",
    },
    {
      header: "Estado",
      accessor: "etapa_nombre",
      sortable: true,
      filtro: "valores",
      sortValue: (o) => ORDEN_ETAPAS.indexOf(etapaDe(o)),
      Cell: ({ row }) => <EtapaBadge om={row} />,
    },
    {
      header: "Siguiente paso",
      accessor: "siguiente",
      Cell: ({ row }) => {
        const a = siguienteAccion(row);
        if (!a) return <span className="text-gray-400">—</span>;
        if (!puedeEscribir) return <span className="text-sm text-gray-600">{a.label}</span>;
        return (
          <button
            type="button"
            onClick={() => irA(row, a)}
            className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium ${
              a.urgente
                ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : a.principal
                  ? "border-primary bg-primary text-white hover:bg-primary-dark"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {a.label}
          </button>
        );
      },
    },
    {
      header: "Objetivo",
      accessor: "peso_objetivo",
      sortable: true,
      align: "right",
      filtro: "numero",
      Cell: ({ value }) => (value ? `${formatNumberCL(value, 0)} kg` : "—"),
    },
    {
      header: "Fecha",
      accessor: "fecha",
      sortable: true,
      sortValue: (o) => (o.fecha ? new Date(o.fecha).getTime() : 0),
      Cell: ({ row }) => {
        if (!row.fecha) return <span className="text-gray-400">—</span>;
        const d = diasAbierta(row);
        return (
          <span className="whitespace-nowrap text-sm">
            {formatFecha(row.fecha)}{" "}
            {d?.detenida && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" title={`Lleva ${d.dias} días abierta`}>
                hace {d.dias} d
              </span>
            )}
          </span>
        );
      },
    },
    { header: "Encargado", accessor: "elaboradorEncargado", defaultHidden: true, Cell: ({ value }) => value?.nombre || "—" },
    { header: "Costo", accessor: "costo_total", defaultHidden: true, align: "right", Cell: ({ value }) => (value ? `$${formatNumberCL(value, 0)}` : "—") },
  ];

  const actions = (o) => (
    <div className="flex items-center justify-end gap-2">
      <ViewDetailButton onClick={() => navigate(`/produccion/elaboraciones/${o.id}`)} tooltipText="Ver detalle" />
      <MenuAcciones
        etiqueta={`Más acciones de la elaboración #${o.id}`}
        items={[
          puedeEscribir && esAnulable(o) && { label: "Anular", peligro: true, onClick: () => setPorAnular(o) },
          puedeBorrar && etapaDe(o) === "planificada" && { label: "Eliminar", peligro: true, onClick: () => abrirBorrado(o) },
        ]}
      />
    </div>
  );

  const getSearchText = (o) =>
    [o.id, nombreProducto(o), o.receta?.nombre, o.bodega?.nombre, o.elaboradorEncargado?.nombre, o.etapa_nombre].filter(Boolean).join(" ");

  return (
    <>
      <DataTable
        title="Elaboraciones"
        data={datos}
        headerExtra={({ filtrosColumna, cambiarFiltroColumna }) => (
          <ChipsEstado
            filas={datos}
            estados={CHIPS}
            campo="etapa_nombre"
            filtro={filtrosColumna.etapa_nombre}
            onCambiar={(f) => cambiarFiltroColumna("etapa_nombre", f)}
          />
        )}
        toolbarStart={
          <select
            aria-label="Bodega"
            value={bodega}
            onChange={(e) => setBodega(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Todas las bodegas</option>
            {bodegas.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        }
        columns={columns.map((c) => ({ ...c, headerClassName: `!px-3 ${c.headerClassName ?? ""}`, cellClassName: `!px-3 ${c.cellClassName ?? ""}` }))}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        loading={isLoading}
        loadingMessage="Cargando elaboraciones"
        defaultRowsPerPage={25}
        initialSort={{ key: "id", direction: "desc" }}
        persistKey="elaboraciones_v2"
        emptyMessage="No hay elaboraciones que calcen."
        headerActions={
          puedeEscribir && (
            <button className="btn btn-primario" onClick={() => navigate("/produccion/elaboraciones/nuevo")}>
              + Nueva elaboración
            </button>
          )
        }
      />

      {porAnular && (
        <ModalAnularElaboracion om={porAnular} abierto onCerrar={() => setPorAnular(null)} onAnulada={cargar} />
      )}

      <ConfirmDeletePreviewModal
        isOpen={!!porBorrar}
        onClose={() => setPorBorrar(null)}
        onConfirm={borrar}
        entityName={porBorrar ? `Elaboración #${porBorrar.id}` : "Elaboración"}
        title={porBorrar ? `¿Eliminar la elaboración #${porBorrar.id}?` : "¿Eliminar la elaboración?"}
        preview={porBorrar?.preview}
        loading={porBorrar?.cargando}
        error={porBorrar?.error}
      />
    </>
  );
}
