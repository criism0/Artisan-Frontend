import { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast.js';
import { dteService } from '../services/dteService.js';

/**
 * useDTE — Hook para gestionar los Documentos Tributarios Electrónicos
 * de una Orden de Venta.
 *
 * Carga los documentos desde el backend al montar y expone acciones
 * para emitir GD y Factura. Las NC/ND se emiten directamente desde
 * los modales y se agregan con `agregarDocumento`.
 */
export function useDTE(ordenId) {
  const [documentos, setDocumentos] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  // ── Carga inicial y recarga ────────────────────────────────────────────────

  const cargarDocumentos = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    setError(null);
    try {
      const docs = await dteService.listarPorOrden(ordenId);
      setDocumentos(docs ?? []);
    } catch (err) {
      console.error('Error cargando DTEs:', err);
      setError('No se pudieron cargar los documentos tributarios.');
    } finally {
      setLoading(false);
    }
  }, [ordenId]);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  // ── Agregar documento externamente (NC/ND desde modales) ──────────────────

  const agregarDocumento = (doc) => {
    if (!doc) return;
    setDocumentos((prev) => [...prev, doc]);
  };

  // ── Emitir Guía de Despacho (IndTraslado=1 — despacho a cliente) ──────────

  const emitirGuiaDespacho = async (/* indTraslado no se usa, siempre es 1 desde ventas */) => {
    if (!ordenId) return null;
    setLoading(true);
    setError(null);
    try {
      const gd = await dteService.emitirGuiaDespachoVenta(ordenId);
      setDocumentos((prev) => [...prev, gd]);
      toast.success(`Guía de Despacho N° ${gd.folio} emitida ✓`);
      return gd;
    } catch (err) {
      const msg = err?.message || 'Error al emitir la Guía de Despacho';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ── Emitir Factura Electrónica (tipo 33) ──────────────────────────────────

  const emitirFactura = async () => {
    if (!ordenId) return null;
    setLoading(true);
    setError(null);
    try {
      const fac = await dteService.emitirFactura(ordenId);
      setDocumentos((prev) => [...prev, fac]);
      toast.success(`Factura N° ${fac.folio} emitida ✓`);
      return fac;
    } catch (err) {
      const msg = err?.message || 'Error al emitir la Factura';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    documentos,
    loading,
    error,
    cargarDocumentos,
    agregarDocumento,
    emitirGuiaDespacho,
    emitirFactura,
  };
}
