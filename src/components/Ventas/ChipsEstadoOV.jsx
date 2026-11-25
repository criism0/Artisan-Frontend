/**
 * Chips con el conteo por estado, sobre la lista de órdenes de venta (revisión de UI, Fase 5,
 * 2026-11-25). Antes el estado sólo se filtraba desde el embudo de la columna, que hay que saber
 * que existe. Un clic acá pone ESE MISMO filtro de columna (y el embudo lo muestra marcado), así
 * que no hay dos filtros de estado que puedan contradecirse.
 *
 * Sólo aparecen los estados que tienen órdenes: un chip en cero es ruido.
 */

/** Orden del flujo. Los colores son los de `EstadoOVBadge`, en un punto. */
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

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";
const encendido = "border-primary bg-primary-light text-primary font-medium";
const apagado = "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

export default function ChipsEstadoOV({ ordenes, filtro, onCambiar }) {
  const cuenta = new Map();
  for (const o of ordenes) cuenta.set(o.estado, (cuenta.get(o.estado) ?? 0) + 1);

  const seleccion = Array.isArray(filtro?.seleccion) ? filtro.seleccion : [];
  const todas = seleccion.length === 0;
  const elegir = (estado) =>
    onCambiar(estado ? { tipo: "valores", seleccion: [estado] } : { tipo: "valores", seleccion: [] });

  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      <button type="button" aria-pressed={todas} onClick={() => elegir(null)} className={`${base} ${todas ? encendido : apagado}`}>
        Todas <b className="font-semibold">{ordenes.length}</b>
      </button>
      {ESTADOS.filter(([estado]) => cuenta.get(estado)).map(([estado, punto, corto]) => {
        const on = seleccion.length === 1 && seleccion[0] === estado;
        return (
          <button
            key={estado}
            type="button"
            aria-pressed={on}
            title={corto ? estado : undefined}
            onClick={() => elegir(on ? null : estado)}
            className={`${base} ${on ? encendido : apagado}`}
          >
            <span className={`h-2 w-2 rounded-full ${punto}`} aria-hidden="true" />
            {corto ?? estado} <b className="font-semibold">{cuenta.get(estado)}</b>
          </button>
        );
      })}
    </div>
  );
}
