import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { desglosarEnCajas, totalDesdeCajas } from "../../utils/lineasSolicitud.js";

/**
 * Lo despachado de un PT sin bultos con QR (Cottage, Provoleta «Pieza x Kg»…).
 *
 * Hasta el hotfix del 2026-10-28 una línea de PT sólo quedaba despachada escaneando bultos, y
 * estos productos no tienen: la guía respondía «nada que declarar» y bodega la emitía en
 * LibreDTE. Bodega cuenta en cajas y unidades sueltas; se guarda —y la guía declara— el total
 * en unidades. Lo que se vende por kilo se escribe en kilos.
 */
export default function DespachoPorCantidad({ linea, onGuardar, deshabilitado }) {
  const porKilo = linea.unidadVenta && linea.unidadVenta !== "Unidades";
  const porCaja = linea.unidadesPorCajaVenta || 1;
  const inicial = desglosarEnCajas(linea.cantidad_despachada, porCaja);
  const [cajas, setCajas] = useState(linea.cantidad_despachada != null && !porKilo ? String(inicial.cajas) : "");
  const [sueltas, setSueltas] = useState(linea.cantidad_despachada != null && !porKilo ? String(inicial.sueltas) : "");
  const [kilos, setKilos] = useState(linea.cantidad_despachada != null && porKilo ? String(linea.cantidad_despachada) : "");
  const [guardando, setGuardando] = useState(false);

  const total = porKilo ? Number(String(kilos).replace(",", ".")) || 0 : totalDesdeCajas(cajas, sueltas, porCaja);
  const cambio = total !== (linea.cantidad_despachada ?? 0);

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(linea, porKilo ? { cantidad: total } : { cajas: Number(cajas) || 0, sueltas: Number(sueltas) || 0 });
    } finally {
      setGuardando(false);
    }
  };

  const input = "w-14 border border-gray-300 rounded px-1.5 py-0.5 text-sm text-right";

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {porKilo ? (
        <>
          <input type="number" min="0" step="0.001" value={kilos} onChange={(e) => setKilos(e.target.value)} className={input + " w-20"} aria-label="Kilos despachados" disabled={deshabilitado || guardando} />
          <span className="text-xs text-gray-500">kg</span>
        </>
      ) : (
        <>
          <input type="number" min="0" step="1" value={cajas} onChange={(e) => setCajas(e.target.value)} className={input} aria-label="Cajas despachadas" disabled={deshabilitado || guardando} />
          <span className="text-xs text-gray-500">cajas ×{porCaja} +</span>
          <input type="number" min="0" step="1" value={sueltas} onChange={(e) => setSueltas(e.target.value)} className={input} aria-label="Unidades sueltas despachadas" disabled={deshabilitado || guardando} />
          <span className="text-xs text-gray-500">= {total} un.</span>
        </>
      )}
      {cambio && (
        <button type="button" onClick={guardar} disabled={deshabilitado || guardando} className="p-1 rounded text-primary hover:bg-primary/10 disabled:opacity-50" title="Guardar lo despachado" aria-label="Guardar lo despachado">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
