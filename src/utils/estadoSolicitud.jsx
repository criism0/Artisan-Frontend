// Estado de una solicitud de mercadería: el nombre que se muestra y su color.
//
// Un color por estado, y que no se confundan entre sí (pedido de Cristóbal, 2026-10-22). La lista y
// el detalle tenían cada uno su mapa y se contradecían: en la lista «En preparación» y «Recepción
// Completa con Pérdida» eran el mismo ámbar, «Recepción Parcial» un amarillo casi igual y
// «Pendiente» el mismo naranjo que «Parcial con Pérdida». Se conservan los colores que ya tenía cada
// estado y se cambian sólo los que chocaban.

const NOMBRES_ANTIGUOS = {
  "Recepcionada Completa": "Recepción Completa",
  "Recepcionada Parcial Falta Stock": "Recepción Parcial",
  "Recepcionada Parcial Perdida": "Recepción Parcial con Pérdida",
};

export function normalizeEstadoSolicitud(estado) {
  if (!estado) return estado;
  return NOMBRES_ANTIGUOS[estado] ?? estado;
}

export const COLOR_ESTADO_SOLICITUD = {
  Creada: "border-gray-300 bg-gray-100 text-gray-700",
  Pendiente: "border-slate-300 bg-slate-100 text-slate-700",
  Validada: "border-sky-300 bg-sky-100 text-sky-800",
  "En preparación": "border-amber-300 bg-amber-100 text-amber-800",
  "Lista para despacho": "border-lime-300 bg-lime-100 text-lime-800",
  "En tránsito": "border-indigo-300 bg-indigo-100 text-indigo-800",
  "Recepción Completa": "border-green-300 bg-green-100 text-green-800",
  "Recepción Completa con Pérdida": "border-purple-300 bg-purple-100 text-purple-800",
  "Recepción Parcial": "border-orange-300 bg-orange-100 text-orange-800",
  "Recepción Parcial con Pérdida": "border-pink-300 bg-pink-100 text-pink-800",
  Cancelada: "border-red-300 bg-red-100 text-red-800",
};

export function claseEstadoSolicitud(estado) {
  return COLOR_ESTADO_SOLICITUD[normalizeEstadoSolicitud(estado)] ?? COLOR_ESTADO_SOLICITUD.Creada;
}

export function EstadoSolicitudBadge({ estado }) {
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${claseEstadoSolicitud(estado)}`}
    >
      {normalizeEstadoSolicitud(estado) ?? "—"}
    </span>
  );
}
