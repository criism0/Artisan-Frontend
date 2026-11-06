import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { api } from "../../lib/api";
import EntregaParada from "./EntregaParada";
import { formatearCLP, formatearFecha } from "../../utils/rutas";

/**
 * Cómo se entregó esta OV (rutas de entrega, Fase 2): cada visita —en ruta, retiro en bodega o
 * despacho externo— con sus respuestas, las líneas de esta orden y las fotos (el documento
 * firmado, la hoja de recepción). No se muestra nada si la orden todavía no tiene entregas.
 */
export default function EntregasDeOrden({ idOrden, costoEnvio }) {
  const [entregas, setEntregas] = useState(null);

  useEffect(() => {
    let vivo = true;
    api(`/rutas/ordenes/${idOrden}/entregas`)
      .then((r) => vivo && setEntregas(Array.isArray(r) ? r : []))
      .catch(() => vivo && setEntregas([]));
    return () => {
      vivo = false;
    };
  }, [idOrden]);

  if (!entregas?.length) return null;
  const vigentes = entregas.filter((e) => !e.anulada_en);
  const anuladas = entregas.filter((e) => e.anulada_en);

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Entregas
        </h2>
        {Number(costoEnvio) > 0 && (
          <span className="text-xs text-gray-500" title="Lo que costó llevarla (rutas cerradas y despachos externos). Interno: no se cobra.">
            Costo de entrega (interno): {formatearCLP(costoEnvio)}
          </span>
        )}
      </div>
      {vigentes.map((e) => (
        <div key={e.id} className="mt-3">
          <div className="text-xs text-gray-500">
            {e.ruta ? (
              <>
                <Link to={`/Logistica/entregas/${e.ruta.id}`} className="text-primary hover:underline">Ruta #{e.ruta.id}</Link>
                {` · ${formatearFecha(e.ruta.fecha)} · parada ${e.ruta.parada}`}
              </>
            ) : (
              <>
                {e.modalidad}
                {e.seguimiento ? ` · seguimiento ${e.seguimiento}` : ""}
                {e.costo_externo != null ? ` · costo ${formatearCLP(e.costo_externo)}` : ""}
              </>
            )}
          </div>
          <EntregaParada entrega={e} />
        </div>
      ))}
      {anuladas.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {anuladas.length} registro{anuladas.length > 1 ? "s" : ""} anulado{anuladas.length > 1 ? "s" : ""}:{" "}
          {anuladas.map((e) => `${e.estado} del ${formatearFecha(e.fecha_hora)} (${e.motivo_anulacion})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
