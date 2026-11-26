import ChipsEstado from "../UI/ChipsEstado.jsx";

/**
 * Chips por estado sobre la lista de órdenes de venta: los estados en el orden del flujo, con
 * los colores de `EstadoOVBadge` en un punto. La lógica vive en `ChipsEstado`.
 */
const ESTADOS = [
  ["Creada", "bg-gray-400"],
  ["Validada", "bg-blue-500"],
  ["En picking", "bg-purple-500"],
  ["Lista para facturación", "bg-cyan-500", "Por facturar"],
  ["Guía emitida", "bg-teal-500"],
  ["Facturada parcial", "bg-orange-500"],
  ["Facturada", "bg-yellow-500"],
  ["Entregada", "bg-green-500"],
  ["Cancelada", "bg-red-500"],
];

export default function ChipsEstadoOV({ ordenes, filtro, onCambiar }) {
  return <ChipsEstado filas={ordenes} estados={ESTADOS} filtro={filtro} onCambiar={onCambiar} />;
}
