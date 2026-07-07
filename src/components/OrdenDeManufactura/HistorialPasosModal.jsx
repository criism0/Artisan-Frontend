import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

function formatTime(val) {
  if (!val && val !== 0) return null;
  if (typeof val === "string" && /^\d{2}:\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return String(val);
}

function hasExtraData(obj) {
  return obj && typeof obj === "object" && Object.keys(obj).length > 0;
}

// `inline`: renderiza el contenido como panel embebido (sin overlay ni botón cerrar),
// para usarlo dentro de un tab. En ese modo `open`/`onClose` se ignoran.
export default function HistorialPasosModal({ open, omId, onClose, inline = false }) {
  const abierto = inline || open;
  const [ordenData, setOrdenData] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);

  const canReadManufacture = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.READ);

  useEffect(() => {
    if (!abierto) return;
    if (!canReadManufacture) {
      toast.permissionError([ModelType.ORDEN_MANUFACTURA, ScopeType.READ]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const orden = await api(`/ordenes_manufactura/${omId}`);
        setOrdenData(orden || null);

        try {
          const pasos = await api(`/registro-paso-produccion/${omId}/pasos`);
          setRegistros(Array.isArray(pasos) ? pasos : []);
        } catch {
          setRegistros(orden?.registrosPasoProduccion || []);
        }
      } catch (err) {
        toast.error(err?.message || "Error al cargar el historial de pasos.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [abierto, omId, canReadManufacture]);

  if (!abierto) return null;

  const contenido = (
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 gap-3">
            <h1 className="text-2xl font-bold">Historial de Pasos de Producción</h1>
            {!inline && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                ✕ Cerrar
              </button>
            )}
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

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-center">Orden</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Descripción</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Estado</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Elaborador</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Hora Inicio</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Hora Término</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Variables</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(registros || []).map((registro, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {registro.pasoPautaElaboracion?.orden || idx + 1}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {registro.pasoPautaElaboracion?.descripcion || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded text-sm ${
                              registro.estado === "Completado"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {registro.estado}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {registro.elaborador?.nombre || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {formatTime(registro.hora_inicio) || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {formatTime(registro.hora_termino) || "N/A"}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 min-w-[220px]">
                          <div className="space-y-1">
                            {registro.pasoPautaElaboracion?.requires_temperature && registro.temperatura != null ? (
                              <div>Temperatura: {registro.temperatura}°C</div>
                            ) : null}
                            {registro.pasoPautaElaboracion?.requires_ph && registro.ph != null ? (
                              <div>pH: {registro.ph}</div>
                            ) : null}
                            {registro.pasoPautaElaboracion?.requires_obtained_quantity && registro.cantidad_obtenida != null ? (
                              <div>Cantidad: {registro.cantidad_obtenida}</div>
                            ) : null}

                            {hasExtraData(registro.extra_input_data) ? (
                              Object.entries(registro.extra_input_data).map(([k, v], i) => (
                                <div key={i}>
                                  {k}: {v === null ? "N/A" : String(v)}
                                </div>
                              ))
                            ) : null}

                            {(() => {
                              const showsTemp = registro.pasoPautaElaboracion?.requires_temperature && registro.temperatura != null;
                              const showsPh = registro.pasoPautaElaboracion?.requires_ph && registro.ph != null;
                              const showsQty = registro.pasoPautaElaboracion?.requires_obtained_quantity && registro.cantidad_obtenida != null;
                              const showsExtra = hasExtraData(registro.extra_input_data);
                              if (showsTemp || showsPh || showsQty || showsExtra) return null;
                              return <span className="text-gray-500 text-center block">Sin variables</span>;
                            })()}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {registro.observaciones ? (
                            <div>{registro.observaciones}</div>
                          ) : (
                            <div className="text-gray-500">Sin observaciones</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
  );

  if (inline) {
    return <div className="bg-white rounded-xl border border-gray-200 shadow-sm">{contenido}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        {contenido}
      </div>
    </div>
  );
}
