import { api } from "../lib/api";

const unwrapList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

/* ---------- Usuarios ---------- */

export const listarUsuarios = async () => {
  const res = await api("/usuarios");
  return unwrapList(res);
};
