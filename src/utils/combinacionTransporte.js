/**
 * Combinaciones de transporte (Res. Ex. SII N° 144 de 2026, que reemplazó a la N° 154).
 *
 * `modalidad`:
 * - `autogestionado`: se conocen el transportista, el chofer y la patente al emitir;
 * - `tercerizado`: el operador (p. ej., el bus de Valdivia) asigna vehículo y chofer después, y lo
 *   que no se sabe sale «DIFERIDO» en el documento;
 * - `retiro`: el cliente retira en la bodega; la factura no lleva datos de transporte.
 */
export const MODALIDADES = [
  { valor: "autogestionado", etiqueta: "Con todos los datos" },
  { valor: "tercerizado", etiqueta: "Tercerizado: el operador asigna vehículo y chofer" },
  { valor: "retiro", etiqueta: "Retira el cliente" },
];

export const etiquetaModalidad = (valor) =>
  ({ autogestionado: "Con todos los datos", tercerizado: "Tercerizado", retiro: "Retira el cliente" })[valor] ?? valor;

/** Lo que se ve de una combinación debajo del selector. */
export function resumenCombinacion(c) {
  if (!c) return "";
  if (c.modalidad === "retiro") return "El documento no lleva datos de transporte";
  const transportista = [c.transportista, c.rut_transportista].filter(Boolean).join(", ");
  const chofer = c.chofer_nombre ? `${c.chofer_nombre} (${c.chofer_rut})` : null;
  if (c.modalidad === "tercerizado") {
    return [transportista || "Operador externo", chofer, c.patente ? `patente ${c.patente}` : "vehículo y chofer diferidos"]
      .filter(Boolean).join(" · ");
  }
  return [chofer, transportista && `transportista ${transportista}`].filter(Boolean).join(" · ");
}

/** El texto de cada opción del selector. */
export function etiquetaOpcion(c) {
  if (c.modalidad === "retiro") return c.nombre;
  if (!c.patente) return `${c.nombre} · diferido`;
  return `${c.nombre} · ${c.patente}`;
}
