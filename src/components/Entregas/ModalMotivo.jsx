import { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import { toast } from "../../lib/toast.js";

/**
 * Confirmar una acción que exige explicar por qué (anular un registro, cerrar una ruta antes de
 * tiempo). `onConfirmar(motivo)` hace la llamada; si lanza, el error se muestra y el modal sigue
 * abierto.
 */
export default function ModalMotivo({ abierto, onCerrar, titulo, descripcion, textoBoton, destructiva = true, placeholder, onConfirmar }) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setMotivo("");
  }, [abierto]);

  const confirmar = async () => {
    setGuardando(true);
    try {
      await onConfirmar(motivo.trim());
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={descripcion}
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando || motivo.trim().length < 3}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${destructiva ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"}`}
          >
            {guardando ? "Guardando…" : textoBoton}
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
          placeholder={placeholder}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </label>
    </Modal>
  );
}
