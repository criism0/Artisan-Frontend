import { useEffect, useState } from 'react';
import { FileSearch } from 'lucide-react';
import { toast } from 'react-toastify';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';

/**
 * DTEPreview — lo que va a decir el documento, tal como se va a emitir.
 *
 * Muestra receptor, detalle y totales que devuelve
 * `GET /facturacion/ordenes-venta/:id/preview`, o sea la misma aritmética que usa el emisor:
 * las líneas ya vienen fusionadas por nombre de facturación (productos físicos equivalentes
 * salen como un solo ítem comercial) y los totales calculados con IVA.
 *
 * 🔴 ES UN CUERPO, NO UN MODAL, Y ESO ES EL PUNTO. Antes vivía dentro de `DTEPreviewModal`,
 * que sólo abría el botón legacy del panel de documentos; el modal de «Facturar orden» —la vía
 * real de emisión— pedía dirección y fecha sin mostrar nada de lo que se iba a emitir. Eran dos
 * pantallas distintas para la misma acción, y la que se usaba de verdad era la que menos
 * mostraba. Ahora las dos muestran esto.
 */
export default function DTEPreview({ ordenId, tipo = 'factura', tipoPrevisualizacion = 'factura' }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abriendoPdf, setAbriendoPdf] = useState(false);

  // El PDF real lo genera LibreDTE y deja un documento temporal en su cuenta, así que se pide
  // sólo cuando alguien lo pide. Lo de arriba (líneas y totales) se calcula acá y es gratis.
  const abrirPdfReal = async () => {
    setAbriendoPdf(true);
    try {
      await dteService.verPrevisualizacion(tipoPrevisualizacion, ordenId);
    } catch (err) {
      toast.error('No se pudo generar el documento: ' + (err?.message ?? 'error desconocido'));
    } finally {
      setAbriendoPdf(false);
    }
  };

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await dteService.previewVenta(ordenId, tipo);
        if (!cancelado) setPreview(data);
      } catch (err) {
        if (!cancelado) setError(err?.message || 'No se pudo generar la vista previa');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [ordenId, tipo]);

  if (loading) {
    return <p className="text-sm text-gray-500 py-4 text-center">Generando vista previa…</p>;
  }

  // Que la previsualización falle NO impide facturar: el emisor vuelve a calcular todo del lado
  // del servidor. Se dice qué pasó y se deja seguir, en vez de bloquear por un problema de vista.
  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
        No se pudo generar la vista previa ({error}). Puedes facturar igual: el documento se
        calcula en el servidor al emitir.
      </div>
    );
  }

  const detalle  = Array.isArray(preview?.detalle) ? preview.detalle : [];
  const totales  = preview?.totales  || {};
  const receptor = preview?.receptor || {};

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
        <div className="text-xs text-gray-500 font-medium uppercase mb-1">Receptor</div>
        <div className="font-semibold text-gray-900">{receptor.RznSocRecep || '—'}</div>
        <div className="text-xs text-gray-600 mt-0.5">
          {receptor.RUTRecep ? `RUT ${receptor.RUTRecep}` : ''}
          {receptor.GiroRecep ? ` · ${receptor.GiroRecep}` : ''}
        </div>
        {(receptor.DirRecep || receptor.CmnaRecep) && (
          <div className="text-xs text-gray-600">
            {[receptor.DirRecep, receptor.CmnaRecep].filter(Boolean).join(', ')}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs text-gray-500 font-medium uppercase mb-2">Detalle del documento</div>
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ítem</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detalle.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 text-gray-800">{item.nombre}</td>
                  <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                    {item.cantidad}
                    {item.unidad_medida ? (
                      <span className="text-xs text-gray-400"> {item.unidad_medida}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                    {formatCLP(Number(item.precio_unitario || 0), 0)}
                    {item.descuento_porcentaje ? (
                      <span className="text-xs text-gray-400"> (−{item.descuento_porcentaje}%)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800 whitespace-nowrap">
                    {formatCLP(Number(item.monto_item || 0), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Las líneas se fusionan por nombre de facturación: productos físicos equivalentes
          aparecen como un solo ítem comercial.
        </p>
      </div>

      <div className="flex justify-end">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-600">
            <span>Neto</span><span>{formatCLP(Number(totales.MntNeto || 0), 0)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>IVA</span><span>{formatCLP(Number(totales.IVA || 0), 0)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
            <span>Total</span><span>{formatCLP(Number(totales.MntTotal || 0), 0)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={abrirPdfReal}
          disabled={abriendoPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <FileSearch size={14} />
          {abriendoPdf ? 'Generando…' : 'Ver documento como saldrá'}
        </button>
        <span className="text-xs text-gray-400">
          Abre el PDF real que genera el SII vía LibreDTE, con folio 0. No emite ni gasta folio.
        </span>
      </div>
    </div>
  );
}
