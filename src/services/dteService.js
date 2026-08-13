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

  /**
   * Guía de despacho de un TRASLADO entre bodegas (tipo 52, IndTraslado 5).
   *
   * 🔴 Este endpoint existía en el backend desde siempre y NO TENÍA LLAMADOR: la vista de
   * solicitudes lo había retirado mientras duraba el bloqueo del traspaso a LibreDTE, y quedó
   * así. En la práctica significaba que las guías de traslado —unas 17 al mes— se emitían
   * fuera del ERP y el número se escribía a mano en la solicitud.
   *
   * El detalle y los valores salen de los bultos efectivamente cargados en los pallets, así que
   * la guía declara lo mismo que muestra la pantalla de la solicitud.
   */
  emitirGuiaDespachoSolicitud: async (idSolicitud, { transportista, fechaEnvio } = {}) => {
    const res = await api('/facturacion/emitir-guia-despacho', {
      method: 'POST',
      body: {
        id_solicitud_mercaderia: idSolicitud,
        ...(transportista ? { transportista } : {}),
        ...(fechaEnvio ? { fecha_envio_override: fechaEnvio } : {}),
      },
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

  /**
   * 🔴 NO USAR: LA RUTA ESTÁ CERRADA EN EL BACKEND DESDE EL 2026-08-08. Devuelve 404.
   *
   * (El comentario anterior decía que "el endpoint existe y funciona"; ya no es cierto.)
   *
   * Sin llamador desde el 2026-08-01, cuando se eliminó la vista /Pallets — y aquel botón
   * "Emitir GD" **nunca funcionó**: llamaba a un método inexistente. O sea que esta función
   * jamás emitió un documento.
   *
   * Se cerró en el backend por tres motivos, además de no tener uso:
   *   · permitía declararle al SII la misma mercadería dos veces (la guía de la solicitud no
   *     bloqueaba las de sus pallets);
   *   · si el pallet no tenía solicitud, emitía con las bodegas literales "Bodega origen" y
   *     "Bodega destino";
   *   · el modelo cambió: un solo pallet abierto por solicitud, y los pallets se eliminan al
   *     recepcionarlos. La unidad de envío es la solicitud.
   *
   * Se conserva por si la guía por pallet vuelve a hacer falta. Antes de cablearla hay que
   * reabrir la ruta en `facturacion-router.ts` y resolver lo de arriba.
   */
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
   * Conciliación con LibreDTE (B5): cruza nuestros documentos, sus emitidos y SUS TEMPORALES.
   * Sólo lee — no emite, no anula y no corrige nada.
   */
  conciliar: async ({ desde, hasta } = {}) => {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const query = params.toString() ? `?${params}` : '';
    const res = await api(`/facturacion/conciliacion${query}`);
    return res?.data ?? res ?? null;
  },

  /**
   * Las emisiones que quedaron trabadas, sin consultar a LibreDTE.
   * Es la consulta barata, para el aviso del dashboard.
   */
  listarEmisionesAbiertas: async () => {
    const res = await api('/facturacion/emisiones-abiertas');
    return res?.data ?? res ?? [];
  },

  /**
   * Libera una emisión trabada. ⚠️ NO emite ni anula nada: sólo deja de bloquear el reintento.
   * La nota es obligatoria porque quien libera está afirmando que fue a mirar LibreDTE.
   */
  liberarEmision: async (id, nota) => {
    const res = await api(`/facturacion/emisiones/${id}/revisar`, {
      method: 'POST',
      body: { nota },
    });
    return res?.data ?? res ?? null;
  },

  /**
   * Abre el documento REAL como saldría, antes de emitirlo. NO consume folio.
   *
   * Lo genera LibreDTE a partir del mismo payload que usaría la emisión, y sale con
   * **FOLIO N° 0**: es el borrador, no existe ante el SII. Sirve para cazar un cliente
   * equivocado o un total que no cuadra mientras todavía se puede, porque una factura emitida
   * ya no se edita — sólo se corrige con nota de crédito.
   *
   * ⚠️ Cada llamada deja un documento temporal en la cuenta de LibreDTE, así que va detrás de
   * un botón y no se dispara sola al abrir una pantalla.
   *
   * @param tipo 'factura' | 'guia-solicitud'
   */
  // `opciones` lleva lo que el operario tiene elegido y todavía no está guardado en la orden:
  // la dirección de facturación y la fecha. Sin eso el backend arma el documento desde la orden
  // guardada, donde `id_local` recién existe DESPUÉS de facturar — y respondía «la orden no
  // tiene dirección de facturación» justo a quien quería mirar antes de emitir.
  verPrevisualizacion: async (tipo, referenciaId, opciones = {}) => {
    const params = new URLSearchParams();
    if (opciones.idLocal) params.set('id_local', String(opciones.idLocal));
    if (opciones.fecha) params.set('fecha', opciones.fecha);
    if (opciones.transportista) params.set('transportista', opciones.transportista);
    const query = params.toString() ? `?${params.toString()}` : '';

    const blob = await apiBlob(`/facturacion/previsualizar/${tipo}/${referenciaId}${query}`);
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank');
    if (ventana) {
      ventana.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
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
