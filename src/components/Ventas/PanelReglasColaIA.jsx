import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Modal from "../UI/Modal";
import { EditButton, TrashButton } from "../Buttons/ActionButtons";

const VACIA = { nombre: "", accion: "ignorar", remitente: "", asunto_contiene: "", adjunto_extension: "", instruccion: "" };

/** Qué hace la regla con el correo que cumple sus condiciones (2026-11-18). */
const ACCIONES = [
  { valor: "ignorar", etiqueta: "Ignorar el correo" },
  { valor: "documento_externo", etiqueta: "Marcar la OV con documento externo (boleta fuera del ERP)" },
  { valor: "instruccion", etiqueta: "Darle una instrucción a la IA para este cliente" },
  { valor: "precio_lista", etiqueta: "Usar el precio de la lista del cliente (el del correo es referencia)" },
];

/** Chip y verbo del contador según lo que hace la regla. Las de ignorar no llevan chip. */
const MARCA_ACCION = {
  documento_externo: { chip: "documento externo", clase: "bg-teal-50 text-teal-800", verbo: "marcados" },
  instruccion: { chip: "instrucción IA", clase: "bg-violet-50 text-violet-800", verbo: "usos" },
  precio_lista: { chip: "precio de lista", clase: "bg-amber-50 text-amber-800", verbo: "usos" },
};

/**
 * Correos que la Cola IA no procesa (pedido de Hernán, 2026-10-21): los pedidos que llegan dos
 * veces —el original y el que arma su script— se duplicaban. Antes de guardar, la regla se prueba
 * contra los últimos 60 días: si toca correos que crearon una orden, dejaría fuera ventas reales.
 * Desde 2026-11-18 una regla también puede marcar la OV que crea el correo con documento externo
 * (los pedidos de la tienda web, con boleta): ahí tocar correos que crearon orden es lo esperado.
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
        if (form.accion === "ignorar" && p.crearon_orden > 0) return;
        // Las demás acciones no dejan pedidos fuera: no hace falta mirar la prueba para guardar.
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
              <p className="text-sm font-medium text-gray-900 truncate">
                {r.nombre}
                {MARCA_ACCION[r.accion] && (
                  <span className={`ml-2 text-xs font-semibold rounded px-1.5 py-0.5 ${MARCA_ACCION[r.accion].clase}`}>{MARCA_ACCION[r.accion].chip}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {r.remitente && <Condicion etiqueta="De" valor={r.remitente} />}
                {r.asunto_contiene && <Condicion etiqueta="Asunto" valor={r.asunto_contiene} />}
                {r.adjunto_extension && <Condicion etiqueta="Adjunto" valor={`.${r.adjunto_extension}`} />}
              </div>
              {r.accion === "instruccion" && r.instruccion && (
                <p className="text-xs text-gray-500 mt-1 truncate" title={r.instruccion}>{r.instruccion}</p>
              )}
            </div>
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">{r.ignorados} {MARCA_ACCION[r.accion]?.verbo ?? "ignorados"}</span>
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
              {form.accion === "ignorar" && prueba?.crearon_orden > 0 ? "Guardar igual" : "Guardar"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Entrada etiqueta="Nombre" valor={form.nombre} onCambiar={(v) => campo("nombre", v)} ejemplo="Lokal: aviso de pedido nuevo" />
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Qué hace</span>
            <select
              value={form.accion}
              onChange={(e) => campo("accion", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
            >
              {ACCIONES.map((a) => <option key={a.valor} value={a.valor}>{a.etiqueta}</option>)}
            </select>
          </label>
          <Entrada etiqueta="Remitente (dirección o @dominio)" valor={form.remitente} onCambiar={(v) => campo("remitente", v)} ejemplo="@somoslokal.cl" />
          <Entrada etiqueta="El asunto contiene" valor={form.asunto_contiene} onCambiar={(v) => campo("asunto_contiene", v)} ejemplo="tienes un nuevo pedido" />
          <Entrada etiqueta="Adjunto (extensión)" valor={form.adjunto_extension} onCambiar={(v) => campo("adjunto_extension", v)} ejemplo="rtf" />
          {form.accion === "instruccion" && (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Instrucción para la IA</span>
              <textarea
                value={form.instruccion}
                onChange={(e) => campo("instruccion", e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Toma las líneas tal como vienen, sin dividirlas."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
              />
            </label>
          )}
          {prueba && <ResultadoPrueba prueba={prueba} marca={form.accion !== "ignorar"} />}
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

function ResultadoPrueba({ prueba, marca }) {
  const peligro = !marca && prueba.crearon_orden > 0;
  return (
    <div className={`rounded-lg border p-3 text-sm ${peligro ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
      <p className="font-medium">
        {peligro
          ? `${prueba.crearon_orden} de los correos que toca crearon una orden: dejaría fuera pedidos reales.`
          : marca
            ? `En los últimos ${prueba.dias} días habría aplicado a ${prueba.crearon_orden} pedido${prueba.crearon_orden === 1 ? "" : "s"} (de ${prueba.total} correo${prueba.total === 1 ? "" : "s"}).`
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
