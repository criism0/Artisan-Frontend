import { api } from '../lib/api';

export async function getJumpsellerOrdenPorId(id) {
  return api(`/jumpseller/orders/${id}`, { auth: true });
}