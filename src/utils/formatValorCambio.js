/**
 * Convierte a texto un valor del historial de cambios para poder mostrarlo.
 *
 * El historial guarda el antes/después de cada campo tal cual, así que un campo que en la
 * base es JSON llega como array u objeto. Pasar eso directo a JSX hace que React lance
 * "Objects are not valid as a React child" y **desmonte la página entera**: el síntoma no es
 * una celda fea, es una pantalla en blanco.
 *
 * Pasó de verdad en el detalle de órdenes de compra: `recepciones` (412 registros) y
 * `numero_factura` (398) se guardan como arrays, así que el historial de cualquier orden
 * recepcionada o facturada dejaba la vista vacía.
 */
export function formatValorCambio(valor, vacio = "—") {
  if (valor === null || valor === undefined || valor === "") return vacio;

  if (Array.isArray(valor)) {
    if (valor.length === 0) return vacio;
    // Una lista de escalares se lee bien tal cual; una de objetos no aporta nada
    // desplegada, así que se resume.
    const escalares = valor.every((v) => v === null || typeof v !== "object");
    return escalares
      ? valor.map((v) => formatValorCambio(v, "")).filter(Boolean).join(", ")
      : `${valor.length} ${valor.length === 1 ? "elemento" : "elementos"}`;
  }

  if (typeof valor === "object") {
    // Caso frecuente: asociaciones incluidas por Sequelize, donde lo único que
    // interesa mostrar es el nombre.
    if (typeof valor.nombre === "string") return valor.nombre;
    try {
      return JSON.stringify(valor);
    } catch {
      return vacio;
    }
  }

  if (typeof valor === "boolean") return valor ? "Sí" : "No";

  return String(valor);
}
