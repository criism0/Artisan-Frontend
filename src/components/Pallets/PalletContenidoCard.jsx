import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { resumirPallet } from "../../utils/contenidoPallet";

const COLOR_ESTADO = {
  Preparando: "border-gray-200 bg-gray-50 text-gray-700",
  "En preparación": "border-amber-200 bg-amber-50 text-amber-800",
  "En tránsito": "border-violet-200 bg-violet-50 text-violet-800",
  Recepcionado: "border-green-200 bg-green-50 text-green-800",
};

const formatNum = (n) =>
  Number(n || 0).toLocaleString("es-CL", { maximumFractionDigits: 2 });

/**
 * Un pallet, mostrado por su contenido.
 *
 * Antes era una fila de tabla (ID / Identificador / Estado) con un botón "Ver bultos" que
 * desplegaba OTRA tabla dentro de una celda con `colSpan`: una tabla anidada en un recuadro
 * gris, con sus propias cabeceras, que no se sentía parte de nada. Y las tres columnas de
 * la fila no decían lo único que uno quiere saber de un pallet: qué lleva arriba.
 *
 * Ahora la tarjeta muestra el resumen por producto, y los identificadores de cada bulto
 * quedan detrás de un desplegable para cuando hay que buscar uno puntual.
 */
export default function PalletContenidoCard({ pallet }) {
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const { identificador, estado, totalBultos, productos } = resumirPallet(pallet);

  const claseEstado = COLOR_ESTADO[estado] || "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-text">
            <Package className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">{identificador}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalBultos} {totalBultos === 1 ? "bulto" : "bultos"}
            {productos.length > 0 &&
              ` · ${productos.length} ${productos.length === 1 ? "producto" : "productos"}`}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs border shrink-0 ${claseEstado}`}>
          {estado}
        </span>
      </div>

      {productos.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Este pallet todavía no tiene bultos.</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {productos.map((p) => (
              <li key={p.nombre} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-text min-w-0 break-words">{p.nombre}</span>
                <span className="text-sm text-gray-600 text-right shrink-0">
                  <span className="font-medium text-gray-900">{formatNum(p.unidades)}</span> un.
                  {p.peso > 0 && p.unidad && (
                    <span className="text-xs text-gray-500">
                      {" "}
                      · {formatNum(p.peso)} {String(p.unidad).toLowerCase()}
                    </span>
                  )}
                  <span className="text-xs text-gray-400"> · {p.bultos} b.</span>
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => setDetalleAbierto((v) => !v)}
            className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100"
          >
            {detalleAbierto ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            {detalleAbierto ? "Ocultar identificadores" : "Ver identificadores de los bultos"}
          </button>

          {detalleAbierto && (
            <div className="px-4 py-3 border-t border-gray-100 space-y-2">
              {productos.map((p) => (
                <div key={p.nombre}>
                  <p className="text-xs text-gray-500 mb-1">{p.nombre}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.identificadores.map((ident) => (
                      <span
                        key={ident}
                        className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600 font-mono"
                      >
                        {ident}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
