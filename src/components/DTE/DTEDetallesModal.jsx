/**
 * DTEDetallesModal — muestra los detalles de una Nota de Crédito o Débito.
 *
 * Información que muestra:
 *   - Tipo, folio, estado SII, fecha de emisión
 *   - Documento de referencia (factura o NC)
 *   - Motivo (razon_ref de referencias[0])
 *   - CodRef (solo NC): tipo de corrección
 *   - Ítems (líneas del detalle)
 *   - Montos
 */

import { X } from 'lucide-react';
import { DTEStatusBadge } from './DTEStatusBadge.jsx';
import { formatCLP } from '../../services/formatHelpers.js';

const TIPO_LABEL = {
  33: 'Factura Electrónica',
  52: 'Guía de Despacho',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
};

const COD_REF_LABEL = {
  1: 'Anulación total',
  2: 'Corrección de texto',
  3: 'Rebaja parcial',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DTEDetallesModal({ dte, onClose }) {
  if (!dte) return null;

  const referencia = dte.referencias?.[0] ?? null;
  const items = dte.detalle ?? [];
  const codRef = referencia?.codigo_ref ?? null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Detalles — {TIPO_LABEL[dte.tipoDte] ?? `DTE ${dte.tipoDte}`}
            </h2>
            {dte.folio && (
              <p className="text-xs text-gray-500 mt-0.5">N° {dte.folio}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Estado + fecha */}
          <div className="flex items-center justify-between">
            <DTEStatusBadge tipoDte={dte.tipoDte} folio={dte.folio} estadoSii={dte.estadoSii} />
            <span className="text-xs text-gray-500">{fmtDate(dte.fechaEmision)}</span>
          </div>

          {/* Referencia */}
          {referencia && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Documento de Referencia
              </p>
              <div className="space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo</span>
                  <span>{TIPO_LABEL[referencia.tipo_dte_ref] ?? `Tipo ${referencia.tipo_dte_ref}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Folio</span>
                  <span className="font-medium">N° {referencia.folio_ref}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha ref.</span>
                  <span>{fmtDate(referencia.fecha_ref)}</span>
                </div>
              </div>
            </div>
          )}

          {/* CodRef (NC) */}
          {dte.tipoDte === 61 && codRef != null && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">
                Tipo de corrección (CodRef={codRef})
              </p>
              <p className="text-red-800">{COD_REF_LABEL[codRef] ?? `Código ${codRef}`}</p>
            </div>
          )}

          {/* Motivo */}
          {referencia?.razon_ref && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Motivo</p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {referencia.razon_ref}
              </p>
            </div>
          )}

          {/* Ítems */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ítems</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Descripción</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Cant.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Precio</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{it.nombre}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{it.cantidad}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatCLP(it.precio_unitario ?? 0, 0)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCLP(it.monto_item ?? 0, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Montos */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Neto</span><span>{formatCLP(dte.montoNeto ?? 0, 0)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA (19%)</span><span>{formatCLP(dte.montoIva ?? 0, 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1">
              <span>Total</span><span>{formatCLP(dte.montoTotal ?? 0, 0)}</span>
            </div>
          </div>

        </div>

        <div className="px-5 pb-4">
          <button onClick={onClose} className="w-full py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
