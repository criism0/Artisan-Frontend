// Lo que la lista y el detalle de una orden de compra muestran igual: chips, marcas de recepción y
// de pago, la fecha del paso y QUÉ ACCIONES corresponden a cada estado.
//
// Antes cada página decidía sus acciones por su cuenta y no coincidían: la lista ofrecía
// «Eliminar» en cualquier estado y mandaba el correo al validar; el detalle no mandaba correo y
// ofrecía «Editar» sólo en Creada. Ahora las dos leen de `accionesOC`.

export const PARCIAL = "Parcialmente recepcionada";
export const ESTADOS_BORRABLES_OC = ["Creada", "Validada"];
/** Desde cuántos días una orden abierta se marca en ámbar. */
export const DIAS_SIN_CERRAR = 30;

// [estado, clase del punto, etiqueta corta] en el orden del flujo, para `ChipsEstado`.
export const ESTADOS_OC_CHIPS = [
  ["Creada", "bg-gray-400"],
  ["Validada", "bg-sky-500"],
  [PARCIAL, "bg-amber-500", "Recep. parcial"],
  ["Recepcionada", "bg-green-500"],
  ["Rechazada", "bg-rose-500"],
];

export const etiquetaEstadoOC = (estado) => (estado === PARCIAL ? "Recep. parcial" : estado);

/** Validada o recibida y sin pagar: lo que el chip «$ Por pagar» cuenta. */
export const porPagar = (o) => !o.pagada && ["Validada", PARCIAL, "Recepcionada"].includes(o.estado);

const lineas = (n) => `${n} línea${n === 1 ? "" : "s"}`;

/** Marca de lo recibido contra lo pedido (`resultado.recepcion` del backend). */
export function marcaRecepcionOC(resultado) {
  const r = resultado?.recepcion;
  if (!r) return null;
  if (r.menos) return { texto: `▼ ${lineas(r.menos)}`, titulo: `Llegó menos de lo pedido en ${lineas(r.menos)}`, tono: "menos" };
  if (r.mas) return { texto: `▲ ${lineas(r.mas)}`, titulo: `Llegó más de lo pedido en ${lineas(r.mas)}`, tono: "mas" };
  return { texto: "= pedido", titulo: "Llegó todo lo pedido", tono: "ok" };
}

/** Marca de pago, aparte del estado. */
export function marcaPagoOC(o) {
  if (o.pagada) return { texto: "✓ Pagada", titulo: "Pagada", tono: "ok" };
  if (o.estado === "Rechazada") return null;
  if (o.requiere_prepago) return { texto: "Prepago pendiente", titulo: "La orden exige pagar antes de recibir", tono: "menos" };
  return { texto: "Por pagar", titulo: "Sin pagar", tono: "gris" };
}


/**
 * La fecha que importa según el paso: la de emisión mientras está abierta (con los días que
 * lleva) y la de recepción una vez recibida.
 */
export function fechaDelPasoOC(o, ahora = new Date()) {
  const recibida = o.estado === "Recepcionada" && o.fecha_recepcion;
  const fecha = new Date(recibida ? o.fecha_recepcion : o.fecha);
  if (Number.isNaN(fecha.getTime())) return { fecha: null, etiqueta: "", dias: 0, antigua: false };
  const dias = Math.floor((ahora - fecha) / 86400000);
  const abierta = ["Creada", "Validada", PARCIAL].includes(o.estado);
  return { fecha, etiqueta: recibida ? "recibida" : "emitida", dias, antigua: abierta && dias >= DIAS_SIN_CERRAR };
}

export const nombreInsumoOC = (mp) =>
  mp?.proveedorMateriaPrima?.materiaPrima?.nombre || mp?.materiaPrima?.nombre || `Insumo #${mp?.id_proveedor_materia_prima ?? "?"}`;

/**
 * Las acciones de una orden según su estado, con la forma de `PanelAcciones`:
 * { principal, menu, destructivas }. `ejecutar(ruta, exito, metodo)` llama al backend.
 */
export function accionesOC(o, { puedeEscribir, puedeBorrar, ejecutar, navigate }) {
  const ruta = `/adquisiciones/ordenes-compra/${o.id}`;
  const e = o.estado;
  let principal = null;
  if (puedeEscribir && e === "Creada") {
    principal = {
      label: "Validar orden",
      onClick: () => ejecutar("validar", "Orden validada"),
      confirmar: { titulo: `¿Validar la OC #${o.id}?`, mensaje: "Queda lista para recepcionar y se avisa por correo.", textoBoton: "Validar" },
    };
  } else if (puedeEscribir && (e === "Validada" || e === PARCIAL)) {
    principal = { label: e === PARCIAL ? "Recepcionar lo que falta" : "Recepcionar", onClick: () => navigate(`${ruta}/recepcionar`) };
  }

  const menu = [
    puedeEscribir && e === "Creada" && { label: "Editar", onClick: () => navigate(`${ruta}/editar`) },
    puedeEscribir && e !== "Rechazada" &&
      (o.pagada
        ? { label: "Revertir pago", onClick: () => ejecutar("revertir-pago", "Pago revertido"), confirmar: { titulo: `¿Revertir el pago de la OC #${o.id}?`, textoBoton: "Revertir" } }
        : { label: "Marcar como pagada", onClick: () => ejecutar("pagar", "Orden marcada como pagada"), confirmar: { titulo: `¿Marcar la OC #${o.id} como pagada?`, textoBoton: "Marcar pagada" } }),
    puedeEscribir && e === PARCIAL && {
      label: "Cerrar con lo recibido",
      onClick: () => ejecutar("cerrar", "Orden cerrada con lo recibido"),
      confirmar: { titulo: "¿Cerrar con lo recibido?", mensaje: "Pasa a «Recepcionada» con lo que ya llegó y no se espera el resto.", textoBoton: "Cerrar" },
    },
  ].filter(Boolean);

  const destructivas = [
    puedeEscribir && ["Validada", PARCIAL, "Recepcionada"].includes(e) && {
      label: "Retroceder estado",
      onClick: () => ejecutar("retroceder", "Orden retrocedida"),
      confirmar: {
        titulo: "¿Retroceder la orden un paso?",
        mensaje: e === "Validada" ? "Vuelve a «Creada» y se puede editar." : "Vuelve a «Validada» y se eliminan los bultos que creó la recepción.",
        textoBoton: "Retroceder",
      },
    },
    puedeBorrar && {
      label: "Eliminar",
      disabled: !ESTADOS_BORRABLES_OC.includes(e),
      title: ESTADOS_BORRABLES_OC.includes(e) ? undefined : "Ya recibió mercadería: retrocédela primero",
      onClick: () => ejecutar("", "Orden eliminada", "DELETE"),
      confirmar: { titulo: `¿Eliminar la OC #${o.id}?`, mensaje: "No se puede deshacer.", textoBoton: "Eliminar" },
    },
  ].filter(Boolean);

  return { principal, menu, destructivas };
}
