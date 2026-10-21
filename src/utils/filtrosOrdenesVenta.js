/**
 * Lo que se filtra en la lista de Órdenes de Venta y NO es una columna.
 *
 * 🔴 POR QUÉ QUEDA TAN POCO ACÁ. La primera versión traía siete filtros escritos a mano
 * (estado, cliente, comuna, documento posterior, rango de entrega…). Todos ésos pasaron a ser
 * filtros POR COLUMNA en el `DataTable` —pedido de Cristóbal, 2026-09-02— y tenerlos además en
 * un panel aparte dejaría el mismo dato filtrable en dos lugares que se combinan: alguien pone
 * "Facturada" en el panel, otro pone "Validada" en la columna, y la lista sale vacía sin que
 * ninguno de los dos controles se vea mal puesto.
 *
 * Queda sólo lo que no tiene columna propia. El número de factura se muestra DENTRO de la
 * columna Estado —pedido literal de Hernán— así que no hay un embudo donde colgar esta pregunta.
 */

/** Ninguna orden queda fuera con esto puesto. */
export const FILTROS_VACIOS = {
  facturacion: "",
};

/**
 * ¿Esta orden pasa los filtros del panel?
 *
 * ⚠️ Una factura ANULADA cuenta como facturada. El backend la devuelve igual a propósito (ver
 * `facturaDeOrden.ts`): la OV 824 de producción se facturó y después se anuló con una NC total,
 * y tratarla como "sin factura" la escondería de la única búsqueda que la encontraría.
 */
export function ordenPasaFiltros(orden, filtros) {
  const f = { ...FILTROS_VACIOS, ...filtros };
  const tieneFactura = orden?.factura?.folio != null;

  if (f.facturacion === "con" && !tieneFactura) return false;
  if (f.facturacion === "sin" && tieneFactura) return false;

  return true;
}

/** Cuántos filtros del panel están puestos — para el contador y el botón de limpiar. */
export function contarFiltrosActivos(filtros) {
  return Object.keys(FILTROS_VACIOS).filter((k) => filtros?.[k]).length;
}

/**
 * Recorta un texto para el tooltip nativo del navegador.
 *
 * 🔴 NO ES COSMÉTICO. Medido contra producción el 2026-09-01: 92 de las 220 órdenes traen
 * comentario, con **p90 de 248 caracteres y un máximo de 946**. Un `title` de 946 caracteres se
 * pinta como un bloque gigante que tapa la tabla y que igual hay que leer entero para encontrar
 * el dato — o sea, peor que no tener tooltip. Se muestra el principio, que es donde los clientes
 * ponen lo importante (el local, la fecha de despacho), y se dice que hay más.
 */
export function recortarParaTooltip(texto, limite = 240) {
  if (!texto) return undefined;
  const t = String(texto).trim();
  if (!t) return undefined;
  return t.length <= limite
    ? t
    : `${t.slice(0, limite)}…\n\n(texto recortado — abre el detalle para verlo completo)`;
}
