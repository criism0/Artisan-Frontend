/**
 * adjuntosService — archivos colgados de una orden de venta o de una solicitud.
 *
 * Pedido de Cristóbal, 2026-08-22: poder adjuntar a una OV cualquier archivo relevante (una
 * foto del despacho, el PDF de la OC del cliente, un comprobante) y consultarlo después junto
 * con los documentos tributarios.
 */

import { api } from '../lib/api.js';

/** Lo que el backend acepta. Se usa también en el `accept` del input para no ofrecer lo que va a rebotar. */
export const TIPOS_ACEPTADOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'text/plain',
];

export const MAX_BYTES = 50 * 1024 * 1024;

function mapAdjunto(a) {
  if (!a) return null;
  return {
    id: a.id,
    nombre: a.nombre_original,
    mimeType: a.mime_type,
    tamanoBytes: Number(a.tamano_bytes ?? 0),
    descripcion: a.descripcion,
    subidoPor: a.autor?.nombre ?? null,
    fecha: a.createdAt,
  };
}

/** Tamaño legible. 0 no se muestra como «0 B» sino como vacío: es «no se sabe», no «vacío». */
export function formatearTamano(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const adjuntosService = {
  listar: async ({ idOrdenVenta, idSolicitud } = {}) => {
    const params = new URLSearchParams();
    if (idOrdenVenta) params.set('id_orden_venta', idOrdenVenta);
    if (idSolicitud) params.set('id_solicitud_mercaderia', idSolicitud);
    const res = await api(`/adjuntos?${params.toString()}`);
    return (res?.data?.adjuntos ?? []).map(mapAdjunto);
  },

  subir: async ({ archivo, descripcion, idOrdenVenta, idSolicitud }) => {
    const fd = new FormData();
    fd.append('file', archivo);
    if (descripcion) fd.append('descripcion', descripcion);
    if (idOrdenVenta) fd.append('id_orden_venta', String(idOrdenVenta));
    if (idSolicitud) fd.append('id_solicitud_mercaderia', String(idSolicitud));

    // Sin `Content-Type`: el navegador tiene que ponerlo él para incluir el boundary del
    // multipart. Fijarlo a mano rompe la subida de una forma que se lee como "archivo inválido".
    const res = await api('/adjuntos', { method: 'POST', body: fd });
    return mapAdjunto(res?.data?.adjunto ?? res?.data);
  },

  /**
   * La URL firmada del archivo, para mostrarlo o descargarlo.
   *
   * Dura 5 minutos y se pide en el momento: es un permiso de lectura con vida propia, así que no
   * se guarda ni se reparte de antemano — por eso el listado no las trae y hay una llamada por
   * archivo que se abre.
   *
   * ✅ Sirve para previsualizar en un `<iframe>`/`<img>` porque S3 la firma con el `Content-Type`
   * real del objeto y SIN `Content-Disposition: attachment`; con esa cabecera el navegador
   * descargaría el archivo en vez de mostrarlo, y el visor quedaría en blanco.
   */
  obtenerUrl: async (id) => {
    const res = await api(`/adjuntos/${id}/url`);
    const datos = res?.data ?? {};
    if (!datos.url) throw new Error('No se pudo generar el enlace del archivo');
    return { url: datos.url, nombre: datos.nombre_original, mimeType: datos.mime_type };
  },

  /**
   * Abre el archivo en una pestaña nueva. Queda como salida para lo que el visor no puede
   * mostrar (planillas, documentos de Word, fotos HEIC de iPhone).
   */
  abrir: async (id) => {
    const { url } = await adjuntosService.obtenerUrl(id);
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  eliminar: async (id) => {
    await api(`/adjuntos/${id}`, { method: 'DELETE' });
  },
};
