import { api } from "../lib/api";

const unwrapList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

const unwrapOne = (res) => {
  if (res?.data && !Array.isArray(res.data)) return res.data;
  return res;
}

const buildQuery = (params = {}) => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of entries) qs.set(k, String(v));
  return `?${qs.toString()}`;
};

// El backend persiste `respuestas` (JSONB) verbatim pero NO guarda estado ni
// detalle como columnas propias. Para no perder el estado de conformidad
// declarado por el usuario, se embeben dentro del propio JSONB bajo estas
// claves reservadas (las lee calidadAnalytics al enriquecer la respuesta).
export const META_ESTADO = "__estado";
export const META_DETALLE = "__detalle";

const embebeMeta = (respuestas, estado, detalle) => {
  const base = { ...respuestas };
  if (estado !== undefined) base[META_ESTADO] = estado;
  if (estado === "conforme") base[META_DETALLE] = "";
  else if (detalle !== undefined) base[META_DETALLE] = detalle;
  return base;
};

/* ---------- Formularios de calidad ---------- */

export const listarFormularios = async () => {
  const res = await api("/calidad/formularios");
  return unwrapList(res);
}

export const obtenerFormulario = async (id) =>{
  const res = await api(`/calidad/formularios/${id}`);
  return unwrapOne(res);
}

// checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE)
export const crearFormulario = (body) =>
  api("/calidad/formularios", { method: "POST", body });

// checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE)
export const actualizarFormulario = (id, body) =>
  api(`/calidad/formularios/${id}`, { method: "PUT", body });

// checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE)
export const toggleActivoFormulario = (id) =>
  api(`/calidad/formularios/${id}/toggle-active`, { method: "POST" });

// checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.DELETE)
export const eliminarFormulario = (id) =>
  api(`/calidad/formularios/${id}`, { method: "DELETE" });

/* ---------- Respuestas de formularios ---------- */

// El backend pagina y devuelve { data, meta }. Para los flujos del frontend
// se devuelve el arreglo completo, paginando internamente hasta agotar `meta.total`.
export const listarRespuestas = async (idFormulario, { estado } = {}) => {
  const baseQuery = buildQuery({ estado, limit: 100 });
  const first = await api(`/calidad/formularios/${idFormulario}/respuestas${baseQuery}`);
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return unwrapList(first);
  }
  const rows = Array.isArray(first.data) ? [...first.data] : [];
  const totalPages = first.meta?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const next = await api(
      `/calidad/formularios/${idFormulario}/respuestas${buildQuery({ estado, limit: 100, page })}`
    );
    if (Array.isArray(next?.data)) rows.push(...next.data);
  }
  return rows;
}

// checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE)
// estado: "conforme" | "desvio" | "no-conforme"
// detalle: requerido cuando estado != "conforme"; vacío cuando estado == "conforme"
export const crearRespuesta = (idFormulario, { respuestas, estado, detalle }) =>
  api(`/calidad/formularios/${idFormulario}/respuestas`, {
    method: "POST",
    // estado/detalle van también top-level (forward-compatible si el backend
    // los soporta) y embebidos en el JSONB (única vía que hoy se persiste).
    body: {
      respuestas: embebeMeta(respuestas, estado, detalle),
      estado,
      detalle: detalle || undefined,
    },
  });

export const obtenerRespuesta = async (id) => {
  const res = await api(`/calidad/respuestas/${id}`);
  return unwrapOne(res);
}

// checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE)
export const actualizarRespuesta = (id, { respuestas, estado, detalle }) => {
  const body = {};
  // Solo se embebe el meta cuando vienen las respuestas: si se mandara un
  // JSONB con solo las claves reservadas se borrarían las respuestas guardadas.
  if (respuestas !== undefined) body.respuestas = embebeMeta(respuestas, estado, detalle);
  if (estado !== undefined) body.estado = estado;
  if (detalle !== undefined) body.detalle = detalle;
  return api(`/calidad/respuestas/${id}`, {
    method: "PUT",
    body,
  });
}

// checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE)
export const eliminarRespuesta = (id) =>
  api(`/calidad/respuestas/${id}`, { method: "DELETE" });
