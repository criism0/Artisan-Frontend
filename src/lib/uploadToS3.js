import { API_BASE, getToken } from "./api";
import { toast } from "./toast";

/**
 * Sube un archivo al bucket S3 a través del backend.
 * @param {File} file - Archivo a subir
 * @returns {Promise<Object>} - Referencia del archivo subida ({ s3_key, s3_bucket, original_name, mime_type, size })
 */
export async function uploadToS3(file) {

  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();

  const res = await fetch(`${API_BASE}/s3/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    toast.error("Error al subir archivo:", errText);
    throw new Error(`Error al subir ${file.name}`);
  }

  const data = await res.json();
  return data.s3_reference;
}
