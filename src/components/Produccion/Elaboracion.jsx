// Piezas comunes de la lista y el detalle de elaboraciones (Fase 5, 2026-11-26).
import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "../UI/Modal.jsx";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { ETAPAS, barraEtapas, etapaDe } from "../../utils/elaboracionVista.js";

const BASE = "px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap";

export function EtapaBadge({ om }) {
  const e = ETAPAS[etapaDe(om)] ?? ETAPAS.planificada;
  return <span className={`${BASE} ${e.clase}`} title={om?.estado}>{e.nombre}</span>;
}

/** Insumos → Pasos → Producción → Valor agregado → Cerrada, con lo hecho en verde. */
export function BarraEtapas({ om }) {
  const pasos = barraEtapas(om);
  return (
    <ol className="flex flex-wrap items-center gap-2 md:flex-nowrap" aria-label="Etapas de la elaboración">
      {pasos.map((p, i) => (
        <li key={p.id} className="flex min-w-0 items-center gap-2 md:flex-1 md:last:flex-none">
          <span
            className={`flex items-center gap-2 whitespace-nowrap text-sm ${
              p.estado === "actual" ? "font-semibold text-text" : p.estado === "no_aplica" ? "text-gray-400" : "text-gray-700"
            }`}
            aria-current={p.estado === "actual" ? "step" : undefined}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                p.estado === "hecho"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : p.estado === "actual"
                    ? "border-primary bg-white text-primary"
                    : p.estado === "no_aplica"
                      ? "border-dashed border-gray-300 bg-white text-gray-400"
                      : "border-gray-300 bg-white text-gray-500"
              }`}
            >
              {p.estado === "hecho" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            {p.nombre}
            {p.estado === "no_aplica" ? (
              <span className="text-xs">no aplica</span>
            ) : p.detalle ? (
              <span className="text-xs text-gray-500">{p.detalle}</span>
            ) : null}
          </span>
          {i < pasos.length - 1 && (
            <span
              className={`hidden h-0.5 min-w-4 flex-1 md:block ${p.estado === "hecho" || p.estado === "no_aplica" ? "bg-emerald-500" : "bg-gray-200"}`}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * Anular una elaboración que no registró su producción. Si se consumieron insumos, se elige si
 * vuelven a sus bultos (no se hizo) o quedan consumidos (se usaron, aunque no se registró).
 */
export function ModalAnularElaboracion({ om, abierto, onCerrar, onAnulada }) {
  const [devolver, setDevolver] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const consumio = Number(om?.costo_total || 0) > 0;

  const anular = async () => {
    setEnviando(true);
    try {
      await api(`/ordenes_manufactura/${om.id}/cancelar`, { method: "PUT", body: JSON.stringify({ devolver }) });
      toast.success(`Elaboración #${om.id} anulada`);
      onAnulada?.();
      onCerrar();
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo anular la elaboración");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`¿Anular la elaboración #${om?.id}?`}
      pie={
        <>
          <button className="btn btn-secundario" onClick={onCerrar} disabled={enviando}>Volver</button>
          <button className="btn btn-peligro" onClick={anular} disabled={enviando}>
            {enviando ? "Anulando…" : "Anular"}
          </button>
        </>
      }
    >
      {consumio ? (
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium text-text">Los insumos ya se consumieron</legend>
          <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-primary">
            <input type="radio" name="devolver" checked={devolver} onChange={() => setDevolver(true)} className="mt-0.5" />
            <span><b>Devolverlos a sus bultos</b><span className="block text-gray-500">No se elaboró: el stock vuelve.</span></span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-primary">
            <input type="radio" name="devolver" checked={!devolver} onChange={() => setDevolver(false)} className="mt-0.5" />
            <span><b>Dejarlos consumidos</b><span className="block text-gray-500">Se usaron aunque no se registró la producción.</span></span>
          </label>
        </fieldset>
      ) : (
        <p className="text-sm text-gray-600">No tiene insumos consumidos: lo anotado se descarta.</p>
      )}
    </Modal>
  );
}

/** Terminar un valor agregado en un paso: el peso que sale y, si cambian, los bultos. */
export function ModalTerminarPVA({ pauta, abierto, onCerrar, onTerminada }) {
  const [peso, setPeso] = useState("");
  const [unidades, setUnidades] = useState("");
  const [enviando, setEnviando] = useState(false);

  const terminar = async () => {
    setEnviando(true);
    try {
      await api(`/pautas-valor-agregado/${pauta.id}/terminar`, {
        method: "POST",
        body: JSON.stringify({ peso_final: Number(peso), ...(unidades ? { unidades: Number(unidades) } : {}) }),
      });
      toast.success(`${pauta.proceso ?? "Valor agregado"} terminado`);
      onTerminada?.();
      onCerrar();
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo terminar el valor agregado");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Terminar ${pauta?.proceso ?? "valor agregado"}`}
      descripcion="Los pasos que falten quedan hechos."
      pie={
        <>
          <button className="btn btn-secundario" onClick={onCerrar} disabled={enviando}>Volver</button>
          <button className="btn btn-primario" onClick={terminar} disabled={enviando || !(Number(peso) > 0)}>
            {enviando ? "Terminando…" : "Terminar"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-600">Peso que sale (kg)</span>
          <input type="number" min="0" step="any" value={peso} onChange={(e) => setPeso(e.target.value)} autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-600">Bultos que salen <span className="text-gray-400">(opcional)</span></span>
          <input type="number" min="1" step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} placeholder="los mismos"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5" />
        </label>
      </div>
    </Modal>
  );
}
