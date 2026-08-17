/**
 * Modal para emitir una Nota de Crédito (Tipo 61) sobre una factura existente.
 *
 * POST /api/dte/emitidos/:dteId/nota-credito
 *   Body: { codRef: 1|2|3, razon: string, items: [...] }
 *
 * Distinción clave (R7 reunión con Hernán — INFORME_REUNION_SII_20260511.md):
 *   CodRef=1 → Anulación total: folio desaparece del SII, inventario +100%
 *   CodRef=3 → Rebaja parcial:  folio sigue, monto baja, inventario parcial
 *   CodRef=2 → Corrección texto: sin impacto en monto ni inventario, item con PrcItem=0
 *
 * Ajuste de inventario (2026-07-21): el/los bultos devueltos vuelven a su bodega de
 * origen marcados como merma (DteService.emitirNotaCredito → ajusteInventarioNotaCredito.ts).
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { toast } from '../../lib/toast.js';
import { formatCLP } from '../../services/formatHelpers.js';
import { cantidadFacturable } from '../../utils/cantidadFacturable.js';

const COD_REF_OPTIONS = [
  { value: 3, label: 'Rebaja parcial / merma — folio sigue existiendo, monto baja' },
  { value: 1, label: 'Anulación total — folio desaparece del SII (devolución completa)' },
  { value: 2, label: 'Corrección de texto — error en nombre o descripción (sin cambio de monto)' },
];

export default function NotaCreditoModal({ dte, orden, onClose, onSuccess }) {
  const [codRef,   setCodRef]   = useState(3);
  const [razon,    setRazon]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Items de la orden para seleccionar cuáles devolver.
  //
  // 🔴 El tope es lo que dice la FACTURA, no lo que decía el pedido. Desde que el documento se
  // emite por lo pickeado (2026-08-17), una orden despachada a medias tiene la factura por menos
  // que la orden: ofrecer devolver lo pedido dejaría emitir una nota de crédito por MÁS de lo
  // que se cobró.
  const itemsOrden = (orden?.productos ?? []).map((it, idx) => ({
    id: it.id_producto ?? it.id ?? idx,
    nombre: it?.ProductoBase?.nombre ?? `Producto #${it.id_producto ?? idx + 1}`,
    cantidadMax: cantidadFacturable(it),
    cantidadDevuelta: cantidadFacturable(it),
    unidad: 'un',
    precioUnitario: Number(it.precio_venta ?? 0),
    seleccionado: false,
  }));

  const [items, setItems] = useState(itemsOrden);

  const esTexto    = codRef === 2;
  const esAnulacion = codRef === 1;

  function updateItem(id, k, v) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [k]: v } : it));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!razon.trim()) { toast.error('Ingresa el motivo de la Nota de Crédito'); return; }
    if (!esTexto && !esAnulacion && !items.some(it => it.seleccionado)) {
      toast.error('Selecciona al menos un ítem a devolver');
      return;
    }

    // 🔴 FRENO PARA LA ANULACIÓN TOTAL, y sólo para ella.
    //
    // Los tres CodRef no son igual de graves: una rebaja parcial ajusta el monto y una
    // corrección de texto no toca la plata, pero la anulación total **hace desaparecer el folio
    // ante el SII** y devuelve el 100% del inventario. Es irreversible y se elige en un
    // desplegable, a un clic de las otras dos.
    //
    // Se pide escribir el folio: obliga a mirar CUÁL factura se está anulando, que es
    // exactamente el error que hay que evitar. Un «¿está seguro?» no lo lograría — se aprieta
    // sin leer.
    if (esAnulacion) {
      const escrito = window.prompt(
        `ANULACIÓN TOTAL de la factura N° ${dte.folio} por ${formatCLP(dte.montoTotal ?? 0, 0)}.\n\n` +
        'El folio desaparece ante el SII y el inventario vuelve completo. No se puede deshacer.\n\n' +
        `Para confirmar, escribe el número de folio (${dte.folio}):`,
      );
      if (escrito === null) return;              // canceló
      if (String(escrito).trim() !== String(dte.folio)) {
        toast.error('El folio no coincide. No se emitió la nota de crédito.');
        return;
      }
    }

    setLoading(true);
    try {
      const itemsPayload = esTexto
        ? []
        : esAnulacion
          ? items.map(it => ({ nombre: it.nombre, cantidad: it.cantidadMax, unidad: it.unidad, precioUnitario: it.precioUnitario }))
          : items.filter(it => it.seleccionado).map(it => ({ nombre: it.nombre, cantidad: it.cantidadDevuelta, unidad: it.unidad, precioUnitario: it.precioUnitario }));

      const res = await dteService.emitirNotaCredito(dte.id, { codRef, razon, items: itemsPayload });
      toast.success(`Nota de Crédito${res?.folio ? ` N° ${res.folio}` : ''} emitida`);
      onSuccess(res);
      onClose();
    } catch (e) {
      toast.error(e.message ?? 'Error al emitir Nota de Crédito');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">Emitir Nota de Crédito</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Referencia a Factura{dte.folio ? ` N° ${dte.folio}` : ' (demo)'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* CodRef selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de corrección (CodRef)
            </label>
            <select
              value={codRef}
              onChange={e => setCodRef(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {COD_REF_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Razón */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo / Razón <span className="text-red-500">*</span>
            </label>
            <textarea
              value={razon}
              onChange={e => setRazon(e.target.value)}
              rows={2}
              placeholder={
                codRef === 1 ? 'Ej: Devolución total por producto rechazado en recepción' :
                codRef === 2 ? 'Ej: Error en nombre del producto — dice Queso Premium, debe decir Queso Semiduro' :
                               'Ej: Devolución parcial por merma de 6 unidades con deterioro'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Ítems a devolver (solo si no es texto ni anulación total) */}
          {!esTexto && !esAnulacion && items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ítems a devolver
              </label>
              <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                {items.map(it => (
                  <div key={String(it.id)} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={it.seleccionado}
                      onChange={e => updateItem(it.id, 'seleccionado', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="flex-1 text-sm text-gray-700 truncate">{it.nombre}</span>
                    <input
                      type="number"
                      min={1}
                      max={it.cantidadMax}
                      value={it.cantidadDevuelta}
                      disabled={!it.seleccionado}
                      onChange={e => updateItem(it.id, 'cantidadDevuelta', Number(e.target.value))}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-40"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">/ {it.cantidadMax} u</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {esAnulacion && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <strong>Anulación total:</strong> Se devolverán todos los ítems de la factura.
              El folio desaparecerá del SII. El inventario se ajustará en +100%.
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Emitiendo...' : 'Emitir Nota de Crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
