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
        identificadores: [],
        detalle: [],
      });
    }

    const grupo = porProducto.get(nombre);
    grupo.bultos += 1;
    grupo.unidades += aNumero(bulto?.unidades_disponibles);
    // El peso del bulto es `peso_unitario` por cada unidad que quede dentro.
    grupo.peso += aNumero(bulto?.peso_unitario) * aNumero(bulto?.unidades_disponibles);
    grupo.identificadores.push(bulto?.identificador ?? `#${bulto?.id ?? "—"}`);
    // El detalle completo lo necesita el modal, que además imprime las etiquetas y para eso
    // le hacen falta los ids.
    grupo.detalle.push({
      id: bulto?.id,
      identificador: bulto?.identificador ?? `#${bulto?.id ?? "—"}`,
      unidades: aNumero(bulto?.unidades_disponibles),
      pesoUnitario: aNumero(bulto?.peso_unitario),
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
  };
}
