import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog } from "@headlessui/react";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { formatNumberCL } from "../../services/formatHelpers";

export default function EjecutarPasosPVA() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pauta, setPauta] = useState(null);
  const [lote, setLote] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [pautasLote, setPautasLote] = useState([]);
  const [insumosConfig, setInsumosConfig] = useState([]);
  const [bultosPorInsumo, setBultosPorInsumo] = useState({});
  const [seleccionBultos, setSeleccionBultos] = useState({});
  const [nombreInsumoByKey, setNombreInsumoByKey] = useState({});

  const formatDisponible = (b) => {
    const rawQty =
      b?.unidades_disponibles ??
      b?.peso_disponible ??
      b?.peso ??
      b?.cantidad_disponible;

    const qty = Number(rawQty);
    const hasQty = Number.isFinite(qty);

    const um =
      b?.unidad_medida ||
      b?.materiaPrima?.unidad_medida ||
      b?.productoBase?.unidad_medida ||
      b?.ProductoBase?.unidad_medida ||
      "";

    if (!hasQty) return "Disponible: —";
    return `Disponible: ${formatNumberCL(qty, 2)}${um ? ` ${um}` : ""}`;
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompletarModal, setShowCompletarModal] = useState(false);
  const [formCompletar, setFormCompletar] = useState({
    peso_retirado: "",
    fecha_vencimiento: "",
    unidades_de_salida: "",
    cant_nuevas_unidades: "",
  });

  const [bultosSalida, setBultosSalida] = useState([]);
  const [bultosCollapsed, setBultosCollapsed] = useState(true);

  const toInputDate = (d) => {
    if (!d) return "";
    // Si viene como string ISO/fecha, tomar YYYY-MM-DD directo para evitar shifts por timezone.
    if (typeof d === "string") {
      const m = d.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m?.[1]) return m[1];
    }
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
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

  const loadPauta = async () => {
    try {
      const pautaDetalle = await api(`/pautas-valor-agregado/${id}`, { method: "GET" });
      setPauta(pautaDetalle);

      const data = await api(`/registros-pasos-valor-agregado/pauta/${id}`, { method: "GET" });
      const ordered = (data.registroPasos || []).sort(
        (a, b) => (a.pasoValorAgregado?.orden ?? 0) - (b.pasoValorAgregado?.orden ?? 0)
      );
      setPasos(ordered);

      const insumos = pautaDetalle?.pvaPorProducto?.insumosPVAProductos || [];
      setInsumosConfig(insumos);

      // precargar nombres para mostrar UI humana
      if (Array.isArray(insumos) && insumos.length > 0) {
        const nombres = {};
        await Promise.all(
          insumos.map(async (ins) => {
            const idMateriaPrima = ins?.id_materia_prima || null;
            const idProductoBase = ins?.id_producto_base || null;
            const key = idMateriaPrima || idProductoBase;
            if (!key) return;

            try {
              if (idMateriaPrima) {
                const mp = await api(`/materias-primas/${idMateriaPrima}`);
                nombres[key] = mp?.nombre || mp?.materia_prima?.nombre || `Materia prima #${idMateriaPrima}`;
              } else if (idProductoBase) {
                const pb = await api(`/productos-base/${idProductoBase}`);
                nombres[key] = pb?.nombre || pb?.producto_base?.nombre || `Producto #${idProductoBase}`;
              }
            } catch {
              if (idMateriaPrima) nombres[key] = `Materia prima #${idMateriaPrima}`;
              if (idProductoBase) nombres[key] = `Producto #${idProductoBase}`;
            }
          })
        );
        setNombreInsumoByKey(nombres);
      } else {
        setNombreInsumoByKey({});
      }

      // precargar bultos disponibles por insumo si aplica
      if (Array.isArray(insumos) && insumos.length > 0) {
        const disponibilidad = {};
        for (const ins of insumos) {
          const idInsumo = ins?.id_materia_prima || ins?.id_producto_base;
          if (!idInsumo) continue;
          try {
            disponibilidad[idInsumo] = await api(`/bultos-disponibles-insumo/${idInsumo}`);
          } catch {
            disponibilidad[idInsumo] = [];
          }
        }
        setBultosPorInsumo(disponibilidad);
      } else {
        setBultosPorInsumo({});
      }

      // cargar pauta(s) del lote para bloqueo secuencial
      try {
        let query = "";
        const lotePip = pautaDetalle?.id_lote_producto_en_proceso;
        const loteFinal = pautaDetalle?.id_lote_producto_final;
        if (lotePip) query = `/pautas-valor-agregado/lote?id_lote_producto_en_proceso=${lotePip}`;
        if (loteFinal) query = `/pautas-valor-agregado/lote?id_lote_producto_final=${loteFinal}`;
        if (query) {
          const res = await api(query);
          setPautasLote(Array.isArray(res) ? res : []);
        } else {
          setPautasLote([]);
        }
      } catch {
        setPautasLote([]);
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

  const proceso = pauta?.procesoValorAgregado || pauta?.ProcesoDeValorAgregado;
  const tienePasos = Boolean(proceso?.tiene_pasos) || pasos.length > 0;
  const requiereInsumos = (proceso?.utiliza_insumos !== false) && (insumosConfig?.length ?? 0) > 0;

  const ordenActual = Number(pauta?.pvaPorProducto?.orden || 0);
  const hayPreviasIncompletas = useMemo(() => {
    if (!Array.isArray(pautasLote) || !ordenActual) return false;
    return pautasLote.some((p) => {
      const ord = Number(p?.pvaPorProducto?.orden || 0);
      if (!ord || ord >= ordenActual) return false;
      const st = String(p?.estado || "").toLowerCase();
      return !st.includes("complet");
    });
  }, [pautasLote, ordenActual]);

  const puedeComenzarPauta = !hayPreviasIncompletas;
  const estadoLower = String(pauta?.estado || "").toLowerCase();
  const pautaPendiente = estadoLower.includes("pend");
  const pautaEnProceso = estadoLower.includes("proceso") || estadoLower.includes("ejec") || estadoLower.includes("inici");
  const pautaCompletada = estadoLower.includes("complet");

  const inicioAprox = pautaEnProceso ? (pauta?.updatedAt || pauta?.updated_at) : null;
  const elapsedText = useMemo(() => {
    if (!inicioAprox) return null;
    const start = new Date(inicioAprox);
    if (Number.isNaN(start.getTime())) return null;
    const diffMs = Date.now() - start.getTime();
    if (diffMs < 0) return null;
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [inicioAprox]);

  const handleComenzarPauta = async () => {
    if (!id) return;
    if (!puedeComenzarPauta) {
      toast.error("Debes completar los PVAs anteriores antes de comenzar este.");
      return;
    }

    try {
      setSaving(true);
      const body = {};

      if (requiereInsumos) {
        const bultos = [];
        for (const ins of insumosConfig) {
          const idMateriaPrima = ins?.id_materia_prima || null;
          const idProductoBase = ins?.id_producto_base || null;
          const key = idMateriaPrima || idProductoBase;
          const idBulto = Number(seleccionBultos?.[key] || 0);
          if (!key || !idBulto) {
            toast.error("Selecciona un bulto para cada insumo antes de comenzar.");
            setSaving(false);
            return;
          }
          bultos.push({
            id_materia_prima: idMateriaPrima,
            id_producto_base: idProductoBase,
            id_bulto: idBulto,
          });
        }
        body.bultos = bultos;
      }

      await api(`/pautas-valor-agregado/${id}/comenzar`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Pauta comenzada correctamente.");
      await loadPauta();
    } catch (err) {
      const msg = err?.error || err?.message;
      toast.error(msg || "No se pudo comenzar la pauta.");
    } finally {
      setSaving(false);
    }
  };

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

    const fechaVencimientoActual =
      formCompletar?.fecha_vencimiento || toInputDate(lote?.fecha_vencimiento);

    const bultosLote =
      lote?.LoteProductoEnProcesoBultos ||
      lote?.LoteProductoFinalBultos ||
      [];

    // Inicializar salida por bulto (modo confirmación)
    setBultosSalida(
      (bultosLote || []).map((b) => ({
        id_bulto: b?.id,
        identificador:
          b?.identificador ??
          b?.codigo ??
          b?.codigo_interno ??
          b?.numero ??
          b?.folio ??
          b?.id,
        peso_unitario: Number(b?.peso_unitario ?? 0),
        eliminar: false,
      }))
    );
    setBultosCollapsed(true);

    setFormCompletar({
      peso_retirado: "",
      fecha_vencimiento: fechaVencimientoActual,
      unidades_de_salida: cantBultosActuales,
      cant_nuevas_unidades: "",
    });

    setShowCompletarModal(true);
  };

  
    const generaBultos = proceso?.genera_bultos_nuevos === true;
    const descripcion = proceso?.descripcion?.toLowerCase() || "";
  const esEmpaque = /(empaqu|empac)/i.test(descripcion);
  const esPIP = Boolean(pauta?.id_lote_producto_en_proceso);
  const mostrarCantNuevasUnidades = generaBultos && (!esEmpaque || esPIP);

  const handleCompletarPauta = async () => {
    try {
      setSaving(true);

      const body = {
        fecha_vencimiento: formCompletar.fecha_vencimiento,
      };

      // Si el proceso NO genera bultos nuevos, se cierra por bulto.
      if (proceso?.genera_bultos_nuevos === false) {
        const rows = Array.isArray(bultosSalida) ? bultosSalida : [];
        if (rows.length === 0) {
          toast.error("No hay bultos para declarar salida.");
          setSaving(false);
          return;
        }

        const salida = rows.filter((r) => !r.eliminar);
        if (salida.length === 0) {
          toast.error("Debes dejar al menos 1 bulto de salida.");
          setSaving(false);
          return;
        }

        for (const r of rows) {
          const p = Number(r?.peso_unitario);
          if (!Number.isFinite(p) || p <= 0) {
            toast.error("Todos los bultos deben tener un peso válido (> 0).");
            setSaving(false);
            return;
          }
        }

        body.bultos_salida = rows.map((r) => ({
          id_bulto: Number(r.id_bulto),
          peso_unitario: Number(r.peso_unitario),
          eliminar: Boolean(r.eliminar),
        }));
      } else {
        // Modo legacy (genera bultos nuevos): se mantiene el cierre por peso/unidades
        body.peso_retirado = Number(formCompletar.peso_retirado);
        body.unidades_de_salida = Number(formCompletar.unidades_de_salida);
      }

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

  const resumenSalida = useMemo(() => {
    const rows = Array.isArray(bultosSalida) ? bultosSalida : [];
    const salida = rows.filter((r) => !r.eliminar);
    const totalPeso = salida.reduce((acc, r) => acc + Number(r?.peso_unitario || 0), 0);
    return {
      totalBultos: rows.length,
      bultosSalida: salida.length,
      pesoTotal: totalPeso,
    };
  }, [bultosSalida]);

  const todosCompletos = tienePasos && pasos.length > 0 && pasos.every((p) => p.estado === "Completado");
  const puedeCompletar = pautaEnProceso && (todosCompletos || !tienePasos);

  if (loading)
    return <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">Cargando pasos...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ejecución de PVA</h1>
        <button
          onClick={() => navigate("/Orden_de_Manufactura")}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Volver a Órdenes
        </button>
      </div>

      <div className="mb-4 text-sm text-gray-700">
        <p><strong>Proceso:</strong> {proceso?.descripcion || "Sin descripción"}</p>
        <p><strong>Estado actual:</strong> {pauta?.estado}</p>
        {proceso?.tiempo_estimado != null ? (
          <p><strong>Tiempo estimado:</strong> {proceso.tiempo_estimado} {proceso?.unidad_tiempo || ""}</p>
        ) : null}
        {elapsedText ? (
          <p><strong>Tiempo transcurrido (aprox):</strong> {elapsedText}</p>
        ) : null}
      </div>

      {pautaPendiente ? (
        <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
          <div className="font-semibold text-text">1) Comenzar PVA</div>

          {hayPreviasIncompletas ? (
            <div className="text-sm text-amber-700 mt-2">
              Debes completar los PVAs anteriores antes de comenzar este.
            </div>
          ) : null}

          {requiereInsumos ? (
            <div className="mt-3">
              <div className="text-sm text-gray-700">
                Este PVA requiere consumir insumos antes de comenzar.
              </div>
              <div className="mt-3 space-y-3">
                {(insumosConfig || []).map((ins) => {
                  const key = ins?.id_materia_prima || ins?.id_producto_base;
                  const insumoNombre = nombreInsumoByKey?.[key] || `Insumo #${key}`;
                  const bultos = bultosPorInsumo?.[key] || [];
                  return (
                    <div key={key} className="bg-white border border-border rounded p-3">
                      <div className="text-sm font-medium text-text">
                        {insumoNombre}
                      </div>
                      <div className="mt-2">
                        <select
                          className="w-full border border-border rounded px-3 py-2"
                          value={seleccionBultos?.[key] || ""}
                          onChange={(e) =>
                            setSeleccionBultos((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona un bulto…</option>
                          {Array.isArray(bultos) && bultos.length > 0 ? (
                            bultos.map((b) => (
                              <option key={b.id} value={b.id}>
                                {(b.identificador || b.codigo || "")
                                  ? `${b.identificador || b.codigo} · `
                                  : ""}
                                Bulto #{b.id} · {formatDisponible(b)}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              Sin bultos disponibles
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 mt-2">Este PVA no requiere insumos.</div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleComenzarPauta()}
              disabled={saving || !puedeComenzarPauta}
              className="px-5 py-2 bg-primary text-white rounded hover:bg-hover disabled:opacity-60"
            >
              {saving ? "Comenzando…" : "Comenzar"}
            </button>
          </div>
        </div>
      ) : null}

      {pautaCompletada ? (
        <div className="text-sm text-green-700 font-medium mb-6">Esta pauta ya está completada.</div>
      ) : null}

      {pautaEnProceso && tienePasos ? (
        <div className="bg-gray-200 p-4 rounded-lg mb-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 font-semibold text-text">2) Ejecutar pasos</div>

            <div className="w-full overflow-x-auto">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {pasos.map((p, index) => {
                    const puedeComenzar =
                      p.estado === "Pendiente" &&
                      (index === 0 || pasos[index - 1].estado === "Completado");

                    const orden = p.pasoValorAgregado?.orden ?? index + 1;
                    const desc = p.pasoValorAgregado?.descripcion || "—";

                    return (
                      <tr key={p.id}>
                        <td className="p-2 font-medium text-gray-700">{orden}</td>
                        <td className="p-2 text-gray-700">{desc}</td>
                        <td className="p-2 text-center">
                          {p.estado === "Completado" ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              Completado
                            </span>
                          ) : p.estado === "En Proceso" ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              En Proceso
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {!todosCompletos ? (
                            <>
                              {p.estado === "Pendiente" && puedeComenzar ? (
                                <button
                                  onClick={() => handleComenzarPaso(p.id)}
                                  disabled={saving}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-60"
                                >
                                  Comenzar
                                </button>
                              ) : null}

                              {p.estado === "Pendiente" && !puedeComenzar ? (
                                <span className="text-gray-400 text-xs italic">Esperando paso anterior</span>
                              ) : null}

                              {p.estado === "En Proceso" ? (
                                <button
                                  onClick={() => handleCompletarPaso(p.id)}
                                  disabled={saving}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
                                >
                                  Completar
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs">Finalizado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {pautaEnProceso && !tienePasos ? (
        <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
          <div className="font-semibold text-text">2) Sin pasos</div>
          <div className="text-sm text-gray-600 mt-2">
            Este PVA no tiene pasos. Continúa directamente a registrar salidas.
          </div>
        </div>
      ) : null}

      {puedeCompletar ? (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="font-semibold text-text">3) Registrar salidas</div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleAbrirCompletar}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
            >
              Registrar salidas
            </button>
          </div>
        </div>
      ) : pautaEnProceso ? (
        <div className="text-sm text-gray-500 italic">
          Completa los pasos para registrar salidas.
        </div>
      ) : null}

      <Dialog
        open={showCompletarModal}
        onClose={() => setShowCompletarModal(false)}
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
      >
        <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-2xl space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Completar Pauta
          </h2>

          {proceso?.genera_bultos_nuevos === false ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Confirma bultos de salida y ajusta el peso si cambió.
              </div>

              <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
                <div>
                  <strong>Resumen:</strong> {resumenSalida.bultosSalida}/{resumenSalida.totalBultos} bultos de salida
                </div>
                <div>
                  <strong>Peso total salida:</strong> {formatNumberCL(resumenSalida.pesoTotal, 2)} kg
                </div>
              </div>

              <div className="border border-gray-200 rounded">
                <button
                  type="button"
                  onClick={() => setBultosCollapsed((v) => !v)}
                  className="w-full px-3 py-2 text-left text-sm font-medium bg-gray-50 hover:bg-gray-100"
                >
                  {bultosCollapsed ? "▶" : "▼"} Bultos ({resumenSalida.totalBultos})
                </button>

                {!bultosCollapsed ? (
                  <div className="max-h-64 overflow-auto p-3 space-y-2">
                    {bultosSalida.map((r, idx) => (
                      <div key={r.id_bulto ?? idx} className="flex items-center gap-3">
                        <div
                          className="text-xs text-gray-600 w-64 whitespace-normal break-words"
                          title={String(r.identificador ?? r.id_bulto)}
                        >
                          {String(r.identificador ?? `#${r.id_bulto}`)}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          className="border rounded px-2 py-1 w-32 text-sm"
                          value={r.peso_unitario}
                          disabled={saving || r.eliminar}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBultosSalida((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, peso_unitario: val } : x))
                            );
                          }}
                        />
                        <div className="text-xs text-gray-500">kg</div>
                        <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(r.eliminar)}
                            disabled={saving}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBultosSalida((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, eliminar: checked } : x))
                              );
                            }}
                          />
                          Quitar (merma)
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fecha de vencimiento (opcional)
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
            </div>
          ) : (
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
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCompletarModal(false)}
              disabled={saving}
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
