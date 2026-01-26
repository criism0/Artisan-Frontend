import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { toast } from "../../../lib/toast";

function n(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function HistorialCostosModal({ open, omId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await api(`/ordenes_manufactura/${omId}/historial-costos`);
        setData(res || null);
      } catch (err) {
        toast.error(err?.message || "Error al cargar el historial de costos.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, omId]);

  const om = data?.om || null;
  const resumen = data?.resumen || {};
  const costosIndirectosDetalle = Array.isArray(resumen?.costos_receta?.costos_indirectos_detalle)
    ? resumen.costos_receta.costos_indirectos_detalle
    : [];

  const absorciones = useMemo(() => {
    const arr = Array.isArray(data?.absorciones) ? data.absorciones : [];
    return [...arr].sort((a, b) => {
      const da = a?.bulto?.createdAt ? new Date(a.bulto.createdAt).getTime() : 0;
      const db = b?.bulto?.createdAt ? new Date(b.bulto.createdAt).getTime() : 0;
      return da - db;
    });
  }, [data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 gap-3">
            <div>
              <h1 className="text-2xl font-bold">Historial de Costos</h1>
              <div className="text-xs text-gray-600">
                OM #{om?.id || omId} · {om?.receta?.nombre ? `Receta: ${om.receta.nombre}` : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ✕ Cerrar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-500">Cargando historial...</div>
            </div>
          ) : null}

          {!loading && !om ? (
            <div className="text-center text-gray-500">No se encontró la orden.</div>
          ) : null}

          {!loading && om ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo total OM</div>
                  <div className="text-lg font-bold text-text">${n(resumen?.costo_total_om).toFixed(2)}</div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 font-medium">Absorción insumos</div>
                  <div className="text-lg font-bold text-text">${n(resumen?.costo_bultos_ingredientes).toFixed(2)}</div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 font-medium">Absorción empaques</div>
                  <div className="text-lg font-bold text-text">${n(resumen?.costo_bultos_empaques).toFixed(2)}</div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo directo</div>
                  <div className="text-lg font-bold text-text">${n(resumen?.costos_receta?.costo_directo_total).toFixed(2)}</div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo indirecto</div>
                  <div className="text-lg font-bold text-text">${n(resumen?.costos_receta?.costo_indirecto_total).toFixed(2)}</div>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Detalle de costos indirectos</h2>
                {!resumen?.costos_receta?.aplicado ? (
                  <div className="text-gray-500">Se verá al estar la OM post-cierre.</div>
                ) : costosIndirectosDetalle.length === 0 ? (
                  <div className="text-gray-500">No hay costos indirectos asociados a la receta.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Costo indirecto</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">$/kg</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Peso aplicado</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Costo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costosIndirectosDetalle.map((c, idx) => (
                          <tr key={`${c?.id || "ci"}-${idx}`} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{c?.nombre || "—"}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">${n(c?.costo_por_kg).toFixed(4)}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{n(c?.peso_aplicado).toFixed(2)} kg</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">${n(c?.costo_total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Detalle de absorciones por bulto</h2>
                {absorciones.length === 0 ? (
                  <div className="text-gray-500">Aún no hay absorciones registradas.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Materia Prima</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Bulto</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Proveedor</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Peso usado</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Costo absorbido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {absorciones.map((row, idx) => {
                          const mp = row?.materia_prima;
                          const proveedor = row?.proveedor;

                          return (
                            <tr key={`${row?.registro_id}-${row?.bulto?.id}-${idx}`} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">
                                {mp?.nombre || "—"}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {row?.bulto?.identificador || row?.bulto?.id || "—"}
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                {proveedor?.nombre_empresa || "—"}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right">
                                {n(row?.peso_utilizado).toFixed(3)}
                              </td>
                              <td className="border border-gray-300 px-4 py-2 text-right">
                                ${n(row?.costo_absorbido).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
