/**
 * Chips con el conteo por estado sobre una lista (revisión de UI, Fase 5, 2026-11-25): Órdenes
 * de venta y Rutas de entrega. Antes el estado sólo se filtraba desde el embudo de la columna o
 * dentro de «Filtros», que hay que saber que existen. Un clic acá pone ESE MISMO filtro de
 * columna (`{ tipo: "valores", seleccion }`), así que no hay dos filtros que se contradigan:
 * se conecta por el `headerExtra` en función de `DataTable`.
 *
 * estados: [[valor, clasePunto, etiquetaCorta?]] en el orden del flujo. Sólo aparecen los que
 * tienen filas: un chip en cero es ruido.
 */
const base =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";
const encendido = "border-primary bg-primary-light text-primary font-medium";
const apagado = "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

export default function ChipsEstado({ filas, estados, campo = "estado", filtro, onCambiar, etiquetaTodas = "Todas" }) {
  const cuenta = new Map();
  for (const f of filas) cuenta.set(f[campo], (cuenta.get(f[campo]) ?? 0) + 1);

  const seleccion = Array.isArray(filtro?.seleccion) ? filtro.seleccion : [];
  const todas = seleccion.length === 0;
  const elegir = (estado) => onCambiar({ tipo: "valores", seleccion: estado ? [estado] : [] });

  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      <button type="button" aria-pressed={todas} onClick={() => elegir(null)} className={`${base} ${todas ? encendido : apagado}`}>
        {etiquetaTodas} <b className="font-semibold">{filas.length}</b>
      </button>
      {estados
        .filter(([estado]) => cuenta.get(estado))
        .map(([estado, punto, corto]) => {
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
