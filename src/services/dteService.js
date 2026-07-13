/**
 * dteService — Servicio de Documentos Tributarios Electrónicos.
 *
 * Conecta el frontend con los endpoints de facturación del backend,
 * que a su vez llaman a LibreDTE para emitir DTEs en el SII.
 */

import { api, apiBlob } from '../lib/api.js';
import { toast } from '../lib/toast.js';

// ── Helpers internos ──────────────────────────────────────────────────────────

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function nombreArchivo(dte) {
  return `DTE-${dte.tipoDte}-${dte.folio ?? dte.id}.pdf`;
}

/**
 * Mapea un DocumentoTributario del backend al formato que usa el frontend.
 * Backend usa snake_case; el frontend usa camelCase.
 */
function mapDte(d) {
  if (!d) return null;
  return {
    id:           d.id,
    tipoDte:      d.tipo_dte,
    folio:        d.folio,
    fechaEmision: d.fecha_emision,
    montoTotal:   d.monto_total,
    montoNeto:    d.monto_neto,
    montoIva:     d.monto_iva,
    estadoSii:    (d.estado_sii ?? 'PENDIENTE').toLowerCase(),
    trackId:      d.track_id,
    pdfUrl:       d.pdf_url,
    metadata:     d.metadata,
    referencias:  d.referencias ?? [],
    indTraslado:  d.metadata?.ind_traslado ?? null,
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export const dteService = {

  listarPorOrden: async (ordenId) => {
    const res = await api(`/facturacion/ordenes-venta/${ordenId}/documentos`);
    return (res?.data ?? res ?? []).map(mapDte);
  },

  /**
   * Vista previa del DTE (factura/boleta) de una OV sin emitir:
   * líneas fusionadas por nombre de facturación + totales + receptor.
   */
  previewVenta: async (idOrdenVenta, tipo = 'factura') => {
    const res = await api(`/facturacion/ordenes-venta/${idOrdenVenta}/preview?tipo=${tipo}`);
    return res?.data ?? res;
  },

  emitirFactura: async (idOrdenVenta) => {
    const res = await api('/facturacion/emitir-factura', {
      method: 'POST',
      body: { id_orden_venta: idOrdenVenta },
    });
    return mapDte(res?.data ?? res);
  },

  emitirGuiaDespachoVenta: async (idOrdenVenta) => {
    const res = await api('/facturacion/emitir-guia-despacho-venta', {
      method: 'POST',
      body: { id_orden_venta: idOrdenVenta },
    });
    return mapDte(res?.data ?? res);
  },

  emitirGuiaDespachoPallet: async (idPallet) => {
    const res = await api('/facturacion/emitir-guia-despacho-pallet', {
      method: 'POST',
      body: { id_pallet: idPallet },
    });
    return mapDte(res?.data ?? res);
  },

  emitirNotaCredito: async (idDteReferencia, { codRef, razon, items = [] }) => {
    const body = {
      id_dte_referencia: idDteReferencia,
      motivo: razon,
      codigo_referencia: codRef,
    };
    if (codRef === 3 && items.length > 0) {
      body.items = items.map((it) => ({
        nombre: it.nombre,
        cantidad: Number(it.cantidadDevuelta ?? it.cantidad ?? 1),
        precio_unitario: Number(it.precioUnitario ?? 0),
      }));
    }
    const res = await api('/facturacion/emitir-nota-credito', { method: 'POST', body });
    return mapDte(res?.data ?? res);
  },

  emitirNotaDebito: async (idDteReferencia, { razon, items = [] }) => {
    const res = await api('/facturacion/emitir-nota-debito', {
      method: 'POST',
      body: {
        id_dte_referencia: idDteReferencia,
        motivo: razon,
        items: items.map((it) => ({
          nombre: it.nombre,
          cantidad: Number(it.cantidad ?? 1),
          precio_unitario: Number(it.precioUnitario ?? it.precio_unitario ?? 0),
        })),
      },
    });
    return mapDte(res?.data ?? res);
  },

  listarPorSolicitud: async (solicitudId) => {
    const res = await api(`/facturacion/solicitudes/${solicitudId}/documentos`);
    return (res?.data ?? res ?? []).map(mapDte);
  },

  confirmarLlegada: async (dteId) => {
    const res = await api(`/facturacion/documentos/${dteId}/confirmar-llegada`, { method: 'POST' });
    return mapDte(res?.data ?? res);
  },

  /**
   * Descarga el PDF de un DTE desde el backend.
   */
  descargarPDF: async (dte) => {
    if (!dte?.id) {
      toast.error('No se puede descargar: documento sin ID');
      return;
    }
    try {
      const blob = await apiBlob(`/facturacion/documentos/${dte.id}/pdf`);
      descargarBlob(blob, nombreArchivo(dte));
    } catch (err) {
      toast.error('No se pudo descargar el PDF: ' + (err?.message ?? 'Error desconocido'));
    }
  },

  /**
   * Envía el DTE al cliente/receptor por email vía LibreDTE.
   */
  enviarEmail: async (dteId, email, nombre = '') => {
    const res = await api(`/facturacion/documentos/${dteId}/enviar-email`, {
      method: 'POST',
      body: { email, nombre },
    });
    return res?.data ?? res;
  },

  /**
   * Obtiene el estado de cobro/pago de un DTE.
   */
  obtenerCobro: async (dteId) => {
    const res = await api(`/facturacion/documentos/${dteId}/cobro`);
    return res?.data ?? res;
  },

  actualizarEstadoSii: async (dteId) => {
    const res = await api(`/facturacion/documentos/${dteId}/consultar-estado`, { method: 'POST' });
    return res?.data ?? res;
  },

  /**
   * Lista los DTEs recibidos desde la bandeja de LibreDTE (facturas/GDs de proveedores).
   */
  listarBandejaSii: async ({ desde_fecha, hasta_fecha, emisor, dte } = {}) => {
    const params = new URLSearchParams();
    if (desde_fecha) params.set('desde_fecha', desde_fecha);
    if (hasta_fecha) params.set('hasta_fecha', hasta_fecha);
    if (emisor) params.set('emisor', emisor);
    if (dte) params.set('dte', String(dte));
    const query = params.toString() ? `?${params}` : '';
    const res = await api(`/facturacion/bandeja-sii${query}`);
    return res?.data ?? res ?? [];
  },

  /**
   * Lista los DTEs emitidos desde LibreDTE (facturas/GDs a clientes).
   */
  listarBandejaSiiEmitidos: async ({ desde_fecha, hasta_fecha, receptor, dte } = {}) => {
    const params = new URLSearchParams();
    if (desde_fecha) params.set('desde_fecha', desde_fecha);
    if (hasta_fecha) params.set('hasta_fecha', hasta_fecha);
    if (receptor) params.set('receptor', receptor);
    if (dte) params.set('dte', String(dte));
    const query = params.toString() ? `?${params}` : '';
    const res = await api(`/facturacion/bandeja-sii-emitidos${query}`);
    return res?.data ?? res ?? [];
  },

  /**
   * Abre el PDF de un DTE en una nueva pestaña del navegador.
   */
  verPDF: async (dte) => {
    if (!dte?.id) {
      toast.error('No se puede abrir: documento sin ID');
      return;
    }
    try {
      const blob = await apiBlob(`/facturacion/documentos/${dte.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const ventana = window.open(url, '_blank');
      // Revocar la URL después de que el navegador haya cargado el documento
      if (ventana) {
        ventana.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (err) {
      toast.error('No se pudo abrir el PDF: ' + (err?.message ?? 'Error desconocido'));
    }
  },
};
