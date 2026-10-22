// Estado de una orden de manufactura y de sus PVA.
//
// La lista y el detalle tenían cada uno su mapa con seis colores (gris, azul, cian, naranjo,
// morado, verde). El color dice el tramo —gris sin empezar, violeta en curso, verde cerrada, rojo
// cancelada—; en qué paso va ya lo dice el nombre. Ver docs/GUIA_VISUAL.md.

const BASE = "px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap";

const TRAMO_OM = {
  borrador: "border-gray-200 bg-gray-50 text-gray-700",
  "insumos asignados": "border-violet-200 bg-violet-50 text-violet-700",
  "en ejecución": "border-violet-200 bg-violet-50 text-violet-700",
  "esperando salidas": "border-violet-200 bg-violet-50 text-violet-700",
  "esperando pvas": "border-violet-200 bg-violet-50 text-violet-700",
  cerrada: "border-green-200 bg-green-50 text-green-700",
  cancelada: "border-red-200 bg-red-50 text-red-700",
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
    <span className={`${BASE} ${TRAMO_OM[clave] ?? TRAMO_OM.borrador}`}>
      {NOMBRE_OM[clave] ?? estado}
    </span>
  );
}

/** Pendiente → En progreso → Completado, con el mismo criterio de tramo. */
export function EstadoPVABadge({ estado }) {
  const v = String(estado || "").toLowerCase();
  if (!v) return <span className={`${BASE} ${TRAMO_OM.borrador}`}>—</span>;
  if (v.includes("pend")) return <span className={`${BASE} ${TRAMO_OM.borrador}`}>Pendiente</span>;
  if (v.includes("progres") || v.includes("ejec") || v.includes("inici"))
    return <span className={`${BASE} ${TRAMO_OM["en ejecución"]}`}>En progreso</span>;
  if (v.includes("termin") || v.includes("complet"))
    return <span className={`${BASE} ${TRAMO_OM.cerrada}`}>Completado</span>;
  if (v.includes("cancel")) return <span className={`${BASE} ${TRAMO_OM.cancelada}`}>Cancelado</span>;
  return <span className={`${BASE} ${TRAMO_OM.borrador}`}>{estado}</span>;
}

/** Resumen de las PVA de una OM en la lista: completadas, en progreso o pendientes. */
export function ResumenPVABadge({ pautas }) {
  const lista = Array.isArray(pautas) ? pautas : [];
  if (lista.length === 0) return <span className={`${BASE} ${TRAMO_OM.borrador}`}>Sin PVA</span>;
  const estados = lista.map((p) => String(p?.estado || "").toLowerCase());
  if (estados.every((v) => v.includes("complet")))
    return <span className={`${BASE} ${TRAMO_OM.cerrada}`}>PVAs completadas</span>;
  if (estados.some((v) => v.includes("progres") || v.includes("ejec") || v.includes("inici")))
    return <span className={`${BASE} ${TRAMO_OM["en ejecución"]}`}>PVA en progreso</span>;
  return <span className={`${BASE} ${TRAMO_OM.borrador}`}>PVAs pendientes</span>;
}
