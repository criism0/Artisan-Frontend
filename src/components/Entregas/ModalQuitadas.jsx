import { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";

/** Las OV quitadas del planificador, para devolverlas. No se les cambió el estado ni los documentos. */
export default function ModalQuitadas({ onCerrar, onCambio }) {
  const [filas, setFilas] = useState(null);
  const [enviando, setEnviando] = useState(null);

  const cargar = () => rutasApi.listarQuitadasDelPlanificador().then(setFilas).catch((e) => { setFilas([]); toast.error(e.message); });
  useEffect(() => { cargar(); }, []);

  const devolver = async (id) => {
    setEnviando(id);
    try {
      await rutasApi.quitarDelPlanificador(id, false);
      toast.success(`OV #${id} vuelve al planificador`);
      await cargar();
      await onCambio?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Quitadas del planificador" ancho="max-w-lg">
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {filas === null && <p className="p-3 text-sm text-gray-500">Cargando…</p>}
        {filas?.length === 0 && <p className="p-3 text-sm text-gray-500">No hay OV quitadas.</p>}
        {(filas ?? []).map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-gray-800 truncate">{o.cliente}</span>
              <span className="block text-xs text-gray-500 truncate">#{o.id}{o.numero_oc ? ` · ${o.numero_oc}` : ""} · {o.estado}</span>
            </span>
            <button
              type="button"
              disabled={enviando === o.id}
              onClick={() => devolver(o.id)}
              className="px-3 py-1 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Devolver
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
