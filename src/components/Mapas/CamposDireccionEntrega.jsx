const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

/**
 * Campos de la dirección de entrega PROPIA de una orden (tienda web: cada pedido va a la casa de
 * un comprador distinto). Controlado: `valor` es { entrega_direccion, entrega_comuna, … } y
 * `onChange` recibe el objeto completo.
 *
 * Dirección y comuna son obligatorias si se escribe algo; todo vacío = la orden no tiene
 * dirección propia. Esa regla la hace cumplir el backend.
 */
export default function CamposDireccionEntrega({ valor, onChange, comentarioCliente }) {
  const set = (campo) => (e) => onChange({ ...valor, [campo]: e.target.value });
  return (
    <div className="flex flex-col gap-3">
      {comentarioCliente && (
        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 whitespace-pre-line">
          <span className="font-medium text-gray-700">Lo que escribió el cliente: </span>
          {comentarioCliente}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="sm:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
          Calle y número *
          <input className={inputCls} value={valor.entrega_direccion} onChange={set("entrega_direccion")} placeholder="Moneda 1901" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Comuna *
          <input className={inputCls} value={valor.entrega_comuna} onChange={set("entrega_comuna")} placeholder="Santiago" />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
          Depto, oficina o indicaciones
          <input className={inputCls} value={valor.entrega_referencia} onChange={set("entrega_referencia")} placeholder="Of. 304, horario de oficina" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Región
          <input className={inputCls} value={valor.entrega_region} onChange={set("entrega_region")} placeholder="Región Metropolitana" />
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
          Quién recibe
          <input className={inputCls} value={valor.entrega_destinatario} onChange={set("entrega_destinatario")} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Teléfono
          <input className={inputCls} value={valor.entrega_telefono} onChange={set("entrega_telefono")} placeholder="+569…" />
        </label>
      </div>
    </div>
  );
}
