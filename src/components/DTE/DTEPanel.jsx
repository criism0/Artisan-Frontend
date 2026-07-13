/**
 * DTEPanel — Documentos Tributarios Electrónicos para una Orden de Venta.
 *
 * Ciclo de vida:
 *   1. Guía de Despacho (tipo 52) — antes o en lugar de la factura
 *   2. Factura Electrónica (tipo 33) — al confirmar la orden
 *   3. Nota de Crédito (tipo 61)    — corrección o devolución (ref. Factura)
 *   4. Nota de Débito (tipo 56)     — cargo adicional (ref. Nota de Crédito)
 *
 * Botones por fila:
 *   - NC/ND: [Ver Detalles] [Ver] [Descargar]
 *   - Resto: [Ver] [Descargar]
 *
 * La referencia de cada NC/ND se muestra en la fila: "→ Factura N°X" / "→ NC N°X"
 */

import { FileText, Truck, FileMinus, FilePlus, FileDown, RefreshCw, Eye, Info, AlertCircle, X } from 'lucide-react';
import { DTEStatusBadge } from './DTEStatusBadge.jsx';
import NotaCreditoModal from './NotaCreditoModal.jsx';
import NotaDebitoModal from './NotaDebitoModal.jsx';
import DTEDetallesModal from './DTEDetallesModal.jsx';
import DTEPreviewModal from './DTEPreviewModal.jsx';
import { useDTE } from '../../hooks/useDTE.js';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';
import { useState } from 'react';

const TIPO_LABEL = { 33: 'Factura', 52: 'Guía de Despacho', 56: 'Nota de Débito', 61: 'Nota de Crédito' };

function estadoIncludes(estado, ...substrings) {
  const s = String(estado ?? '').toLowerCase();
  return substrings.some(sub => s.includes(sub));
}

export default function DTEPanel({ orden }) {
  const {
    documentos, loading, error,
    cargarDocumentos, emitirGuiaDespacho, emitirFactura,
  } = useDTE(orden?.id);

  const [modalNC,       setModalNC]       = useState(null);
  const [modalND,       setModalND]       = useState(null);
  const [modalDetalles, setModalDetalles] = useState(null);
  const [modalRechazo,  setModalRechazo]  = useState(null);
  const [preEmitiendo,  setPreEmitiendo]  = useState(false);
  const [showPreview,   setShowPreview]   = useState(false);

  if (!orden) return null;

  const estado  = orden.estado ?? '';
  const cliente = orden.direccion?.cliente ?? {};
  const tieneRUT = !!cliente.rut;

  const facturaEmitida = documentos.find(d => d.tipoDte === 33 && d.estadoSii !== 'anulado');
  const guiaEmitida    = documentos.find(d => d.tipoDte === 52);
  const ncEmitida      = documentos.find(d => d.tipoDte === 61);
  const ndEmitida      = documentos.find(d => d.tipoDte === 56);

  // Guards de emisión
  const puedeEmitirGD      = !guiaEmitida && estadoIncludes(estado, 'pend', 'asig', 'list', 'listo', 'factur');
  const puedeEmitirFactura = !facturaEmitida && tieneRUT && estadoIncludes(estado, 'pend', 'factur', 'list', 'listo', 'envi');
  const puedeEmitirNC      = !!facturaEmitida && !ncEmitida;
  const puedeEmitirND      = !!facturaEmitida && !ndEmitida;

  // Tras emitir NC/ND, recargar desde backend para mostrar folio real
  function handleNcSuccess() {
    setModalNC(null);
    cargarDocumentos();
  }
  function handleNdSuccess() {
    setModalND(null);
    cargarDocumentos();
  }

  async function handleAbrirNC(factura) {
    setPreEmitiendo(true);
    try {
      await dteService.actualizarEstadoSii(factura.id);
      await cargarDocumentos();
    } catch { /* silencioso — si falla igual abrimos el modal */ } finally {
      setPreEmitiendo(false);
    }
    setModalNC(factura);
  }

  async function handleAbrirND(nc) {
    setPreEmitiendo(true);
    try {
      await dteService.actualizarEstadoSii(nc.id);
      await cargarDocumentos();
    } catch { /* silencioso */ } finally {
      setPreEmitiendo(false);
    }
    setModalND(nc);
  }

  async function actualizarYRecargar() {
    const pendientes = documentos.filter(
      d => d.folio && estadoIncludes(d.estadoSii, 'enviado', 'pendiente', 'proceso')
    );
    await Promise.allSettled(pendientes.map(d => dteService.actualizarEstadoSii(d.id)));
    await cargarDocumentos();
  }

  function handleDescargar(dte) {
    dteService.descargarPDF(dte);
  }

  function handleVer(dte) {
    dteService.verPDF(dte);
  }

  // Mostrar la referencia de un NC o ND en la fila
  function getReferenciaLabel(dte) {
    const ref = dte.referencias?.[0];
    if (!ref) return null;
    const tipoRef = TIPO_LABEL[ref.tipo_dte_ref] ?? `Tipo ${ref.tipo_dte_ref}`;
    return `→ ${tipoRef} N° ${ref.folio_ref}`;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mt-6">

      {/* Título */}
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-blue-600" />
        <h2 className="text-base font-semibold text-gray-900">Documentos Tributarios (DTE)</h2>
        <button
          onClick={actualizarYRecargar}
          disabled={loading}
          title="Actualizar estado en SII"
          className="ml-auto p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Sin RUT */}
      {!tieneRUT && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-3">
          ⚠ El cliente <strong>{cliente.nombre_empresa ?? '—'}</strong> no tiene RUT registrado.
          No se puede emitir Factura Electrónica hasta que se registre.
        </div>
      )}

      {/* Lista de DTEs */}
      {documentos.length > 0 && (
        <div className="space-y-2 mb-4">
          {documentos.map(dte => {
            const esNcNd = dte.tipoDte === 61 || dte.tipoDte === 56;
            const refLabel = esNcNd ? getReferenciaLabel(dte) : null;

            return (
              <div
                key={dte.id}
                className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg"
              >
                {/* Izquierda */}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <DTEStatusBadge tipoDte={dte.tipoDte} folio={dte.folio} estadoSii={dte.estadoSii} />

                  {/* Referencia (NC/ND) */}
                  {refLabel && (
                    <span className="text-xs text-gray-400 pl-0.5 italic">{refLabel}</span>
                  )}

                  {/* Monto */}
                  {dte.montoTotal != null && dte.montoTotal > 0 && (
                    <span className="text-xs text-gray-500 pl-0.5">
                      Total: {formatCLP(dte.montoTotal, 0)}
                    </span>
                  )}

                </div>

                {/* Derecha: botones */}
                <div className="flex items-center gap-1 flex-shrink-0">

                  {/* Motivo de rechazo SII */}
                  {dte.estadoSii === 'rechazado' && dte.metadata?.glosa_sii && (
                    <button
                      onClick={() => setModalRechazo(dte)}
                      title="Ver motivo de rechazo"
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <AlertCircle size={12} /> Ver motivo
                    </button>
                  )}

                  {/* Ver Detalles — solo NC y ND */}
                  {esNcNd && (
                    <button
                      onClick={() => setModalDetalles(dte)}
                      title="Ver detalles"
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <Info size={12} /> Detalles
                    </button>
                  )}

                  {/* Ver PDF — abre en nueva pestaña desde el backend */}
                  {dte.folio && (
                    <button
                      onClick={() => handleVer(dte)}
                      title="Ver PDF"
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <Eye size={12} /> Ver
                    </button>
                  )}

                  {/* Descargar PDF desde el backend */}
                  {dte.folio && (
                    <button
                      onClick={() => handleDescargar(dte)}
                      title="Descargar PDF"
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <FileDown size={12} /> Descargar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cargando */}
      {loading && documentos.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-4">Cargando documentos…</p>
      )}

      {/* Botones de emisión */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">

        {puedeEmitirGD && (
          <button
            onClick={() => emitirGuiaDespacho()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            <Truck size={14} />
            {loading ? 'Generando…' : 'Emitir Guía de Despacho'}
          </button>
        )}

        {puedeEmitirFactura && (
          <button
            onClick={() => setShowPreview(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText size={14} />
            {loading ? 'Generando…' : 'Emitir Factura'}
            {guiaEmitida && <span className="text-xs opacity-80 ml-1">(ref. GD)</span>}
          </button>
        )}

        {puedeEmitirNC && (
          <button
            onClick={() => handleAbrirNC(facturaEmitida)}
            disabled={preEmitiendo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            <FileMinus size={14} />
            {preEmitiendo ? 'Verificando…' : 'Emitir Nota de Crédito'}
          </button>
        )}

        {puedeEmitirND && (
          <button
            onClick={() => handleAbrirND(facturaEmitida)}
            disabled={preEmitiendo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
          >
            <FilePlus size={14} />
            {preEmitiendo ? 'Verificando…' : 'Emitir Nota de Débito'}
          </button>
        )}

        {!puedeEmitirGD && !puedeEmitirFactura && documentos.length === 0 && !loading && (
          <p className="text-xs text-gray-400 italic">
            No hay acciones DTE disponibles para el estado actual de la orden.
          </p>
        )}
      </div>

      {/* Modal preview de factura antes de emitir */}
      {showPreview && (
        <DTEPreviewModal
          ordenId={orden.id}
          tipo="factura"
          emitting={loading}
          onClose={() => setShowPreview(false)}
          onConfirm={async () => {
            const fac = await emitirFactura();
            if (fac) setShowPreview(false);
          }}
        />
      )}

      {/* Modal NC */}
      {modalNC && (
        <NotaCreditoModal
          dte={modalNC}
          orden={orden}
          onClose={() => setModalNC(null)}
          onSuccess={handleNcSuccess}
        />
      )}

      {/* Modal ND */}
      {modalND && (
        <NotaDebitoModal
          dte={modalND}
          onClose={() => setModalND(null)}
          onSuccess={handleNdSuccess}
        />
      )}

      {/* Modal Ver Detalles NC/ND */}
      {modalDetalles && (
        <DTEDetallesModal
          dte={modalDetalles}
          onClose={() => setModalDetalles(null)}
        />
      )}

      {/* Modal motivo de rechazo SII */}
      {modalRechazo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="text-sm font-bold text-gray-900">Motivo de rechazo SII</h2>
              </div>
              <button type="button" onClick={() => setModalRechazo(null)} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500">
                {TIPO_LABEL[modalRechazo.tipoDte] ?? `DTE ${modalRechazo.tipoDte}`}{' '}
                N° {modalRechazo.folio} fue rechazada por el SII con el siguiente motivo:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 font-mono">
                {modalRechazo.metadata.glosa_sii}
              </div>
              <p className="text-xs text-gray-400">
                Debes anular este folio en el portal SII y emitir un nuevo documento corrigiendo el error.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
