import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog } from "@headlessui/react";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";

export default function EjecutarPasosPVA() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pauta, setPauta] = useState(null);
  const [lote, setLote] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompletarModal, setShowCompletarModal] = useState(false);
  const [formCompletar, setFormCompletar] = useState({
    peso_retirado: "",
    fecha_vencimiento: "",
    unidades_de_salida: "",
    cant_nuevas_unidades: "",
  });

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

  const loadPauta = async () => {
    try {
      const data = await api(`/registros-pasos-valor-agregado/pauta/${id}`, { method: "GET" });
      setPauta(data.pauta);
      const ordered = data.registroPasos.sort(
        (a, b) => a.pasoValorAgregado?.orden - b.pasoValorAgregado?.orden
      );
      setPasos(ordered);

      const estado = data.pauta?.estado;
      if (estado && estado !== "En Proceso" && estado !== "Finalizado" && estado !== "Completado") {
        const utilizaInsumos = data.pauta?.procesoValorAgregado?.utiliza_insumos || false;
        if (!utilizaInsumos) {
          toast.warning("La pauta no está en proceso. Intenta comenzar la pauta desde el detalle primero.");
        }
      }

      const pautaDetalle = await api(`/pautas-valor-agregado/${id}`, { method: "GET" });
      if (pautaDetalle?.procesoValorAgregado) {
        setPauta(prev => ({
          ...prev,
          procesoValorAgregado: pautaDetalle.procesoValorAgregado
        }));
      }
    } catch {
      toast.error("Error al cargar los pasos del PVA.");
    } finally {
      setLoading(false);
    }
  };

  const loadLote = async (pautaData) => {
    try {
      let loteData = null;
      if (pautaData.id_lote_producto_en_proceso) {
        loteData = await api(`/lotes-producto-en-proceso/${pautaData.id_lote_producto_en_proceso}`);
      } else if (pautaData.id_lote_producto_final) {
        loteData = await api(`/lotes-producto-final/${pautaData.id_lote_producto_final}`);
      }
      setLote(loteData);
    } catch {
      toast.error("Error al cargar lote asociado.");
    }
  };

  useEffect(() => {
    loadPauta();
  }, [id]);

  useEffect(() => {
    if (pauta) loadLote(pauta);
  }, [pauta]);

  const handleComenzarPaso = async (idRegistro) => {
    try {
      setSaving(true);
      await api(`/registros-pasos-valor-agregado/comenzarPaso/${idRegistro}`, {
        method: "PUT",
        body: JSON.stringify({ id_elaborador: elaboradorId }),
      });
      toast.success("Paso iniciado correctamente.");
      await loadPauta();
    } catch {
      toast.error("No se pudo comenzar el paso. Verifica el orden o el ID.");
    } finally {
      setSaving(false);
    }
  };
  const handleCompletarPaso = async (idRegistro) => {
    try {
      setSaving(true);
      await api(`/registros-pasos-valor-agregado/completarPaso/${idRegistro}`, {
        method: "PUT",
        body: JSON.stringify({ id_elaborador: elaboradorId }),
      });
      toast.success("Paso completado correctamente.");
      await loadPauta();
    } catch {
      toast.error("No se pudo completar el paso.");
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirCompletar = () => {
    const cantBultosActuales = lote?.cant_bultos ?? 0;

    setFormCompletar({
      peso_retirado: "",
      fecha_vencimiento: "",
      unidades_de_salida: cantBultosActuales,
      cant_nuevas_unidades: "",
    });

    setShowCompletarModal(true);
  };

  
  const generaBultos = pauta?.procesoValorAgregado?.genera_bultos_nuevos === true;
  const descripcion = pauta?.procesoValorAgregado?.descripcion?.toLowerCase() || "";
  const esEmpaque = /(empaqu|empac)/i.test(descripcion);
  const esPIP = Boolean(pauta?.id_lote_producto_en_proceso);
  const mostrarCantNuevasUnidades = generaBultos && (!esEmpaque || esPIP);

  const handleCompletarPauta = async () => {
    try {
      setSaving(true);

      const body = {
        peso_retirado: Number(formCompletar.peso_retirado),
        fecha_vencimiento: formCompletar.fecha_vencimiento,
        unidades_de_salida: Number(formCompletar.unidades_de_salida),
      };

      if (mostrarCantNuevasUnidades) {
        const unidades = Number(formCompletar.cant_nuevas_unidades || 0);
        if (unidades <= 0) {
          toast.error("Este PVA genera nuevos bultos; la cantidad de bultos obtenidos debe ser un número mayor a 0");
          setSaving(false);
          return;
        }
        body.cant_nuevas_unidades = unidades;

      } else if (formCompletar.cant_nuevas_unidades && Number(formCompletar.cant_nuevas_unidades) > 0) {
        toast.error("El proceso no permite declarar unidades nuevas.");
        setSaving(false);
        return;
      }

      await api(`/pautas-valor-agregado/${id}/completar`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Pauta completada correctamente.");
      setShowCompletarModal(false);
      await loadPauta();
    } catch (err) {
      const errorMsg = err.message || "Error al completar la pauta.";
      toast.error(errorMsg);
      setSaving(false);
    };
  }

  const todosCompletos = pasos.length > 0 && pasos.every((p) => p.estado === "Completado");

  if (loading)
    return <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">Cargando pasos...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ejecución de Pasos del PVA</h1>
        <button
          onClick={() => navigate("/Orden_de_Manufactura")}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Volver a Órdenes
        </button>
      </div>

      <div className="mb-4 text-sm text-gray-700">
        <p><strong>Proceso:</strong> {pauta?.procesoValorAgregado?.descripcion || pauta?.ProcesoDeValorAgregado?.descripcion || "Sin descripción"}</p>
        <p><strong>Estado actual:</strong> {pauta?.estado}</p>
      </div>

      <table className="w-full border border-gray-200 rounded-lg text-sm mb-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Orden</th>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-center">Estado</th>
            <th className="p-2 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pasos.map((p, index) => {
            const puedeComenzar =
              p.estado === "Pendiente" &&
              (index === 0 ||
                pasos[index - 1].estado === "En Proceso" ||
                pasos[index - 1].estado === "Completado");

            return (
              <tr key={p.id} className="border-t border-gray-200">
                <td className="p-2 font-medium">{p.pasoValorAgregado?.orden}</td>
                <td className="p-2">{p.pasoValorAgregado?.descripcion}</td>
                <td className="p-2 text-center">
                  {p.estado === "Completado" ? (
                    <span className="text-green-700 font-medium">Completado</span>
                  ) : p.estado === "En Proceso" ? (
                    <span className="text-blue-700 font-medium">En Proceso</span>
                  ) : (
                    <span className="text-gray-500">Pendiente</span>
                  )}
                </td>
                <td className="p-2 text-center space-x-2">
                  {!todosCompletos && (
                    <>
                      {p.estado === "Pendiente" && puedeComenzar && (
                        <button
                          onClick={() => handleComenzarPaso(p.id)}
                          disabled={saving}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          Comenzar
                        </button>
                      )}
                      {p.estado === "Pendiente" && !puedeComenzar && (
                        <span className="text-gray-400 text-xs italic">
                          Esperando paso anterior
                        </span>
                      )}
                      {p.estado === "En Proceso" && (
                        <button
                          onClick={() => handleCompletarPaso(p.id)}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Completar
                        </button>
                      )}
                    </>
                  )}
                  {p.estado === "Completado" && (
                    <span className="text-gray-400 text-xs">Finalizado</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {todosCompletos && (
        <div className="flex justify-end mt-6">
          <button
            onClick={handleAbrirCompletar}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Completar Pauta
          </button>
        </div>
      )}

      <Dialog
        open={showCompletarModal}
        onClose={() => setShowCompletarModal(false)}
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
      >
        <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-lg space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Completar Pauta
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Peso retirado (kg)
              </label>
              <input
                type="number"
                value={formCompletar.peso_retirado}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    peso_retirado: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={formCompletar.fecha_vencimiento}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    fecha_vencimiento: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Unidades de salida
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formCompletar.unidades_de_salida}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    unidades_de_salida: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            {mostrarCantNuevasUnidades && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Cantidad de nuevos bultos
                </label>
                <input
                  className="border p-2 w-full rounded"
                  type="number"
                  min="1"
                  placeholder="Cantidad de nuevos bultos"
                  value={formCompletar.cant_nuevas_unidades}
                  onChange={(e) =>
                    setFormCompletar((prev) => ({
                      ...prev,
                      cant_nuevas_unidades: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCompletarModal(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleCompletarPauta}
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {saving ? "Guardando..." : "Completar"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
