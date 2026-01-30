import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { formatCLP } from "../../services/formatHelpers";
import ResumenOMOperario from "../../components/OM/ResumenOMOperario";
import { downloadBlob } from "../../lib/downloadBlob";

export default function ProduccionFinal() {
  const { id } = useParams();
  const navigate = useNavigate();

  const NO_EMPACAR_VALUE = "__NO_EMPACAR__";

  const [om, setOm] = useState(null);
  const [loadingOm, setLoadingOm] = useState(true);
  const [disponiblesByMp, setDisponiblesByMp] = useState({});
  const [empaqueByMp, setEmpaqueByMp] = useState({});
  const [formatoEmpaqueId, setFormatoEmpaqueId] = useState("");
  const [empaqueOpenByMp, setEmpaqueOpenByMp] = useState({});
  const [bultoInfoById, setBultoInfoById] = useState({});

  const [form, setForm] = useState({
    peso_obtenido: "",
    unidades_obtenidas: "",
    fecha_vencimiento: "",
  });

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [consumoInsumos, setConsumoInsumos] = useState([]);
  const [pesosPorUnidad, setPesosPorUnidad] = useState([]);
  const [pesosPorUnidadTocados, setPesosPorUnidadTocados] = useState(false);

  const setField = (k, v) => {
    setPreview(null);
    setForm((s) => ({ ...s, [k]: v }));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingOm(true);
        const [omData, consumoData] = await Promise.all([
          api(`/ordenes_manufactura/${id}`),
          api(`/registros-insumo-produccion?id_orden_manufactura=${id}`).catch(() => ({ registros: [] }))
        ]);
        if (!mounted) return;
        setOm(omData);
        setConsumoInsumos(consumoData.registros || []);
      } catch (err) {
        toast.error(err.message || "No se pudo cargar la OM.");
      } finally {
        if (mounted) setLoadingOm(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const esPT = Boolean(om?.receta?.id_producto_base);

  const pesoTotalNumber = useMemo(() => Number(form.peso_obtenido), [form.peso_obtenido]);
  const unidadesNumber = useMemo(() => Number(form.unidades_obtenidas), [form.unidades_obtenidas]);

  const resetPesosPorUnidad = () => {
    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);
    const pesoPromedio = unidades > 0 ? pesoTotal / unidades : 0;
    const arr = unidades > 0 ? Array(unidades).fill(pesoPromedio) : [];
    setPesosPorUnidad(arr);
    setPesosPorUnidadTocados(false);
  };

  useEffect(() => {
    // Para PIP: permitir ajustar pesos por unidad/bulto.
    // - Si cambian las unidades, ajusta largo.
    // - Si no han sido tocados, recalcula el promedio automáticamente.
    if (esPT) return;

    const unidades = Number(form.unidades_obtenidas);
    const pesoTotal = Number(form.peso_obtenido);

    if (!unidades || unidades < 1) {
      setPesosPorUnidad([]);
      setPesosPorUnidadTocados(false);
      return;
    }

    // Caso especial: 1 unidad => el peso de esa unidad debe ser el total.
    // Si veníamos de "Repartir igual" con N unidades, no se puede dejar el primer valor antiguo
    // (porque la UI oculta inputs y quedaría inconsistente con peso_obtenido).
    if (unidades === 1) {
      setPesosPorUnidad([Number.isFinite(pesoTotal) ? pesoTotal : 0]);
      setPesosPorUnidadTocados(false);
      return;
    }

    const pesoPromedio = pesoTotal > 0 ? pesoTotal / unidades : 0;

    setPesosPorUnidad((prev) => {
      const prevArr = Array.isArray(prev) ? prev.slice() : [];
      if (prevArr.length !== unidades) {
        // Si no han sido tocados (p.ej. venimos de "Repartir igual"), siempre recalcular.
        if (!pesosPorUnidadTocados) {
          return Array(unidades).fill(pesoPromedio);
        }

        // Si fueron tocados manualmente, preservamos lo que exista y completamos con promedio.
        return Array(unidades)
          .fill(null)
          .map((_, idx) => {
            const v = prevArr[idx];
            return typeof v === "number" && Number.isFinite(v) ? v : pesoPromedio;
          });
      }

      if (!pesosPorUnidadTocados) {
        return Array(unidades).fill(pesoPromedio);
      }

      return prevArr;
    });
  }, [esPT, form.unidades_obtenidas, form.peso_obtenido, pesosPorUnidadTocados]);

  const formatosEmpaqueAplicables = useMemo(() => {
    const formatos = om?.receta?.formatosEmpaque || [];
    if (!Array.isArray(formatos)) return [];
    return formatos
      .sort((a, b) => (a?.nombre || "").localeCompare(b?.nombre || ""));
  }, [om, esPT]);

  const hayCostosSecos = formatosEmpaqueAplicables.length > 0;

  const permiteNoEmpacar = useMemo(() => {
    if (esPT) return false;
    return formatosEmpaqueAplicables.some((f) => Boolean(f?.opcional));
  }, [esPT, formatosEmpaqueAplicables]);

  useEffect(() => {
    if (!hayCostosSecos) {
      setFormatoEmpaqueId("");
      return;
    }

    if (formatoEmpaqueId) return;
    if (formatosEmpaqueAplicables.length === 1) {
      setFormatoEmpaqueId(String(formatosEmpaqueAplicables[0].id));
    }
  }, [hayCostosSecos, formatosEmpaqueAplicables, formatoEmpaqueId]);

  const formatoEmpaqueSeleccionado = useMemo(() => {
    if (!formatoEmpaqueId) return null;
    return (
      formatosEmpaqueAplicables.find((f) => String(f?.id ?? "") === String(formatoEmpaqueId || "")) || null
    );
  }, [formatosEmpaqueAplicables, formatoEmpaqueId]);

  const insumosEmpaqueAplicables = useMemo(() => {
    if (!formatoEmpaqueSeleccionado) return [];
    const insumos = formatoEmpaqueSeleccionado?.insumos || [];
    if (!Array.isArray(insumos)) return [];
    return insumos.slice().sort((a, b) => (a?.nombre || "").localeCompare(b?.nombre || ""));
  }, [formatoEmpaqueSeleccionado]);

  const empaquesAplicables = useMemo(() => {
    return insumosEmpaqueAplicables;
  }, [insumosEmpaqueAplicables]);

  const nombreMp = useMemo(() => {
    const map = new Map();
    for (const mp of empaquesAplicables) {
      map.set(Number(mp.id), mp.nombre);
    }
    return (idMp) => map.get(Number(idMp)) || `MP #${idMp}`;
  }, [empaquesAplicables]);

  const unidadMp = useMemo(() => {
    const map = new Map();
    for (const mp of empaquesAplicables) {
      map.set(Number(mp.id), mp.unidad_medida || "");
    }
    return (idMp) => map.get(Number(idMp)) || "";
  }, [empaquesAplicables]);

  const bodegaId = om?.bodega?.id;

  const cargarDisponibles = async (mpId) => {
    if (!bodegaId) return toast.error("No se pudo determinar la bodega de la OM.");
    try {
      const bultos = await api(
        `/bultos/disponibles?id_bodega=${encodeURIComponent(bodegaId)}&id_materia_prima=${encodeURIComponent(mpId)}`
      );
      setDisponiblesByMp((s) => ({ ...s, [mpId]: bultos }));
      setBultoInfoById((prev) => {
        const next = { ...prev };
        for (const b of Array.isArray(bultos) ? bultos : []) {
          const bid = Number(b?.id);
          if (Number.isFinite(bid) && bid > 0) next[bid] = b;
        }
        return next;
      });
      return Array.isArray(bultos) ? bultos : [];
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar bultos disponibles.");
      return [];
    }
  };

  const setEmpaquePeso = (mpId, bultoId, peso) => {
    const val = peso === "" ? "" : Number(peso);
    if (val !== "" && (Number.isNaN(val) || val < 0)) return;

    setPreview(null);
    setEmpaqueByMp((prev) => {
      const current = prev[mpId] || {};
      return {
        ...prev,
        [mpId]: {
          ...current,
          [bultoId]: val,
        },
      };
    });
  };

  const parseNumber = (v) => {
    if (v == null) return NaN;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return NaN;
      return Number(s.replace(",", "."));
    }
    return Number(v);
  };

  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  const autoDistribuirSugerido = ({ disponibles, totalSugerido }) => {
    const list = Array.isArray(disponibles) ? disponibles : [];
    let remaining = Number(totalSugerido);
    if (!Number.isFinite(remaining) || remaining <= 0) return { allocation: {}, remaining: 0 };

    const allocation = {};

    for (const b of list) {
      const bId = Number(b?.id);
      if (!Number.isFinite(bId) || bId <= 0) continue;

      const max =
        Number(b?.unidades_disponibles || 0) * Number(b?.peso_unitario || 0);

      if (!Number.isFinite(max) || max <= 0) continue;

      const take = Math.min(remaining, max);
      if (take > 0) {
        allocation[bId] = round2(take);
        remaining -= take;
      }

      if (remaining <= 0) break;
    }

    return { allocation, remaining };
  };

  const buildPayload = () => {
    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);

    const noEmpacar = String(formatoEmpaqueId) === NO_EMPACAR_VALUE;

    const pesoPromedio = unidades > 0 ? pesoTotal / unidades : 0;
    const pesosCalculados = unidades > 0 ? Array(unidades).fill(pesoPromedio) : [];
    const pesosFinalRaw =
      !esPT && Array.isArray(pesosPorUnidad) && pesosPorUnidad.length === unidades
        ? pesosPorUnidad
        : pesosCalculados;
    const pesosFinal = Array.isArray(pesosFinalRaw) ? pesosFinalRaw.map((v) => Number(v)) : pesosCalculados;

    const allowedMpIds = new Set((empaquesAplicables || []).map((mp) => Number(mp?.id)).filter((x) => Number.isFinite(x)));

    return {
      id_formato_empaque: noEmpacar ? null : formatoEmpaqueId ? Number(formatoEmpaqueId) : null,
      peso_obtenido: pesoTotal,
      unidades_obtenidas: unidades,
      fecha_vencimiento: form.fecha_vencimiento,
      pesos: pesosFinal,
      empaques: noEmpacar
        ? []
        : Object.entries(empaqueByMp)
        .filter(([mpId]) => {
          if (allowedMpIds.size === 0) return true;
          return allowedMpIds.has(Number(mpId));
        })
        .map(([mpId, mapByBulto]) => {
          const bultos = Object.entries(mapByBulto || {})
            .map(([bultoId, peso_utilizado]) => ({
              id_bulto: Number(bultoId),
              peso_utilizado: Number(peso_utilizado),
            }))
            .filter((b) => b.id_bulto && b.peso_utilizado && b.peso_utilizado > 0);

          return {
            id_materia_prima: Number(mpId),
            bultos,
          };
        })
        .filter((x) => x.id_materia_prima && Array.isArray(x.bultos) && x.bultos.length > 0),
    };
  };

  const handlePreview = async () => {
    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);

    if (!unidades || unidades < 1) return toast.error("Indica al menos 1 unidad.");
    if (Number.isNaN(pesoTotal) || pesoTotal <= 0) return toast.error("Peso obtenido inválido.");
    if (!form.fecha_vencimiento) return toast.error("Ingresa la fecha de vencimiento.");

    if (!esPT && unidades > 1) {
      if (!Array.isArray(pesosPorUnidad) || pesosPorUnidad.length !== unidades) {
        return toast.error("Completa los pesos por bulto (una por unidad).");
      }
      const pesos = pesosPorUnidad.map((v) => Number(v));
      if (pesos.some((v) => !Number.isFinite(v) || v <= 0)) {
        return toast.error("Todos los pesos por bulto deben ser > 0.");
      }
      const suma = pesos.reduce((acc, v) => acc + v, 0);
      if (Math.abs(suma - pesoTotal) > 0.02) {
        return toast.error(
          `La suma de pesos por bulto (${suma.toFixed(2)} kg) debe coincidir con el peso obtenido (${pesoTotal.toFixed(2)} kg).`
        );
      }
    }

    const payload = buildPayload();

    const noEmpacar = String(formatoEmpaqueId) === NO_EMPACAR_VALUE;

    if (esPT) {
      if (!hayCostosSecos) {
        return toast.error("La receta no tiene Costos Secos configurados (Formatos de Empaque).");
      }
      if (!formatoEmpaqueId || noEmpacar) return toast.error("Selecciona un Formato de Empaque.");
      if (!Array.isArray(payload.empaques) || payload.empaques.length === 0) {
        return toast.error("Debes declarar al menos un empaque consumido.");
      }
    } else {
      if (!hayCostosSecos) {
        // PIP sin costos secos configurados: permitido.
      } else {
        if (!formatoEmpaqueId) {
          return toast.error(permiteNoEmpacar ? "Selecciona un Formato de Empaque o 'No empacar'." : "Selecciona un Formato de Empaque.");
        }
        if (noEmpacar) {
          // No empacar: permitido (solo cuando existe al menos un formato opcional).
          if (!permiteNoEmpacar) return toast.error("No empacar no está habilitado para esta receta.");
        } else {
          if (empaquesAplicables.length > 0 && (!Array.isArray(payload.empaques) || payload.empaques.length === 0)) {
            return toast.error("Debes declarar al menos un empaque consumido.");
          }
        }
      }
    }

    try {
      setLoadingPreview(true);
      const data = await api(`/ordenes_manufactura/${id}/registrar_preview`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPreview(data);
    } catch (err) {
      toast.error(err.message || "No se pudo previsualizar el cierre.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);

    if (!unidades || unidades < 1)
      return toast.error("Indica al menos 1 unidad.");
    if (Number.isNaN(pesoTotal) || pesoTotal <= 0)
      return toast.error("Peso obtenido inválido.");
    if (!form.fecha_vencimiento)
      return toast.error("Ingresa la fecha de vencimiento.");

    if (!esPT && unidades > 1) {
      if (!Array.isArray(pesosPorUnidad) || pesosPorUnidad.length !== unidades) {
        return toast.error("Completa los pesos por bulto (una por unidad).");
      }
      const pesos = pesosPorUnidad.map((v) => Number(v));
      if (pesos.some((v) => !Number.isFinite(v) || v <= 0)) {
        return toast.error("Todos los pesos por bulto deben ser > 0.");
      }
      const suma = pesos.reduce((acc, v) => acc + v, 0);
      if (Math.abs(suma - pesoTotal) > 0.02) {
        return toast.error(
          `La suma de pesos por bulto (${suma.toFixed(2)} kg) debe coincidir con el peso obtenido (${pesoTotal.toFixed(2)} kg).`
        );
      }
    }

    const payload = buildPayload();

    const noEmpacar = String(formatoEmpaqueId) === NO_EMPACAR_VALUE;

    if (esPT) {
      if (!hayCostosSecos) {
        return toast.error("La receta no tiene Costos Secos configurados (Formatos de Empaque).");
      }
      if (!formatoEmpaqueId || noEmpacar) return toast.error("Selecciona un Formato de Empaque.");
      if (!Array.isArray(payload.empaques) || payload.empaques.length === 0) {
        return toast.error("Debes declarar al menos un empaque consumido.");
      }
    } else {
      if (!hayCostosSecos) {
        // PIP sin costos secos configurados: permitido.
      } else {
        if (!formatoEmpaqueId) {
          return toast.error(permiteNoEmpacar ? "Selecciona un Formato de Empaque o 'No empacar'." : "Selecciona un Formato de Empaque.");
        }
        if (noEmpacar) {
          if (!permiteNoEmpacar) return toast.error("No empacar no está habilitado para esta receta.");
        } else {
          if (empaquesAplicables.length > 0 && (!Array.isArray(payload.empaques) || payload.empaques.length === 0)) {
            return toast.error("Debes declarar al menos un empaque consumido.");
          }
        }
      }
    }

    try {
      setLoading(true);
      const res = await api(`/ordenes_manufactura/${id}/registrar`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const bultoIds = Array.isArray(res?.bultos)
        ? res.bultos.map((b) => Number(b?.id)).filter((x) => Number.isFinite(x) && x > 0)
        : [];

      if (bultoIds.length > 0) {
        try {
          const blob = await apiBlob(`/bultos/etiquetas`, {
            method: "POST",
            body: JSON.stringify({ ids_bultos: bultoIds }),
          });
          downloadBlob(blob, `etiquetas_OM_${id}.pdf`);
        } catch (err) {
          toast.error(
            err?.message ||
              "La producción se registró, pero no se pudieron descargar las etiquetas."
          );
        }
      }

      navigate(`/Orden_de_Manufactura/${id}`);
    } catch (err) {
      toast.error(err.message || "Error al registrar la producción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Orden_de_Manufactura/${id}`} />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-text">Producción Final · OM #{id}</h1>
      </div>

      {/* Panel informativo de la OM */}
      {om && !loadingOm ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
            <div className="text-xs text-gray-500 font-medium">Receta</div>
            <div className="text-lg font-bold text-text">{om.receta?.nombre || "—"}</div>
            <div className="text-xs text-gray-600 mt-1">
              Costo ref: {formatCLP(om.receta?.costo_referencial_produccion, 2)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium">Peso Objetivo</div>
            <div className="text-lg font-bold text-text">{om.peso_objetivo || 0} kg</div>
            <div className="text-xs text-gray-600 mt-1">
              Costo OM: {formatCLP(om.costo_total, 0)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 font-medium">Ingredientes</div>
            <div className="text-lg font-bold text-text">{consumoInsumos.length}</div>
            <div className="text-xs text-gray-600 mt-1">
              {consumoInsumos.filter((r) => Number(r.peso_utilizado || 0) > 0).length} consumidos
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-xs text-gray-500 font-medium">Estado</div>
            <div className="text-lg font-bold text-text capitalize">{om.estado || "—"}</div>
            <div className="text-xs text-gray-600 mt-1">
              {om.elaboradorEncargado?.nombre || "Sin asignar"}
            </div>
          </div>
        </div>
      ) : null}

      {/* Panel de consumo de insumos esperado vs actual */}
      {!loadingOm && consumoInsumos.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-base font-semibold text-text mb-3">📊 Consumo de Ingredientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {consumoInsumos.slice(0, 6).map((insumo, idx) => {
              const pesoNecesario = Number(insumo.peso_necesario || 0);
              const pesoUtilizado = Number(insumo.peso_utilizado || 0);
              const porcentaje = pesoNecesario > 0 ? ((pesoUtilizado / pesoNecesario) * 100).toFixed(0) : 0;
              const estado = pesoUtilizado >= pesoNecesario * 0.99 ? "✓ OK" : pesoUtilizado > 0 ? "⚠ Parcial" : "○ Pendiente";
              const colorBarrra = pesoUtilizado >= pesoNecesario * 0.99 ? "bg-green-400" : pesoUtilizado > 0 ? "bg-yellow-400" : "bg-gray-300";
              const nombreIngrediente =
                insumo?.ingredienteReceta?.materiaPrima?.nombre ||
                insumo?.materiaPrima?.nombre ||
                insumo?.MateriaPrima?.nombre ||
                "—";

              return (
                <div key={idx} className="border border-border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-text">{nombreIngrediente}</span>
                    <span className={`text-xs font-bold ${pesoUtilizado >= pesoNecesario * 0.99 ? "text-green-600" : pesoUtilizado > 0 ? "text-yellow-600" : "text-gray-600"}`}>
                      {estado}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div className={`${colorBarrra} h-2 rounded-full`} style={{ width: `${Math.min(porcentaje, 100)}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>{pesoUtilizado.toFixed(2)} / {pesoNecesario.toFixed(2)} kg</span>
                    <span>{porcentaje}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          {consumoInsumos.length > 6 && (
            <div className="text-xs text-gray-500 mt-2 italic">y {consumoInsumos.length - 6} ingrediente(s) más…</div>
          )}
        </div>
      ) : null}

      <div className="bg-gray-200 p-4 rounded-lg">
        <div className="bg-white rounded-lg shadow p-6 w-full">
          <form onSubmit={handleSubmit} className="space-y-6">
        {loadingOm ? (
          <div className="text-sm text-gray-600">Cargando datos de la OM…</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">
                Peso obtenido (kg)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                value={form.peso_obtenido}
                onChange={(e) => setField("peso_obtenido", e.target.value)}
                placeholder="500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Unidades obtenidas
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                value={form.unidades_obtenidas}
                onChange={(e) => setField("unidades_obtenidas", e.target.value)}
                placeholder="5"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {esPT
                  ? "Se asignará automáticamente el peso promedio a cada unidad."
                  : "En PIP puedes ajustar el peso de cada bulto si obtuviste unidades desiguales."}
              </p>
            </div>

            {!esPT && unidadesNumber > 1 ? (
              <div className="border border-border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text">Pesos por bulto (PIP)</div>
                    <div className="text-xs text-gray-600">La suma debe coincidir con el peso obtenido.</div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100"
                    onClick={resetPesosPorUnidad}
                    disabled={!pesoTotalNumber || !unidadesNumber}
                  >
                    Repartir igual
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                  {Array.from({ length: unidadesNumber }).map((_, idx) => {
                    const val = pesosPorUnidad?.[idx] ?? "";
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-white border border-border rounded p-2">
                        <div className="w-10 text-sm font-semibold text-gray-700">#{idx + 1}</div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="flex-1 border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          value={val}
                          onChange={(e) => {
                            const nextVal = e.target.value === "" ? "" : Number(e.target.value);
                            if (nextVal !== "" && (Number.isNaN(nextVal) || nextVal < 0)) return;
                            setPreview(null);
                            setPesosPorUnidadTocados(true);
                            setPesosPorUnidad((prev) => {
                              const arr = Array.isArray(prev) ? prev.slice() : Array(unidadesNumber).fill(0);
                              arr[idx] = nextVal === "" ? "" : nextVal;
                              return arr;
                            });
                          }}
                          placeholder="kg"
                        />
                        <div className="w-10 text-xs text-gray-500 text-right">kg</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 text-xs text-gray-700">
                  {(() => {
                    const pesos = Array.isArray(pesosPorUnidad) ? pesosPorUnidad.map((v) => Number(v)) : [];
                    const suma = pesos.every((v) => Number.isFinite(v)) ? pesos.reduce((a, b) => a + b, 0) : NaN;
                    if (!Number.isFinite(pesoTotalNumber) || !Number.isFinite(suma)) return null;
                    const diff = suma - pesoTotalNumber;
                    const ok = Math.abs(diff) <= 0.02;
                    return (
                      <div className={ok ? "text-green-700" : "text-red-700"}>
                        Suma: <span className="font-semibold">{suma.toFixed(2)} kg</span> · Objetivo:{" "}
                        <span className="font-semibold">{pesoTotalNumber.toFixed(2)} kg</span>
                        {!ok ? <span className="font-semibold"> · Diferencia: {diff.toFixed(2)} kg</span> : null}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                value={form.fecha_vencimiento}
                onChange={(e) => setField("fecha_vencimiento", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">Costos secos</h2>
              <div className="text-xs text-gray-500">
                {esPT ? "PT: se consume al empacar" : "PIP: se consume al almacenar"}
              </div>
            </div>

            {formatosEmpaqueAplicables.length > 0 ? (
              <div className="bg-white border border-border rounded-lg p-3">
                <div className="grid grid-cols-1 gap-3 items-end">
                  <div>
                  <label className="block text-xs text-gray-600 mb-1">Formato de Empaque</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                    value={formatoEmpaqueId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPreview(null);
                      setFormatoEmpaqueId(next);
                      setDisponiblesByMp({});
                      setEmpaqueByMp({});
                      setEmpaqueOpenByMp({});
                    }}
                  >
                    <option value="">Seleccionar</option>
                    {!esPT && permiteNoEmpacar ? (
                      <option value={NO_EMPACAR_VALUE}>No empacar (generar bulto igual)</option>
                    ) : null}
                    {formatosEmpaqueAplicables.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                  </div>

                  <div className="text-xs text-gray-600">
                  {String(formatoEmpaqueId) === NO_EMPACAR_VALUE ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <div className="font-semibold text-yellow-800">No empacar</div>
                      <div className="text-yellow-800">
                        Se registrará la salida y se generará el bulto/QR del PIP, pero no se consumirán costos secos.
                        Podrás usar este bulto en una nueva producción.
                      </div>
                    </div>
                  ) : formatoEmpaqueSeleccionado?.descripcion ? (
                    <div>
                      <span className="font-semibold">Descripción:</span> {formatoEmpaqueSeleccionado.descripcion}
                    </div>
                  ) : (
                    <div>Selecciona un formato para ver sus insumos.</div>
                  )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                {esPT
                  ? "Esta receta no tiene Costos Secos configurados (Formatos de Empaque). Configúralos antes de cerrar."
                  : "Esta receta no tiene Costos Secos configurados (Formatos de Empaque)."}
              </p>
            )}

            {formatosEmpaqueAplicables.length > 0 && !formatoEmpaqueSeleccionado && String(formatoEmpaqueId) !== NO_EMPACAR_VALUE ? (
              <p className="text-sm text-gray-600">Selecciona un formato para habilitar el consumo de empaques.</p>
            ) : null}

            {formatosEmpaqueAplicables.length > 0 && formatoEmpaqueSeleccionado && empaquesAplicables.length === 0 ? (
              <p className="text-sm text-gray-600">
                Este formato no tiene insumos. {esPT ? "No podrás cerrar PT sin declarar consumos." : "Puedes cerrar PIP sin consumos."}
              </p>
            ) : null}

            {String(formatoEmpaqueId) !== NO_EMPACAR_VALUE ? (
              <div className="space-y-3">
                {empaquesAplicables.map((mp) => {
                  const mpId = mp.id;
                  const disponibles = disponiblesByMp[mpId];
                  const throughFormatoRaw =
                    mp?.FormatoEmpaqueInsumo ??
                    mp?.FormatoEmpaqueInsumos ??
                    mp?.formatoEmpaqueInsumo ??
                    mp?.formatoEmpaqueInsumos ??
                    null;

                  const throughFormato = Array.isArray(throughFormatoRaw)
                    ? (throughFormatoRaw[0] ?? null)
                    : throughFormatoRaw;
                  const requeridoFormato = !Boolean(throughFormato?.opcional);
                  const sugeridoPorUnidad = parseNumber(
                    throughFormato?.cantidad_sugerida_por_unidad ?? mp?.cantidad_sugerida_por_unidad
                  );
                  const totalSugerido =
                    Number.isFinite(sugeridoPorUnidad) && unidadesNumber > 0
                      ? Number(sugeridoPorUnidad) * Number(unidadesNumber)
                      : null;

                  const assignedEntries = Object.entries(empaqueByMp?.[mpId] || {})
                    .map(([bultoId, peso]) => ({ id_bulto: Number(bultoId), peso_utilizado: Number(peso) }))
                    .filter(
                      (x) =>
                        Number.isFinite(x.id_bulto) &&
                        x.id_bulto > 0 &&
                        Number.isFinite(x.peso_utilizado) &&
                        x.peso_utilizado > 0
                    );

                  const totalAsignado = assignedEntries.reduce((acc, a) => acc + Number(a.peso_utilizado || 0), 0);

                  const isOpen = Boolean(empaqueOpenByMp?.[mpId]);

                  return (
                    <div key={mpId} className="border border-border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-text">{mp.nombre}</div>
                          <div className="text-xs text-gray-500">
                            {Number.isFinite(sugeridoPorUnidad)
                              ? unidadesNumber > 0
                                ? `Cantidad sugerida: ${Number(totalSugerido)} ${mp.unidad_medida || ""}`
                                : `Sugerido/unidad: ${Number(sugeridoPorUnidad)} ${mp.unidad_medida || ""} (ingresa Unidades obtenidas para ver total)`
                              : `Sugerido/unidad: —`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <button
                              type="button"
                              className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100"
                              onClick={() => setEmpaqueOpenByMp((s) => ({ ...s, [mpId]: false }))}
                            >
                              Listo
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100"
                              onClick={async () => {
                                setEmpaqueOpenByMp((s) => ({ ...s, [mpId]: true }));
                                if (!Array.isArray(disponiblesByMp?.[mpId])) await cargarDisponibles(mpId);
                              }}
                              disabled={!bodegaId}
                            >
                              {assignedEntries.length > 0 ? "Editar" : "Asignar"}
                            </button>
                          )}
                        </div>
                      </div>

                      {assignedEntries.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-gray-600">
                            Asignado · Total: {Number(totalAsignado || 0).toFixed(2)} {mp.unidad_medida || ""}
                          </div>
                          {assignedEntries.map((a) => {
                            const info = bultoInfoById?.[a.id_bulto];
                            return (
                              <div
                                key={a.id_bulto}
                                className="flex items-center justify-between gap-3 bg-white border border-border rounded p-2"
                              >
                                <div>
                                  <div className="text-sm font-medium">{info?.identificador || `#${a.id_bulto}`}</div>
                                  <div className="text-xs text-gray-500">
                                    Consumir: {Number(a.peso_utilizado || 0).toFixed(2)} {mp.unidad_medida || ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100"
                                  onClick={() => {
                                    setPreview(null);
                                    setEmpaqueByMp((prev) => {
                                      const current = { ...(prev?.[mpId] || {}) };
                                      delete current[a.id_bulto];
                                      return { ...prev, [mpId]: current };
                                    });
                                  }}
                                >
                                  Quitar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-600">Sin asignación.</div>
                      )}

                      {isOpen ? (
                        <div className="mt-3 space-y-2">
                          {!Array.isArray(disponibles) ? (
                            <div className="text-sm text-gray-600">Cargando bultos…</div>
                          ) : disponibles.length === 0 ? (
                            <div className="text-sm text-gray-600">Sin bultos disponibles para este empaque.</div>
                          ) : (
                            disponibles.map((b) => {
                              const maxPeso = (
                                Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0)
                              ).toFixed(2);
                              const current = empaqueByMp?.[mpId]?.[b.id] ?? "";
                              return (
                                <div key={b.id} className="flex items-center gap-3 bg-white border border-border rounded p-2">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{b.identificador || `#${b.id}`}</div>
                                    <div className="text-xs text-gray-500">
                                      Disponible: {maxPeso} {mp.unidad_medida || ""}
                                    </div>
                                  </div>
                                  <div className="w-36">
                                    <label className="block text-xs text-gray-600 mb-1">Consumir</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                      value={current}
                                      onChange={(e) => setEmpaquePeso(mpId, b.id, e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

          </div>
        </div>

          {preview ? (
            <div className="border-t border-border pt-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-base font-semibold text-text mb-3">Previsualización del cierre</h2>

              {Array.isArray(preview.advertencias) && preview.advertencias.length > 0 ? (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="text-sm font-semibold text-yellow-800">Advertencias</div>
                  <ul className="mt-1 text-sm text-yellow-800 list-disc pl-5">
                    {preview.advertencias.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              
              {/* Métricas principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo OM</div>
                  <div className="text-lg font-bold text-text">{formatCLP(preview.costo_total_om_actual, 0)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Empaques</div>
                  <div className="text-lg font-bold text-text">{formatCLP(preview.costo_empaques_estimado, 0)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Indirectos</div>
                  <div className="text-lg font-bold text-text">{formatCLP(preview?.costos_indirectos_estimado?.costo_indirecto_total, 0)}</div>
                  <div className="text-[11px] text-gray-600 mt-1">
                    {formatCLP(preview?.costos_indirectos_estimado?.costo_indirecto_por_kg, 4)}/kg · Base: {Number(preview?.costos_indirectos_estimado?.peso_aplicado || 0).toFixed(2)} kg
                  </div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo Total</div>
                  <div className="text-lg font-bold text-green-600">{formatCLP(preview.costo_total_estimado, 0)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo/kg</div>
                  <div className="text-lg font-bold text-text">{formatCLP(preview.costo_por_kg_estimado, 2)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Peso objetivo</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_objetivo || 0).toFixed(2)} kg</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Salida para rendimiento</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_total_salida_rendimiento || 0).toFixed(2)} kg</div>
                </div>
              </div>

              {Array.isArray(preview?.costos_indirectos_estimado?.detalle) && preview.costos_indirectos_estimado.detalle.length > 0 ? (
                <div className="mb-4 bg-white border border-blue-200 rounded p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">Detalle de costos indirectos</div>
                    <div className="text-xs text-gray-700">
                      Total: <span className="font-semibold">{formatCLP(preview.costos_indirectos_estimado.costo_indirecto_total, 0)}</span>
                    </div>
                  </div>

                  <div className="mt-2 overflow-x-auto border border-border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2">Costo</th>
                          <th className="text-left p-2">$/kg</th>
                          <th className="text-left p-2">Kg aplicado</th>
                          <th className="text-left p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.costos_indirectos_estimado.detalle.map((ci, idx) => (
                          <tr key={ci?.id ?? idx} className="border-t border-border">
                            <td className="p-2">{ci?.nombre || "Costo indirecto"}</td>
                            <td className="p-2">{formatCLP(ci?.costo_por_kg, 2)}</td>
                            <td className="p-2">{Number(ci?.peso_aplicado || 0).toFixed(2)}</td>
                            <td className="p-2">{formatCLP(ci?.costo_total, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* Rendimiento y Merma */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white border border-orange-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Merma estimada</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_merma_estimado || 0).toFixed(2)} kg</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {Number(preview.peso_objetivo || 0) > 0 
                      ? `${((Number(preview.peso_merma_estimado || 0) / Number(preview.peso_objetivo || 1)) * 100).toFixed(1)}% del objetivo`
                      : "N/A"}
                  </div>
                </div>
                <div className="bg-white border border-green-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Rendimiento</div>
                  <div className="text-lg font-bold text-text">
                    {preview.rendimiento_peso_estimado == null ? "N/A" : `${(Number(preview.rendimiento_peso_estimado) * 100).toFixed(2)}%`}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Buen rango: 90-110%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-3 mb-4">
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Subproductos</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_subproductos || 0).toFixed(2)} kg</div>
                </div>
              </div>

              {/* Salida: cajas o bultos */}
              <div className="bg-white border border-blue-200 rounded p-3">
                <div className="text-xs text-gray-500 font-medium mb-2">
                  {preview.es_pt ? "Cajas de PT a crear" : "Bultos de PIP a crear"}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {Array.isArray(preview.items_salida) ? preview.items_salida.length : 0}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {preview.es_pt 
                    ? `Se crearán ${preview.items_salida?.length || 0} caja(s) de Producto Terminado`
                    : `Se crearán ${preview.items_salida?.length || 0} bulto(s) de Producto en Proceso`}
                </div>

                {preview?.resumen_salida?.tipo === "PT" ? (
                  <div className="text-xs text-gray-700 mt-2">
                    Unid/caja: <span className="font-semibold">{preview.resumen_salida.unidades_por_caja}</span> · Abiertas: <span className="font-semibold">{preview.resumen_salida.total_cajas_abiertas}</span>
                  </div>
                ) : null}
              </div>

              {Array.isArray(preview.items_salida) && preview.items_salida.length > 0 ? (
                <div className="mt-4 bg-white border border-blue-200 rounded p-3">
                  <div className="text-sm font-semibold text-text mb-2">Detalle de salida</div>
                  <div className="overflow-x-auto border border-border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2">Tipo</th>
                          <th className="text-left p-2">Unidades</th>
                          <th className="text-left p-2">Peso (kg)</th>
                          <th className="text-left p-2">Costo</th>
                          <th className="text-left p-2">Rango</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items_salida.map((it, idx) => (
                          <tr key={idx} className="border-t border-border">
                            <td className="p-2">
                              {it.tipo === "CAJA_PT" ? (
                                <span className={it.caja_abierta ? "text-yellow-700 font-semibold" : ""}>
                                  CAJA PT{it.caja_abierta ? " (ABIERTA)" : ""}
                                </span>
                              ) : (
                                "BULTO PIP"
                              )}
                            </td>
                            <td className="p-2">{Number(it.cantidad_unidades || 0)}</td>
                            <td className="p-2">{Number(it.peso_unitario || 0).toFixed(3)}</td>
                            <td className="p-2">{formatCLP(it.costo_unitario, 2)}</td>
                            <td className="p-2">
                              {it.tipo === "CAJA_PT" ? `${it.rango?.nro_inicio ?? "?"}-${it.rango?.nro_fin ?? "?"}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {Array.isArray(preview.detalle_empaques) && preview.detalle_empaques.length > 0 ? (
                <div className="mt-4 bg-white border border-blue-200 rounded p-3">
                  <div className="text-sm font-semibold text-text mb-2">Detalle de empaques</div>
                  <div className="space-y-3">
                    {preview.detalle_empaques.map((emp) => (
                      <div key={emp.id_materia_prima} className="border border-border rounded p-3">
                        {(() => {
                          const unidad = unidadMp(emp.id_materia_prima);
                          return (
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{nombreMp(emp.id_materia_prima)}</div>
                          <div className="text-xs text-gray-700">
                            Utilizado: <span className="font-semibold">{Number(emp.peso_total_utilizado || 0).toFixed(3)} {unidad}</span> · Costo Total: <span className="font-semibold">{formatCLP(emp.costo_total_estimado, 0)}</span>
                          </div>
                        </div>

                          );
                        })()}

                        <div className="mt-2 overflow-x-auto border border-border rounded">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left p-2">Bulto</th>
                                <th className="text-left p-2">Utilizado</th>
                                <th className="text-left p-2">Disponible</th>
                                <th className="text-left p-2">Unidad de Medida</th>
                                <th className="text-left p-2">Costo unitario</th>
                                <th className="text-left p-2">Costo Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(emp.bultos || []).map((b) => (
                                <tr key={b.id_bulto} className="border-t border-border">
                                  <td className="p-2">{b.identificador || `#${b.id_bulto}`}</td>
                                  <td className="p-2">{Number(b.peso_utilizado || 0).toFixed(3)}</td>
                                  <td className="p-2">{Number(b.peso_disponible || 0).toFixed(3)}</td>
                                  <td className="p-2">{unidadMp(emp.id_materia_prima)}</td>
                                  <td className="p-2">{formatCLP(b.costo_unitario, 2)}</td>
                                  <td className="p-2">{formatCLP(b.costo_estimado, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-700 font-medium">
                Revisión completada. Presiona "Registrar Producción" para confirmar.
              </div>
            </div>
          ) : null}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || loadingPreview}
            className="px-4 py-2 bg-white border border-border rounded hover:bg-gray-100 disabled:opacity-60"
            onClick={handlePreview}
          >
            {loadingPreview ? "Previsualizando…" : "Previsualizar"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-hover disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Registrar Producción"}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );
}