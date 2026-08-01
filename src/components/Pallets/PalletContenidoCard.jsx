import { useState } from "react";
import { Package } from "lucide-react";
import { contar, resumirPallet, tienePesoUtil } from "../../utils/contenidoPallet";
import PalletDetalleModal from "./PalletDetalleModal";

/**
 * Cuánto se muestra en la tarjeta antes de mandar el resto al modal.
 *
 * Los identificadores van a la vista porque son el dato con el que se trabaja en bodega, pero
 * un pallet real puede traer 83 bultos de 18 productos (solicitud 90 de producción) y así la
 * tarjeta mide más de tres pantallas. Con estos topes la tarjeta queda de un tamaño
 * predecible —lo que hay arriba, de un vistazo— y el detalle completo, bulto por bulto, vive
 * en el modal, que además imprime las etiquetas.
 */
const PRODUCTOS_VISIBLES = 4;
const CHIPS_VISIBLES = 6;

const COLOR_ESTADO = {
  Preparando: "border-gray-200 bg-gray-50 text-gray-700",
  "En preparación": "border-amber-200 bg-amber-50 text-amber-800",
  "En tránsito": "border-violet-200 bg-violet-50 text-violet-800",
  Recepcionado: "border-green-200 bg-green-50 text-green-800",
};

const formatNum = (n) => Number(n || 0).toLocaleString("es-CL", { maximumFractionDigits: 2 });

/**
 * Un pallet, mostrado por su contenido.
 *
 * Antes era una fila de tabla (ID / Identificador / Estado) con un botón "Ver bultos" que
 * desplegaba OTRA tabla dentro de una celda con `colSpan`: una tabla anidada en un recuadro
 * gris, con sus propias cabeceras, que no se sentía parte de nada. Y las tres columnas no
 * decían lo único que uno quiere saber de un pallet: qué lleva arriba.
 *
 * Los identificadores de los bultos van a la vista, agrupados bajo su insumo, porque son el
 * dato con el que se trabaja en bodega — se buscan contra la etiqueta física. La cantidad
 * total va en la misma línea del insumo para no tener que contar las cajitas.
 */
export default function PalletContenidoCard({ pallet }) {
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const { identificador, estado, totalBultos, productos } = resumirPallet(pallet);
  const claseEstado = COLOR_ESTADO[estado] || "border-gray-200 bg-gray-50 text-gray-700";

  const productosVisibles = productos.slice(0, PRODUCTOS_VISIBLES);
  const productosOcultos = productos.length - productosVisibles.length;

  const alternarProducto = (nombre) =>
    setExpandidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(nombre)) siguiente.delete(nombre);
      else siguiente.add(nombre);
      return siguiente;
    });

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
        <div className="divide-y divide-gray-100">
          {productosVisibles.map((p) => {
            const expandido = expandidos.has(p.nombre);
            const ocultos = p.identificadores.length - CHIPS_VISIBLES;
            const visibles = expandido
              ? p.identificadores
              : p.identificadores.slice(0, CHIPS_VISIBLES);

            return (
              <div key={p.nombre} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-sm text-text min-w-0 break-words">{p.nombre}</span>
                  <span className="text-sm text-gray-600 text-right shrink-0">
                    <span className="font-medium text-gray-900">
                      {contar(p.unidades, "unidad", "unidades")}
                    </span>
                    {tienePesoUtil(p) && (
                      <span className="text-xs text-gray-500">
                        {" "}
                        · {formatNum(p.peso)} {String(p.unidad).toLowerCase()}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {" "}
                      · {contar(p.bultos, "bulto", "bultos")}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {visibles.map((ident) => (
                    <span
                      key={ident}
                      className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600 font-mono"
                    >
                      {ident}
                    </span>
                  ))}
                  {ocultos > 0 && (
                    <button
                      onClick={() => alternarProducto(p.nombre)}
                      className="px-2 py-0.5 rounded border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      {expandido ? "ver menos" : `+${ocultos} más`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setDetalleAbierto(true)}
            className="w-full px-4 py-2.5 text-sm text-primary hover:bg-gray-50 font-medium text-left"
          >
            {productosOcultos > 0
              ? `Ver los ${productos.length} productos y sus ${totalBultos} bultos`
              : `Ver el detalle de los ${totalBultos} bultos`}
          </button>
        </div>
      )}

      <PalletDetalleModal
        pallet={pallet}
        abierto={detalleAbierto}
        onCerrar={() => setDetalleAbierto(false)}
      />
    </div>
  );
}
