import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Route as IconoRuta } from "lucide-react";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { listarDevoluciones, listarRevisiones } from "../../services/rutasService";

/**
 * Barra común de Logística → Entregas (revisión de UI, Fase 5, 2026-11-25, maqueta aprobada por
 * Cristóbal). Rutas, Semana, Sin ruta, Revisión y Devoluciones son vistas HERMANAS: antes eran
 * botones en la cabecera de la lista y cada una se dejaba con «Volver», así que no se sabía en
 * cuál se estaba ni qué quedaba pendiente sin volver a la lista. Lo pendiente va en ámbar en la
 * propia pestaña. «Planificar ruta» es la única acción principal del módulo.
 *
 * El detalle de una ruta y el planificador siguen con «Volver»: esos sí son hijos.
 */
const PESTANAS = [
  { to: "/logistica/entregas", label: "Rutas", end: true },
  { to: "/logistica/entregas/semana", label: "Semana" },
  { to: "/logistica/entregas/sin-ruta", label: "Sin ruta" },
  { to: "/logistica/entregas/revision", label: "Revisión", cuenta: "revision" },
  { to: "/logistica/entregas/devoluciones", label: "Devoluciones", cuenta: "devoluciones" },
];

/**
 * `planificarSecundario`: en Semana la acción del tablero es «Planificación rápida» (y cada día
 * tiene «Armar ruta»); dos botones morados juntos competían, así que ahí éste va con borde.
 */
export default function BarraEntregas({ recargar = 0, planificarSecundario = false }) {
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState({ revision: 0, devoluciones: 0 });
  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  // `recargar`: la vista lo cambia cuando resuelve algo, para que el número baje sin recargar.
  useEffect(() => {
    let vivo = true;
    Promise.all([listarRevisiones("Pendiente").catch(() => []), listarDevoluciones().catch(() => [])]).then(
      ([rev, dev]) =>
        vivo &&
        setCuentas({
          revision: Array.isArray(rev) ? rev.length : 0,
          devoluciones: Array.isArray(dev) ? dev.length : 0,
        }),
    );
    return () => {
      vivo = false;
    };
  }, [recargar]);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200">
      <nav className="flex flex-wrap gap-1" aria-label="Entregas">
        {PESTANAS.map((p) => {
          const n = p.cuenta ? cuentas[p.cuenta] : 0;
          return (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
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
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">{n}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
      {puedeEscribir && (
        <button
          type="button"
          onClick={() => navigate("/logistica/entregas/planificar")}
          className={`btn ${planificarSecundario ? "btn-secundario" : "btn-primario"} mb-2 inline-flex items-center gap-2`}
        >
          <IconoRuta className="w-4 h-4" /> Planificar ruta
        </button>
      )}
    </div>
  );
}
