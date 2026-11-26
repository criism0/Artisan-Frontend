// Estado de una solicitud de mercadería: el nombre que se muestra, su color y sus marcas.
//
// Un color por estado, y que no se confundan entre sí (pedido de Cristóbal, 2026-10-22).
//
// 🔑 EL ESTADO DICE DÓNDE VA; LAS MARCAS, CÓMO LE FUE (2026-11-26). Los cuatro estados de
// recepción («Recepción Completa», «Parcial», «… con Pérdida») mezclaban en un nombre si se envió
// lo pedido y si llegó lo enviado. Ahora la solicitud termina «Recepcionada» y el backend manda
// `resultado: { envio, recepcion }`, contado línea por línea; acá se dibuja como dos marcas.

// Nombres que ya no existen en la base (la migración los pasó a «Recepcionada»), pero que siguen
// en el historial de estados.
const NOMBRES_ANTIGUOS = {
  "Recepcionada Completa": "Recepcionada",
  "Recepcionada Parcial Falta Stock": "Recepcionada",
  "Recepcionada Parcial Perdida": "Recepcionada",
  "Recepción Completa": "Recepcionada",
  "Recepción Completa con Pérdida": "Recepcionada",
  "Recepción Parcial": "Recepcionada",
  "Recepción Parcial con Pérdida": "Recepcionada",
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
  Recepcionada: "border-green-300 bg-green-100 text-green-800",
  Cancelada: "border-red-300 bg-red-100 text-red-800",
};

/** Los estados en el orden del flujo, con el color del punto de su chip. */
export const ESTADOS_SOLICITUD_CHIPS = [
  ["Creada", "bg-gray-400", "Por validar"],
  ["Validada", "bg-sky-500"],
  ["En preparación", "bg-amber-500"],
  ["Lista para despacho", "bg-lime-500"],
  ["En tránsito", "bg-indigo-500"],
  ["Recepcionada", "bg-green-500"],
  ["Cancelada", "bg-red-500"],
];

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

// ── Marcas de envío y recepción ─────────────────────────────────────────────────────────────

const lineas = (n) => `${n} línea${n === 1 ? "" : "s"}`;

export const ESTILO_MARCA = {
  ok: "bg-emerald-50 text-emerald-700",
  menos: "bg-amber-50 text-amber-700",
  mas: "bg-blue-50 text-blue-700",
  perdida: "bg-red-50 text-red-700",
  gris: "bg-gray-100 text-gray-600",
  borrador: "bg-violet-50 text-violet-700",
};

/**
 * Las marcas de una solicitud como lista de { clave, texto, titulo, tono }. `corto` deja el texto
 * para una celda de tabla («▼ 2 líneas»); sin él lleva el nombre («Envío ▼ 2 líneas»).
 */
export function marcasSolicitud(resultado, { corto = false } = {}) {
  const marcas = [];
  const envio = resultado?.envio;
  const recepcion = resultado?.recepcion;
  const pre = (p) => (corto ? "" : `${p} `);
  if (envio) {
    if (!envio.menos && !envio.mas)
      marcas.push({ clave: "e-ok", texto: `${pre("Envío")}= pedido`, titulo: "Se envió todo lo pedido", tono: "ok" });
    if (envio.menos)
      marcas.push({ clave: "e-menos", texto: `${pre("Envío")}▼ ${lineas(envio.menos)}`, titulo: `Se envió menos de lo pedido en ${lineas(envio.menos)}`, tono: "menos" });
    if (envio.mas)
      marcas.push({ clave: "e-mas", texto: `${pre("Envío")}▲ ${lineas(envio.mas)}`, titulo: `Se envió más de lo pedido en ${lineas(envio.mas)}`, tono: "mas" });
  }
  if (recepcion) {
    if (!recepcion.menos && !recepcion.mas)
      marcas.push({ clave: "r-ok", texto: `${pre("Recepción")}= enviado`, titulo: "Llegó todo lo enviado", tono: "ok" });
    if (recepcion.menos)
      marcas.push({ clave: "r-menos", texto: `${pre("Recepción")}▼ pérdida ${recepcion.menos}`, titulo: `Llegó menos de lo enviado en ${lineas(recepcion.menos)}`, tono: "perdida" });
    if (recepcion.mas)
      marcas.push({ clave: "r-mas", texto: `${pre("Recepción")}▲ ${lineas(recepcion.mas)}`, titulo: `Llegó más de lo enviado en ${lineas(recepcion.mas)}`, tono: "mas" });
  }
  return marcas;
}

export function tienePerdida(resultado) {
  return Number(resultado?.recepcion?.menos) > 0;
}

export function MarcasSolicitud({ resultado, corto = false }) {
  const marcas = marcasSolicitud(resultado, { corto });
  if (marcas.length === 0) return corto ? <span className="text-gray-400">—</span> : null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {marcas.map((m) => (
        <span key={m.clave} title={m.titulo} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${ESTILO_MARCA[m.tono]}`}>
          {m.texto}
        </span>
      ))}
    </span>
  );
}
