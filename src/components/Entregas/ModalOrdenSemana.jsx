import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../UI/Modal";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";

const cantidad = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });
const nombreLinea = (p) => p?.NombreFacturacion?.nombre || p?.ProductoBase?.nombre || "Producto";

/**
 * Una OV del planificador semanal: lo que pidió el cliente y dos atajos —marcarla como entregada
 * fuera del flujo (ya se entregó por otro lado) o quitarla del planificador—. También permite
 * moverla de día. Una OV que ya va en una ruta sólo se mira.
 */
export default function ModalOrdenSemana({ orden, dias, puedeEscribir, onCerrar, onMover, onCambio }) {
  const navigate = useNavigate();
  const [productos, setProductos] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api(`/ordenes-venta/${orden.id}/info`)
      .then((o) => vivo && setProductos(Array.isArray(o?.productos) ? o.productos : []))
      .catch((e) => { if (vivo) { setProductos([]); toast.error(e.message); } });
    return () => { vivo = false; };
  }, [orden.id]);

  const ejecutar = async (accion, mensaje) => {
    setEnviando(true);
    try {
      await accion();
      toast.success(mensaje);
      await onCambio?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const libre = puedeEscribir && !orden.ruta;
  const total = (productos ?? []).reduce((s, p) => s + Number(p.cantidad || 0), 0);

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`OV #${orden.id} · ${orden.cliente.nombre}`}
      descripcion={[orden.comuna, orden.ruta ? `Ruta #${orden.ruta.id}` : null].filter(Boolean).join(" · ") || undefined}
      ancho="max-w-xl"
      pie={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <button type="button" onClick={() => navigate(`/ventas/ordenes/${orden.id}`)} className="text-sm text-primary hover:underline">
            Abrir la OV
          </button>
          {libre && !confirmando && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() => ejecutar(() => rutasApi.quitarDelPlanificador(orden.id), "Quitada del planificador")}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Quitar del planificador
              </button>
              <button type="button" onClick={() => setConfirmando(true)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                Marcar como entregada
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {productos === null && <p className="p-3 text-sm text-gray-500">Cargando…</p>}
          {productos?.length === 0 && <p className="p-3 text-sm text-gray-500">Sin productos.</p>}
          {(productos ?? []).map((p, i) => (
            <div key={p.id ?? i} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
              <span className="text-gray-800 min-w-0">{nombreLinea(p)}</span>
              <span className="tabular-nums text-gray-700 shrink-0">{cantidad(p.cantidad)}</span>
            </div>
          ))}
        </div>
        {productos?.length > 0 && <p className="text-xs text-gray-500 text-right">{productos.length} líneas · {cantidad(total)} unidades pedidas</p>}

        {libre && confirmando && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex flex-col gap-2">
            <p className="text-sm font-medium text-green-900">¿Ya se entregó? Queda como entregada y sale del planificador.</p>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): cómo o quién la entregó" className="h-9 px-3 border border-gray-300 rounded-lg bg-white text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:underline">Cancelar</button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => ejecutar(() => rutasApi.marcarEntregadaFueraDeFlujo(orden.id, nota.trim() || null), "Marcada como entregada")}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar entrega
              </button>
            </div>
          </div>
        )}

        {libre && !confirmando && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Mover a</span>
            {dias.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => { onMover(orden, d.iso); onCerrar(); }}
                disabled={orden.dia === d.iso}
                className="px-2 py-1 rounded-md border border-gray-300 text-xs hover:bg-gray-50 disabled:bg-primary/10 disabled:text-primary disabled:border-primary/30"
              >
                {d.nombre}
              </button>
            ))}
          </div>
        )}
        {orden.ruta && <p className="text-xs text-gray-500">Va en la ruta #{orden.ruta.id}: sale ese día. Para cambiarla, hazlo desde la ruta.</p>}
      </div>
    </Modal>
  );
}
