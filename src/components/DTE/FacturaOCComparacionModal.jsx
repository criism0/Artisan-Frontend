/**
 * FacturaOCComparacionModal — registro de GD o Factura recibida de proveedor.
 *
 * Muestra el archivo (imagen/PDF) a la izquierda y solo los 3 datos que el
 * operador debe confirmar/corregir a la derecha: N° folio, fecha de emisión
 * y total.  El nombre, RUT y N° OC del proveedor se toman automáticamente
 * del objeto `orden` ya cargado en la página.
 */

import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCLP } from '../../services/formatHelpers.js';
import { esImagen } from '../../services/ocrService.js';

const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500';
const inputErrCls = 'w-full border border-red-400 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 bg-red-50';

export default function FacturaOCComparacionModal({
  archivo,
  camposOCR = {},
  tipo = 'factura',
  orden,
  ordenId,
  guiasExistentes = [],
  onClose,
  onSuccess,
}) {
  // Solo los 3 campos que el operador debe confirmar/corregir
  const [campos, setCampos] = useState({
    folio:         camposOCR.folio         ?? '',
    fecha_emision: camposOCR.fecha_emision ?? '',
    monto_total:   camposOCR.monto_total   ?? '',
  });

  const [guiasSeleccionadas, setGuiasSeleccionadas] = useState(
    guiasExistentes.map((g) => g.id)
  );
  const [motivoDescuadre, setMotivoDescuadre] = useState('');
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function updateCampo(key, value) {
    setCampos((prev) => ({ ...prev, [key]: value }));
    if (errores[key]) setErrores((prev) => ({ ...prev, [key]: false }));
  }

  function toggleGuia(id) {
    setGuiasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Validación ─────────────────────────────────────────────────────────────

  function validar() {
    const errs = {};
    if (!campos.fecha_emision) errs.fecha_emision = 'La fecha de emisión es requerida';
    if (!campos.monto_total || Number(campos.monto_total) <= 0) errs.monto_total = 'El total debe ser mayor a 0';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const montoDocumento = Number(campos.monto_total) || 0;
  const montoOC        = Number(orden?.total_pago)  || 0;
  const descuadre      = tipo === 'factura' ? montoDocumento - montoOC : 0;
  const hayDescuadre   = tipo === 'factura' && Math.abs(descuadre) > 0;

  // ── Confirmar ──────────────────────────────────────────────────────────────

  async function handleConfirmar() {
    if (!validar()) return;

    setLoading(true);

    const rawDoc = {
      tipo_dte:         tipo === 'factura' ? 33 : 52,
      folio:            campos.folio         || null,
      fecha_emision:    campos.fecha_emision,
      monto_total:      Number(campos.monto_total),
      archivo_tipo:     archivo ? (esImagen(archivo) ? 'imagen' : 'pdf') : null,
      motivo_descuadre: motivoDescuadre || null,
      origen:           archivo ? (esImagen(archivo) ? 'foto' : 'pdf_upload') : 'manual',
      descuadre,
      guias_ids:        guiasSeleccionadas,
      blobUrl,
      _file:            archivo,
    };

    setLoading(false);
    onSuccess(rawDoc);
  }

  const tipoLabel = tipo === 'factura' ? 'Factura' : 'Guía de Despacho';
  const titulo = tipo === 'factura'
    ? `Registrar Factura${campos.folio ? ` N° ${campos.folio}` : ''} — OC #${ordenId}`
    : `Registrar Guía de Despacho${campos.folio ? ` N° ${campos.folio}` : ''} — OC #${ordenId}`;

  const hayErrores = Object.keys(errores).length > 0;
  const ocrDetecto = !!(camposOCR.folio || camposOCR.fecha_emision || camposOCR.monto_total);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 truncate pr-4">{titulo}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Alerta de campos faltantes */}
        {hayErrores && (
          <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-5 py-2 flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>Faltan campos obligatorios. Completa los campos resaltados antes de confirmar.</span>
          </div>
        )}

        {/* Two-panel body */}
        <div className="flex flex-1 overflow-hidden divide-x divide-gray-200">

          {/* LEFT: Document viewer */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-2 min-h-0">
              {blobUrl ? (
                archivo && esImagen(archivo) ? (
                  <img src={blobUrl} alt="Documento recibido" className="max-w-full max-h-full object-contain rounded shadow" />
                ) : (
                  <iframe src={blobUrl} title="Documento recibido" className="w-full h-full rounded border-0" />
                )
              ) : (
                <p className="text-gray-400 text-sm italic">Sin archivo adjunto</p>
              )}
            </div>
          </div>

          {/* RIGHT: OC info + 3 campos editables */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Datos del proveedor (solo lectura, vienen de la OC) */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Datos del proveedor (OC #{ordenId})
                </p>
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">Proveedor</span>
                  <span>{orden?.proveedor?.nombre_empresa ?? '—'}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="font-medium">RUT</span>
                  <span>{orden?.proveedor?.rut_empresa ?? '—'}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1">
                  <span>Total OC</span>
                  <span>{formatCLP(montoOC, 0)}</span>
                </div>
              </div>

              {/* GDs previas (informativo) */}
              {guiasExistentes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Guías de Despacho previas ({guiasExistentes.length})
                  </p>
                  <div className="space-y-1">
                    {guiasExistentes.map((g) => (
                      <div key={g.id} className="flex justify-between text-sm bg-blue-50 rounded px-2 py-1">
                        <span className="text-blue-800">GD #{g.folio ?? g.id} — {g.fechaEmision ?? '—'}</span>
                        <span className="text-blue-700 font-medium">{formatCLP(g.montoTotal ?? 0, 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 campos editables */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Datos de la {tipoLabel}
                  {ocrDetecto && (
                    <span className="ml-2 font-normal text-blue-600 normal-case">extraídos por OCR — revisa y corrige</span>
                  )}
                </p>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">N° de {tipoLabel}</label>
                    <input
                      className={inputCls}
                      value={campos.folio}
                      onChange={(e) => updateCampo('folio', e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Fecha de emisión <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className={errores.fecha_emision ? inputErrCls : inputCls}
                      value={campos.fecha_emision}
                      onChange={(e) => updateCampo('fecha_emision', e.target.value)}
                    />
                    {errores.fecha_emision && (
                      <p className="text-xs text-red-600 mt-0.5">{errores.fecha_emision}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      Total <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      className={errores.monto_total ? inputErrCls : inputCls}
                      value={campos.monto_total}
                      onChange={(e) => updateCampo('monto_total', e.target.value)}
                      placeholder="0"
                    />
                    {errores.monto_total && (
                      <p className="text-xs text-red-600 mt-0.5">{errores.monto_total}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Descuadre vs OC (solo facturas) */}
              {tipo === 'factura' && montoDocumento > 0 && (
                <div className={`rounded-lg p-3 text-sm ${hayDescuadre ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                  {hayDescuadre ? (
                    <div className="flex justify-between font-semibold text-amber-700">
                      <span className="flex items-center gap-1"><AlertTriangle size={13} />Diferencia vs OC</span>
                      <span>{descuadre > 0 ? '+' : ''}{formatCLP(descuadre, 0)}</span>
                    </div>
                  ) : (
                    <div className="text-green-700 font-semibold">✅ Total coincide con la OC</div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-5 py-3 bg-gray-50 space-y-3">

          {/* GD selector para facturas */}
          {tipo === 'factura' && guiasExistentes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Guías de Despacho que cubre esta factura:</p>
              <div className="flex flex-wrap gap-3">
                {guiasExistentes.map((g) => (
                  <label key={g.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={guiasSeleccionadas.includes(g.id)} onChange={() => toggleGuia(g.id)} className="w-4 h-4 rounded" />
                    <span className="text-gray-700">GD #{g.folio ?? g.id} ({formatCLP(g.montoTotal ?? 0, 0)})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Motivo descuadre */}
          {hayDescuadre && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo del descuadre (opcional)</label>
              <input className={inputCls} value={motivoDescuadre} onChange={(e) => setMotivoDescuadre(e.target.value)} placeholder="Ej: Cargo de flete incluido en factura, no en OC" />
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirmar} disabled={loading} className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Guardando…</>
                : <><Check size={14} /> Confirmar y guardar</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
