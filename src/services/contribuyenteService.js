/**
 * contribuyenteService — Busca información de empresas por RUT en el SII (vía LibreDTE).
 * Útil para autocompletar datos al crear clientes o proveedores.
 */
import { api } from '../lib/api.js';

/**
 * Normaliza un RUT: quita puntos, convierte a mayúsculas.
 * Ej: "76.059.975-1" → "76059975-1"  |  "12345678k" → "12345678-K"
 */
export function normalizarRut(rut) {
  if (!rut) return '';
  const limpio = rut.replace(/\./g, '').trim().toUpperCase();
  // Si ya tiene guión, dejarlo; si no, insertar antes del último char
  if (limpio.includes('-')) return limpio;
  if (limpio.length > 1) return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
  return limpio;
}

/**
 * Valida que el DV del RUT sea correcto (Módulo 11).
 * @param {string} rut — con o sin puntos, con guión
 */
export function validarDvRut(rut) {
  const limpio = rut.replace(/\./g, '').toUpperCase();
  const [cuerpo, dv] = limpio.split('-');
  if (!cuerpo || !dv) return false;
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult < 7 ? mult + 1 : 2;
  }
  const resto = 11 - (suma % 11);
  const dvCalc = resto === 10 ? 'K' : resto === 11 ? '0' : String(resto);
  return dvCalc === dv;
}

export const contribuyenteService = {
  /**
   * Busca un contribuyente por RUT en el SII.
   * Retorna { razon_social, giro, direccion, comuna_glosa, email, telefono }
   * Lanza ApiError si no se encuentra (404) o hay error de red.
   */
  buscarPorRut: async (rut) => {
    const rutNorm = normalizarRut(rut);
    const res = await api(`/facturacion/contribuyentes/${encodeURIComponent(rutNorm)}`);
    return res?.data ?? res;
  },
};
