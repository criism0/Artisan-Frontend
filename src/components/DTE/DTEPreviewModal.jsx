import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';

/**
 * DTEPreviewModal — Vista previa del documento (factura/boleta) antes de emitir.
 *
 * Muestra las líneas tal como saldrán en el DTE: fusionadas por nombre de
 * facturación (una línea por nombre comercial, aunque el picking haya usado
 * varios productos físicos del grupo), más receptor y totales.
 */
export default function DTEPreviewModal({ ordenId, tipo = 'factura', onConfirm, onClose, emitting = false }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
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

  const detalle = Array.isArray(preview?.detalle) ? preview.detalle : [];
  const totales = preview?.totales || {};
  const receptor = preview?.receptor || {};
  const tipoLabel = tipo === 'boleta' ? 'Boleta' : 'Factura';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Vista previa — {tipoLabel} (Orden #{ordenId})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Generando vista previa…</p>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              {/* Receptor */}
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

              {/* Detalle fusionado */}
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase mb-2">
                  Detalle del documento
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                          <td className="px-3 py-2 text-gray-800">{item.NmbItem}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{item.QtyItem}</td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {formatCLP(Number(item.PrcItem || 0), 0)}
                            {item.DescuentoPct ? (
                              <span className="text-xs text-gray-400"> (−{item.DescuentoPct}%)</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            {formatCLP(Number(item.MontoItem || 0), 0)}
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

              {/* Totales */}
              <div className="flex justify-end">
                <div className="w-56 text-sm space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Neto</span>
                    <span>{formatCLP(Number(totales.MntNeto || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>IVA</span>
                    <span>{formatCLP(Number(totales.IVA || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                    <span>Total</span>
                    <span>{formatCLP(Number(totales.MntTotal || 0), 0)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={emitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !!error || emitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {emitting ? 'Emitiendo…' : `Confirmar y emitir ${tipoLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
