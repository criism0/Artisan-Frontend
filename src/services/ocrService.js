/**
 * ocrService — extrae campos de facturas/GDs desde imagen o PDF.
 *
 * PDFs: usa pdfjs-dist para extraer texto en el browser y aplicar regex.
 * Imágenes: devuelve campos vacíos (el operador los completa manualmente).
 *
 * Solo extrae los 3 campos que el modal necesita:
 *   folio, fecha_emision, monto_total
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/heic', 'image/heif',
];

export function esImagen(file) {
  return (
    IMAGE_TYPES.includes(file?.type?.toLowerCase()) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file?.name ?? '')
  );
}

export function esPDF(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');
}

// ── Extracción de texto desde PDF ─────────────────────────────────────────────

async function extraerTextoPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const partes = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    partes.push(content.items.map((item) => item.str).join(' '));
  }
  return partes.join('\n');
}

// ── Parseo de campos desde texto ──────────────────────────────────────────────

function parsearCampos(texto) {
  const resultado = { folio: '', fecha_emision: '', monto_total: '' };

  // N° Folio: "N° 12345", "Folio: 12345", "N.° 12345", "Nro. 12345"
  const matchFolio = texto.match(/(?:n[°º\.\s]+|folio\s*:\s*|n[uú]mero\s*:\s*|nro\s*\.?\s*:?\s*)(\d{1,8})/i);
  if (matchFolio) resultado.folio = matchFolio[1];

  // Fecha: DD/MM/YYYY o DD-MM-YYYY → YYYY-MM-DD  |  YYYY-MM-DD
  const matchFecha = texto.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b|\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/);
  if (matchFecha) {
    resultado.fecha_emision = matchFecha[4]
      ? `${matchFecha[4]}-${matchFecha[5]}-${matchFecha[6]}`
      : `${matchFecha[3]}-${matchFecha[2]}-${matchFecha[1]}`;
  }

  // Monto total: "Total: $1.234.567", "TOTAL $ 1.234", etc.
  const matchTotal = texto.match(/total[^\d$]{0,20}\$?\s*([\d\.]+)/i);
  if (matchTotal) {
    resultado.monto_total = matchTotal[1].replace(/\./g, '');
  }

  return resultado;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Procesa un archivo e intenta extraer folio, fecha de emisión y total.
 * Nunca lanza error — si falla, retorna campos vacíos para ingreso manual.
 */
export async function procesarDocumento(file) {
  if (!file) return {};

  try {
    if (esPDF(file)) {
      const texto = await extraerTextoPDF(file);
      return parsearCampos(texto);
    }
    // Imágenes: el operador llena los campos manualmente
    return {};
  } catch (err) {
    console.warn('[OCR] No se pudo procesar el documento:', err?.message ?? err);
    return {};
  }
}
