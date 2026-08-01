import TabButton from "../Wizard/TabButton";

/**
 * Pestañas de una vista de detalle.
 *
 * Envuelve el TabButton que ya usaban OMDetail, ProductDetail e InsumoDetail, para que el
 * resto de los módulos no tenga que reinventar la barra: mismo contenedor, mismo espaciado,
 * misma forma de mostrar el contador.
 *
 * El contador va en la propia pestaña a propósito: dice cuánto hay sin obligar a entrar,
 * y es lo que permite reemplazar secciones apiladas por pestañas sin perder el resumen.
 *
 * Las pestañas vacías se muestran igual, deshabilitadas. Esconderlas haría que cambiaran
 * de posición entre un registro y otro, y ya no se podría aprender dónde está cada cosa.
 *
 * pestanas: [{ id, label, cantidad?, deshabilitadaSiVacia? }]
 */
export default function Tabs({ pestanas, activa, onCambiar }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 flex flex-wrap gap-2 mb-6">
      {pestanas.filter(Boolean).map((p) => {
        const vacia = p.cantidad === 0;
        return (
          <TabButton
            key={p.id}
            active={activa === p.id}
            disabled={vacia && p.deshabilitadaSiVacia}
            onClick={() => onCambiar(p.id)}
          >
            {p.label}
            {p.cantidad != null && (
              <span className={activa === p.id ? "opacity-80" : "text-gray-400"}> ({p.cantidad})</span>
            )}
          </TabButton>
        );
      })}
    </div>
  );
}
