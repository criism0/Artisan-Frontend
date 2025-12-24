import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function EjecutarPasos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pasos, setPasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ordenData, setOrdenData] = useState(null);

  const [todosCompletados, setTodosCompletados] = useState(false);


  // time helpers
  const toHHMM = (d) => {
    if (!d) return null;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return null;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const nowHHMM = () => {
    const date = new Date();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const elaboradorId = useMemo(() => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) return undefined;
      const decoded = jwtDecode(token);
      return Number(decoded?.id ?? decoded?.sub);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load manufacturing order data
        const ordenData = await api(`/ordenes_manufactura/${id}`);
        setOrdenData(ordenData);

        // Load steps data
        const data = await api(`/registro-paso-produccion/${id}/pasos`);
        
        const ordered = Array.isArray(data)
          ? data.sort((a, b) => (a.pasoPautaElaboracion?.orden ?? 0) - (b.pasoPautaElaboracion?.orden ?? 0))
          : [];

        setPasos(
          ordered.map((p) => ({
            ...p,
            ph: p.ph ?? "",
            temperatura: p.temperatura ?? "",
            observaciones: p.observaciones ?? "",
            cantidad_obtenida: p.cantidad_obtenida ?? "",
            extra_input_defs: p.pasoPautaElaboracion?.extra_input_data || [],
            extra_input_data: p.extra_input_data || {},
            // local time strings for inputs (HH:mm). default to current time if not present
            hora_inicio_local: toHHMM(p.hora_inicio) || nowHHMM(),
            hora_termino_local: toHHMM(p.hora_termino) || nowHHMM(),
          }))
        );

        const completados = ordered.every((p) => p.estado === "Completado");
        setTodosCompletados(completados);

      } catch (error) {
        console.error("Error al cargar los datos."+error);
        toast.error("Error al cargar los datos.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (idx, field, value) => {
    setPasos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const handleTimeChange = (idx, field, value) => {
    // value is HH:MM string from <input type=time>
    setPasos((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleExtraChange = (idx, varName, value) => {
    setPasos((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const extra = { ...(p.extra_input_data || {}) };
        extra[varName] = value;
        return { ...p, extra_input_data: extra };
      })
    );
  };

  const handleGuardar = async (paso, idx) => {
    if (!elaboradorId) {
      toast.error("No se pudo identificar el usuario.");
      return;
    }

    const phValue = Number(paso.ph);
    const tempValue = Number(paso.temperatura);

    // Validate pH if required
    if (paso.pasoPautaElaboracion?.requires_ph && (phValue < 0 || phValue > 14)) {
      toast.error("El pH debe estar entre 0 y 14.");
      return;
    }
    
    // Validate temperature if required
    if (paso.pasoPautaElaboracion?.requires_temperature && tempValue > 150) {
      toast.error("La temperatura máxima permitida es 150°C.");
      return;
    }

    const prepareExtraInputData = (paso) => {
      const defs = paso.pasoPautaElaboracion?.extra_input_data || paso.extra_input_defs || [];
      const values = paso.extra_input_data || {};
      const out = {};
      for (const def of defs) {
        const raw = values[def.name];
        if (def.type === 'number') {
          if (raw === '' || raw === undefined || raw === null) {
            out[def.name] = null;
            continue;
          }
          const n = Number(raw);
          if (Number.isNaN(n)) {
            throw new Error(`La variable "${def.name}" debe ser un número válido.`);
          }
          out[def.name] = n;
        } else {
          out[def.name] = raw == null ? '' : String(raw);
        }
      }
      return out;
    };

    try {
      // prepare and validate extra variables
      let extraPrepared = {};
      try {
        extraPrepared = prepareExtraInputData(paso);
      } catch (err) {
        toast.error(err.message);
        return;
      }

      setSaving(true);
        const payload = {
          observaciones: paso.observaciones,
          ph: phValue,
          temperatura: tempValue,
          cantidad_obtenida: Number(paso.cantidad_obtenida),
          id_elaborador: elaboradorId,
          extra_input_data: extraPrepared,
          hora_inicio: paso.hora_inicio_local || null,
          hora_termino: paso.hora_termino_local || null,
        };

        if (paso.estado === 'Completado') {
          await api(`/registro-paso-produccion/${id}/pasos/${paso.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          const nuevos = pasos.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  ...payload,
                  hora_inicio_local: payload.hora_inicio || p.hora_inicio_local,
                  hora_termino_local: payload.hora_termino || p.hora_termino_local,
                }
              : p
          );
          setPasos(nuevos);
          toast.success(`Paso #${paso.pasoPautaElaboracion?.orden ?? idx + 1} actualizado correctamente.`);
        } else {
          await api(`/registro-paso-produccion/${id}/pasos/${paso.id}/completar`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          const nuevos = pasos.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  estado: 'Completado',
                  ...payload,
                  hora_inicio_local: payload.hora_inicio || p.hora_inicio_local,
                  hora_termino_local: payload.hora_termino || p.hora_termino_local,
                }
              : p
          );
          setPasos(nuevos);
          toast.success(`Paso #${paso.pasoPautaElaboracion?.orden ?? idx + 1} guardado correctamente.`);

          const completados = nuevos.every((p) => p.estado === 'Completado');
          setTodosCompletados(completados);
        }
      } catch (error) {
        console.error('Error al guardar el paso.' + error);
        toast.error('Error al guardar el paso. Verifica los datos e intenta nuevamente.');
      } finally {
        setSaving(false);
      }
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        Cargando pasos...
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Orden_de_Manufactura/${id}`} />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Ejecución de pasos · OM #{id}</h1>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {pasos.length === 0 ? (
            <div className="p-6 text-gray-600">
              Esta OM no tiene pasos para ejecutar.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-center">Variables</th>
            <th className="p-2 text-center">Hora Inicio</th>
            <th className="p-2 text-center">Hora Término</th>
            <th className="p-2 text-center">Observaciones</th>
            <th className="p-2 text-center">Estado</th>
            <th className="p-2 text-center">Acción</th>
          </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {pasos.map((p, idx) => (
                    <tr key={p.id}>
              <td className="p-2 font-medium text-gray-700">
                {p.pasoPautaElaboracion?.orden ?? idx + 1}
              </td>
              <td className="p-2 text-gray-700">
                <div>
                  {p.pasoPautaElaboracion?.descripcion}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.pasoPautaElaboracion?.requires_ph && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        pH
                      </span>
                    )}
                    {p.pasoPautaElaboracion?.requires_temperature && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                        Temp
                      </span>
                    )}
                    {p.pasoPautaElaboracion?.requires_obtained_quantity && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Cantidad
                      </span>
                    )}
                    {p.extra_input_defs && p.extra_input_defs.length > 0 && (
                      p.extra_input_defs.map((def, iDef) => (
                        <span
                          key={iDef}
                          className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded"
                        >
                          {def.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </td>
              <td className="p-2">
                <div className="space-y-2">
                  {p.pasoPautaElaboracion?.requires_ph && (
                    <div className="flex items-center">
                      <label className="text-xs text-gray-600 w-20">pH</label>
                      <input
                        type="number"
                        min="0"
                        max="14"
                        step="0.1"
                        placeholder="Ej: 6.8"
                        className="border border-border rounded px-2 py-1 w-32"
                        value={p.ph}
                        onChange={(e) => handleChange(idx, "ph", e.target.value)}
                      />
                    </div>
                  )}

                  {p.pasoPautaElaboracion?.requires_temperature && (
                    <div className="flex items-center">
                      <label className="text-xs text-gray-600 w-20">Temperatura (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Ej: 45°C"
                        className="border border-border rounded px-2 py-1 w-32"
                        value={p.temperatura}
                        onChange={(e) => handleChange(idx, "temperatura", e.target.value)}
                      />
                    </div>
                  )}

                  {p.pasoPautaElaboracion?.requires_obtained_quantity && (
                    <div className="flex items-center">
                      <label className="text-xs text-gray-600 w-20">Cantidad</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="Ej: 750"
                        className="border border-border rounded px-2 py-1 w-32"
                        value={p.cantidad_obtenida}
                        onChange={(e) => handleChange(idx, "cantidad_obtenida", e.target.value)}
                      />
                    </div>
                  )}

                  {p.extra_input_defs && p.extra_input_defs.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {p.extra_input_defs.map((def, iDef) => {
                        const val = (p.extra_input_data || {})[def.name] ?? "";
                        return (
                          <div key={iDef} className="flex items-center">
                            <label className="text-xs text-gray-600 w-20">{def.name}</label>
                            {def.type === "number" ? (
                              <input
                                type="number"
                                step="any"
                                placeholder={def.name}
                                className="border border-border rounded px-2 py-1 w-32"
                                value={val}
                                onChange={(e) => handleExtraChange(idx, def.name, e.target.value)}
                              />
                            ) : (
                              <input
                                type="text"
                                placeholder={def.name}
                                className="border border-border rounded px-2 py-1 w-32"
                                value={val}
                                onChange={(e) => handleExtraChange(idx, def.name, e.target.value)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !(p.pasoPautaElaboracion?.requires_ph || p.pasoPautaElaboracion?.requires_temperature || p.pasoPautaElaboracion?.requires_obtained_quantity) && (
                      <span className="block text-center text-gray-400 text-xs">Sin variables</span>
                    )
                  )}
                </div>
              </td>
              <td className="p-2 text-center">
                <input
                  type="time"
                  className="border border-border rounded px-2 py-1 w-28 text-center"
                  value={p.hora_inicio_local || ''}
                  onChange={(e) => handleTimeChange(idx, 'hora_inicio_local', e.target.value)}
                />
              </td>

              <td className="p-2 text-center">
                <input
                  type="time"
                  className="border border-border rounded px-2 py-1 w-28 text-center"
                  value={p.hora_termino_local || ''}
                  onChange={(e) => handleTimeChange(idx, 'hora_termino_local', e.target.value)}
                />
              </td>

              <td className="p-2">
                <input
                  type="text"
                  placeholder="Ej: sin impurezas visibles"
                  className="border border-border rounded px-2 py-1 w-full placeholder-gray-400"
                  value={p.observaciones}
                  onChange={(e) =>
                    handleChange(idx, "observaciones", e.target.value)
                  }
                />
              </td>
              <td className="p-2 text-center">
                {p.estado === "Completado" ? (
                  <span className="text-green-700 font-medium">Completado</span>
                ) : (
                  <span className="text-gray-500">Pendiente</span>
                )}
              </td>
              <td className="p-2 text-center">
                <button
                  onClick={() => handleGuardar(p, idx)}
                  disabled={saving}
                  className="px-3 py-1 bg-primary text-white rounded hover:bg-hover disabled:opacity-60"
                >
                  Guardar
                </button>
              </td>
            </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
        >
          Volver al detalle
        </button>

        {todosCompletados && (
          <>
            {ordenData?.receta?.posiblesSubproductos?.length > 0 ? (
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() => navigate(`/Orden_de_Manufactura/${id}/subproductos-decision`)}
              >
                Siguiente paso: Verificar Subproductos
              </button>
            ) : (
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() => navigate(`/Orden_de_Manufactura/${id}/produccion-final`)}
              >
                Siguiente paso: Producción Final
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
