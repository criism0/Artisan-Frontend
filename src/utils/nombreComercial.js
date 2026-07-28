/**
 * Nombre a mostrar de una fila que representa un producto comercial.
 *
 * Desde la feature de Nombre de Facturación, la identidad comercial de una entrada de lista
 * de precios (y de una línea de OV) es el **nombre de facturación**, no el producto físico:
 * `id_producto_base` quedó como referencia legacy y viene en NULL en la gran mayoría de las
 * filas. Por eso pintar `Producto #${id_producto_base}` produce "Producto #null".
 *
 * La API entrega la asociación con dos formas según el endpoint —`NombreFacturacion` en los
 * de ventas y `nombreFacturacion` en los de listas de precio—, así que se aceptan ambas.
 */
export function getNombreComercial(fila, respaldo = "Sin nombre") {
  if (!fila) return respaldo;

  return (
    fila.NombreFacturacion?.nombre ||
    fila.nombreFacturacion?.nombre ||
    fila.nombre_facturacion ||
    fila.nombre_producto ||
    fila.ProductoBase?.nombre ||
    fila.productoBase?.nombre ||
    respaldo
  );
}
