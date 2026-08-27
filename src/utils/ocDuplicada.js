/**
 * ¿Este cliente ya tiene una orden con este número de OC?
 *
 * Pedido de Cristóbal (2026-08-26): avisar antes de crear una OV con un número de orden de
 * compra que el cliente ya usó. Pasa cuando el mismo pedido entra dos veces —el correo
 * reenviado, o alguien que la carga a mano sin ver que la Cola IA ya la creó— y hasta ahora
 * quedaban dos órdenes idénticas que después se facturaban dos veces.
 *
 * 🔴 ES UN AVISO, NO UN BLOQUEO. Repetir la OC del cliente **es legítimo**: una misma orden de
 * compra puede despacharse en dos entregas parciales. Bloquearlo rompería casos reales; avisar
 * pone la decisión donde corresponde.
 *
 * Vive acá y no dentro de una vista porque lo usan los dos caminos por los que nace una OV —el
 * formulario manual y la Cola IA— y tienen que avisar lo mismo.
 */

import { api } from '../lib/api.js';

/**
 * Devuelve las órdenes del mismo cliente que ya usan ese número de OC.
 *
 * Nunca lanza: esto es una comprobación de cortesía antes de guardar, y si la consulta falla no
 * puede impedir que se cree la orden. Un aviso que no se pudo calcular es sólo un aviso que no
 * aparece — al revés, dejar al operario sin poder guardar por un error de red sería peor que el
 * duplicado que se quiere evitar.
 *
 * @param excluirId  la propia orden que se está revisando (en la Cola IA ya está guardada con
 *                   ese número y siempre se encontraría a sí misma).
 */
export async function buscarOvConMismaOC({ numeroOc, idCliente, excluirId = null }) {
  const oc = String(numeroOc ?? '').trim();
  if (!oc || !idCliente) return [];

  const params = new URLSearchParams({ numero_oc: oc, id_cliente: String(idCliente) });
  if (excluirId) params.set('excluir_id', String(excluirId));

  try {
    const res = await api(`/ordenes-venta/oc-duplicada?${params.toString()}`);
    return res?.data?.duplicadas ?? [];
  } catch {
    return [];
  }
}

/** Resume las coincidencias para el aviso: «OV #824 (12-08-2026, Facturada)». */
export function describirDuplicadas(duplicadas) {
  return (duplicadas ?? []).map((d) => {
    const fecha = d.fecha_orden ? String(d.fecha_orden).slice(0, 10) : null;
    const partes = [fecha, d.estado].filter(Boolean);
    return `OV #${d.id}${partes.length ? ` (${partes.join(', ')})` : ''}`;
  });
}
