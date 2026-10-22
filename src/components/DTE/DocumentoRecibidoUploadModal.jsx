/**
 * Modal para subir documentos recibidos de proveedores (Facturas y GDs).
 *
 * Flujo:
 *   1. Operador elige Foto o PDF
 *   2. Al seleccionar el archivo se lanza OCR automáticamente
 *   3. Siempre abre FacturaOCComparacionModal con los resultados
 *      (si OCR falló, los campos vienen vacíos y el operador los llena allí)
 */

import { useState, useRef, useCallback } from 'react';
import { X, Camera, FileText, Loader2, Upload, CloudDownload, RefreshCw, Search } from 'lucide-react';
import { procesarDocumento } from '../../services/ocrService.js';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';
import FacturaOCComparacionModal from './FacturaOCComparacionModal.jsx';

const TABS = [
  { id: 'libredte', label: 'Desde LibreDTE', Icon: CloudDownload },
  { id: 'foto',     label: 'Foto',            Icon: Camera        },
  { id: 'pdf',      label: 'PDF',             Icon: FileText      },
];

const EMPTY_CAMPOS = {
  emisor_nombre: '', emisor_rut: '', folio: '',
  fecha_emision: '', monto_neto: '', monto_iva: '',
  monto_total:   '', numero_oc:  '',
};

export default function DocumentoRecibidoUploadModal({
  tipo = 'factura',  // 'factura' | 'guia'
  orden,
  ordenId,
  guiasExistentes = [],
  onClose,
  onSuccess,
}) {
  const [tab,        setTab]        = useState('libredte');
  const [archivo,    setArchivo]    = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [camposOCR,  setCamposOCR]  = useState(null);   // null = no procesado aún
  const [libreDoc,   setLibreDoc]   = useState(null);   // doc seleccionado desde LibreDTE

  // Estado del tab LibreDTE
  const hoy     = new Date().toISOString().slice(0, 10);
  const hace60  = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [ldFiltros,   setLdFiltros]   = useState({ desde_fecha: hace60, hasta_fecha: hoy, emisor: '' });
  const [ldDocs,      setLdDocs]      = useState([]);
  const [ldLoading,   setLdLoading]   = useState(false);
  const [ldBuscado,   setLdBuscado]   = useState(false);

  const fotoInputRef = useRef(null);
  const pdfInputRef  = useRef(null);

  const tipoDteFiltro = tipo === 'factura' ? 33 : 52;

  const buscarEnLibreDTE = useCallback(async () => {
    setLdLoading(true);
    setLdBuscado(false);
    try {
      const params = { dte: tipoDteFiltro };
      if (ldFiltros.desde_fecha) params.desde_fecha = ldFiltros.desde_fecha;
      if (ldFiltros.hasta_fecha) params.hasta_fecha = ldFiltros.hasta_fecha;
      if (ldFiltros.emisor.trim()) params.emisor = ldFiltros.emisor.trim();
      const data = await dteService.listarBandejaSii(params);
      setLdDocs(Array.isArray(data) ? data : []);
      setLdBuscado(true);
    } catch {
      setLdDocs([]);
      setLdBuscado(true);
    } finally {
      setLdLoading(false);
    }
  }, [ldFiltros, tipoDteFiltro]);

  const tipoLabel = tipo === 'factura' ? 'Factura' : 'Guía de Despacho';

  // ── Selección + OCR automático ────────────────────────────────────────────

  async function handleFileSelected(file) {
    if (!file) return;
    setArchivo(file);
    setCamposOCR(null);

    if (tab === 'foto') {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }

    // Lanzar OCR inmediatamente
    setProcesando(true);
    try {
      const resultado = await procesarDocumento(file);
      setCamposOCR(resultado ?? EMPTY_CAMPOS);
    } catch {
      setCamposOCR(EMPTY_CAMPOS);
    } finally {
      setProcesando(false);
    }
  }

  function handleDeselect() {
    setArchivo(null);
    setPreview(null);
    setCamposOCR(null);
  }

  // ── Abrir modal de comparación desde LibreDTE ────────────────────────────

  if (libreDoc) {
    return (
      <FacturaOCComparacionModal
        archivo={null}
        camposOCR={{
          folio:         String(libreDoc.folio ?? ''),
          fecha_emision: libreDoc.fecha ?? '',
          monto_total:   String(libreDoc.total ?? ''),
          emisor_nombre: libreDoc.razon_social ?? '',
          emisor_rut:    String(libreDoc.emisor ?? ''),
        }}
        tipo={tipo}
        orden={orden}
        ordenId={ordenId}
        guiasExistentes={guiasExistentes}
        onClose={() => setLibreDoc(null)}
        onSuccess={(rawDoc) => {
          setLibreDoc(null);
          onSuccess({ ...rawDoc, origen: 'libredte' });
          onClose();
        }}
      />
    );
  }

  // ── Abrir modal de comparación desde OCR ─────────────────────────────────

  if (camposOCR !== null && !procesando && archivo) {
    return (
      <FacturaOCComparacionModal
        archivo={archivo}
        camposOCR={camposOCR}
        tipo={tipo}
        orden={orden}
        ordenId={ordenId}
        guiasExistentes={guiasExistentes}
        onClose={() => { setCamposOCR(null); }}
        onSuccess={(rawDoc) => {
          setCamposOCR(null);
          onSuccess(rawDoc);
          onClose();
        }}
      />
    );
  }

  // ── Modal de upload ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Agregar {tipoLabel}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {TABS.map((t) => {
            const TabIcon = t.Icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); handleDeselect(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <TabIcon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">

          {/* ── TAB: LibreDTE ─────────────────────────────────────────── */}
          {tab === 'libredte' && (
            <>
              <p className="text-sm text-gray-600">
                Selecciona un documento recibido desde LibreDTE. El sistema pre-completará los datos automáticamente.
              </p>

              {/* Filtros */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={ldFiltros.desde_fecha}
                    onChange={e => setLdFiltros(p => ({ ...p, desde_fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={ldFiltros.hasta_fecha}
                    onChange={e => setLdFiltros(p => ({ ...p, hasta_fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">RUT Emisor (opcional)</label>
                  <input
                    type="text"
                    value={ldFiltros.emisor}
                    onChange={e => setLdFiltros(p => ({ ...p, emisor: e.target.value }))}
                    placeholder="Ej: 76059975-1"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <button
                onClick={buscarEnLibreDTE}
                disabled={ldLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {ldLoading ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                {ldLoading ? 'Buscando…' : 'Buscar en LibreDTE'}
              </button>

              {/* Resultados */}
              {ldBuscado && !ldLoading && ldDocs.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-4">No se encontraron documentos con estos filtros.</p>
              )}

              {ldDocs.length > 0 && (
                <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {ldDocs.map((doc, i) => (
                    <button
                      key={`${doc.emisor}-${doc.folio}-${i}`}
                      onClick={() => setLibreDoc(doc)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {doc.razon_social ?? `RUT ${doc.emisor}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            Folio {doc.folio} · {doc.fecha}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                          {doc.total != null ? formatCLP(doc.total, 0) : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-1">
                ¿No encuentras el documento?{' '}
                <button
                  onClick={() => setTab('pdf')}
                  className="text-blue-500 hover:underline"
                >
                  Súbelo manualmente
                </button>
              </p>
            </>
          )}

          {/* ── TAB: Foto ─────────────────────────────────────────────── */}
          {tab === 'foto' && (
            <>
              <p className="text-sm text-gray-600">
                Toma una foto de la {tipoLabel.toLowerCase()} o sube una imagen desde tu computador.
                El sistema intentará extraer los datos automáticamente.
              </p>

              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*,image/heic,image/heif"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />

              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full max-h-52 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={handleDeselect}
                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-red-50 text-gray-500 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={procesando}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                >
                  <Camera size={28} />
                  <span className="text-sm">Tomar foto / Seleccionar imagen</span>
                </button>
              )}
            </>
          )}

          {/* ── TAB: PDF ──────────────────────────────────────────────── */}
          {tab === 'pdf' && (
            <>
              <p className="text-sm text-gray-600">
                Sube el PDF de la {tipoLabel.toLowerCase()} recibida por correo.
                El sistema intentará extraer los datos automáticamente.
              </p>

              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />

              {archivo ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={20} className="text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{archivo.name}</span>
                  </div>
                  <button
                    onClick={handleDeselect}
                    className="ml-2 p-1 hover:bg-blue-100 rounded text-gray-400 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={procesando}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                >
                  <Upload size={28} />
                  <span className="text-sm">Seleccionar PDF</span>
                </button>
              )}
            </>
          )}

          {/* Estado de procesamiento OCR */}
          {procesando && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin flex-shrink-0" />
              Extrayendo datos del documento…
            </div>
          )}

          {/* Indicación cuando archivo seleccionado pero aún procesando */}
          {archivo && !procesando && !camposOCR && (
            <p className="text-xs text-gray-400 italic">Procesando…</p>
          )}
        </div>

      </div>
    </div>
  );
}
