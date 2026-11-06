/**
 * La última fila de las paradas de una ruta: vuelve a la bodega de origen o termina en la última
 * parada (pedido de Cristóbal, 2026-10-01). Con `onCambiar` es el interruptor para elegirlo; sin
 * él sólo lo dice.
 */
export default function FinRuta({ bodega, vuelve, onCambiar, disabled = false, className = "" }) {
  const nombre = bodega?.nombre ?? "la bodega";
  const marca = (
    <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${vuelve ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500"}`}>B</span>
  );

  if (!onCambiar) {
    return (
      <li className={`text-xs text-gray-500 flex items-center gap-2 ${className}`}>
        {vuelve ? (
          <>
            {marca}Vuelve a {nombre}
          </>
        ) : (
          <span className="pl-7">Termina en la última parada (no vuelve a {nombre})</span>
        )}
      </li>
    );
  }

  return (
    <li className={`text-xs flex items-start gap-2 ${className}`}>
      {marca}
      <label className={`flex flex-col gap-0.5 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <span className="inline-flex items-center gap-2 text-gray-700">
          <input type="checkbox" className="accent-primary" checked={vuelve} disabled={disabled} onChange={(e) => onCambiar(e.target.checked)} />
          Vuelve a {nombre}
        </span>
        <span className="text-gray-400">
          {vuelve ? "El recorrido y el costo incluyen el regreso." : "Termina en la última parada: el regreso no se suma al recorrido ni al costo."}
        </span>
      </label>
    </li>
  );
}
