// Lo que la pantalla de insumos de una elaboración calcula en el navegador. El backend
// (GET /ordenes_manufactura/:id/insumos) ya manda cuánto falta por ingrediente; acá sólo se
// arma lo que se envía al guardar el borrador y el resumen del botón.

const ABREV = { kilogramos: "kg", kilogramo: "kg", kg: "kg", litros: "L", litro: "L", l: "L", unidades: "un", unidad: "un" };
export const abreviarUnidad = (u) => (u ? ABREV[String(u).toLowerCase()] ?? u : "");

/** Los bultos anotados como los pide PUT /insumos/borrador. */
export function itemsDelBorrador(vista) {
  return (vista?.ingredientes ?? []).flatMap((i) =>
    i.anotados.map((a) => ({ id_registro: i.id_registro, id_bulto: a.id_bulto, peso: Number(a.peso) }))
  );
}

/** Cambia la cantidad de un bulto anotado (0 lo quita) y devuelve los items a guardar. */
export function cambiarPeso(vista, idRegistro, idBulto, peso) {
  return itemsDelBorrador(vista).map((it) =>
    it.id_registro === idRegistro && it.id_bulto === idBulto ? { ...it, peso: Number(peso) || 0 } : it
  );
}

/** Texto del botón de abajo: qué falta o cuántos bultos se van a descontar. */
export function resumenParaConsumir(vista) {
  const ings = vista?.ingredientes ?? [];
  const faltan = ings.filter((i) => !i.cubierto).length;
  if (faltan > 0) return { listo: false, texto: faltan === 1 ? "Falta 1 insumo" : `Faltan ${faltan} insumos` };
  const bultos = new Set(ings.flatMap((i) => i.anotados.map((a) => a.id_bulto))).size;
  return { listo: bultos > 0, texto: `Consumir insumos · ${bultos} ${bultos === 1 ? "bulto" : "bultos"}` };
}
