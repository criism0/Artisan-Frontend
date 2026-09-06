import { api, apiBlob } from '../lib/api.js';

const BASE_OC = '/proceso-compra/ordenes';
const BASE_DR = '/documentos-recibidos';
const BASE_LIBREDTE = '/facturacion/documentos-recibidos-libredte';

export const dteRecibidoService = {
  // ── Queries ───────────────────────────────────────────────────────────────

  // Returns { guias: [...], facturas: [...] } with calculated fields:
  //   diasRestantes, descuadre, guiasAsociadas, archivoTipo
  listarPorOrden: (ordenId) =>
    api(`${BASE_OC}/${ordenId}/documentos-recibidos`),

  // ── Mutations ─────────────────────────────────────────────────────────────

  // Payload: { tipo_dte, emisor_rut, emisor_nombre, folio, fecha_emision,
  //            monto_neto, monto_iva, monto_total, numero_oc, archivo_url?,
  //            archivo_tipo?, motivo_descuadre?, origen? }
  vincularDocumento: (ordenId, payload) =>
    api(`${BASE_OC}/${ordenId}/documentos-recibidos`, {
      method: 'POST',
      body: payload,
    }),

  // Associates a factura to 0..N guías de despacho previously registered under the same OC.
  vincularGuias: (facturaId, guiaIds) =>
    api(`${BASE_DR}/${facturaId}/vincular-guias`, {
      method: 'POST',
      body: { guia_ids: guiaIds },
    }),

  actualizar: (id, data) =>
    api(`${BASE_DR}/${id}`, { method: 'PATCH', body: data }),

  aceptar: (id) =>
    api(`${BASE_DR}/${id}/aceptar`, { method: 'POST' }),

  reclamar: (id, motivo) =>
    api(`${BASE_DR}/${id}/reclamar`, { method: 'POST', body: { motivo } }),

  // ── Files ─────────────────────────────────────────────────────────────────

  // Downloads the stored PDF or image for a received document.
  descargarArchivo: (id) => apiBlob(`${BASE_DR}/${id}/archivo`),

  // ── Vincular facturas recibidas (sincronización con LibreDTE/SII) ──────────
  //
  // Distinto del flujo de arriba: acá el documento no lo fotografía nadie, se lee de la
  // bandeja de LibreDTE (que a su vez sincroniza con el RCV del SII). Punto 2 de la reunión
  // con Hernán, 2026-09-01.

  // Todo lo que llegó en el rango — facturas y guías vinculables, y también lo que no (NC/ND),
  // marcado con tipoSoportado:false para que se vea por qué no tiene botón de vincular.
  listarLibreDte: (desde, hasta) =>
    api(`${BASE_LIBREDTE}?desde=${desde}&hasta=${hasta}`),

  // ¿Con qué OC calza este documento, si es que se puede saber solo? Sólo lee.
  sugerirVinculo: ({ tipoDte, folio, emisorRut, intercambioId }) =>
    api(
      `${BASE_LIBREDTE}/sugerencia?tipo_dte=${tipoDte}&folio=${folio}` +
      `&emisor_rut=${encodeURIComponent(emisorRut)}` +
      (intercambioId != null ? `&intercambio_id=${intercambioId}` : ''),
    ),

  // Payload: { tipo_dte, folio, emisor_rut, emisor_nombre, fecha_emision, monto_neto?,
  //            monto_iva?, monto_total, intercambio_id?, id_orden_compra, metodo,
  //            nota? (obligatoria si metodo='manual'), numero_oc_leido? }
  vincularLibreDte: (payload) =>
    api(`${BASE_LIBREDTE}/vincular`, { method: 'POST', body: payload }),

  desvincularLibreDte: (id) =>
    api(`${BASE_LIBREDTE}/${id}/desvincular`, { method: 'POST' }),
};
