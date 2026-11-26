import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../lib/api";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { tomaAbierta } from "../../utils/inventarioVista.js";

/**
 * Barra común de Inventario (revisión de UI, Fase 5, 2026-11-25, maqueta aprobada por
 * Cristóbal). Stock, Bultos, Sin QR, Tomas y Consumo interno son vistas HERMANAS que antes sólo
 * se cruzaban por el menú. Es la misma barra que la de Entregas.
 *
 * Las tomas abiertas o por validar van en ámbar en su pestaña: mientras haya una toma en curso
 * no se deben hacer solicitudes ni ventas, y antes no había forma de saberlo sin entrar a Tomas.
 * Los detalles (una toma, un consumo, editar un bulto) siguen con «Volver»: ésos sí son hijos.
 */
const PESTANAS = [
  { to: "/inventario/stock", label: "Stock", modelo: ModelType.INVENTARIO },
  { to: "/inventario/bultos", label: "Bultos", modelo: ModelType.BULTO },
  { to: "/inventario/sin-qr", label: "Sin QR", modelo: ModelType.BULTO },
  { to: "/inventario/tomas", label: "Tomas", modelo: ModelType.SESION_INVENTARIADO, cuenta: "tomas" },
  { to: "/inventario/consumo-interno", label: "Consumo interno", modelo: ModelType.BULTO },
];


/** `acciones`: botones de la vista a la derecha de las pestañas (como «Planificar ruta» en Entregas). */
export default function BarraInventario({ acciones = null }) {
  const [tomasAbiertas, setTomasAbiertas] = useState(0);
  const veTomas = checkScope(ModelType.SESION_INVENTARIADO, ScopeType.READ);

  useEffect(() => {
    if (!veTomas) return undefined;
    let vivo = true;
    api("/sesiones-inventariado")
      .then((res) => {
        const lista = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (vivo) setTomasAbiertas(lista.filter((s) => tomaAbierta(s)).length);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [veTomas]);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
      <nav className="flex flex-wrap gap-1" aria-label="Inventario">
        {PESTANAS.filter((p) => checkScope(p.modelo, ScopeType.READ)).map((p) => {
          const n = p.cuenta === "tomas" ? tomasAbiertas : 0;
          return (
            <NavLink
              key={p.to}
              to={p.to}
              className={({ isActive }) =>
                `-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary-dark"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`
              }
            >
              {p.label}
              {n > 0 && (
                <span
                  className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800"
                  title={`${n} toma${n === 1 ? "" : "s"} en curso o por validar: no se deben hacer solicitudes ni ventas`}
                >
                  {n}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      {acciones && <div className="mb-2 flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
