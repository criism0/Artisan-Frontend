// src/services/ocrFacturas.js
import { api } from "../../lib/api";

export function crear_factura(payload) {
  return api(`/ocr-facturas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function lista_de_facturas() {
  return api(`/ocr-facturas`, { method: "GET" });
}

export function buscar_factura(id) {
  return api(`/ocr-facturas/${id}`, { method: "GET" });
}

export function editar_factura(id, payload) {
  return api(`/ocr-facturas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function eliminar_factura(id) {
  return api(`/ocr-facturas/${id}`, { method: "DELETE" });
}