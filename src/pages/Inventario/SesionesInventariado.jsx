import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { ClipboardCheck } from "lucide-react";

function BadgeEstado({ estado }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border";
  if (estado === "Activa")
    return <span className={`${base} border-blue-200 bg-blue-50 text-blue-800`}>Activa</span>;
  if (estado === "Terminada")
    return <span className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>Terminada — por validar</span>;
  if (estado === "Validada")
    return <span className={`${base} border-green-200 bg-green-50 text-green-800`}>Validada</span>;
  return <span className={`${base} border-gray-200 bg-gray-50 text-gray-700`}>{estado}</span>;
}

/**
 * Listado de sesiones de toma de inventario (creadas desde la app móvil).
 * Desde aquí se revisa y valida cada sesión contra la realidad de la bodega.
 */
export default function SesionesInventariado() {
  const api = useApi();
  const navigate = useNavigate();
  const [sesiones, setSesiones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/sesiones-inventariado");
        const arr = res?.data ?? res;
        setSesiones(Array.isArray(arr) ? arr : arr?.sesiones ?? []);
      } catch {
        toast.error("No se pudieron cargar las sesiones de inventariado");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <PageLoader message="Cargando sesiones de inventariado" />;

  const visibles = filtroEstado
    ? sesiones.filter((s) => s.estado === filtroEstado)
    : sesiones;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary" />
          Tomas de Inventario
        </h1>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border border-gray-300 px-3 py-2 rounded-md text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="Activa">Activa</option>
          <option value="Terminada">Terminada — por validar</option>
          <option value="Validada">Validada</option>
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Las sesiones se crean y escanean desde la app móvil. Al validar una sesión
        <span className="font-medium"> Terminada</span>, los conteos se aplican a la bodega:
        ajustes de cantidad, traslados, reaparecidos y merma para los bultos no encontrados.
      </p>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Bodega</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Bultos escaneados</th>
              <th className="px-4 py-3">Creada por</th>
              <th className="px-4 py-3">Escaneadores</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Validada por</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No hay sesiones {filtroEstado ? `en estado ${filtroEstado}` : "registradas"}.
                </td>
              </tr>
            )}
            {visibles.map((s) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/Inventario/tomas/${s.id}`)}
                className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium">#{s.id}</td>
                <td className="px-4 py-3">{s.bodega?.nombre ?? s.id_bodega}</td>
                <td className="px-4 py-3"><BadgeEstado estado={s.estado} /></td>
                <td className="px-4 py-3">{s.cantidad_bultos ?? "—"}</td>
                <td className="px-4 py-3">{s.creador?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {(s.usuarios_escaneadores || []).map((u) => u.nombre).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.createdAt ? new Date(s.createdAt).toLocaleString("es-CL") : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.validador?.nombre
                    ? `${s.validador.nombre} (${new Date(s.fecha_validacion).toLocaleDateString("es-CL")})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
