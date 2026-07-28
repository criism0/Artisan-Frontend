// Panel displayed inside OrdenDetail that tracks all supplier documents for a purchase order.
//
// Shows two sections:
//   • Guías de Despacho recibidas (tipo_dte = 52) — can be 0, 1 or many
//   • Factura recibida         (tipo_dte = 33) — 0 or 1
//
// Each document can be viewed (blob download), and facturas can be accepted/rejected.
// Upload modal opens for adding new GDs or a new Factura.

import { useState } from 'react';
import { RefreshCw, Plus, FileText, Image, Eye, CheckCircle, XCircle, Loader2, Info, X } from 'lucide-react';
import { useDTERecibido } from '../../hooks/useDTERecibido.js';
import { DocumentoRecibidoBadge } from './DocumentoRecibidoBadge.jsx';
import DocumentoRecibidoUploadModal from './DocumentoRecibidoUploadModal.jsx';
import { formatCLP } from '../../services/formatHelpers.js';
import { toast } from '../../lib/toast.js';
import { api, buildApiUrl } from '../../lib/api.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Reclamar modal (inline, lightweight) ─────────────────────────────────────

function ReclamarModal({ onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-gray-900">Reclamar factura ante el SII</h3>
        <p className="text-sm text-gray-600">
          Deberás indicar el motivo del reclamo. Esta acción notificará al SII y al proveedor.
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Motivo del reclamo <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            placeholder="Ej: Monto no corresponde a lo acordado en OC #142"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            disabled={!motivo.trim()}
            onClick={() => onConfirm(motivo.trim())}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Confirmar reclamo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document details modal ────────────────────────────────────────────────────

function DetallesDocModal({ doc, onClose }) {
  if (!doc) return null;
  const esGD = doc.tipoDte === 52 || doc.tipo_dte === 52;
  const tipoLabel = esGD ? 'Guía de Despacho' : 'Factura';

  const rows = [
    ['Tipo',            tipoLabel],
    ['N° Folio',        doc.folio ?? '—'],
    ['Fecha de emisión', fechaCorta(doc.fechaEmision)],
    ['Total',           formatCLP(doc.montoTotal, 0)],
    ['Neto',            doc.montoNeto != null ? formatCLP(doc.montoNeto, 0) : '—'],
    ['IVA',             doc.montoIva  != null ? formatCLP(doc.montoIva,  0) : '—'],
    ['Proveedor / Emisor', doc.emisorNombre ?? '—'],
    ['RUT Emisor',      doc.emisorRut  ?? '—'],
    ['N° Orden de Compra', doc.numeroOc ?? '—'],
    ['Estado',          doc.estadoAceptacion ?? '—'],
    ['Origen',          doc.origen ?? '—'],
    ['Registrado por',  doc.creador?.nombre ?? '—'],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {tipoLabel}{doc.folio ? ` N° ${doc.folio}` : ''}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <span className="font-medium text-gray-600 shrink-0">{label}</span>
              <span className="text-gray-800 text-right">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document viewer (blob download + open in new tab) ─────────────────────────

function VerDocumentoButton({ doc }) {
  const [loading, setLoading] = useState(false);

  // archivoUrl persistido puede ser: un s3_key (uploads/…), una URL http(s)
  // real, o una blob URL vieja (inválida). Solo las dos primeras son abribles.
  const urlPersistida = doc.archivoUrl && !doc.archivoUrl.startsWith('blob:') ? doc.archivoUrl : null;
  const tieneArchivo = !!(doc._file || urlPersistida);

  async function handleVer() {
    setLoading(true);
    try {
      // 1) Archivo subido en esta sesión: recrear una blob URL fresca.
      if (doc._file) {
        const url = URL.createObjectURL(doc._file);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        return;
      }
      if (!urlPersistida) return;
      // 2) URL http(s) completa ya almacenada: abrir directo.
      if (/^https?:\/\//i.test(urlPersistida)) {
        window.open(urlPersistida, '_blank');
        return;
      }
      // 3) s3_key: pedir al backend una URL firmada fresca (expira en 1h).
      const res = await api(`/s3/url?s3_key=${encodeURIComponent(urlPersistida)}`, { method: 'GET' });
      const signed = res?.signed_url;
      if (!signed) throw new Error('No se obtuvo la URL del archivo');
      // En desarrollo la URL firmada es una ruta local (/uploads/…): se prefija
      // con la base del backend. En producción S3 devuelve una URL absoluta.
      window.open(signed.startsWith('/') ? buildApiUrl(signed) : signed, '_blank');
    } catch (e) {
      toast.error('No se pudo abrir el documento: ' + (e?.message ?? 'error'));
    } finally {
      setLoading(false);
    }
  }

  const Icon = doc.archivoTipo === 'imagen' ? Image : FileText;
  return (
    <button
      onClick={handleVer}
      disabled={loading || !tieneArchivo}
      title={tieneArchivo ? 'Ver documento' : 'Sin archivo adjunto'}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <Icon size={12} />}
      Ver
    </button>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function DTERecibidoPanel({ ordenId, orden }) {
  const { guias, facturas, loading, error, hayAlerta, cargarDocumentos, agregarDocumento, aceptar, reclamar } =
    useDTERecibido(ordenId);

  const [uploadModal, setUploadModal] = useState(null);   // null | 'guia' | 'factura'
  const [reclamarId, setReclamarId]   = useState(null);   // id of factura being reclaimed
  const [detallesDoc, setDetallesDoc] = useState(null);   // document to show in details modal

  const factura = facturas[0] ?? null;   // at most 1 factura per OC in this version

  async function handleAceptar(id) {
    await aceptar(id);
  }

  async function handleReclamar(motivo) {
    await reclamar(reclamarId, motivo);
    setReclamarId(null);
  }

  // ── Section header ─────────────────────────────────────────────────────────

  const panelBorder = hayAlerta ? 'border-red-300' : 'border-gray-200';

  return (
    <>
      <div className={`mt-6 bg-white rounded-xl border-2 ${panelBorder} shadow-sm overflow-hidden`}>

        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-gray-800">Documentos del Proveedor</span>
            {hayAlerta && (
              <span className="animate-pulse text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                ⏰ Acción requerida
              </span>
            )}
          </div>
          <button
            onClick={cargarDocumentos}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
            title="Actualizar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
            ⚠ {error}
          </div>
        )}

        <div className="divide-y divide-gray-100">

          {/* ── GUÍAS DE DESPACHO ──────────────────────────────────────────── */}
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Guías de Despacho recibidas
            </h3>

            {guias.length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-3">
                No hay guías de despacho registradas aún.
              </p>
            ) : (
              <ul className="space-y-2 mb-3">
                {guias.map((gd) => (
                  <li key={gd.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-800 shrink-0">GD #{gd.folio ?? gd.id}</span>
                      <span className="text-gray-500 shrink-0">—</span>
                      <span className="text-gray-600 shrink-0">{fechaCorta(gd.fechaEmision)}</span>
                      <span className="text-gray-500 shrink-0">—</span>
                      <span className="font-medium text-gray-700 shrink-0">{formatCLP(gd.montoTotal, 0)}</span>
                      {gd.emisorNombre && (
                        <span className="text-gray-400 text-xs truncate hidden sm:block">· {gd.emisorNombre}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DocumentoRecibidoBadge doc={{ ...gd, tipoDte: 52 }} />
                      <button
                        onClick={() => setDetallesDoc({ ...gd, tipoDte: 52 })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <Info size={12} /> Detalles
                      </button>
                      <VerDocumentoButton doc={gd} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setUploadModal('guia')}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus size={14} />
              Registrar nueva Guía de Despacho
            </button>
          </section>

          {/* ── FACTURA RECIBIDA ───────────────────────────────────────────── */}
          <section className="px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Factura recibida
            </h3>

            {!factura ? (
              <p className="text-sm text-gray-400 italic mb-3">
                No hay factura registrada para esta OC.
              </p>
            ) : (
              <div
                className={`rounded-lg border p-4 mb-3 space-y-3 ${
                  hayAlerta ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Factura header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      Factura #{factura.folio ?? factura.id}
                    </p>
                    {factura.emisorNombre && (
                      <p className="text-xs text-gray-500">{factura.emisorNombre}</p>
                    )}
                  </div>
                  <DocumentoRecibidoBadge doc={{ ...factura, tipoDte: 33 }} />
                </div>

                {/* Key fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Emisión:</span>{' '}
                    {fechaCorta(factura.fechaEmision)}
                  </div>
                  <div>
                    <span className="font-medium">Total:</span>{' '}
                    <span className="font-semibold text-gray-900">{formatCLP(factura.montoTotal, 0)}</span>
                  </div>
                  {factura.descuadre != null && Math.abs(factura.descuadre) > 0 && (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="font-medium">vs. OC:</span>{' '}
                      <span className={`font-semibold ${factura.descuadre > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        {factura.descuadre > 0 ? '+' : ''}{formatCLP(factura.descuadre, 0)}
                      </span>
                    </div>
                  )}
                  {factura.fechaLimiteAceptacion && (
                    <div className="col-span-2">
                      <span className="font-medium">Límite SII:</span>{' '}
                      {fechaCorta(factura.fechaLimiteAceptacion)}
                    </div>
                  )}
                  {Array.isArray(factura.guiasAsociadas) && factura.guiasAsociadas.length > 0 && (
                    <div className="col-span-3">
                      <span className="font-medium">Cubre GDs:</span>{' '}
                      {factura.guiasAsociadas.map((gid) => {
                        const gd = guias.find((g) => g.id === gid);
                        return gd ? `GD #${gd.folio ?? gd.id}` : `#${gid}`;
                      }).join(', ')}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => setDetallesDoc({ ...factura, tipoDte: 33 })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Info size={12} /> Detalles
                  </button>
                  <VerDocumentoButton doc={factura} />

                  {factura.estadoAceptacion === 'pendiente' && (
                    <>
                      <button
                        onClick={() => handleAceptar(factura.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle size={12} />
                        Aceptar
                      </button>
                      <button
                        onClick={() => setReclamarId(factura.id)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle size={12} />
                        Reclamar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Only allow registering a factura if none exists yet */}
            {!factura && (
              <button
                onClick={() => setUploadModal('factura')}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={14} />
                Registrar factura del período
              </button>
            )}
          </section>

        </div>
      </div>

      {/* ── Upload modal ──────────────────────────────────────────────────── */}
      {uploadModal && (
        <DocumentoRecibidoUploadModal
          tipo={uploadModal}
          orden={orden}
          ordenId={ordenId}
          guiasExistentes={guias}
          onClose={() => setUploadModal(null)}
          onSuccess={(rawDoc) => {
            // rawDoc comes from FacturaOCComparacionModal — add it to in-memory state.
            if (rawDoc) agregarDocumento(rawDoc);
            setUploadModal(null);
          }}
        />
      )}

      {/* ── Reclamar modal ────────────────────────────────────────────────── */}
      {reclamarId && (
        <ReclamarModal
          onConfirm={handleReclamar}
          onClose={() => setReclamarId(null)}
        />
      )}

      {/* ── Detalles modal ───────────────────────────────────────────────── */}
      {detallesDoc && (
        <DetallesDocModal
          doc={detallesDoc}
          onClose={() => setDetallesDoc(null)}
        />
      )}
    </>
  );
}
