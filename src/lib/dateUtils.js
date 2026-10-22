/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 * @returns {string} Fecha actual en formato YYYY-MM-DD
 */
export const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_A_MEDIANOCHE_UTC = /^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.0{1,3})?)?(?:Z|[+-]00:?00)$/;

function esMedianocheUtc(d) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/**
 * La fecha como `Date` local, sin correr el día.
 *
 * 🔴 Las fechas de calendario («entregar el 21») llegan de la API como `2026-10-21` (columnas
 * DATEONLY) o como `2026-10-21T00:00:00.000Z` (DATE guardadas a medianoche). `new Date()` las lee
 * como la medianoche UTC, que en Chile es el día ANTERIOR a las 21:00 o 20:00, y
 * `toLocaleDateString` mostraba el 20: la lista y el detalle de OV decían que la entrega
 * comprometida era un día antes de la real.
 *
 * Un día de calendario se arma al mediodía local de ese día —así ningún huso lo corre— y un
 * instante de verdad (un `createdAt` con hora) se deja tal cual.
 */
export function aFechaLocal(valor) {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'string') {
    const m = DIA.exec(valor.trim()) || DIA_A_MEDIANOCHE_UTC.exec(valor.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  }
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  if (esMedianocheUtc(d)) return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  return d;
}

/**
 * Una fecha para mostrar: `21-10-2026`, o con `opciones` de `toLocaleDateString`. El único
 * formateador de fechas de la app — ver `aFechaLocal` para el día que se corría.
 */
export function formatFecha(valor, opciones) {
  const d = aFechaLocal(valor);
  return d ? d.toLocaleDateString('es-CL', opciones) : '—';
}
