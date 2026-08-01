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
      });
    }

    const grupo = porProducto.get(nombre);
    grupo.bultos += 1;
    grupo.unidades += aNumero(bulto?.unidades_disponibles);
    // El peso del bulto es `peso_unitario` por cada unidad que quede dentro.
    grupo.peso += aNumero(bulto?.peso_unitario) * aNumero(bulto?.unidades_disponibles);
    grupo.identificadores.push(bulto?.identificador ?? `#${bulto?.id ?? "—"}`);
    // La unidad puede faltar en el primer bulto y venir en otro del mismo producto.
    if (!grupo.unidad) grupo.unidad = unidadDeBulto(bulto);
  }

  return [...porProducto.values()].sort((a, b) => b.bultos - a.bultos);
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
  };
}
