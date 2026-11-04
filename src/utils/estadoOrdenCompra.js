// Color de cada estado de una orden de compra.
//
// La lista y el modal de importar desde una OC tenían cada uno su mapa: «Pagada» era verde lima en
// uno —casi igual al verde de «Recepcionada»— y azul en el otro. Un color por estado, y que no se
// confundan entre sí.
export const COLOR_ESTADO_OC = {
  Creada: "border-gray-300 bg-gray-100 text-gray-700",
  Validada: "border-sky-300 bg-sky-100 text-sky-800",
  "Parcialmente recepcionada": "border-amber-300 bg-amber-100 text-amber-800",
  Recepcionada: "border-green-300 bg-green-100 text-green-800",
  Pagada: "border-indigo-300 bg-indigo-100 text-indigo-800",
  Rechazada: "border-rose-300 bg-rose-100 text-rose-800",
};

export function claseEstadoOC(estado) {
  return COLOR_ESTADO_OC[estado] ?? COLOR_ESTADO_OC.Creada;
}
