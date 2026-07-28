import { api, apiBlob } from '../lib/api.js';

const BASE_OC = '/proceso-compra/ordenes';
const BASE_DR = '/documentos-recibidos';

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
};
