import { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast.js';
import { dteRecibidoService } from '../services/dteRecibidoService.js';
import { uploadToS3 } from '../lib/uploadToS3.js';

/**
 * useDTERecibido — Hook para gestionar los documentos tributarios recibidos
 * de proveedores en una Orden de Compra.
 *
 * Carga guías de despacho y facturas recibidas desde el backend.
 * Expone acciones para registrar, aceptar, reclamar y vincular documentos.
 */
export function useDTERecibido(ordenId) {
  const [guias,    setGuias]    = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // ── Carga desde el backend ────────────────────────────────────────────────

  const cargarDocumentos = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dteRecibidoService.listarPorOrden(ordenId);
      // Backend envuelve en { data: { guias, facturas } } vía successResponse
      const payload = res?.data ?? res;
      setGuias(payload?.guias ?? []);
      setFacturas(payload?.facturas ?? []);
    } catch (err) {
      console.error('Error cargando documentos recibidos:', err);
      setError('No se pudieron cargar los documentos recibidos.');
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  // ── Registrar nuevo documento (desde modal de comparación) ────────────────

  /**
   * Crea un nuevo documento recibido en el backend y lo agrega al estado local.
   * rawDoc viene de FacturaOCComparacionModal.onSuccess(rawDoc).
   */
  const agregarDocumento = async (rawDoc) => {
    if (!rawDoc || !ordenId) return;

    setLoading(true);
    try {
      // Persistir el archivo adjunto en S3 (a través del endpoint /s3/upload).
      // Guardamos el s3_key en archivo_url; al presionar "Ver" se resuelve una
      // URL firmada fresca (ver VerDocumentoButton en DTERecibidoPanel).
      // Las blob URLs (blob:https://...) son efímeras: mueren al recargar la
      // página, por eso NO se persisten en el backend.
      let archivoUrl = null;
      if (rawDoc._file) {
        try {
          const ref = await uploadToS3(rawDoc._file);
          archivoUrl = ref?.s3_key ?? null;
        } catch (e) {
          toast.error('No se pudo guardar el archivo adjunto: ' + (e?.message ?? 'error de subida'));
          // Continuamos registrando el documento aunque el archivo no se haya guardado.
        }
      } else {
        // Sin File en esta sesión (ej. registro manual): solo persistimos URLs
        // reales http/https, nunca blob URLs.
        const rawUrl = rawDoc.archivo_url ?? null;
        archivoUrl = rawUrl && !rawUrl.startsWith('blob:') ? rawUrl : null;
      }

      const payload = {
        tipo_dte:        rawDoc.tipo_dte,
        emisor_rut:      rawDoc.emisor_rut ?? '',
        emisor_nombre:   rawDoc.emisor_nombre ?? '',
        folio:           rawDoc.folio ? String(rawDoc.folio) : null,
        fecha_emision:   rawDoc.fecha_emision,
        monto_neto:      Number(rawDoc.monto_neto  ?? 0),
        monto_iva:       Number(rawDoc.monto_iva   ?? 0),
        monto_total:     Number(rawDoc.monto_total ?? 0),
        archivo_url:     archivoUrl,
        archivo_tipo:    rawDoc.archivo_tipo ?? null,
        motivo_descuadre: rawDoc.motivo_descuadre ?? null,
        origen:          rawDoc.origen ?? 'manual',
        numero_oc:       rawDoc.numero_oc ?? null,
        guias_ids:       rawDoc.guias_ids ?? [],
      };

      const creado = await dteRecibidoService.vincularDocumento(ordenId, payload);
      const docId = creado?.data?.id ?? creado?.id;

      // Recargar lista completa para tener los campos calculados del servidor
      // (diasRestantes, descuadre, etc.)
      await cargarDocumentos();

      // Fast path: preservar la referencia al File en memoria para poder verlo
      // de inmediato en esta sesión sin un round-trip. Se pierde al recargar la
      // página; a partir de ahí "Ver" usa el s3_key persistido.
      if (rawDoc._file && docId) {
        const patchFile = (doc) => doc.id === docId ? { ...doc, _file: rawDoc._file } : doc;
        setGuias(prev => prev.map(patchFile));
        setFacturas(prev => prev.map(patchFile));
      }

      toast.success(
        rawDoc.tipo_dte === 33
          ? `Factura N° ${rawDoc.folio ?? '—'} registrada ✓`
          : `Guía de Despacho N° ${rawDoc.folio ?? '—'} registrada ✓`
      );

      return docId;
    } catch (err) {
      const msg = err?.message || 'Error al registrar el documento';
      toast.error(msg);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ── Aceptar factura ───────────────────────────────────────────────────────

  const aceptar = async (id) => {
    setLoading(true);
    try {
      await dteRecibidoService.aceptar(id);
      setFacturas((prev) =>
        prev.map((f) => f.id === id ? { ...f, estadoAceptacion: 'aceptada' } : f)
      );
      toast.success('Factura aceptada ✓');
    } catch (err) {
      toast.error(err?.message || 'Error al aceptar la factura');
    } finally {
      setLoading(false);
    }
  };

  // ── Reclamar factura ──────────────────────────────────────────────────────

  const reclamar = async (id, motivo) => {
    setLoading(true);
    try {
      await dteRecibidoService.reclamar(id, motivo);
      setFacturas((prev) =>
        prev.map((f) => f.id === id ? { ...f, estadoAceptacion: 'reclamada', motivoReclamo: motivo } : f)
      );
      toast.success('Reclamo registrado ante el SII ✓');
    } catch (err) {
      toast.error(err?.message || 'Error al reclamar la factura');
    } finally {
      setLoading(false);
    }
  };

  // ── Alerta: factura pendiente a punto de vencer ───────────────────────────

  const hayAlerta = facturas.some(
    (f) => f.estadoAceptacion === 'pendiente' && f.diasRestantes != null && f.diasRestantes <= 2
  );

  return {
    guias,
    facturas,
    loading,
    error,
    hayAlerta,
    cargarDocumentos,
    agregarDocumento,
    aceptar,
    reclamar,
  };
}
