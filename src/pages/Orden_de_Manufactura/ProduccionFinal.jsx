import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";
import ResumenOMOperario from "../../components/OM/ResumenOMOperario";
import { downloadBlob } from "../../lib/downloadBlob";

export default function ProduccionFinal() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [om, setOm] = useState(null);
  const [loadingOm, setLoadingOm] = useState(true);
  const [disponiblesByMp, setDisponiblesByMp] = useState({});
  const [empaqueByMp, setEmpaqueByMp] = useState({});

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
    if (!unidades || unidades < 1) {
      setPesosPorUnidad([]);
      setPesosPorUnidadTocados(false);
      return;
    }

    const pesoTotal = Number(form.peso_obtenido);
    const pesoPromedio = pesoTotal > 0 ? pesoTotal / unidades : 0;

    setPesosPorUnidad((prev) => {
      const prevArr = Array.isArray(prev) ? prev.slice() : [];
      if (prevArr.length !== unidades) {
        const next = Array(unidades)
          .fill(null)
          .map((_, idx) => {
            const v = prevArr[idx];
            return typeof v === "number" && Number.isFinite(v) ? v : pesoPromedio;
          });
        return next;
      }

      if (!pesosPorUnidadTocados) {
        return Array(unidades).fill(pesoPromedio);
      }

      return prevArr;
    });
  }, [esPT, form.unidades_obtenidas, form.peso_obtenido, pesosPorUnidadTocados]);

  const costosSecosAplicables = useMemo(() => {
    const costos = om?.receta?.costosSecos || [];
    if (!Array.isArray(costos)) return [];
    const modo = esPT ? "PT_EMPACAR" : "PIP_ALMACENAR";

    return costos
      .filter((mp) => {
        const aplicaEn = mp?.RecetaCostoSeco?.aplica_en || "AMBOS";
        return aplicaEn === "AMBOS" || aplicaEn === modo;
      })
      .sort((a, b) => (a?.nombre || "").localeCompare(b?.nombre || ""));
  }, [om, esPT]);

  const nombreMp = useMemo(() => {
    const map = new Map();
    for (const mp of costosSecosAplicables) {
      map.set(Number(mp.id), mp.nombre);
    }
    return (idMp) => map.get(Number(idMp)) || `MP #${idMp}`;
  }, [costosSecosAplicables]);

  const bodegaId = om?.bodega?.id;

  const cargarDisponibles = async (mpId) => {
    if (!bodegaId) return toast.error("No se pudo determinar la bodega de la OM.");
    try {
      const bultos = await api(
        `/bultos/disponibles?id_bodega=${encodeURIComponent(bodegaId)}&id_materia_prima=${encodeURIComponent(mpId)}`
      );
      setDisponiblesByMp((s) => ({ ...s, [mpId]: bultos }));
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar bultos disponibles.");
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

  const buildPayload = () => {
    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);

    const pesoPromedio = unidades > 0 ? pesoTotal / unidades : 0;
    const pesosCalculados = unidades > 0 ? Array(unidades).fill(pesoPromedio) : [];
    const pesosFinalRaw =
      !esPT && Array.isArray(pesosPorUnidad) && pesosPorUnidad.length === unidades
        ? pesosPorUnidad
        : pesosCalculados;
    const pesosFinal = Array.isArray(pesosFinalRaw) ? pesosFinalRaw.map((v) => Number(v)) : pesosCalculados;

    return {
      peso_obtenido: pesoTotal,
      unidades_obtenidas: unidades,
      fecha_vencimiento: form.fecha_vencimiento,
      pesos: pesosFinal,
      empaques: Object.entries(empaqueByMp)
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

    try {
      setLoadingPreview(true);
      const data = await api(`/ordenes_manufactura/${id}/registrar_preview`, {
        method: "POST",
        body: JSON.stringify(buildPayload()),
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
              Costo ref: ${Number(om.receta?.costo_referencial_produccion || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium">Peso Objetivo</div>
            <div className="text-lg font-bold text-text">{om.peso_objetivo || 0} kg</div>
            <div className="text-xs text-gray-600 mt-1">
              Costo OM: ${Number(om.costo_total || 0).toFixed(2)}
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
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
        {loadingOm ? (
          <div className="text-sm text-gray-600">Cargando datos de la OM…</div>
        ) : null}

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
                <div className="text-xs text-gray-600">
                  La suma debe coincidir con el peso obtenido.
                </div>
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
                    Suma: <span className="font-semibold">{suma.toFixed(2)} kg</span> · Objetivo: <span className="font-semibold">{pesoTotalNumber.toFixed(2)} kg</span>
                    {!ok ? (
                      <span className="font-semibold"> · Diferencia: {diff.toFixed(2)} kg</span>
                    ) : null}
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

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text">
              Empaque / costos secos (opcional)
            </h2>
            <div className="text-xs text-gray-500">
              {esPT ? "PT: se consume al empacar" : "PIP: se consume al almacenar"}
            </div>
          </div>

          {!loadingOm && costosSecosAplicables.length === 0 ? (
            <p className="text-sm text-gray-600 mt-2">
              No hay costos secos sugeridos en la receta. Puedes cerrar la OM sin empaque.
            </p>
          ) : null}

          <div className="space-y-3 mt-3">
            {costosSecosAplicables.map((mp) => {
              const mpId = mp.id;
              const disponibles = disponiblesByMp[mpId];
              return (
                <div key={mpId} className="border border-border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-text">{mp.nombre}</div>
                      <div className="text-xs text-gray-500">
                        UM: {mp.unidad_medida || "N/A"}
                        {mp?.RecetaCostoSeco?.cantidad_sugerida_por_kg
                          ? ` · Sug: ${mp.RecetaCostoSeco.cantidad_sugerida_por_kg}/kg`
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100"
                      onClick={() => cargarDisponibles(mpId)}
                      disabled={!bodegaId}
                    >
                      Ver bultos
                    </button>
                  </div>

                  {Array.isArray(disponibles) ? (
                    <div className="mt-3 space-y-2">
                      {disponibles.length === 0 ? (
                        <div className="text-sm text-gray-600">Sin bultos disponibles para este empaque.</div>
                      ) : (
                        disponibles.map((b) => {
                          const maxPeso = (Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0)).toFixed(2);
                          const current = empaqueByMp?.[mpId]?.[b.id] ?? "";
                          return (
                            <div key={b.id} className="flex items-center gap-3 bg-white border border-border rounded p-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium">{b.identificador || `#${b.id}`}</div>
                                <div className="text-xs text-gray-500">
                                  Disp: {maxPeso} · PU: {Number(b.peso_unitario || 0).toFixed(2)} · CU: {Number(b.costo_unitario || 0).toFixed(2)}
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
                  ) : (
                    <div className="mt-2 text-sm text-gray-600">
                      Presiona “Ver bultos” para seleccionar consumo.
                    </div>
                  )}
                </div>
              );
            })}
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
                  <div className="text-lg font-bold text-text">${Number(preview.costo_total_om_actual || 0).toFixed(2)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Empaques</div>
                  <div className="text-lg font-bold text-text">${Number(preview.costo_empaques_estimado || 0).toFixed(2)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo Total</div>
                  <div className="text-lg font-bold text-green-600">${Number(preview.costo_total_estimado || 0).toFixed(2)}</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Costo/kg</div>
                  <div className="text-lg font-bold text-text">${Number(preview.costo_por_kg_estimado || 0).toFixed(4)}</div>
                </div>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Peso objetivo</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_objetivo || 0).toFixed(2)} kg</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Subproductos (kg)</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_subproductos || 0).toFixed(2)} kg</div>
                </div>
                <div className="bg-white border border-blue-200 rounded p-3">
                  <div className="text-xs text-gray-500 font-medium">Salida para rendimiento</div>
                  <div className="text-lg font-bold text-text">{Number(preview.peso_total_salida_rendimiento || 0).toFixed(2)} kg</div>
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
                            <td className="p-2">{Number(it.costo_unitario || 0).toFixed(2)}</td>
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
                  <div className="text-sm font-semibold text-text mb-2">Detalle de empaques / costos secos</div>
                  <div className="space-y-3">
                    {preview.detalle_empaques.map((emp) => (
                      <div key={emp.id_materia_prima} className="border border-border rounded p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{nombreMp(emp.id_materia_prima)}</div>
                          <div className="text-xs text-gray-700">
                            Peso: <span className="font-semibold">{Number(emp.peso_total_utilizado || 0).toFixed(3)} kg</span> · Costo: <span className="font-semibold">${Number(emp.costo_total_estimado || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="mt-2 overflow-x-auto border border-border rounded">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left p-2">Bulto</th>
                                <th className="text-left p-2">Solicitado (kg)</th>
                                <th className="text-left p-2">Disponible (kg)</th>
                                <th className="text-left p-2">PU (kg/un)</th>
                                <th className="text-left p-2">CU</th>
                                <th className="text-left p-2">Costo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(emp.bultos || []).map((b) => (
                                <tr key={b.id_bulto} className="border-t border-border">
                                  <td className="p-2">{b.identificador || `#${b.id_bulto}`}</td>
                                  <td className="p-2">{Number(b.peso_utilizado || 0).toFixed(3)}</td>
                                  <td className="p-2">{Number(b.peso_disponible || 0).toFixed(3)}</td>
                                  <td className="p-2">{Number(b.peso_unitario || 0).toFixed(3)}</td>
                                  <td className="p-2">{Number(b.costo_unitario || 0).toFixed(2)}</td>
                                  <td className="p-2">{Number(b.costo_estimado || 0).toFixed(2)}</td>
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
        </div>

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