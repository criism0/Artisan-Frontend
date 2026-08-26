import { api } from "./api";

/**
 * Sube un archivo al bucket S3 a través del backend.
 * @param {File} file - Archivo a subir
 * @returns {Promise<Object>} - Referencia del archivo subida ({ s3_key, s3_bucket, original_name, mime_type, size })
 */
export async function uploadToS3(file) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await api("/s3/upload", {
    method: "POST",
    body: formData,
  });

  return data.s3_reference;
}

/**
 * URL firmada de un objeto de S3 a partir de su `s3_key`.
 *
 * Existe para poder MOSTRAR los archivos que quedaron guardados como referencias sueltas dentro
 * de un JSONB —`SolicitudMercaderia.archivos_guia_despacho`— antes de que existiera la tabla de
 * adjuntos. Ese camino guardaba los archivos y nadie los volvía a leer nunca: había **una sola
 * mención en todo el frontend**, la escritura.
 *
 * ⚠️ Para adjuntar algo NUEVO no se usa esto sino `adjuntosService`, que además guarda quién
 * subió qué y tiene integridad referencial con el proceso.
 */
export async function urlFirmadaDeS3(s3Key) {
  // `/s3/url` responde el cuerpo plano, sin el sobre `{ data }` del resto de la API.
  const data = await api(`/s3/url?s3_key=${encodeURIComponent(s3Key)}`);
  const url = data?.signed_url ?? data?.data?.signed_url;
  if (!url) throw new Error("No se pudo generar el enlace del archivo");
  return url;
}
