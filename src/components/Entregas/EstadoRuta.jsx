import { ESTADOS_RUTA } from "../../utils/rutas";

/** Chip del estado de una ruta, igual en la lista y en el detalle. */
export default function EstadoRuta({ estado }) {
  const s = ESTADOS_RUTA[estado] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium text-center ${s.bg} ${s.text}`}>{estado}</span>;
}
