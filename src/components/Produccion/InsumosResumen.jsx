// Pestaña «Insumos» del detalle de una elaboración: lo que pide la receta, lo consumido y, si
// todavía se está preparando, lo anotado. Sale de GET /ordenes_manufactura/:id/insumos.
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { formatNumberCL } from "../../services/formatHelpers";
import { abreviarUnidad } from "../../utils/elaboracionInsumos.js";

export default function InsumosResumen({ omId, recarga = 0 }) {
  const [vista, setVista] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    api(`/ordenes_manufactura/${omId}/insumos`)
      .then((r) => vivo && setVista(r?.data ?? null))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [omId, recarga]);

  if (error) return <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">No se pudieron cargar los insumos.</div>;
  if (!vista) return <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Cargando insumos…</div>;
  if (!vista.ingredientes.length) return <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">La receta no tiene ingredientes.</div>;

  const cant = (n, u) => `${formatNumberCL(n, 3)} ${abreviarUnidad(u)}`;
  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Insumo</th>
            <th className="px-4 py-2.5 text-right font-semibold">Receta</th>
            <th className="px-4 py-2.5 text-right font-semibold">Consumido</th>
            {vista.editable && <th className="px-4 py-2.5 text-right font-semibold">Anotado</th>}
            <th className="px-4 py-2.5 font-semibold">Bultos</th>
          </tr>
        </thead>
        <tbody>
          {vista.ingredientes.map((i) => {
            const u = i.materia_prima.unidad_medida;
            const bultos = i.consumidos.length ? i.consumidos : i.anotados;
            return (
              <tr key={i.id_registro} className="border-t border-gray-100 align-top">
                <td className="px-4 py-2.5 font-medium text-text">{i.materia_prima.nombre}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{cant(i.necesario, u)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {i.consumido > 0 ? cant(i.consumido, u) : <span className="text-gray-400">—</span>}
                  {i.consumido > 0 && i.cubierto && !vista.editable && (
                    <span className="ml-1.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">✓</span>
                  )}
                </td>
                {vista.editable && (
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {i.anotado > 0 ? cant(i.anotado, u) : <span className="text-gray-400">—</span>}
                    {i.faltante > 0 && (
                      <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">faltan {formatNumberCL(i.faltante, 3)}</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5 text-xs text-gray-600">
                  {bultos.length ? bultos.map((b) => `${b.identificador} · ${formatNumberCL(b.peso, 3)}`).join(" / ") : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
