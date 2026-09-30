import { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import CamposDireccionEntrega from "./CamposDireccionEntrega";
import { entregaDeOrden, entregaVacia, guardarDireccionEntrega } from "../../services/ubicacionService";
import { toast } from "../../lib/toast.js";

/**
 * Escribir o corregir la dirección de entrega propia de una orden. Al guardar, el backend la
 * ubica en el mapa; si la dirección cambió, el pin anterior se suelta.
 */
export default function ModalDireccionEntrega({ abierto, onCerrar, orden, onGuardada }) {
  const [valor, setValor] = useState(entregaVacia());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setValor(entregaDeOrden(orden));
  }, [abierto, orden]);

  const guardar = async (datos) => {
    setGuardando(true);
    try {
      const actualizada = await guardarDireccionEntrega(orden.id, datos);
      toast.success(datos.entrega_direccion ? "Dirección de entrega guardada" : "Dirección de entrega quitada");
      onGuardada?.(actualizada);
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const tenia = Boolean(orden?.entrega_direccion);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Dirección de entrega · OV #${orden?.id ?? ""}`}
      descripcion="A dónde va ESTE pedido. Manda sobre la dirección de despacho del cliente."
      ancho="max-w-2xl"
      pie={
        <>
          {tenia && (
            <button
              type="button"
              onClick={() => guardar(entregaVacia())}
              disabled={guardando}
              className="mr-auto px-4 py-2 text-sm rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Quitar dirección propia
            </button>
          )}
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => guardar(valor)}
            disabled={guardando || !valor.entrega_direccion.trim() || !valor.entrega_comuna.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar
          </button>
        </>
      }
    >
      <CamposDireccionEntrega valor={valor} onChange={setValor} comentarioCliente={orden?.comentario_cliente} />
    </Modal>
  );
}
