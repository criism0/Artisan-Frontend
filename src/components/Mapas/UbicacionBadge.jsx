import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import { describirUbicacion } from "../../utils/ubicacion";

const ESTILOS = {
  ok: "bg-green-50 text-green-800 border-green-200",
  duda: "bg-amber-50 text-amber-800 border-amber-200",
  falta: "bg-red-50 text-red-700 border-red-200",
};
const ICONOS = { ok: MapPin, duda: AlertTriangle, falta: MapPinOff };

/** Chip con el estado de la ubicación de una dirección. Clickeable si recibe `onClick`. */
export default function UbicacionBadge({ lat, lng, precision, onClick, title }) {
  const { texto, tono } = describirUbicacion(lat, lng, precision);
  const Icono = ICONOS[tono];
  const clase = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${ESTILOS[tono]}`;
  if (!onClick) {
    return (
      <span className={clase} title={title}>
        <Icono className="w-3 h-3" /> {texto}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${clase} hover:brightness-95`} title={title ?? "Ver o corregir en el mapa"}>
      <Icono className="w-3 h-3" /> {texto}
    </button>
  );
}
