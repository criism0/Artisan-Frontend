import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import Modal from "../../components/UI/Modal.jsx";
import { EditButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { mensajeError } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

const VACIA = {
  nombre: "",
  transportista: "",
  rut_transportista: "",
  chofer_nombre: "",
  chofer_rut: "",
  patente: "",
  patente_carro: "",
  id_bodega_por_defecto: "",
  activa: true,
};

/**
 * Combinaciones de transporte (Res. Ex. SII N° 154, desde el 1-nov-2026): el transportista, el
 * chofer y la patente que se eligen al emitir una factura o una guía, en vez de escribirlos cada
 * vez (pedido de Hernán, 2026-10-22). La de cada bodega es la que el formulario trae puesta.
 * No se borran: una que ya no se usa se desactiva, y lo emitido guarda su copia.
 */
export default function TransportePage() {
  const api = useApi();
  const [combinaciones, setCombinaciones] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null = cerrado · {} = nueva · fila = editar
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);
  const puedeEditar = checkScope(ModelType.BODEGA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api("/combinaciones-transporte");
      setCombinaciones(res?.combinaciones ?? []);
    } catch (err) {
      toast.error(mensajeError(err, "cargar las combinaciones de transporte"));
    } finally {
      setCargando(false);
    }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    api("/bodegas")
      // `/bodegas` responde `{ bodegas: [...] }`.
      .then((r) => setBodegas(Array.isArray(r) ? r : r?.bodegas ?? r?.data ?? []))
      .catch(() => setBodegas([]));
  }, [api]);

  const abrir = (fila) => {
    setEditando(fila ?? {});
    setForm(fila
      ? Object.fromEntries(Object.keys(VACIA).map((k) => [k, fila[k] ?? VACIA[k]]))
      : VACIA);
  };
  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    try {
      const body = { ...form, id_bodega_por_defecto: form.id_bodega_por_defecto ? Number(form.id_bodega_por_defecto) : null };
      if (editando?.id) await api(`/combinaciones-transporte/${editando.id}`, { method: "PUT", body });
      else await api("/combinaciones-transporte", { method: "POST", body });
      setEditando(null);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, "guardar la combinación"));
    } finally {
      setGuardando(false);
    }
  };

  const filas = useMemo(() => combinaciones.map((c) => ({
    ...c,
    bodega_nombre: c.bodegaPorDefecto?.nombre ?? "",
    estado: c.activa ? "Activa" : "Desactivada",
  })), [combinaciones]);

  const columns = useMemo(() => [
    { header: "Nombre", accessor: "nombre", sortable: true, hideable: false },
    {
      header: "Transportista",
      accessor: "rut_transportista",
      sortable: true,
      Cell: ({ row }) => <Doble arriba={row.transportista} abajo={row.rut_transportista} />,
    },
    {
      header: "Chofer",
      accessor: "chofer_nombre",
      sortable: true,
      Cell: ({ row }) => <Doble arriba={row.chofer_nombre} abajo={row.chofer_rut} />,
    },
    {
      header: "Patente",
      accessor: "patente",
      sortable: true,
      Cell: ({ row }) => (row.patente_carro ? `${row.patente} · carro ${row.patente_carro}` : row.patente),
    },
    {
      header: "Por defecto en",
      accessor: "bodega_nombre",
      sortable: true,
      Cell: ({ value }) => value || <span className="text-gray-400">—</span>,
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {row.estado}
        </span>
      ),
    },
  ], []);

  const acciones = (row) => (
    <div className="flex gap-2 justify-center items-center">
      {puedeEditar && <EditButton onClick={() => abrir(row)} tooltipText="Editar" />}
    </div>
  );

  return (
    <div className="p-6">
      <DataTable
        title="Transporte"
        data={filas}
        columns={columns}
        actions={puedeEditar ? acciones : undefined}
        persistKey="combinaciones-transporte"
        loading={cargando}
        loadingMessage="Cargando combinaciones"
        emptyMessage="No hay combinaciones de transporte."
        headerActions={puedeEditar && (
          <button
            type="button"
            onClick={() => abrir(null)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            <Plus className="w-4 h-4" /> Nueva combinación
          </button>
        )}
      />

      <Modal
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando?.id ? "Editar combinación" : "Nueva combinación"}
        pie={
          <>
            <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Entrada clase="col-span-2" etiqueta="Nombre" valor={form.nombre} onCambiar={(v) => campo("nombre", v)} ejemplo="Santiago, camión de Juan" />
          <Entrada etiqueta="Transportista" valor={form.transportista} onCambiar={(v) => campo("transportista", v)} ejemplo="Transportes Pérez Ltda." />
          <Entrada etiqueta="RUT del transportista" valor={form.rut_transportista} onCambiar={(v) => campo("rut_transportista", v)} ejemplo="76.123.456-7" />
          <Entrada etiqueta="Chofer" valor={form.chofer_nombre} onCambiar={(v) => campo("chofer_nombre", v)} ejemplo="Juan Pérez" />
          <Entrada etiqueta="RUT del chofer" valor={form.chofer_rut} onCambiar={(v) => campo("chofer_rut", v)} ejemplo="12.345.678-5" />
          <Entrada etiqueta="Patente" valor={form.patente} onCambiar={(v) => campo("patente", v)} ejemplo="BBCC12" />
          <Entrada etiqueta="Patente del carro (si lleva)" valor={form.patente_carro} onCambiar={(v) => campo("patente_carro", v)} ejemplo="JK1234" />
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Por defecto en</span>
            <select
              value={form.id_bodega_por_defecto ?? ""}
              onChange={(e) => campo("id_bodega_por_defecto", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-transparent"
            >
              <option value="">Ninguna bodega</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!form.activa} onChange={(e) => campo("activa", e.target.checked)} className="w-4 h-4 accent-[#7A5AF8]" />
            Activa
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Doble({ arriba, abajo }) {
  return (
    <div className="leading-tight">
      <div>{arriba || <span className="text-gray-400">—</span>}</div>
      <div className="text-xs text-gray-500 tabular-nums">{abajo}</div>
    </div>
  );
}

function Entrada({ etiqueta, valor, onCambiar, ejemplo, clase = "" }) {
  return (
    <label className={`block ${clase}`}>
      <span className="block text-sm font-medium text-gray-700 mb-1">{etiqueta}</span>
      <input
        type="text"
        value={valor ?? ""}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={ejemplo}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
      />
    </label>
  );
}
