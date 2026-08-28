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
import { X, AlertTriangle } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { toast } from '../../lib/toast.js';
import { formatCLP } from '../../services/formatHelpers.js';

const COD_REF_OPTIONS = [
  { value: 3, label: 'Rebaja parcial / merma — folio sigue existiendo, monto baja' },
  { value: 1, label: 'Anulación total — folio desaparece del SII (devolución completa)' },
  { value: 2, label: 'Corrección de texto — error en nombre o descripción (sin cambio de monto)' },
];

export default function NotaCreditoModal({ dte, onClose, onSuccess }) {
  const [codRef,   setCodRef]   = useState(3);
  const [razon,    setRazon]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // 🔴 LAS LÍNEAS SALEN DE LA FACTURA, NO DE LA ORDEN — tarea #120.
  //
  // Una nota de crédito corrige un documento **ya declarado ante el SII**, así que sus líneas
  // tienen que ser las de ese documento. Antes se armaban desde `orden.productos` y divergían de
  // tres formas a la vez, todas medidas sobre la factura 160903 de la OV 846:
  //
  //   · el DESCUENTO se perdía — la factura declara «Cottage 250g SF» a 990 con 15% (monto 842)
  //     y la nota mandaba 990 pelado: 17,6% de sobre-crédito;
  //   · el NOMBRE salía del producto físico, que en esa orden es `null`, así que se declaraba al
  //     SII un ítem llamado «Producto #2». No es raro: 287 de 821 líneas no tienen producto
  //     físico, porque la venta se pide por nombre de facturación;
  //   · y la factura FUSIONA en una línea las de la orden que comparten nombre de facturación,
  //     con precio ponderado, mientras el modal las mostraba separadas.
  //
  // Ahora se manda el índice de la línea y la cantidad; el nombre, el precio y el descuento los
  // resuelve el backend contra el propio documento.
  const lineasFactura = Array.isArray(dte?.detalle) ? dte.detalle : [];

  const [items, setItems] = useState(
    lineasFactura.map((linea, idx) => ({
      id: idx,
      nombre: linea.nombre,
      cantidadMax: Number(linea.cantidad ?? 0),
      cantidadDevuelta: Number(linea.cantidad ?? 0),
      precioUnitario: Number(linea.precio_unitario ?? 0),
      descuento: Number(linea.descuento_porcentaje ?? 0),
      montoItem: Number(linea.monto_item ?? 0),
      unidad: linea.unidad_medida ?? 'Un',
      seleccionado: false,
    })),
  );

  const esTexto    = codRef === 2;
  const esAnulacion = codRef === 1;

  // Un documento vinculado desde LibreDTE (`origen: EXTERNO`) no trae sus líneas: LibreDTE no las
  // entrega. Sin ellas no se puede acreditar una parte —inventarlas desde la orden es justo el
  // error que esto viene a cerrar— pero la anulación total sí es posible.
  const sinDetalle = lineasFactura.length === 0;

  function updateItem(id, k, v) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [k]: v } : it));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!razon.trim()) { toast.error('Ingresa el motivo de la Nota de Crédito'); return; }
    if (!esTexto && !esAnulacion && sinDetalle) {
      toast.error('No se puede acreditar una parte: este documento no tiene sus líneas guardadas.');
      return;
    }
    if (!esTexto && !esAnulacion && !items.some(it => it.seleccionado)) {
      toast.error('Selecciona al menos una línea a acreditar');
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
      // La anulación total y la corrección de texto no llevan ítems: el backend las resuelve
      // desde el propio documento (la factura entera, o una línea de $0 con el motivo).
      const itemsPayload = (esTexto || esAnulacion)
        ? []
        : items
            .filter(it => it.seleccionado)
            .map(it => ({ linea: it.id, cantidad: it.cantidadDevuelta }));

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

          {/* Líneas a acreditar — las que declara la factura */}
          {!esTexto && !esAnulacion && (
            sinDetalle ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No se puede acreditar una parte de este documento.</p>
                    <p className="mt-1">
                      Se emitió fuera del ERP y se vinculó a mano, así que no tenemos el detalle de
                      sus líneas —LibreDTE no lo entrega—. Acreditar una parte obligaría a inventar
                      qué dice la factura. La <strong>anulación total</strong> sí es posible.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Líneas a acreditar
                </label>
                {/* Decir de dónde salen es parte del arreglo: son las de la FACTURA, que puede
                    no coincidir con las de la orden —la factura fusiona por nombre de
                    facturación y se emite por lo pickeado—. */}
                <p className="text-xs text-gray-500 mb-2">
                  Tal como las declara la factura N° {dte.folio} ante el SII.
                </p>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {items.map(it => (
                    <div key={String(it.id)} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={it.seleccionado}
                        onChange={e => updateItem(it.id, 'seleccionado', e.target.checked)}
                        className="w-4 h-4 rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-sm text-gray-700 truncate">{it.nombre}</span>
                        <span className="block text-xs text-gray-500">
                          {formatCLP(it.precioUnitario, 0)} c/u
                          {it.descuento > 0 && (
                            <span className="text-amber-700"> · −{it.descuento}% dcto.</span>
                          )}
                          {' · '}línea: {formatCLP(it.montoItem, 0)}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={it.cantidadMax}
                        step="any"
                        value={it.cantidadDevuelta}
                        disabled={!it.seleccionado}
                        onChange={e => updateItem(it.id, 'cantidadDevuelta', Number(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-40 shrink-0"
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                        / {it.cantidadMax} {it.unidad}
                      </span>
                    </div>
                  ))}
                </div>
                {/* El total con el descuento ya aplicado: es lo que se le devuelve al cliente y
                    lo que va a decir el documento. */}
                <p className="text-xs text-gray-600 mt-2 text-right">
                  Neto a acreditar:{' '}
                  <strong>
                    {formatCLP(
                      items
                        .filter(it => it.seleccionado)
                        .reduce(
                          (sum, it) =>
                            sum +
                            Math.round(
                              it.cantidadDevuelta * it.precioUnitario * (1 - (it.descuento || 0) / 100),
                            ),
                          0,
                        ),
                      0,
                    )}
                  </strong>
                </p>
              </div>
            )
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
