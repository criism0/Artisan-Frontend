// Cómo se muestra una elaboración (Fase 5, 2026-11-26).
//
// Las etapas son las que ve la planta: Planificada → En elaboración → Por registrar → Valor
// agregado → Cerrada (o Anulada). El backend manda `etapa`, `pasos`, `siguiente_paso` y `pva`
// en la lista y el detalle; acá sólo se decide qué decir y adónde llevar.

export const ETAPAS = {
  planificada: { nombre: "Planificada", punto: "bg-gray-400", clase: "border-gray-300 bg-gray-100 text-gray-700" },
  en_elaboracion: { nombre: "En elaboración", punto: "bg-blue-500", clase: "border-blue-300 bg-blue-100 text-blue-800" },
  por_registrar: { nombre: "Por registrar", punto: "bg-orange-500", clase: "border-orange-300 bg-orange-100 text-orange-800" },
  valor_agregado: { nombre: "Valor agregado", punto: "bg-purple-500", clase: "border-purple-300 bg-purple-100 text-purple-800" },
  cerrada: { nombre: "Cerrada", punto: "bg-green-500", clase: "border-green-300 bg-green-100 text-green-800" },
  anulada: { nombre: "Anulada", punto: "bg-red-400", clase: "border-red-300 bg-red-100 text-red-800" },
};

export const ORDEN_ETAPAS = ["planificada", "en_elaboracion", "por_registrar", "valor_agregado", "cerrada", "anulada"];

const POR_ESTADO = {
  Borrador: "planificada",
  "Insumos Asignados": "en_elaboracion",
  "En ejecución": "en_elaboracion",
  "Esperando Salidas": "por_registrar",
  "Esperando PVAs": "valor_agregado",
  Cerrada: "cerrada",
  Cancelada: "anulada",
};

export const etapaDe = (om) => om?.etapa ?? POR_ESTADO[om?.estado] ?? "planificada";
export const nombreEtapa = (om) => ETAPAS[etapaDe(om)]?.nombre ?? om?.estado ?? "—";
export const estaAbierta = (om) => !["cerrada", "anulada"].includes(etapaDe(om));

/** Se puede anular hasta antes de registrar la producción (después ya hay lote y bultos). */
export const esAnulable = (om) => ["planificada", "en_elaboracion", "por_registrar"].includes(etapaDe(om));

export const pasosPendientes = (om) => Math.max(0, Number(om?.pasos?.total || 0) - Number(om?.pasos?.hechos || 0));

/** «PIP» o «PT» según lo que sale de la receta. */
export const tipoProducto = (om) => (om?.id_producto_base || om?.productoBase ? "PT" : om?.id_materia_prima || om?.materiaPrima ? "PIP" : null);
export const nombreProducto = (om) => om?.productoBase?.nombre || om?.materiaPrima?.nombre || om?.receta?.nombre || "—";

const fechaCorta = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Lo que toca hacer ahora y adónde lleva (`ruta` relativa a la elaboración, o `tab` del
 * detalle). null si ya no queda nada.
 */
export function siguienteAccion(om) {
  switch (etapaDe(om)) {
    case "planificada":
      return { label: "Preparar insumos", ruta: "insumos", principal: true };
    case "en_elaboracion": {
      const faltan = pasosPendientes(om);
      if (faltan > 0) return { label: `Ejecutar pasos · ${om.pasos.hechos} de ${om.pasos.total}`, ruta: "pasos" };
      return { label: "Registrar producción", ruta: "produccion-final", principal: true };
    }
    case "por_registrar":
      return { label: "Registrar producción", ruta: "produccion-final", principal: true };
    case "valor_agregado": {
      const pva = om?.pva ?? {};
      if (pva.vencidas > 0) return { label: "Terminar valor agregado", tab: "pva", urgente: true };
      if (pva.en_proceso > 0) return { label: pva.termina ? `Valor agregado · termina ${fechaCorta(pva.termina)}` : "Valor agregado en curso", tab: "pva" };
      return { label: "Comenzar valor agregado", tab: "pva" };
    }
    default:
      return null;
  }
}

/** Días desde la fecha de la elaboración, sólo si sigue abierta. «Detenida» desde 14 días. */
export function diasAbierta(om, hoy = new Date()) {
  if (!estaAbierta(om) || !om?.fecha) return null;
  const dias = Math.floor((hoy.getTime() - new Date(om.fecha).getTime()) / 86400000);
  return { dias, detenida: dias >= 14 };
}

/**
 * Los cinco pasos de la barra del detalle: hecho, actual, pendiente o «no aplica».
 * Pasos no aplica si la receta no tiene; valor agregado no aplica si la elaboración ya cerró
 * sin él o todavía no se sabe (antes de registrar se muestra pendiente).
 */
export function barraEtapas(om) {
  const etapa = etapaDe(om);
  const i = ORDEN_ETAPAS.indexOf(etapa);
  const total = Number(om?.pasos?.total || 0);
  const tienePva = Number(om?.pva?.total || 0) > 0;
  const estado = (pos) => (etapa === "anulada" ? "pendiente" : i > pos ? "hecho" : i === pos ? "actual" : "pendiente");

  const insumos = etapa === "planificada" ? "actual" : etapa === "anulada" ? "pendiente" : "hecho";
  let pasos;
  if (total === 0) pasos = "no_aplica";
  else if (etapa === "en_elaboracion") pasos = pasosPendientes(om) > 0 ? "actual" : "hecho";
  else pasos = i > 1 && etapa !== "anulada" ? "hecho" : "pendiente";
  const produccion = etapa === "en_elaboracion" && pasos !== "actual" ? "actual" : estado(2);
  const pva = etapa === "cerrada" && !tienePva ? "no_aplica" : estado(3);

  return [
    { id: "insumos", nombre: "Insumos", estado: insumos },
    { id: "pasos", nombre: "Pasos", estado: pasos, detalle: total ? `${om.pasos.hechos} de ${total}` : null },
    { id: "produccion", nombre: "Producción", estado: produccion },
    { id: "pva", nombre: "Valor agregado", estado: pva },
    { id: "cerrada", nombre: etapa === "anulada" ? "Anulada" : "Cerrada", estado: etapa === "cerrada" ? "hecho" : etapa === "anulada" ? "actual" : "pendiente" },
  ];
}
