import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../../components/Tables/DataTable";
import Modal from "../../components/UI/Modal.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeError } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";

const ABREVIATURA = { kilogramos: "kg", litros: "L", unidades: "un" };
const cantidadConUnidad = (n, unidad) =>
  `${Number(n ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 4 })} ${ABREVIATURA[String(unidad).toLowerCase()] ?? unidad ?? ""}`.trim();

/**
 * El consumo interno de insumos (2026-09-24): lo que se descontó de un bulto desde la app porque
 * se ocupó —en el CD, por ejemplo—, con quién lo hizo. Antes eso terminaba como merma en la
 * siguiente toma de inventario.
 *
 * Se registra desde el móvil; acá se revisa y, si alguien se equivocó, se deshace. Hernán pidió
 * partir abierto: cualquiera con permiso de bultos puede deshacer, y queda quién lo hizo.
 */
export default function ConsumoInternoPage() {
  const api = useApi();
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
    { header: "Fecha", accessor: "createdAt", sortable: true, filtro: "fecha", Cell: ({ value }) => fmtFecha(value) },
    { header: "Bodega", accessor: "bodega_nombre", sortable: true },
    { header: "Insumo", accessor: "insumo", sortable: true },
    { header: "Bulto", accessor: "identificador_bulto", sortable: true },
    {
      header: "Cantidad",
      accessor: "cantidad",
      align: "right",
      sortable: true,
      Cell: ({ row }) => cantidadConUnidad(row.cantidad, row.unidad_medida),
    },
    { header: "Costo", accessor: "costo", align: "right", sortable: true, Cell: ({ value }) => formatCLP(Number(value || 0), 0) },
    { header: "Registró", accessor: "registro", sortable: true },
    {
      header: "Comentario",
      accessor: "comentario",
      Cell: ({ value }) => value
        ? <span className="block max-w-xs truncate" title={value}>{value}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ row }) => row.anulado_en ? (
        <span className="text-gray-500" title={fmtFecha(row.anulado_en)}>
          Deshecho{row.anuladoPor?.nombre ? ` por ${row.anuladoPor.nombre}` : ""}
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Vigente</span>
      ),
    },
  ], []);

  return (
    <div className="p-6">
      <DataTable
        title="Consumo interno"
        data={filas}
        columns={columns}
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
        actions={(row) => (!row.anulado_en && puedeDeshacer ? (
          <button type="button" onClick={() => setADeshacer(row)} className="text-sm text-primary hover:underline">
            Deshacer
          </button>
        ) : null)}
      />

      <Modal
        abierto={!!aDeshacer}
        onCerrar={() => setADeshacer(null)}
        titulo="Deshacer consumo"
        descripcion={aDeshacer ? `${aDeshacer.insumo} · ${aDeshacer.identificador_bulto}` : ""}
        pie={
          <>
            <button type="button" onClick={() => setADeshacer(null)} className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100">Cancelar</button>
            <button type="button" onClick={deshacer} disabled={guardando} className="px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50">
              {guardando ? "Deshaciendo…" : "Deshacer"}
            </button>
          </>
        }
      >
        {aDeshacer && (
          <p className="text-sm text-gray-700">
            Se devuelven <strong>{cantidadConUnidad(aDeshacer.cantidad, aDeshacer.unidad_medida)}</strong> al bulto,
            como si el consumo no se hubiera registrado. El registro no se borra: queda marcado como deshecho, con tu nombre.
          </p>
        )}
      </Modal>
    </div>
  );
}
