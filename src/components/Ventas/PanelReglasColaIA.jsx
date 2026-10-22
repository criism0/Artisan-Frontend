import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Modal from "../UI/Modal";
import { EditButton, TrashButton } from "../Buttons/ActionButtons";

const VACIA = { nombre: "", remitente: "", asunto_contiene: "", adjunto_extension: "" };

/**
 * Correos que la Cola IA no procesa (pedido de Hernán, 2026-10-21): los pedidos que llegan dos
 * veces —el original y el que arma su script— se duplicaban. Antes de guardar, la regla se prueba
 * contra los últimos 60 días: si toca correos que crearon una orden, dejaría fuera ventas reales.
 */
export default function PanelReglasColaIA() {
  const api = useApi();
  const [reglas, setReglas] = useState(null);
  const [editando, setEditando] = useState(null); // null = cerrado · {} = nueva · regla = editar
  const [form, setForm] = useState(VACIA);
  const [prueba, setPrueba] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api("/ordenes-venta/cola-ia/reglas");
      setReglas(Array.isArray(r) ? r : r?.data ?? []);
    } catch (e) {
      toast.error(e.message);
      setReglas([]);
    }
  }, [api]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (regla) => {
    setEditando(regla ?? {});
    setForm(regla ? { ...VACIA, ...Object.fromEntries(Object.keys(VACIA).map((k) => [k, regla[k] ?? ""])) } : VACIA);
    setPrueba(null);
  };
  const campo = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setPrueba(null); };

  const guardar = async () => {
    setGuardando(true);
    try {
      // Se prueba siempre antes de guardar; si toca pedidos reales, el segundo clic confirma.
      if (!prueba) {
        const p = await api("/ordenes-venta/cola-ia/reglas/probar", { method: "POST", body: form });
        setPrueba(p);
        if (p.crearon_orden > 0) return;
      }
      if (editando?.id) await api(`/ordenes-venta/cola-ia/reglas/${editando.id}`, { method: "PUT", body: form });
      else await api("/ordenes-venta/cola-ia/reglas", { method: "POST", body: form });
      setEditando(null);
      await cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternar = async (regla) => {
    try {
      await api(`/ordenes-venta/cola-ia/reglas/${regla.id}`, { method: "PUT", body: { activa: !regla.activa } });
      await cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const eliminar = async (regla) => {
    try {
      await api(`/ordenes-venta/cola-ia/reglas/${regla.id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!reglas) return <p className="text-sm text-gray-500 py-6">Cargando…</p>;

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-3">
        <button type="button" onClick={() => abrir(null)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
          <Plus className="w-4 h-4" /> Nueva regla
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {reglas.length === 0 && <p className="text-sm text-gray-500 p-4">No hay reglas.</p>}
        {reglas.map((r) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.activa ? "" : "opacity-50"}`}>
            <input type="checkbox" checked={r.activa} onChange={() => alternar(r)} title={r.activa ? "Desactivar" : "Activar"} className="w-4 h-4 accent-[#7A5AF8]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{r.nombre}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {r.remitente && <Condicion etiqueta="De" valor={r.remitente} />}
                {r.asunto_contiene && <Condicion etiqueta="Asunto" valor={r.asunto_contiene} />}
                {r.adjunto_extension && <Condicion etiqueta="Adjunto" valor={`.${r.adjunto_extension}`} />}
              </div>
            </div>
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">{r.ignorados} ignorados</span>
            <EditButton onClick={() => abrir(r)} tooltipText="Editar" />
            <TrashButton onConfirmDelete={() => eliminar(r)} tooltipText="Eliminar" entityName="regla" />
          </div>
        ))}
      </div>

      <Modal
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando?.id ? "Editar regla" : "Nueva regla"}
        pie={
          <>
            <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">
              {prueba?.crearon_orden > 0 ? "Guardar igual" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Entrada etiqueta="Nombre" valor={form.nombre} onCambiar={(v) => campo("nombre", v)} ejemplo="Lokal: aviso de pedido nuevo" />
          <Entrada etiqueta="Remitente (dirección o @dominio)" valor={form.remitente} onCambiar={(v) => campo("remitente", v)} ejemplo="@somoslokal.cl" />
          <Entrada etiqueta="El asunto contiene" valor={form.asunto_contiene} onCambiar={(v) => campo("asunto_contiene", v)} ejemplo="tienes un nuevo pedido" />
          <Entrada etiqueta="Adjunto (extensión)" valor={form.adjunto_extension} onCambiar={(v) => campo("adjunto_extension", v)} ejemplo="rtf" />
          {prueba && <ResultadoPrueba prueba={prueba} />}
        </div>
      </Modal>
    </div>
  );
}

function Condicion({ etiqueta, valor }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
      <span className="text-gray-500">{etiqueta}:</span> {valor}
    </span>
  );
}

function Entrada({ etiqueta, valor, onCambiar, ejemplo }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{etiqueta}</span>
      <input
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={ejemplo}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
      />
    </label>
  );
}

function ResultadoPrueba({ prueba }) {
  const peligro = prueba.crearon_orden > 0;
  return (
    <div className={`rounded-lg border p-3 text-sm ${peligro ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
      <p className="font-medium">
        {peligro
          ? `${prueba.crearon_orden} de los correos que toca crearon una orden: dejaría fuera pedidos reales.`
          : `En los últimos ${prueba.dias} días habría ignorado ${prueba.total} correo${prueba.total === 1 ? "" : "s"}.`}
      </p>
      {prueba.ejemplos.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {prueba.ejemplos.map((e, i) => (
            <li key={i} className="truncate">
              {e.orden_venta_id ? `OV #${e.orden_venta_id} · ` : ""}{e.asunto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
