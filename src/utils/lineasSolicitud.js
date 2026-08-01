/**
 * Separa las líneas de una solicitud en insumos y productos terminados.
 *
 * La vista se diseñó cuando una solicitud solo movía insumos. Desde el feature B4 también
 * viajan productos terminados, y hasta ahora se mostraban en la misma tabla con un "(PT)"
 * pegado al final del nombre, bajo el título "Insumos solicitados" y contados juntos en el
 * indicador "Insumos: N". Son dos cosas distintas: el insumo se pide en su unidad de medida
 * y tiene costo; el PT se pide por nombre de facturación y normalmente en cajas.
 *
 * La distinción viene del backend: un detalle trae `materiaPrima` (insumo) o bien
 * `nombreFacturacion` / `productoBase` (PT). `productoBase` queda para detalles legacy,
 * anteriores a que la identidad comercial pasara a ser el nombre de facturación.
 */

const TIPO_INSUMO = "INSUMO";
const TIPO_PT = "PT";

function aNumero(valor) {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(n) ? n : null;
}

export function comentarioDeLinea(detalle) {
  const bruto =
    detalle?.comentario ??
    detalle?.Comentario ??
    detalle?.comentarios ??
    detalle?.Comentarios ??
    "";
  return typeof bruto === "string" ? bruto.trim() : String(bruto || "").trim();
}

export function tipoDeLinea(detalle) {
  if (detalle?.materiaPrima) return TIPO_INSUMO;
  if (detalle?.nombreFacturacion || detalle?.productoBase) return TIPO_PT;
  return null;
}

/**
 * Convierte un detalle crudo del backend en una fila lista para mostrar.
 * Devuelve `null` si el detalle no es reconocible como insumo ni como PT.
 */
export function normalizarLinea(detalle) {
  const tipo = tipoDeLinea(detalle);
  if (!tipo) return null;

  const solicitada = aNumero(detalle?.cantidad_solicitada) ?? 0;
  const porCaja = aNumero(detalle?.cantidad_por_caja) ?? 0;
  const enCajas = Boolean(detalle?.producto_por_cajas) && porCaja > 0;

  const costoUnitario =
    aNumero(detalle?.costo_unitario) ??
    aNumero(detalle?.MateriaPrima?.costo_unitario) ??
    aNumero(detalle?.materiaPrima?.costo_unitario) ??
    0;

  return {
    id: detalle?.id,
    tipo,
    // Sin sufijo "(PT)": el tipo ya lo dice la tabla en la que aparece la fila.
    nombre:
      detalle?.materiaPrima?.nombre ??
      detalle?.nombreFacturacion?.nombre ??
      detalle?.productoBase?.nombre ??
      "—",
    // El PT sin nombre de facturación es una fila legacy; se avisa para que se note.
    legacy: tipo === TIPO_PT && !detalle?.nombreFacturacion,
    enCajas,
    cajas: enCajas ? Math.round(solicitada / porCaja) : null,
    unidadesPorCaja: enCajas ? porCaja : null,
    cantidad_solicitada: solicitada,
    cantidad_despachada: aNumero(detalle?.cantidad_despachada),
    cantidad_recepcionada: aNumero(detalle?.cantidad_recepcionada),
    unidad_medida:
      detalle?.materiaPrima?.unidad_medida ?? (tipo === TIPO_PT ? "Unidades" : "—"),
    comentario: comentarioDeLinea(detalle),
    costo_unitario: costoUnitario,
    costo_despachado: costoUnitario * solicitada,
  };
}

/**
 * Arma el resumen de la solicitud: las dos listas y los totales de cada una.
 *
 * Los totales se calculan acá y no en el JSX para que la cabecera y las tablas no puedan
 * discrepar: era exactamente el problema del indicador que sumaba insumos y PT bajo la
 * etiqueta "Insumos".
 */
export function construirLineasSolicitud(detalles) {
  const lineas = (Array.isArray(detalles) ? detalles : [])
    .map(normalizarLinea)
    .filter(Boolean);

  const insumos = lineas.filter((l) => l.tipo === TIPO_INSUMO);
  const productosTerminados = lineas.filter((l) => l.tipo === TIPO_PT);

  return {
    lineas,
    insumos,
    productosTerminados,
    totales: {
      insumos: insumos.length,
      productosTerminados: productosTerminados.length,
      costoInsumos: insumos.reduce((suma, l) => suma + (l.costo_despachado || 0), 0),
      cajas: productosTerminados.reduce((suma, l) => suma + (l.cajas || 0), 0),
      unidadesPT: productosTerminados.reduce((suma, l) => suma + (l.cantidad_solicitada || 0), 0),
    },
  };
}
