/**
 * El estado de una orden de venta, el mismo en la lista y en el detalle.
 *
 * Antes cada vista tenía su mapa y entre las dos usaban siete colores para ocho estados. Ahora
 * el color dice sólo en qué tramo va la orden —el nombre del estado ya dice cuál es—:
 *   gris    → todavía no entra al flujo (Creada, PendienteIA)
 *   morado  → en curso (Validada, En picking, Lista para facturación, Facturada)
 *   ámbar   → queda algo por resolver (Facturada parcial: hay saldo)
 *   verde   → terminada (Entregada) · rojo → cancelada
 */
const TRAMO = {
  PendienteIA: "bg-gray-100 text-gray-600",
  Creada: "bg-gray-100 text-gray-700",
  Validada: "bg-violet-50 text-violet-700",
  "En picking": "bg-violet-50 text-violet-700",
  "Lista para facturación": "bg-violet-50 text-violet-700",
  Facturada: "bg-violet-50 text-violet-700",
  "Facturada parcial": "bg-amber-50 text-amber-800",
  Entregada: "bg-green-50 text-green-700",
  Cancelada: "bg-red-50 text-red-700",
};

export default function EstadoOVBadge({ estado, size = "sm" }) {
  const tamano = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`${tamano} rounded-full font-medium whitespace-nowrap ${TRAMO[estado] || "bg-gray-100 text-gray-600"}`}>
      {estado || "—"}
    </span>
  );
}
