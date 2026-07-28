import toast from "../lib/toast";
import {
  listarFormularios,
  listarRespuestas,
  META_ESTADO,
  META_DETALLE,
} from "./calidad";
import { listarUsuarios } from "./usuarios";
import { checkScope, ModelType, ScopeType } from "./scopeCheck";

// Construye un Map id → nombre legible de usuario. Tolerante a fallos
// (p. ej. sin permiso para leer usuarios): en ese caso devuelve un Map vacío
// y la UI cae al "#id".
async function cargarUsuariosPorId() {
  try {
    const usuarios = await listarUsuarios();
    const map = new Map();
    for (const u of Array.isArray(usuarios) ? usuarios : []) {
      const nombre = u?.nombre || u?.name || u?.email || null;
      if (u?.id != null && nombre) map.set(u.id, nombre);
    }
    return map;
  } catch {
    return new Map();
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Derivación de conformidad
 *
 * El backend NO persiste un campo `estado` / `detalle` a nivel de respuesta
 * (ver modelo RespuestaFormularioCalidad). La conformidad vive DENTRO del
 * JSONB `respuestas`, en un campo de tipo `seleccion_unica` cuyos valores
 * son del tipo "conforme" / "observacion" / "no_conforme". Aquí derivamos
 * el estado y el detalle a partir de lo que el backend sí envía, para que
 * el dashboard y la lista de no conformidades muestren desvíos y no
 * conformidades reales.
 * ──────────────────────────────────────────────────────────────────── */

// Estados que entiende el frontend, ordenados de menor a mayor severidad.
const SEVERIDAD_ESTADO = { conforme: 0, desvio: 1, "no-conforme": 2 };

const normalizar = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[\s_-]+/g, ""); // quita espacios, guiones y guiones bajos

// Mapea un valor de opción ya normalizado a uno de los estados conocidos.
// El orden importa: "noconforme" contiene "conforme" como substring.
function estadoDesdeValor(valorNormalizado) {
  const v = valorNormalizado;
  if (!v) return null;
  if (v.includes("noconforme")) return "no-conforme";
  if (v.includes("observ") || v.includes("desvi")) return "desvio";
  if (v.includes("conforme")) return "conforme";
  return null;
}

// Un campo es "de conformidad" si es selección única y entre sus opciones
// hay una conforme y al menos una de desvío/no conforme.
function esCampoConformidad(campo) {
  if (campo?.tipo !== "seleccion_unica" || !Array.isArray(campo.opciones))
    return false;
  const estados = campo.opciones
    .map((op) => estadoDesdeValor(normalizar(typeof op === "object" ? op.valor : op)))
    .filter(Boolean);
  return (
    estados.includes("conforme") &&
    (estados.includes("no-conforme") || estados.includes("desvio"))
  );
}

// Palabras clave para reconocer el campo que contiene el detalle del desvío.
const DETALLE_KEYWORDS = [
  "detalle",
  "observ",
  "defecto",
  "descripcion",
  "comentario",
  "motivo",
];

/**
 * Deriva el estado de conformidad ("conforme" | "desvio" | "no-conforme")
 * de una respuesta a partir de los campos de conformidad de su formulario.
 * Si hay varios campos de conformidad, se toma el peor. Devuelve null si el
 * formulario no define ningún campo de conformidad o la respuesta no lo
 * contestó (no hay señal objetiva).
 */
export function derivarEstadoRespuesta(formulario, resp) {
  const valores = resp?.respuestas || {};
  let peor = null;
  for (const sec of formulario?.secciones || []) {
    for (const campo of sec.campos || []) {
      if (!esCampoConformidad(campo)) continue;
      const estado = estadoDesdeValor(normalizar(valores[campo.id]));
      if (!estado) continue;
      if (peor === null || SEVERIDAD_ESTADO[estado] > SEVERIDAD_ESTADO[peor]) {
        peor = estado;
      }
    }
  }
  return peor;
}

/**
 * Deriva el texto de detalle de una respuesta: prioriza campos de texto largo
 * cuya etiqueta/id sugiere "detalle"/"observación"/"defecto"; si no hay, toma
 * el primer texto largo no vacío. Devuelve "" cuando no hay nada.
 */
export function derivarDetalleRespuesta(formulario, resp) {
  const valores = resp?.respuestas || {};
  const candidatos = [];
  for (const sec of formulario?.secciones || []) {
    for (const campo of sec.campos || []) {
      if (campo.tipo !== "texto_largo") continue;
      const val = valores[campo.id];
      if (typeof val !== "string" || !val.trim()) continue;
      const clave = normalizar(campo.etiqueta) + normalizar(campo.id);
      const prioritario = DETALLE_KEYWORDS.some((k) => clave.includes(k));
      candidatos.push({ prioritario, texto: val.trim() });
    }
  }
  const prioritario = candidatos.find((c) => c.prioritario);
  if (prioritario) return prioritario.texto;
  return candidatos.length ? candidatos[0].texto : "";
}

/**
 * Enriquece una respuesta cruda del backend con `estado` y `detalle`.
 * Orden de precedencia:
 *   1. columnas top-level del backend (forward-compatible, hoy no existen),
 *   2. meta embebido en el JSONB (lo que declara el selector de estado),
 *   3. derivación desde el campo de conformidad del formulario.
 */
export function enriquecerRespuesta(formulario, resp) {
  const meta = resp?.respuestas || {};
  const estado =
    resp?.estado ??
    meta[META_ESTADO] ??
    derivarEstadoRespuesta(formulario, resp) ??
    undefined;
  const detalle =
    resp?.detalle ??
    meta[META_DETALLE] ??
    (estado && estado !== "conforme"
      ? derivarDetalleRespuesta(formulario, resp)
      : "");
  return { ...resp, estado, detalle };
}

/**
 * Carga todos los formularios + todas sus respuestas y devuelve
 * estructuras útiles para el dashboard y la lista de alertas.
 *
 * Notas:
 *  - El backend no expone un endpoint global de respuestas; hay que iterar
 *    por formulario. Costo: 1 + N llamadas (N = formularios activos).
 *  - Las "alertas" se derivan client-side: se consideran alertas solo los
 *    campos numéricos cuyo valor queda fuera del rango min/max definido
 *    en `validaciones`. Es la única señal objetiva que expone el schema.
 */
export async function cargarDatosCalidad() {
  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canReadResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ);
  if (!canReadForms || !canReadResponses) {
    toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ], [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]);
    return;
  }

  const formularios = await listarFormularios();
  const safeForms = Array.isArray(formularios) ? formularios : [];

  const [porForm, usuariosPorId] = await Promise.all([
    Promise.all(
      safeForms.map(async (f) => {
        try {
          const resp = await listarRespuestas(f.id);
          return [f.id, Array.isArray(resp) ? resp : []];
        } catch {
          return [f.id, []];
        }
      })
    ),
    cargarUsuariosPorId(),
  ]);

  const respuestasPorForm = new Map(porForm);
  const formById = new Map(safeForms.map((f) => [f.id, f]));

  const nombreUsuario = (id) => (id != null ? usuariosPorId.get(id) || null : null);

  // Se enriquece cada respuesta con el estado/detalle derivado del JSONB
  // (el backend no los persiste) y con el nombre del usuario.
  const respuestas = [];
  for (const [fId, rs] of porForm) {
    const form = formById.get(fId);
    for (const r of rs) {
      const enriquecida = enriquecerRespuesta(form, { ...r, formulario_id: fId });
      enriquecida.usuario_nombre = nombreUsuario(enriquecida.id_usuario);
      respuestas.push(enriquecida);
    }
  }

  const alertas = derivarAlertas(safeForms, respuestasPorForm);
  for (const a of alertas) a.usuario_nombre = nombreUsuario(a.id_usuario);

  return {
    formularios: safeForms,
    respuestas,
    respuestasPorForm,
    alertas,
  };
}

/**
 * Construye una alerta por cada campo numérico cuya respuesta esté fuera
 * del rango definido. La severidad es una heurística basada en qué tan
 * lejos del rango está el valor.
 */
export function derivarAlertas(formularios, respuestasPorForm) {
  const alertas = [];

  for (const form of formularios) {
    const respuestas = respuestasPorForm.get(form.id) || [];
    for (const resp of respuestas) {
      for (const sec of form.secciones || []) {
        for (const campo of sec.campos || []) {
          const alerta = evaluarCampo(form, sec, campo, resp);
          if (alerta) alertas.push(alerta);
        }
      }
    }
  }

  alertas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return alertas;
}

function evaluarCampo(form, seccion, campo, resp) {
  if (campo.tipo !== "numero" || !campo.validaciones) return null;
  const { min, max } = campo.validaciones;
  if (min == null && max == null) return null;

  const raw = resp.respuestas?.[campo.id];
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  if (Number.isNaN(num)) return null;

  let fuera = false;
  let distanciaRel = 0;
  if (min != null && num < min) {
    fuera = true;
    const base = Math.max(Math.abs(min), 1);
    distanciaRel = (min - num) / base;
  }
  if (max != null && num > max) {
    fuera = true;
    const base = Math.max(Math.abs(max), 1);
    distanciaRel = Math.max(distanciaRel, (num - max) / base);
  }
  if (!fuera) return null;

  return {
    id: `${resp.id}-${campo.id}`,
    formulario_id: form.id,
    formulario_codigo: form.codigo,
    formulario_nombre: form.nombre,
    respuesta_id: resp.id,
    seccion_titulo: seccion.titulo,
    campo_id: campo.id,
    campo_etiqueta: campo.etiqueta,
    valor: num,
    min: min ?? null,
    max: max ?? null,
    fecha: resp.completado_en || resp.created_at || null,
    id_usuario: resp.id_usuario ?? null,
    severidad: distanciaRel > 0.1 ? "critica" : "media",
  };
}

/**
 * Calcula KPIs agregados para el dashboard.
 */
export function calcularKpis({ formularios, respuestas, alertas }) {
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);

  const mismoDia = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.toDateString() === hoy.toDateString();
  };

  const fechaRespuesta = (r) => r.completado_en || r.created_at;
  const enUltimas24h = (r) => {
    const iso = fechaRespuesta(r);
    return iso && new Date(iso) >= ayer;
  };

  const respuestasHoy = respuestas.filter((r) => mismoDia(fechaRespuesta(r)));
  const respuestasUltimas24h = respuestas.filter(enUltimas24h);
  const respuestasUltimos7d = respuestas.filter((r) => {
    const iso = fechaRespuesta(r);
    return iso && new Date(iso) >= hace7;
  });

  const activos = formularios.filter((f) => f.activo !== false);
  const aprobados = activos.filter((f) => f.aprobado).length;
  const pendientes = activos.length - aprobados;

  // Desglose por estado (campo nuevo del backend).
  const conformes = respuestas.filter((r) => r.estado === "conforme");
  const desvios = respuestas.filter((r) => r.estado === "desvio");
  const noConformes = respuestas.filter((r) => r.estado === "no-conforme");

  const desviosUltimas24h = desvios.filter(enUltimas24h).length;
  const noConformesUltimas24h = noConformes.filter(enUltimas24h).length;

  const alertasCriticas = alertas.filter((a) => a.severidad === "critica").length;
  const alertasUltimas24h = alertas.filter((a) => {
    if (!a.fecha) return false;
    return new Date(a.fecha) >= ayer;
  }).length;

  return {
    total_formularios_activos: activos.length,
    formularios_aprobados: aprobados,
    formularios_pendientes_aprobacion: pendientes,
    respuestas_hoy: respuestasHoy.length,
    respuestas_ultimas_24h: respuestasUltimas24h.length,
    respuestas_ultimos_7d: respuestasUltimos7d.length,
    total_conformes: conformes.length,
    total_desvios: desvios.length,
    total_no_conformes: noConformes.length,
    desvios_ultimas_24h: desviosUltimas24h,
    no_conformes_ultimas_24h: noConformesUltimas24h,
    total_alertas: alertas.length,
    alertas_criticas: alertasCriticas,
    alertas_ultimas_24h: alertasUltimas24h,
  };
}

/**
 * Devuelve las últimas N respuestas con estado "desvio" o "no-conforme",
 * enriquecidas con el contexto del formulario al que pertenecen.
 */
export function desviosYNoConformidades(formularios, respuestas, limit = 5) {
  const porId = new Map(formularios.map((f) => [f.id, f]));
  return respuestas
    .filter((r) => r.estado === "desvio" || r.estado === "no-conforme")
    .sort((a, b) =>
      (b.completado_en || b.created_at || "").localeCompare(
        a.completado_en || a.created_at || ""
      )
    )
    .slice(0, limit)
    .map((r) => {
      const f = porId.get(r.formulario_id ?? r.id_formulario_calidad);
      return {
        id: r.id,
        formulario_id: r.formulario_id ?? r.id_formulario_calidad,
        formulario_codigo: f?.codigo || "—",
        formulario_nombre: f?.nombre || "—",
        estado: r.estado,
        detalle: r.detalle || "",
        fecha: r.completado_en || r.created_at,
        id_usuario: r.id_usuario,
        usuario_nombre: r.usuario_nombre ?? null,
      };
    });
}

/**
 * Top N formularios por cantidad de respuestas.
 */
export function topFormulariosPorRespuestas(formularios, respuestasPorForm, limit = 5) {
  const ranking = formularios.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    cantidad: (respuestasPorForm.get(f.id) || []).length,
  }));
  ranking.sort((a, b) => b.cantidad - a.cantidad);
  return ranking.slice(0, limit);
}

/**
 * Devuelve las últimas N respuestas (para el feed de actividad), con info
 * del formulario al que pertenecen.
 */
export function actividadReciente(formularios, respuestas, limit = 10) {
  const porId = new Map(formularios.map((f) => [f.id, f]));
  return [...respuestas]
    .sort((a, b) =>
      (b.completado_en || b.created_at || "").localeCompare(
        a.completado_en || a.created_at || ""
      )
    )
    .slice(0, limit)
    .map((r) => {
      const f = porId.get(r.formulario_id);
      return {
        id: r.id,
        formulario_id: r.formulario_id,
        formulario_codigo: f?.codigo || "—",
        formulario_nombre: f?.nombre || "—",
        fecha: r.completado_en || r.created_at,
        id_usuario: r.id_usuario,
        usuario_nombre: r.usuario_nombre ?? null,
      };
    });
}
