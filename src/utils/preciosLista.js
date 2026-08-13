// Precios de la lista del cliente, indexados por NOMBRE DE FACTURACIÓN.
//
// 🔴 POR QUÉ POR NOMBRE Y NO POR PRODUCTO FÍSICO. Desde la feature de Nombre de Facturación el
// precio se define por nombre comercial: en producción `id_producto_base` viene NULL en 433 de
// las 456 filas de lista. Indexar por producto físico dejaría casi todas las entradas fuera.
//
// Es la misma fuente y la misma regla que usa el worker al crear la orden
// (`email-ov-processor.ts`), a propósito: si la pantalla resolviera el precio distinto que el
// worker, el operario vería un número y la orden guardaría otro.

/**
 * Indexa las entradas de `/producto-base-lista-precio/lista/:id` por nombre de facturación.
 *
 * @param {Array} entradas respuesta cruda del endpoint
 * @returns {Map<number, {precio_unidad: number, precio_caja: number|null, unidades_por_caja: number|null, nombre: string|null}>}
 */
export function indexarPreciosPorNombre(entradas) {
  const indice = new Map();
  if (!Array.isArray(entradas)) return indice;

  for (const entrada of entradas) {
    const idNombre = entrada?.id_nombre_facturacion;
    if (idNombre == null) continue;

    const precio = Number(entrada.precio_unidad);
    // 🔴 `> 0` y no `!= null`: una entrada de lista con precio 0 es una fila SIN LLENAR, no un
    // precio acordado. Aceptarla reintroduciría el $0 por otra puerta — justo el problema que
    // la guarda de validación vino a cerrar. Es la misma condición que aplica el worker.
    if (!Number.isFinite(precio) || precio <= 0) continue;

    const precioCaja = Number(entrada.precio_caja);
    indice.set(Number(idNombre), {
      precio_unidad: precio,
      precio_caja: Number.isFinite(precioCaja) && precioCaja > 0 ? precioCaja : null,
      unidades_por_caja: entrada.unidades_por_caja ?? null,
      nombre: entrada.nombreFacturacion?.nombre ?? null,
    });
  }
  return indice;
}

/**
 * Precio unitario de un nombre de facturación dentro de un índice ya construido.
 * Devuelve `null` cuando el producto no está en la lista — que es un dato, no un error:
 * significa que a ese cliente no se le ha fijado precio para ese producto.
 */
export function precioUnitarioDeLista(indice, idNombreFacturacion) {
  if (!indice || idNombreFacturacion == null) return null;
  const entrada = indice.get(Number(idNombreFacturacion));
  return entrada ? entrada.precio_unidad : null;
}

/** ¿Es un precio utilizable? Misma regla que el backend (`precioUtil`). */
export function precioUtil(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0;
}

export function formatearPesos(valor) {
  return `$${Number(valor).toLocaleString("es-CL")}`;
}
