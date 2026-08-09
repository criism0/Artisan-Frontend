/**
 * Resume el contenido de un pallet agrupando sus bultos por producto.
 *
 * Un pallet puede llevar decenas de bultos del mismo producto, y verlos como una lista de
 * identificadores no dice nada útil: lo que se necesita saber es QUÉ va arriba y CUÁNTO.
 * El identificador de cada bulto sigue estando, pero como detalle que se pide, no como la
 * forma principal de leer el pallet.
 */

function nombreDeBulto(bulto) {
  return (
    bulto?.MateriaPrima?.nombre ??
    bulto?.materiaPrima?.nombre ??
    bulto?.loteProductoFinal?.nombreFacturacion?.nombre ??
    bulto?.loteProductoFinal?.productoBase?.nombre ??
    "Sin identificar"
  );
}

function unidadDeBulto(bulto) {
  return bulto?.MateriaPrima?.unidad_medida ?? bulto?.materiaPrima?.unidad_medida ?? null;
}

function aNumero(valor) {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Devuelve una fila por producto: { nombre, unidad, bultos, unidades, peso, identificadores }
 * ordenadas de mayor a menor cantidad de bultos, que es el orden en que se mira un pallet.
 */
export function agruparBultosPorProducto(bultos) {
  const lista = Array.isArray(bultos) ? bultos : [];
  const porProducto = new Map();

  for (const bulto of lista) {
    const nombre = nombreDeBulto(bulto);
    if (!porProducto.has(nombre)) {
      porProducto.set(nombre, {
        nombre,
        unidad: unidadDeBulto(bulto),
        bultos: 0,
        unidades: 0,
        peso: 0,
        costo: 0,
        identificadores: [],
        detalle: [],
      });
    }

    const grupo = porProducto.get(nombre);
    grupo.bultos += 1;
    grupo.unidades += aNumero(bulto?.unidades_disponibles);
    // El peso del bulto es `peso_unitario` por cada unidad que quede dentro.
    grupo.peso += aNumero(bulto?.peso_unitario) * aNumero(bulto?.unidades_disponibles);
    // Y su valor es `costo_unitario` por esas mismas unidades. Es exactamente la cuenta que
    // hace `calcularValorDespacho` en el backend, así que los costos que se ven acá suman el
    // "Valor despachado" de la cabecera — quien emite la guía puede comprobarlo bulto a bulto.
    const costoBulto = aNumero(bulto?.costo_unitario) * aNumero(bulto?.unidades_disponibles);
    grupo.costo += costoBulto;
    grupo.identificadores.push(bulto?.identificador ?? `#${bulto?.id ?? "—"}`);
    // El detalle completo lo necesita el modal, que además imprime las etiquetas y para eso
    // le hacen falta los ids.
    grupo.detalle.push({
      id: bulto?.id,
      identificador: bulto?.identificador ?? `#${bulto?.id ?? "—"}`,
      unidades: aNumero(bulto?.unidades_disponibles),
      pesoUnitario: aNumero(bulto?.peso_unitario),
      costoUnitario: aNumero(bulto?.costo_unitario),
      costo: costoBulto,
      // Nació de una división y todavía no tiene su QR pegado: sin etiqueta física nadie
      // puede escanearlo al recepcionar.
      requiereEtiqueta: Boolean(bulto?.requiere_etiqueta),
    });
    // La unidad puede faltar en el primer bulto y venir en otro del mismo producto.
    if (!grupo.unidad) grupo.unidad = unidadDeBulto(bulto);
  }

  return [...porProducto.values()].sort((a, b) => b.bultos - a.bultos);
}

/**
 * Texto de una cantidad con su sustantivo, en singular o plural.
 *
 * Las abreviaturas se leen mal en pantalla: "10 un. · 10 b." obliga a traducir dos veces.
 * En una tarjeta que se mira de reojo en bodega, la palabra completa cuesta unos píxeles y
 * ahorra la duda.
 */
export function contar(cantidad, singular, plural) {
  const n = Number(cantidad) || 0;
  const texto = n.toLocaleString("es-CL", { maximumFractionDigits: 3 });
  return `${texto} ${n === 1 ? singular : plural}`;
}

/**
 * ¿Vale la pena mostrar el peso además de las unidades?
 *
 * Cuando la unidad de medida del insumo es "Unidades", el peso ES la cantidad de unidades, y
 * la fila termina diciendo "10 un. · 10 unidades": el mismo dato dos veces con distinto
 * nombre. Solo aporta cuando la unidad es de masa o volumen.
 */
export function tienePesoUtil(grupo) {
  if (!grupo?.peso || !grupo?.unidad) return false;
  return !/^unidad/i.test(String(grupo.unidad).trim());
}

/**
 * ¿Hay costo que mostrar?
 *
 * Un bulto sin `costo_unitario` no aporta una columna de ceros: aporta la duda de si el
 * insumo vale cero o si el dato falta. Cuando ningún bulto del grupo tiene costo, la columna
 * simplemente no se dibuja.
 */
export function tieneCostoUtil(grupo) {
  return Number(grupo?.costo) > 0;
}

export function resumirPallet(pallet) {
  const bultos = Array.isArray(pallet?.Bultos)
    ? pallet.Bultos
    : Array.isArray(pallet?.bultos)
      ? pallet.bultos
      : [];
  const productos = agruparBultosPorProducto(bultos);

  return {
    id: pallet?.id,
    identificador: pallet?.identificador ?? `Pallet #${pallet?.id ?? "—"}`,
    estado: pallet?.estado ?? "—",
    totalBultos: bultos.length,
    productos,
    // Los ids que necesita POST /bultos/etiquetas para imprimir el pallet completo.
    idsBultos: productos.flatMap((p) => p.detalle.map((b) => b.id)).filter((id) => id != null),
    // Los que nacieron de una división y esperan que alguien les pegue el QR.
    idsSinEtiqueta: productos
      .flatMap((p) => p.detalle.filter((b) => b.requiereEtiqueta).map((b) => b.id))
      .filter((id) => id != null),
  };
}

/**
 * Bultos de toda la solicitud que esperan su QR.
 *
 * Se cuenta a nivel solicitud y no de pallet porque el aviso vive en la cabecera: lo que
 * importa antes de despachar es si queda ALGUNO sin etiqueta, no en qué pallet está.
 */
export function bultosSinEtiqueta(pallets) {
  const lista = Array.isArray(pallets) ? pallets : [];
  return lista.flatMap((pallet) => resumirPallet(pallet).idsSinEtiqueta);
}
