import { FiCheckCircle, FiClock, FiCircle, FiAlertTriangle } from 'react-icons/fi';

/**
 * Vista estandarizada de avance de items para OC (recepción) y OV (picking).
 *
 * props:
 * - items: [{ id, nombre, formato?, unidad?, solicitado, completado }]
 *   (solicitado/completado en la misma unidad; `unidad` solo para mostrar)
 * - labels: textos según contexto, ej. OC:
 *     { solicitado: 'Pedido', completado: 'Recepcionado', pendiente: 'Falta por recepcionar', itemNoun: 'insumos' }
 *   OV: { solicitado: 'Solicitado', completado: 'Pickeado', pendiente: 'Falta por pickear', itemNoun: 'productos' }
 * - title: título opcional de la sección
 */

const DEFAULT_LABELS = {
  solicitado: 'Solicitado',
  completado: 'Completado',
  pendiente: 'Pendiente',
  itemNoun: 'items',
};

const fmtQty = (n) => {
  const num = Number(n) || 0;
  return Number.isInteger(num)
    ? num.toLocaleString('es-CL')
    : num.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function estadoItem(solicitado, completado) {
  const sol = Number(solicitado) || 0;
  const comp = Number(completado) || 0;
  if (sol > 0 && comp > sol + 1e-9) return 'exceso';
  if (sol > 0 && comp >= sol - 1e-9) return 'completo';
  if (comp > 0) return 'parcial';
  return 'pendiente';
}

const BADGES = {
  completo: {
    cls: 'bg-green-100 text-green-800 border-green-200',
    Icon: FiCheckCircle,
    text: 'Completo',
  },
  parcial: {
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    Icon: FiClock,
    text: 'Parcial',
  },
  pendiente: {
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
    Icon: FiCircle,
    text: 'Pendiente',
  },
  exceso: {
    cls: 'bg-violet-100 text-violet-800 border-violet-200',
    Icon: FiAlertTriangle,
    text: 'Exceso',
  },
};

const BAR_COLORS = {
  completo: 'bg-green-500',
  parcial: 'bg-amber-500',
  pendiente: 'bg-gray-300',
  exceso: 'bg-violet-500',
};

export default function AvanceItems({ items = [], labels = {}, title = null }) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const rows = (Array.isArray(items) ? items : []).filter(
    (it) => it && (Number(it.solicitado) || 0) > 0
  );

  if (rows.length === 0) return null;

  const completos = rows.filter((it) => {
    const e = estadoItem(it.solicitado, it.completado);
    return e === 'completo' || e === 'exceso';
  }).length;
  const todoListo = completos === rows.length;

  return (
    <div>
      {title && <h2 className="text-base font-semibold text-text mb-3">{title}</h2>}

      {/* Resumen global */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${todoListo ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${rows.length ? Math.round((completos / rows.length) * 100) : 0}%` }}
          />
        </div>
        <span className={`text-sm font-medium whitespace-nowrap ${todoListo ? 'text-green-700' : 'text-amber-700'}`}>
          {completos} de {rows.length} {L.itemNoun} {completos === 1 && rows.length === 1 ? 'completo' : 'completos'}
        </span>
      </div>

      {/* Detalle por item */}
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {rows.map((it, idx) => {
          const sol = Number(it.solicitado) || 0;
          const comp = Number(it.completado) || 0;
          const falta = Math.max(0, sol - comp);
          const exceso = Math.max(0, comp - sol);
          const estado = estadoItem(sol, comp);
          const { cls, Icon, text } = BADGES[estado];
          const pct = sol > 0 ? Math.min(100, Math.round((comp / sol) * 100)) : 0;
          const unidad = it.unidad ? ` ${it.unidad}` : '';

          return (
            <li key={it.id ?? idx} className="px-4 py-3 bg-white">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm font-medium text-gray-800 whitespace-normal break-words">
                  {it.nombre}
                  {it.formato && <span className="text-gray-500 font-normal"> ({it.formato})</span>}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cls}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {text}
                </span>
              </div>

              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[estado]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-xs text-gray-600">
                {L.solicitado}: <span className="font-semibold text-gray-800">{fmtQty(sol)}{unidad}</span>
                {' · '}
                {L.completado}: <span className="font-semibold text-gray-800">{fmtQty(comp)}{unidad}</span>
                {falta > 1e-9 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-red-600">
                      {L.pendiente}: {fmtQty(falta)}{unidad}
                    </span>
                  </>
                )}
                {exceso > 1e-9 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-violet-700">
                      Exceso: {fmtQty(exceso)}{unidad}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
