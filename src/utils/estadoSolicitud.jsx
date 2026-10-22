// Estado de una solicitud de mercadería: el nombre que se muestra y su color.
//
// La lista y el detalle tenían cada uno su mapa —diez colores en una, ocho distintos en la otra
// para los mismos estados— y el detalle no conocía «Recepción Completa con Pérdida». El color dice
// el tramo (gris sin empezar, violeta en curso, verde recibida, ámbar recibida con faltante, rojo
// cancelada); cuál estado es ya lo dice el nombre. Ver docs/GUIA_VISUAL.md.

const NOMBRES_ANTIGUOS = {
  "Recepcionada Completa": "Recepción Completa",
  "Recepcionada Parcial Falta Stock": "Recepción Parcial",
  "Recepcionada Parcial Perdida": "Recepción Parcial con Pérdida",
};

export function normalizeEstadoSolicitud(estado) {
  if (!estado) return estado;
  return NOMBRES_ANTIGUOS[estado] ?? estado;
}

const TRAMO = {
  Creada: "sinEmpezar",
  Pendiente: "sinEmpezar",
  Validada: "enCurso",
  "En preparación": "enCurso",
  "Lista para despacho": "enCurso",
  "En tránsito": "enCurso",
  "Recepción Completa": "recibida",
  "Recepción Completa con Pérdida": "conFaltante",
  "Recepción Parcial": "conFaltante",
  "Recepción Parcial con Pérdida": "conFaltante",
  Cancelada: "cancelada",
};

const CLASES = {
  sinEmpezar: "border-gray-200 bg-gray-50 text-gray-700",
  enCurso: "border-violet-200 bg-violet-50 text-violet-700",
  recibida: "border-green-200 bg-green-50 text-green-700",
  conFaltante: "border-amber-200 bg-amber-50 text-amber-800",
  cancelada: "border-red-200 bg-red-50 text-red-700",
};

export function claseEstadoSolicitud(estado) {
  return CLASES[TRAMO[normalizeEstadoSolicitud(estado)]] ?? CLASES.sinEmpezar;
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
