import { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import CamposDireccionEntrega from "./CamposDireccionEntrega";
import { entregaDeOrden, entregaVacia, guardarDireccionEntrega } from "../../services/ubicacionService";
import { toast } from "../../lib/toast.js";

/**
 * Escribir o corregir la dirección a la que va ESTE pedido cuando no es una de las guardadas del
 * cliente. Con «Guardar también en las direcciones del cliente» queda como dirección de despacho
 * del cliente y el pedido le apunta; si no, queda sólo en la orden. Al guardar, el backend la
 * ubica en el mapa; si la dirección cambió, el pin anterior se suelta.
 */
export default function ModalDireccionEntrega({ abierto, onCerrar, orden, onGuardada }) {
  const [valor, setValor] = useState(entregaVacia());
  const [guardando, setGuardando] = useState(false);
  const [enCliente, setEnCliente] = useState(false);

  useEffect(() => {
    if (abierto) {
      setValor(entregaDeOrden(orden));
      setEnCliente(false);
    }
  }, [abierto, orden]);

  const guardar = async (datos, guardarEnCliente = false) => {
    setGuardando(true);
    try {
      const actualizada = await guardarDireccionEntrega(orden.id, guardarEnCliente ? { ...datos, guardar_en_cliente: true } : datos);
      toast.success(
        guardarEnCliente
          ? "Dirección guardada en el cliente y asignada a este pedido"
          : datos.entrega_direccion
            ? "Dirección de este pedido guardada"
            : "Dirección de este pedido quitada",
      );
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
      titulo={`Otra dirección de entrega · OV #${orden?.id ?? ""}`}
      descripcion="A dónde va ESTE pedido, si no es una de las direcciones guardadas del cliente."
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
              Quitar esta dirección
            </button>
          )}
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => guardar(valor, enCliente)}
            disabled={guardando || !valor.entrega_direccion.trim() || !valor.entrega_comuna.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CamposDireccionEntrega valor={valor} onChange={setValor} comentarioCliente={orden?.comentario_cliente} />
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 accent-primary" checked={enCliente} onChange={(e) => setEnCliente(e.target.checked)} />
          <span>
            Guardar también en las direcciones del cliente
            <span className="block text-xs text-gray-500">
              Para una sucursal o bodega nueva a la que se le volverá a despachar. Déjalo sin marcar si es sólo para este
              pedido (la casa de un comprador de la tienda web, un despacho puntual).
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
