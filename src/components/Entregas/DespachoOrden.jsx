import { useCallback, useEffect, useState } from "react";
import { Package, Printer, RotateCcw } from "lucide-react";
import { toast } from "../../lib/toast.js";
import { useConfirm } from "../Modals/ConfirmProvider.jsx";
import * as rutasApi from "../../services/rutasService";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { describirBulto, TONO_BULTO } from "../../utils/despacho";
import FotosMini from "./FotosMini";
import ModalPrepararDespacho from "./ModalPrepararDespacho";

/**
 * Cómo sale una OV (bultos de despacho, plan de rutas §17): en cuántos bultos se preparó, qué
 * lleva cada uno y por dónde va, con la foto del pedido armado; las etiquetas de las cajas
 * armadas; y preparar desde acá si bodega no pudo hacerlo en la app. No se muestra si la OV
 * todavía no termina su picking y no tiene nada preparado.
 */
export default function DespachoOrden({ idOrden }) {
  const [d, setD] = useState(null);
  const [preparando, setPreparando] = useState(false);
  const confirm = useConfirm();
  const puedeEscribir = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE) || checkScope(ModelType.RUTA, ScopeType.WRITE);

  const cargar = useCallback(() => {
    rutasApi.despachoDeOrden(idOrden).then(setD).catch(() => setD(null));
  }, [idOrden]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!d) return null;
  const vigentes = d.preparaciones.filter((p) => p.estado === "Vigente");
  if (!vigentes.length && !d.preparable && !d.sueltos.length) return null;

  const etiquetas = async () => {
    try {
      await rutasApi.abrirEtiquetasDespacho({ id_orden_venta: idOrden });
      cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const rehacer = async (idPrep) => {
    const ok = await confirm({
      title: "¿Rehacer la preparación?",
      message: "Se anulan estos bultos (retira sus etiquetas) y el pedido queda por preparar de nuevo.",
      confirmText: "Sí, rehacer",
    });
    if (!ok) return;
    try {
      await rutasApi.anularPreparacion(idPrep);
      toast.success("Preparación anulada");
      cargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Despacho
          {d.resumen.preparados > 0 && <span className="text-xs font-normal text-gray-500">· {d.resumen.preparados} bulto{d.resumen.preparados === 1 ? "" : "s"} listo{d.resumen.preparados === 1 ? "" : "s"} para salir</span>}
        </h2>
        <div className="flex items-center gap-2">
          {d.resumen.preparados > 0 && puedeEscribir && (
            <button
              type="button"
              onClick={etiquetas}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${d.resumen.sin_etiqueta ? "border-amber-400 bg-amber-50 text-amber-900" : "border-gray-300 text-gray-700"} hover:bg-gray-50`}
              title="Las etiquetas de las cajas armadas (las cerradas llevan la de su bulto)"
            >
              <Printer className="w-4 h-4" /> Etiquetas{d.resumen.sin_etiqueta ? ` (${d.resumen.sin_etiqueta} sin imprimir)` : ""}
            </button>
          )}
          {d.preparable && puedeEscribir && (
            <button type="button" onClick={() => setPreparando(true)} className="px-3 py-1.5 rounded-lg text-sm bg-primary text-white hover:bg-primary-dark">
              Preparar despacho
            </button>
          )}
        </div>
      </div>

      {d.preparable && !vigentes.length && (
        <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Sin preparar: bodega declara en la app en cuántos bultos sale y saca la foto. Sin eso la ruta no se puede iniciar.
        </p>
      )}

      {vigentes.map((p) => (
        <div key={p.id} className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>
              Preparado el {new Date(p.fecha).toLocaleString("es-CL")}
              {p.preparador ? ` por ${p.preparador}` : ""}
              {p.comentario ? ` · ${p.comentario}` : ""}
            </span>
            {p.anulable && puedeEscribir && (
              <button type="button" onClick={() => rehacer(p.id)} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                <RotateCcw className="w-3 h-3" /> Rehacer
              </button>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {p.bultos.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full border text-[11px] ${TONO_BULTO[b.estado] ?? ""}`}>{b.estado}</span>
                <span className="text-gray-800">{describirBulto(b)}</span>
                {b.identificador && <span className="text-xs text-gray-400 font-mono">{b.identificador}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-2"><FotosMini fotos={p.fotos} tipo="PREPARACION" vacio="Sin foto" /></div>
        </div>
      ))}

      {d.sueltos.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 mb-1">Unidades sueltas que volvieron de una entrega</p>
          {d.sueltos.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded-full border text-[11px] ${TONO_BULTO[b.estado] ?? ""}`}>{b.estado}</span>
              <span className="text-gray-800">{describirBulto(b)}</span>
            </div>
          ))}
        </div>
      )}

      {preparando && <ModalPrepararDespacho idOrden={idOrden} despacho={d} onCerrar={() => setPreparando(false)} onPreparado={cargar} />}
    </div>
  );
}
