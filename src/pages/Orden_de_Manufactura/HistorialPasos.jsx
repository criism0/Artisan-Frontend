import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function HistorialPasos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ordenData, setOrdenData] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const orden = await api(`/ordenes_manufactura/${id}`);
        setOrdenData(orden || null);
        try {
          const pasos = await api(`/registro-paso-produccion/${id}/pasos`);
          setRegistros(Array.isArray(pasos) ? pasos : []);
        } catch (e) {
          // fallback: if endpoint not available, try to use orden.registrosPasoProduccion
          setRegistros(orden?.registrosPasoProduccion || []);
        }

      } catch (err) {
        toast.error(err.message || "Error al cargar los datos.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const formatTime = (val) => {
    if (!val && val !== 0) return null;
    if (typeof val === 'string' && /^\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return String(val);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
        <div className="flex justify-center items-center h-32">
          <div className="text-gray-500">Cargando historial...</div>
        </div>
      </div>
    );
  }

  if (!ordenData) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
        <div className="text-center text-gray-500">No se encontró la orden.</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Historial de Pasos de Producción</h1>
        <button
          onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          ← Volver a la orden
        </button>
      </div>

      {/* Order Info */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Información de la Orden</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-800">Estado:</span>
            <span className="ml-2 text-blue-700">{ordenData.estado}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Elaborador:</span>
            <span className="ml-2 text-blue-700">{ordenData.elaboradorEncargado?.nombre}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Bodega:</span>
            <span className="ml-2 text-blue-700">{ordenData.bodega?.nombre}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Fecha:</span>
            <span className="ml-2 text-blue-700">
              {new Date(ordenData.fecha).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Steps Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-center">Orden</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Descripción</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Estado</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Elaborador</th>
              {/* <th className="border border-gray-300 px-4 py-2 text-left">Temperatura</th> */}
              {/* <th className="border border-gray-300 px-4 py-2 text-left">pH</th> */}
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
                  {registro.pasoPautaElaboracion?.descripcion || 'N/A'}
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    registro.estado === 'Completado' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {registro.estado}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {registro.elaborador?.nombre || 'N/A'}
                </td>
                {/* <td className="border border-gray-300 px-4 py-2">
                  {registro.temperatura != null ? `${registro.temperatura}°C` : 'N/A'}
                </td> */}
                {/* <td className="border border-gray-300 px-4 py-2">
                  {registro.ph != null ? registro.ph : 'N/A'}
                </td> */}
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {formatTime(registro.hora_inicio) || 'N/A'}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {formatTime(registro.hora_termino) || 'N/A'}
                </td>
                <td className="border border-gray-300 px-4 py-2 min-w-[180px]">
                  <div className="space-y-1">
                    {registro.pasoPautaElaboracion?.requires_temperature && registro.temperatura != null && (
                      <div>Temperatura: {registro.temperatura}°C</div>
                    )}
                    {registro.pasoPautaElaboracion?.requires_ph && registro.ph != null && (
                      <div>pH: {registro.ph}</div>
                    )}
                    {registro.pasoPautaElaboracion?.requires_obtained_quantity && registro.cantidad_obtenida != null && (
                      <div>Cantidad: {registro.cantidad_obtenida}</div>
                    )}
                      {registro.extra_input_data && Object.keys(registro.extra_input_data).length > 0 ? (
                        Object.entries(registro.extra_input_data).map(([k, v], i) => (
                          <div key={i}>{k}: {v === null ? 'N/A' : String(v)}</div>
                        ))
                      ) : (
                        (() => {
                          const showsTemp = registro.pasoPautaElaboracion?.requires_temperature && registro.temperatura != null;
                          const showsPh = registro.pasoPautaElaboracion?.requires_ph && registro.ph != null;
                          const showsQty = registro.pasoPautaElaboracion?.requires_obtained_quantity && registro.cantidad_obtenida != null;
                          if (showsTemp || showsPh || showsQty) return null;
                          return <span className="text-gray-500 text-center block">Sin variables</span>;
                        })()
                      )}
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

    </div>
  );
}
