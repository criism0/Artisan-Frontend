// src/pages/Facturas_IA/facturas_extra_1.js
import { apiExtra1 } from "../../lib/apiextra1";

export function procesarFacturaExtra1(file, { signal } = {}) {
  if (!(file instanceof File)) {
    throw new Error("procesarFacturaExtra1: 'file' debe ser File (PDF).");
  }

  const fd = new FormData();
  fd.append("file", file, file.name);

  return apiExtra1("/walmart-cencosud/factura_json", {
    method: "POST",
    body: fd,
    signal,
  });
}