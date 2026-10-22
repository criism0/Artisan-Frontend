import { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import { cancelarRuta } from "../../services/rutasService";
import { formatearFecha } from "../../utils/rutas";
import { toast } from "../../lib/toast.js";

/** Cancelar una ruta que todavía no sale, con su motivo. Sus pedidos quedan libres para otra. */
export default function ModalCancelarRuta({ ruta, onCerrar, onCancelada }) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (ruta) setMotivo("");
  }, [ruta]);

  const confirmar = async () => {
    setGuardando(true);
    try {
      const r = await cancelarRuta(ruta.id, motivo);
      toast.success("Ruta cancelada: sus pedidos quedaron libres");
      onCancelada?.(r);
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={Boolean(ruta)}
      onCerrar={onCerrar}
      titulo={ruta ? `Cancelar la ruta #${ruta.id} del ${formatearFecha(ruta.fecha)}` : ""}
      descripcion="Sus pedidos quedan libres para otra ruta."
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando || motivo.trim().length < 3}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50"
          >
            Cancelar ruta
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        Motivo
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Por qué se cancela"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </label>
    </Modal>
  );
}
