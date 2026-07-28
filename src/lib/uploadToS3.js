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
