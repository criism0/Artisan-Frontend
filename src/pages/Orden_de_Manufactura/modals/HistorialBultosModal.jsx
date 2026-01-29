import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { formatCLP } from "../../../services/formatHelpers";

function n(val) {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function HistorialBultosModal({ open, omId, onClose }) {
  const [ordenData, setOrdenData] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        setLoading(true);
        const orden = await api(`/ordenes_manufactura/${omId}`);
        setOrdenData(orden || null);

        const res = await api(`/registros-insumo-produccion/historial-bultos?id_orden_manufactura=${omId}`);
        setData(res || null);
      } catch (err) {
        toast.error(err?.message || "Error al cargar el historial de bultos.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, omId]);

  const registros = Array.isArray(data?.registros) ? data.registros : [];

  const resumenMP = useMemo(() => {
    return registros.map((r) => {
      const mp = r?.materiaPrima || {};
      return {
        id: r?.id,
        materia_prima: mp?.nombre || "N/A",
        unidad: mp?.unidad_medida || "",
        peso_necesario: n(r?.peso_necesario),
        peso_utilizado: n(r?.peso_utilizado),
      };
    });
  }, [registros]);

  const filasAsignaciones = useMemo(() => {
    const rows = [];
    for (const r of registros) {
      const mp = r?.materiaPrima || {};
      const bultos = Array.isArray(r?.bultos) ? r.bultos : [];

      if (bultos.length === 0) {
        rows.push({
          key: `r-${r?.id}-none`,
          materia_prima: mp?.nombre || "N/A",
          unidad: mp?.unidad_medida || "",
          peso_necesario: n(r?.peso_necesario),
          peso_utilizado_registro: n(r?.peso_utilizado),
          bulto_identificador: "—",
          peso_usado_bulto: 0,
          proveedor: "—",
          lote_proveedor: "—",
          fecha_ingreso_bulto: null,
          costo_unitario: null,
          peso_unitario: null,
          costo_absorbido: 0,
        });
        continue;
      }

      for (const b of bultos) {
        const pivotPeso = n(b?.RegistroMateriaPrimaProduccionBulto?.peso_utilizado);
        const pesoUnitario = n(b?.peso_unitario);
        const costoUnitario = n(b?.costo_unitario);
        const unidadesConsumidas = pesoUnitario > 0 ? pivotPeso / pesoUnitario : 0;
        const costoAbsorbido = unidadesConsumidas * costoUnitario;

        const proveedorNombre =
          b?.ProveedorMateriaPrima?.proveedor?.nombre_empresa ||
          b?.ordenCompra?.proveedor?.nombre_empresa ||
          "—";

        const loteProv = b?.lote?.identificador_proveedor || "—";

        rows.push({
          key: `r-${r?.id}-b-${b?.id}`,
          materia_prima: mp?.nombre || "N/A",
          unidad: mp?.unidad_medida || "",
          peso_necesario: n(r?.peso_necesario),
          peso_utilizado_registro: n(r?.peso_utilizado),
          bulto_identificador: b?.identificador || b?.id || "—",
          peso_usado_bulto: pivotPeso,
          proveedor: proveedorNombre,
          lote_proveedor: loteProv,
          fecha_ingreso_bulto: b?.createdAt || null,
          costo_unitario: Number.isFinite(Number(b?.costo_unitario)) ? n(b?.costo_unitario) : null,
          peso_unitario: Number.isFinite(Number(b?.peso_unitario)) ? n(b?.peso_unitario) : null,
          costo_absorbido: costoAbsorbido,
        });
      }
    }
    return rows;
  }, [registros]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 gap-3">
            <h1 className="text-2xl font-bold">Historial de Bultos</h1>
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

          {!loading && !ordenData ? (
            <div className="text-center text-gray-500">No se encontró la orden.</div>
          ) : null}

          {!loading && ordenData ? (
            <>

              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Materias Primas Utilizadas</h2>
                {resumenMP.length === 0 ? (
                  <div className="text-gray-500">No hay registros de insumos.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Materia Prima</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Peso Necesario</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Peso Utilizado</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumenMP.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">{r.materia_prima}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{r.peso_necesario.toFixed(3)}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{r.peso_utilizado.toFixed(3)}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">{r.unidad || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Detalle de extracción por bulto</h2>
                {filasAsignaciones.length === 0 ? (
                  <div className="text-gray-500">No hay asignaciones de bultos.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Materia Prima</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Bulto</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Peso usado</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Proveedor</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Lote proveedor</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Ingreso</th>
                          <th className="border border-gray-300 px-4 py-2 text-right">Costo absorbido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasAsignaciones.map((row) => {
                          const fi = safeDate(row.fecha_ingreso_bulto);
                          return (
                            <tr key={row.key} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">{row.materia_prima}</td>
                              <td className="border border-gray-300 px-4 py-2">{row.bulto_identificador}</td>
                              <td className="border border-gray-300 px-4 py-2 text-right">{n(row.peso_usado_bulto).toFixed(3)}</td>
                              <td className="border border-gray-300 px-4 py-2">{row.proveedor}</td>
                              <td className="border border-gray-300 px-4 py-2">{row.lote_proveedor}</td>
                              <td className="border border-gray-300 px-4 py-2 text-center">{fi ? fi.toLocaleDateString() : "—"}</td>
                              <td className="border border-gray-300 px-4 py-2 text-right">{formatCLP(row.costo_absorbido, 0)}</td>
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
