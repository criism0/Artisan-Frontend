import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import Modal from "../UI/Modal";
import { apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { contar, resumirPallet, tienePesoUtil } from "../../utils/contenidoPallet";

const formatNum = (n) => Number(n || 0).toLocaleString("es-CL", { maximumFractionDigits: 3 });

function descargarBlob(blob, nombre) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Todo el contenido de un pallet, bulto por bulto.
 *
 * La tarjeta muestra solo los primeros productos para no volverse una pared —un pallet real
 * llega a 97 bultos de 43 productos— y el resto vive acá. Es también el único lugar desde el
 * que se pueden imprimir las etiquetas de un pallet concreto: antes solo existía el botón que
 * bajaba las de la solicitud entera, que en una solicitud grande son cientos.
 */
export default function PalletDetalleModal({ pallet, abierto, onCerrar }) {
  const [imprimiendo, setImprimiendo] = useState(false);
  const { identificador, estado, totalBultos, productos, idsBultos } = resumirPallet(pallet);

  const descargarEtiquetas = async () => {
    if (!idsBultos.length) return;
    try {
      setImprimiendo(true);
      const blob = await apiBlob("/bultos/etiquetas", {
        method: "POST",
        body: { ids_bultos: idsBultos },
      });
      descargarBlob(blob, `etiquetas-${identificador}.pdf`);
      toast.success("Etiquetas descargadas");
    } catch (error) {
      console.error("etiquetas del pallet:", error);
      toast.error(error?.message || "No se pudieron descargar las etiquetas");
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      titulo={identificador}
      descripcion={`${totalBultos} ${totalBultos === 1 ? "bulto" : "bultos"} · ${productos.length} ${
        productos.length === 1 ? "producto" : "productos"
      } · ${estado}`}
      pie={
        <>
          <button
            onClick={onCerrar}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={descargarEtiquetas}
            disabled={imprimiendo || idsBultos.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {imprimiendo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Descargando…
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" /> Descargar etiquetas
              </>
            )}
          </button>
        </>
      }
    >
      {productos.length === 0 ? (
        <p className="text-sm text-gray-500">Este pallet todavía no tiene bultos.</p>
      ) : (
        <div className="space-y-5">
          {productos.map((p) => (
            <div key={p.nombre}>
              <div className="flex items-baseline justify-between gap-3 pb-2 mb-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-text min-w-0 break-words">{p.nombre}</h3>
                <span className="text-sm text-gray-600 shrink-0">
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

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="text-left font-medium pb-1">Bulto</th>
                    <th className="text-right font-medium pb-1">Unidades</th>
                    {/* La columna de peso solo aparece si aporta: con unidad "Unidades"
                        repetiría la cantidad que ya está a la izquierda. */}
                    {tienePesoUtil(p) && (
                      <th className="text-right font-medium pb-1">
                        Peso ({String(p.unidad).toLowerCase()})
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {p.detalle.map((b) => (
                    <tr key={b.id ?? b.identificador}>
                      <td className="py-1.5 font-mono text-xs text-gray-700">{b.identificador}</td>
                      <td className="py-1.5 text-right text-gray-700">{formatNum(b.unidades)}</td>
                      {tienePesoUtil(p) && (
                        <td className="py-1.5 text-right text-gray-500">
                          {b.pesoUnitario > 0 ? formatNum(b.pesoUnitario * b.unidades) : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
