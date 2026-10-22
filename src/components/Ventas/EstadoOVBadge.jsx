/**
 * El estado de una orden de venta, el mismo en la lista y en el detalle.
 *
 * Un color por estado, y que no se confundan entre sí (Cristóbal, 2026-10-22). Son los que ya
 * tenían la lista y el detalle, con un cambio: «En picking» era índigo, entre el azul de
 * «Validada» y el cian de «Lista para facturación», y los tres se leían como el mismo azul. Pasa a
 * morado.
 */
const COLOR = {
  PendienteIA: "border-slate-300 bg-slate-100 text-slate-700",
  Creada: "border-gray-300 bg-gray-100 text-gray-700",
  Validada: "border-blue-300 bg-blue-100 text-blue-800",
  "En picking": "border-purple-300 bg-purple-100 text-purple-800",
  "Lista para facturación": "border-cyan-300 bg-cyan-100 text-cyan-800",
  "Facturada parcial": "border-orange-300 bg-orange-100 text-orange-800",
  Facturada: "border-yellow-300 bg-yellow-100 text-yellow-800",
  Entregada: "border-green-300 bg-green-100 text-green-800",
  Cancelada: "border-red-300 bg-red-100 text-red-800",
};

export default function EstadoOVBadge({ estado, size = "sm" }) {
  const tamano = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`${tamano} rounded-full border font-medium whitespace-nowrap ${COLOR[estado] || COLOR.Creada}`}>
      {estado || "—"}
    </span>
  );
}
