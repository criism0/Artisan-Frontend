import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import Modal from "../../components/UI/Modal.jsx";
import { UndoButton, ViewDetailButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeError } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { cantidadConUnidad, fmtFechaHora } from "../../utils/consumoInterno.js";

/**
 * El consumo interno de insumos (2026-09-24): lo que se descontó de un bulto desde la app porque
 * se ocupó —en el CD, por ejemplo—, con quién lo hizo. Antes eso terminaba como merma en la
 * siguiente toma de inventario.
 *
 * Se registra desde el móvil; acá se revisa y, si alguien se equivocó, se deshace. El detalle de
 * cada uno —de cuánto a cuánto pasó el bulto— está en `ConsumoInternoDetail`. Las acciones van
 * fijas a la derecha, como en la lista de órdenes de venta, para que no se pierdan al ocultar o
 * sumar columnas.
 */
export default function ConsumoInternoPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [consumos, setConsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [conDeshechos, setConDeshechos] = useState(false);
  const [aDeshacer, setADeshacer] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const puedeDeshacer = checkScope(ModelType.BULTO, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api(`/consumos-internos?limit=1000${conDeshechos ? "&incluir_anulados=1" : ""}`);
      setConsumos(res?.data ?? []);
    } catch (err) {
      toast.error(mensajeError(err, "cargar los consumos"));
    } finally {
      setCargando(false);
    }
  }, [api, conDeshechos]);

  useEffect(() => { cargar(); }, [cargar]);

  const deshacer = async () => {
    try {
      setGuardando(true);
      const res = await api(`/consumos-internos/${aDeshacer.id}/anular`, { method: "PUT" });
      toast.success(res?.message || "Consumo deshecho");
      setADeshacer(null);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, "deshacer el consumo"));
    } finally {
      setGuardando(false);
    }
  };

  const filas = useMemo(() => consumos.map((c) => ({
    ...c,
    bodega_nombre: c.bodega?.nombre ?? "—",
    insumo: c.materiaPrima?.nombre ?? "—",
    registro: c.registradoPor?.nombre ?? "—",
    estado: c.anulado_en ? "Deshecho" : "Vigente",
  })), [consumos]);

  const totalVigente = useMemo(
    () => filas.filter((c) => !c.anulado_en).reduce((s, c) => s + Number(c.costo || 0), 0),
    [filas],
  );

  const columns = useMemo(() => [
    { header: "N°", accessor: "id", sortable: true, filtro: "numero", defaultHidden: true },
    { header: "Fecha", accessor: "createdAt", sortable: true, filtro: "fecha", Cell: ({ value }) => fmtFechaHora(value) },
    { header: "Insumo", accessor: "insumo", sortable: true, hideable: false },
    { header: "Bulto", accessor: "identificador_bulto", sortable: true },
    { header: "Bodega", accessor: "bodega_nombre", sortable: true },
    {
      header: "Consumido",
      accessor: "cantidad",
      align: "right",
      sortable: true,
      Cell: ({ row }) => cantidadConUnidad(row.cantidad, row.unidad_medida),
    },
    {
      header: "Quedó en el bulto",
      accessor: "disponible_despues",
      align: "right",
      sortable: true,
      defaultHidden: true,
      Cell: ({ row }) => cantidadConUnidad(row.disponible_despues, row.unidad_medida),
    },
    { header: "Costo", accessor: "costo", align: "right", sortable: true, Cell: ({ value }) => formatCLP(Number(value || 0), 0) },
    { header: "Registró", accessor: "registro", sortable: true },
    {
      header: "Comentario",
      accessor: "comentario",
      defaultHidden: true,
      Cell: ({ value }) => value
        ? <span className="block max-w-xs truncate" title={value}>{value}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      hideable: false,
      Cell: ({ row }) => row.anulado_en ? (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600" title={fmtFechaHora(row.anulado_en)}>
          Deshecho
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Vigente</span>
      ),
    },
  ], []);

  const acciones = (row) => (
    <div className="flex gap-2 justify-center items-center">
      <ViewDetailButton onClick={() => navigate(`/Inventario/consumo-interno/${row.id}`)} tooltipText="Ver detalle" />
      {!row.anulado_en && puedeDeshacer && (
        <UndoButton onClick={() => setADeshacer(row)} tooltipText="Deshacer consumo" />
      )}
    </div>
  );

  return (
    <div className="p-6">
      <DataTable
        title="Consumo interno"
        data={filas}
        columns={columns}
        actions={acciones}
        stickyActions
        persistKey="consumo-interno"
        loading={cargando}
        loadingMessage="Cargando consumos"
        defaultRowsPerPage={25}
        emptyMessage="No hay consumos registrados. Se registran desde la app, escaneando el bulto."
        toolbarStart={
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={conDeshechos} onChange={(e) => setConDeshechos(e.target.checked)} />
              Mostrar deshechos
            </label>
            <span className="text-gray-500">
              Vigentes: <span className="font-medium text-text">{formatCLP(totalVigente, 0)}</span>
            </span>
          </div>
        }
      />

      <ModalDeshacer
        consumo={aDeshacer}
        guardando={guardando}
        onCancelar={() => setADeshacer(null)}
        onConfirmar={deshacer}
      />
    </div>
  );
}

/** Compartido con el detalle: lo mismo se confirma igual desde los dos lados. */
export function ModalDeshacer({ consumo, guardando, onCancelar, onConfirmar }) {
  return (
    <Modal
      abierto={!!consumo}
      onCerrar={onCancelar}
      titulo="Deshacer consumo"
      descripcion={consumo ? `${consumo.materiaPrima?.nombre ?? "Insumo"} · ${consumo.identificador_bulto}` : ""}
      pie={
        <>
          <button type="button" onClick={onCancelar} className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100">Cancelar</button>
          <button type="button" onClick={onConfirmar} disabled={guardando} className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50">
            {guardando ? "Deshaciendo…" : "Deshacer"}
          </button>
        </>
      }
    >
      {consumo && (
        <p className="text-sm text-gray-700">
          Se devuelven <strong>{cantidadConUnidad(consumo.cantidad, consumo.unidad_medida)}</strong> al bulto,
          como si el consumo no se hubiera registrado. El registro no se borra: queda marcado como deshecho, con tu nombre.
        </p>
      )}
    </Modal>
  );
}
