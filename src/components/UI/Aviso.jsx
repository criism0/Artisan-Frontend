import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Ayuda from "./Ayuda.jsx";

const TONOS = {
  // Algo que hay que resolver ahora o la operación sale mal (falta un dato, queda saldo).
  atencion: { caja: "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900", icono: AlertTriangle, color: "text-amber-500" },
  // Algo falló o está bloqueado.
  error: { caja: "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800", icono: AlertCircle, color: "text-red-500" },
  // Un dato que informa (quién cerró el saldo, qué se facturó antes).
  info: { caja: "rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900", icono: Info, color: "text-blue-500" },
  // Algo que terminó bien.
  exito: { caja: "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800", icono: CheckCircle2, color: "text-green-500" },
  // Una línea gris, sin recuadro.
  neutro: { caja: "text-gray-600", icono: Info, color: "text-gray-400" },
};

/**
 * Un aviso corto. Regla de Cristóbal (2026-10-22): en pantalla queda sólo lo que cambia lo que el
 * operario hace ahora; cómo funciona algo va en el «(?)» (`Ayuda`), no en un párrafo fijo.
 *
 * Los colores se quedan (corrección del mismo día): ámbar atención, rojo error, azul informativo,
 * verde terminado, gris sin recuadro. Ver docs/GUIA_VISUAL.md.
 */
export default function Aviso({ tono = "atencion", children, ayuda, tituloAyuda, accion, tamano = "sm", className = "" }) {
  const t = TONOS[tono] ?? TONOS.atencion;
  const Icono = t.icono;
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 ${tamano === "xs" ? "text-xs" : "text-sm"} ${t.caja} ${className}`}
    >
      <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${t.color}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {children}
        {/* Pegado al texto, no al borde: el «(?)» explica ESTA frase. */}
        {ayuda && (
          <Ayuda titulo={tituloAyuda} className="ml-1.5 -mt-0.5">
            {ayuda}
          </Ayuda>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
