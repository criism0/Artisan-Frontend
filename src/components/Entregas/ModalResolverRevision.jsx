import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../UI/Modal";
import EntregaParada from "./EntregaParada";
import { resolverRevision } from "../../services/rutasService";
import { formatearFecha } from "../../utils/rutas";
import { toast } from "../../lib/toast.js";

/**
 * Qué se hizo con una entrega en revisión (plan §5.3). Lo resuelto cuenta como cumplido —la OV
 * puede quedar Entregada—; «Re-despachar» devuelve el saldo a la lista de pendientes.
 */
const RESOLUCIONES = [
  { valor: "Re-despachar", ayuda: "Lo que faltó vuelve a la lista de pendientes para otra ruta." },
  { valor: "NC emitida", ayuda: "Se emitió (o se va a emitir) la nota de crédito por la diferencia." },
  { valor: "Reingresado a stock", ayuda: "Lo devuelto volvió a la bodega en buen estado." },
  { valor: "Merma", ayuda: "Lo devuelto no se puede vender." },
  { valor: "Sin acción", ayuda: "No hay nada que hacer (el cliente aceptó la diferencia, fue un error de conteo…)." },
];

export default function ModalResolverRevision({ entrega, soloLectura = false, onCerrar, onResuelta }) {
  const [resolucion, setResolucion] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (entrega) {
      setResolucion("");
      setNota("");
    }
  }, [entrega]);

  if (!entrega) return null;
  const pendiente = entrega.estado_revision === "Pendiente" && !soloLectura;

  const guardar = async () => {
    setGuardando(true);
    try {
      await resolverRevision(entrega.id, { resolucion, nota: nota.trim() });
      toast.success("Revisión resuelta");
      onResuelta?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      titulo={`${entrega.cliente} · ${entrega.estado}`}
      descripcion={
        entrega.ruta ? (
          <span>
            <Link to={`/Logistica/entregas/${entrega.ruta.id}`} className="text-primary hover:underline">Ruta #{entrega.ruta.id}</Link>
            {` del ${formatearFecha(entrega.ruta.fecha)}${entrega.ruta.transportista ? ` · ${entrega.ruta.transportista}` : ""}${entrega.parada?.direccion ? ` · ${entrega.parada.direccion}` : ""}`}
          </span>
        ) : null
      }
      pie={
        pendiente ? (
          <>
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !resolucion || nota.trim().length < 3}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Resolver"}
            </button>
          </>
        ) : (
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Cerrar</button>
        )
      }
    >
      <EntregaParada entrega={entrega} />
      {pendiente && (
        <div className="mt-4 flex flex-col gap-3">
          <span className="text-sm font-medium text-gray-800">¿Qué se hizo?</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RESOLUCIONES.map((r) => (
              <label
                key={r.valor}
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-sm ${resolucion === r.valor ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input type="radio" name="resolucion" className="mt-1 accent-primary" checked={resolucion === r.valor} onChange={() => setResolucion(r.valor)} />
                <span>
                  <span className="font-medium text-gray-800">{r.valor}</span>
                  <span className="block text-xs text-gray-500">{r.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Nota
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Qué se decidió y por qué (por ejemplo, el folio de la NC)"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
