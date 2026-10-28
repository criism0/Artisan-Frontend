// Estado de una orden de manufactura y de sus PVA.
//
// La lista y el detalle tenían cada uno su copia del mismo mapa; quedan en un solo lugar, con los
// colores que ya tenían: un color por estado, para distinguirlos de un vistazo. «Cancelada» no
// estaba y salía gris, como un borrador.

const BASE = "px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap";

const COLOR_OM = {
  borrador: "border-gray-300 bg-gray-100 text-gray-700",
  "insumos asignados": "border-blue-300 bg-blue-100 text-blue-800",
  "en ejecución": "border-cyan-300 bg-cyan-100 text-cyan-800",
  "esperando salidas": "border-orange-300 bg-orange-100 text-orange-800",
  "esperando pvas": "border-purple-300 bg-purple-100 text-purple-800",
  cerrada: "border-green-300 bg-green-100 text-green-800",
  cancelada: "border-red-300 bg-red-100 text-red-800",
};

const NOMBRE_OM = {
  borrador: "Borrador",
  "insumos asignados": "Insumos asignados",
  "en ejecución": "En ejecución",
  "esperando salidas": "Esperando salidas",
  "esperando pvas": "Esperando PVAs",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export function EstadoOMBadge({ estado }) {
  if (!estado) return null;
  const clave = String(estado).toLowerCase();
  return (
    <span className={`${BASE} ${COLOR_OM[clave] ?? COLOR_OM.borrador}`}>
      {NOMBRE_OM[clave] ?? estado}
    </span>
  );
}

const PVA = {
  pendiente: "border-amber-300 bg-amber-100 text-amber-800",
  progreso: "border-blue-300 bg-blue-100 text-blue-800",
  completado: "border-green-300 bg-green-100 text-green-800",
  cancelado: "border-red-300 bg-red-100 text-red-800",
  otro: "border-gray-300 bg-gray-100 text-gray-700",
};

/** Resumen de las PVA de una OM en la lista: completadas, en progreso o pendientes. */
export function ResumenPVABadge({ pautas }) {
  const lista = Array.isArray(pautas) ? pautas : [];
  if (lista.length === 0) return <span className={`${BASE} ${PVA.otro}`}>Sin PVA</span>;
  const estados = lista.map((p) => String(p?.estado || "").toLowerCase());
  if (estados.every((v) => v.includes("complet")))
    return <span className={`${BASE} ${PVA.completado}`}>PVAs completadas</span>;
  if (estados.some((v) => v.includes("progres") || v.includes("ejec") || v.includes("inici")))
    return <span className={`${BASE} ${PVA.progreso}`}>PVA en progreso</span>;
  return <span className={`${BASE} ${PVA.pendiente}`}>PVAs pendientes</span>;
}
