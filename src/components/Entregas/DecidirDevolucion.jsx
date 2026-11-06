import { useState } from "react";
import Aviso from "../UI/Aviso";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";

const ACCIONES = [
  { accion: "Reintegrar", texto: "Reintegrar al stock", tono: "bg-green-600 hover:bg-green-700", detalle: "Vuelve al inventario con el lote y el costo de donde salió. Lo armado nace como bulto nuevo, con etiqueta por imprimir; la caja cerrada recupera sus unidades." },
  { accion: "Merma", texto: "Dar de merma", tono: "bg-red-600 hover:bg-red-700", detalle: "Vuelve marcado merma: no se ofrece como stock bueno." },
  { accion: "Re-despachar", texto: "Vuelve a salir", tono: "bg-primary hover:bg-primary-dark", detalle: "Queda listo para otra ruta, sin tocar el inventario." },
];
// Lo que no existía en el inventario tampoco entra como merma: queda registrado como pérdida.
const DETALLE_MERMA_SIN_TRAZABILIDAD = "Queda registrado como merma; no entra al inventario.";

/**
 * Qué se hace con un bulto que volvió de una ruta (o que no volvió): reintegrarlo, darlo de merma o
 * que vuelva a salir. Lo usan Logística → Devoluciones y la revisión de una entrega.
 *
 * `compacto`: botones en una fila, sin la explicación de cada uno (va en el `title`).
 */
export default function DecidirDevolucion({ bulto, onResuelto, compacto = false }) {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  const resolver = async (accion) => {
    setEnviando(true);
    try {
      const r = await rutasApi.resolverDevolucion(bulto.id, { accion, nota: nota.trim() || null });
      const nuevos = (r.lineas ?? []).flatMap((l) => l.bultos_reintegro ?? []);
      toast.success(accion === "Re-despachar" ? "Listo para otra ruta" : accion === "Merma" ? "Dado de merma" : "Reintegrado al inventario");
      (r.avisos ?? []).forEach((a) => toast.warning(a));
      if (accion !== "Re-despachar" && bulto.tipo !== "Caja cerrada" && nuevos.length) {
        toast.info(`Imprime la etiqueta del bulto nuevo en Inventario → Bultos (${nuevos.map((n) => `#${n}`).join(", ")}).`);
      }
      setNota("");
      await onResuelto?.(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const acciones = ACCIONES.filter(
    (a) => !(a.accion === "Re-despachar" && bulto.tipo === "Suelto") && !(a.accion === "Reintegrar" && bulto.sin_trazabilidad),
  );
  const detalle = (a) => (a.accion === "Merma" && bulto.sin_trazabilidad ? DETALLE_MERMA_SIN_TRAZABILIDAD : a.detalle);

  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {acciones.map((a) => (
          <button
            key={a.accion}
            type="button"
            disabled={enviando}
            onClick={() => resolver(a.accion)}
            title={detalle(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${a.tono} disabled:opacity-50`}
          >
            {a.texto}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bulto.sin_trazabilidad && (
        <Aviso
          tamano="xs"
          ayuda="El pedido se pickeó por cantidad, sin QR: estas unidades no existían en el inventario antes de preparar el despacho, así que no tienen lote ni costo de origen."
          tituloAyuda="Sin trazabilidad"
        >
          <strong>Sin trazabilidad:</strong> no se puede reintegrar al inventario. Resuélvelo como merma o vuelve a despacharlo.
        </Aviso>
      )}
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): en qué estado volvió" className="h-9 px-3 border border-gray-300 rounded-lg" />
      {acciones.map((a) => (
        <button
          key={a.accion}
          type="button"
          disabled={enviando}
          onClick={() => resolver(a.accion)}
          className={`text-left px-4 py-2.5 rounded-lg text-white ${a.tono} disabled:opacity-50`}
        >
          <span className="font-medium">{a.texto}</span>
          <span className="block text-xs text-white/85">{detalle(a)}</span>
        </button>
      ))}
    </div>
  );
}
