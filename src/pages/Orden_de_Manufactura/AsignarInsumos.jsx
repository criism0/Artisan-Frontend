import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import { BackButton } from "../../components/Buttons/ActionButtons";

const formatDecimal = (num) => {
  const numValue = Number(num);
  if (isNaN(numValue)) return num;

  if (numValue === 0) return 0;

  const str = numValue.toString();
  if (str.includes('e') || str.includes('E')) {
    return numValue;
  }

  const parts = str.split('.');
  if (parts.length === 1) return numValue;

  const decimalPart = parts[1] || '';
  const firstNonZeroIndex = decimalPart.search(/[1-9]/);

  if (firstNonZeroIndex === -1) return 0;

  if (firstNonZeroIndex <= 1) {
    return Number(numValue.toFixed(3));
  }
  return numValue;
};

const mostrarNumeroExacto = (num) => {
  const numValue = Number(num);
  if (isNaN(numValue)) return String(num);
  
  if (numValue % 1 === 0) return String(numValue);
  
  const str = numValue.toString();
  
  if (str.includes('e') || str.includes('E')) {
    return str;
  }
  
  return str;
};

export default function AsignarInsumos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [insumos, setInsumos] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [orden, setOrden] = useState(null);
  const [bultosPorInsumo, setBultosPorInsumo] = useState({});
  const [insumosAsignados, setInsumosAsignados] = useState(new Set());

  // Para ingredientes variables: MP seleccionada para filtrar bultos visibles
  const [mpSeleccionadaPorRegistro, setMpSeleccionadaPorRegistro] = useState({});

  const buildAllowedMateriaPrimas = (insumo) => {
    const preferida = insumo?.ingredienteReceta?.materiaPrima || null;
    const equivalentes = Array.isArray(insumo?.ingredienteReceta?.materiasPrimasEquivalentes)
      ? insumo.ingredienteReceta.materiasPrimasEquivalentes
      : [];

    const byId = new Map();
    for (const mp of [preferida, ...equivalentes].filter(Boolean)) {
      const idMp = Number(mp?.id);
      if (!Number.isFinite(idMp)) continue;
      byId.set(idMp, mp);
    }
    return Array.from(byId.values());
  };

  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState(null); // { registroId, bulto, unidadMedida, pesoUtilizado, unidades }

  // null = aún no verificado; true/false = verificado
  const [hasPasos, setHasPasos] = useState(null);
  const [noPasosConfirmOpen, setNoPasosConfirmOpen] = useState(false);
  const [noPasosConfirmTitle, setNoPasosConfirmTitle] = useState("");
  const [noPasosConfirmDescription, setNoPasosConfirmDescription] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const parsePasosResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.pasos)) return data.pasos;
    if (Array.isArray(data?.registros)) return data.registros;
    return [];
  };

  const ensureHasPasos = useCallback(async () => {
    if (hasPasos !== null) return hasPasos;

    try {
      const pasosRes = await api(`/registro-paso-produccion/${id}/pasos`, { method: "GET" });
      const pasos = parsePasosResponse(pasosRes);
      const computed = pasos.length > 0;
      setHasPasos(computed);
      return computed;
    } catch {
      // Si no podemos validar, preferimos ser conservadores y pedir confirmación.
      setHasPasos(false);
      return false;
    }
  }, [api, hasPasos, id]);

  const cargarInsumosYBultos = async () => {
    const [resInsumos, resOrden] = await Promise.all([
      api(`/registros-insumo-produccion?id_orden_manufactura=${id}`, {
        method: "GET",
      }),
      api(`/ordenes_manufactura/${id}`, {
        method: "GET",
      }),
    ]);

    setInsumos(resInsumos.registros);
    setOrden(resOrden);

    const bodega = resOrden.bodega?.id ?? resOrden.id_bodega;

    const bultosMap = {};
    for (const insumo of resInsumos.registros) {
      const allowedMPs = buildAllowedMateriaPrimas(insumo);
      const allowedIds = allowedMPs.map((mp) => Number(mp.id)).filter(Number.isFinite);
      if (allowedIds.length === 0) continue;

      try {
        const resBultos = await api(
          `/bultos/disponibles?id_bodega=${bodega}&id_materia_prima=${allowedIds.join(",")}`,
          { method: "GET" }
        );
        bultosMap[insumo.id] = Array.isArray(resBultos)
          ? resBultos
          : resBultos.bultos || [];
      } catch {
        bultosMap[insumo.id] = [];
      }
    }

    setBultosPorInsumo(bultosMap);

    // Inicializar/normalizar selección de MP por registro (preferida por defecto)
    setMpSeleccionadaPorRegistro((prev) => {
      const next = { ...prev };
      for (const insumo of resInsumos.registros) {
        const allowed = buildAllowedMateriaPrimas(insumo);
        if (allowed.length <= 1) {
          delete next[insumo.id];
          continue;
        }

        const preferida = insumo?.ingredienteReceta?.materiaPrima || null;
        const allowedIds = allowed.map((m) => Number(m.id)).filter(Number.isFinite);
        const current = Number(next[insumo.id]);
        if (Number.isFinite(current) && allowedIds.includes(current)) {
          continue;
        }

        const fallback = preferida?.id != null ? Number(preferida.id) : allowedIds[0];
        if (fallback != null) {
          next[insumo.id] = fallback;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await cargarInsumosYBultos();

        // Prefetch (no bloqueante) del estado de pasos para minimizar latencia al asignar.
        void ensureHasPasos();
      } catch {
        alert("No se pudieron cargar los datos");
      }
    };

    fetchData();
  }, [id, ensureHasPasos]);

  const closeNoPasosConfirm = () => {
    setNoPasosConfirmOpen(false);
    setNoPasosConfirmTitle("");
    setNoPasosConfirmDescription("");
    setPendingAction(null);
  };

  const runWithNoPasosConfirmation = async (action, label) => {
    const computedHasPasos = await ensureHasPasos();
    if (computedHasPasos) {
      await action();
      return;
    }

    setNoPasosConfirmTitle("Esta receta no tiene pasos");
    setNoPasosConfirmDescription(
      `Al ${label}, la OM avanzará automáticamente a "Esperando salidas".\n\n` +
        `¿Deseas continuar? Si necesitas revertir asignaciones, es mejor cancelar y revisar antes.`
    );
    setPendingAction(() => action);
    setNoPasosConfirmOpen(true);
  };

  const handlePesoChange = (registroId, bultoId, peso) => {
    setAsignaciones((prev) => {
      const actuales = prev[registroId] || [];
      const yaExiste = actuales.find((b) => b.id_bulto === bultoId);

      let nuevos;
      if (yaExiste) {
        nuevos = actuales.map((b) =>
          b.id_bulto === bultoId ? { ...b, peso_utilizado: peso } : b
        );
      } else {
        nuevos = [
          ...actuales,
          { id_bulto: bultoId, peso_utilizado: peso },
        ];
      }

      return { ...prev, [registroId]: nuevos };
    });
  };

  const openRevertModal = (registroId, b) => {
    const pesoUtilizado = Number(
      b?.RegistroMateriaPrimaProduccionBulto?.peso_utilizado ?? 0
    );
    const pesoUnitario = Number(b?.peso_unitario ?? 0);
    const unidades = pesoUnitario > 0 ? pesoUtilizado / pesoUnitario : 0;

    const unidadMedida =
      b?.materiaPrima?.unidad_medida || b?.MateriaPrima?.unidad_medida || "";

    setRevertTarget({
      registroId,
      bulto: b,
      unidadMedida,
      pesoUtilizado,
      unidades,
    });
    setRevertModalOpen(true);
  };

  const closeRevertModal = () => {
    setRevertModalOpen(false);
    setRevertTarget(null);
  };

  const confirmRevert = async () => {
    if (!revertTarget) return;
    const { registroId, bulto } = revertTarget;

    try {
      await api(`/registros-insumo-produccion/${registroId}/bultos/${bulto.id}`,
        {
          method: "DELETE",
        }
      );
      await cargarInsumosYBultos();
      toast.success("Bulto revertido correctamente");
      closeRevertModal();
    } catch (err) {
      console.error("Error al revertir bulto:", err);
      toast.error("Error al revertir bulto");
    }
  };

  const handleAsignar = (idRegistro, pesoNecesario, unidadMedida) => async () => {
    const bultosAsignados =
      asignaciones[idRegistro]?.filter((b) => b.peso_utilizado > 0) || [];

    if (bultosAsignados.length === 0) {
      toast.error("Debes asignar al menos un bulto con cantidad válida.");
      return;
    }

    const insumoActual = insumos.find((i) => i.id === idRegistro);
    const pesoUtilizadoActual = Number(insumoActual?.peso_utilizado ?? 0);
    const pesoFaltante = Math.max(0, Number(pesoNecesario) - pesoUtilizadoActual);

    const bultosFormateados = bultosAsignados.map(b => ({
      ...b,
      peso_utilizado: formatDecimal(b.peso_utilizado)
    }));

    const totalAsignado = bultosFormateados.reduce(
      (acc, b) => acc + b.peso_utilizado,
      0
    );

    const tolerancia = Math.max(0.0001, pesoNecesario * 0.01);
    const diferencia = totalAsignado - pesoNecesario;
    
    if (diferencia > 0 && diferencia <= tolerancia) {
      const ultimoBulto = bultosFormateados[bultosFormateados.length - 1];
      const sumaAnteriores = bultosFormateados.slice(0, -1).reduce((acc, b) => acc + b.peso_utilizado, 0);
      const pesoAjustado = pesoNecesario - sumaAnteriores;
      
      if (pesoAjustado > 0) {
        ultimoBulto.peso_utilizado = formatDecimal(pesoAjustado);
      }
    }
    
    const totalFinal = bultosFormateados.reduce((acc, b) => acc + b.peso_utilizado, 0);
    const diferenciaFinal = totalFinal - pesoNecesario;
    
    if (diferenciaFinal > tolerancia) {
      const u = unidadMedida ? ` ${unidadMedida}` : "";
      const intentando = mostrarNumeroExacto(totalFinal);
      const faltan = mostrarNumeroExacto(pesoFaltante);
      toast.error(
        `Estás intentando asignar ${intentando}${u} pero solo hacen falta ${faltan}${u}. Corrige las cantidades para continuar.`
      );
      return;
    }

    try {
      const payload = {
        bultos: bultosFormateados,
      };
      
      const response = await api(`/registros-insumo-produccion/${idRegistro}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      
      const resInsumos = await api(`/registros-insumo-produccion?id_orden_manufactura=${id}`, {
        method: "GET",
      });
      const insumoRecargado = resInsumos.registros.find(r => r.id === idRegistro);
      
      setInsumos(resInsumos.registros);
      
      const resOrden = await api(`/ordenes_manufactura/${id}`, {
        method: "GET",
      });
      setOrden(resOrden);
      
      setAsignaciones((prev) => {
        const nuevas = { ...prev };
        delete nuevas[idRegistro];
        return nuevas;
      });
      
      toast.success("Insumo asignado correctamente");

      await cargarInsumosYBultos();
    } catch (err) {
      console.error("Error al asignar bultos:", err);
      toast.error("Error al asignar bultos");
    }
  };

  const handleAsignarTodo = async () => {
    try {
      for (const insumo of insumos) {
        const idRegistro = insumo.id;

        if (insumo.peso_utilizado > 0) continue;

        const pesoNecesario = insumo.peso_necesario;
        const bultosAsignados =
          asignaciones[idRegistro]?.filter((b) => b.peso_utilizado > 0) || [];

        if (bultosAsignados.length === 0) {
          toast.error(
            `El insumo "${insumo.ingredienteReceta.materiaPrima.nombre}" no tiene bultos asignados.`
          );
          return;
        }

        const bultosFormateados = bultosAsignados.map(b => ({
          ...b,
          peso_utilizado: formatDecimal(b.peso_utilizado)
        }));

        const totalAsignado = bultosFormateados.reduce(
          (acc, b) => acc + b.peso_utilizado,
          0
        );

        const tolerancia = Math.max(0.0001, pesoNecesario * 0.01);
        if (totalAsignado > pesoNecesario + tolerancia) {
          const unidadMedida = insumo?.ingredienteReceta?.unidad_medida || '';
          const u = unidadMedida ? ` ${unidadMedida}` : '';
          toast.error(
            `Estás intentando asignar ${mostrarNumeroExacto(totalAsignado)}${u} ` +
              `pero solo hacen falta ${mostrarNumeroExacto(pesoNecesario)}${u} ` +
              `para "${insumo.ingredienteReceta.materiaPrima.nombre}".`
          );
          return;
        }

        const payload = {
          bultos: bultosFormateados,
        };

        await api(`/registros-insumo-produccion/${idRegistro}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      const resInsumos = await api(`/registros-insumo-produccion?id_orden_manufactura=${id}`, {
        method: "GET",
      });
      setInsumos(resInsumos.registros);
      
      const resOrden = await api(`/ordenes_manufactura/${id}`, {
        method: "GET",
      });
      setOrden(resOrden);
      
      setAsignaciones({});
      
      toast.success("Asignación confirmada");

      return true;
    } catch {
      toast.error("Error al asignar los insumos");
      return false;
    }
  };

  const handleConfirmarAsignacion = async () => {
    const ok = await handleAsignarTodo();
    if (!ok) return;
    navigate(`/Orden_de_Manufactura/${id}`);
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <ConfirmActionModal
        isOpen={noPasosConfirmOpen}
        onClose={closeNoPasosConfirm}
        onConfirm={async () => {
          try {
            if (typeof pendingAction === "function") {
              await pendingAction();
            }
          } finally {
            closeNoPasosConfirm();
          }
        }}
        title={noPasosConfirmTitle || "Confirmar"}
        description={noPasosConfirmDescription}
        confirmText="Sí, continuar"
        cancelText="Cancelar"
      />

      <ConfirmActionModal
        isOpen={revertModalOpen}
        onClose={closeRevertModal}
        onConfirm={confirmRevert}
        title="¿Revertir bulto asignado?"
        description={
          revertTarget
            ? `Se devolverá stock al inventario.\n\n` +
              `Bulto: ${revertTarget.bulto?.identificador || revertTarget.bulto?.id}\n` +
              `Devolver: ${Number(revertTarget.unidades || 0).toFixed(6)} unidades de inventario\n` +
              `Equivalente: ${mostrarNumeroExacto(revertTarget.pesoUtilizado)}${
                revertTarget.unidadMedida ? ` ${revertTarget.unidadMedida}` : ""
              }`
            : ""
        }
        confirmText="Sí, revertir"
        cancelText="Cancelar"
      />

      <div className="mb-4">
        <BackButton to={`/Orden_de_Manufactura/${id}`} />
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Asignar insumos · OM #{id}</h1>
      </div>

      {insumos.map((insumo) => {
        const allowedMPs = buildAllowedMateriaPrimas(insumo);
        const isVariable = allowedMPs.length > 1;

        const allBultos = bultosPorInsumo[insumo.id] || [];
        const mpSeleccionada = Number(mpSeleccionadaPorRegistro[insumo.id]);
        const bultos = isVariable && Number.isFinite(mpSeleccionada)
          ? allBultos.filter((b) => Number(b?.id_materia_prima) === mpSeleccionada)
          : allBultos;
        const yaAsignado = insumo.peso_utilizado >= insumo.peso_necesario;

        const unidadMedida = insumo?.ingredienteReceta?.unidad_medida || "";
        const sufijoUnidad = unidadMedida ? ` ${unidadMedida}` : "";
        const stepInput = unidadMedida === "unidades" ? "1" : "0.001";

        const bultosAsignados = insumo?.bultos || insumo?.Bultos || [];

        return (
          <div key={insumo.id} className="mb-6 bg-white shadow rounded-xl p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold text-text">
                {insumo.ingredienteReceta.materiaPrima.nombre}
              </h2>

              <div className="text-sm text-gray-700">
                <span className="font-medium">Asignado:</span> {mostrarNumeroExacto(insumo.peso_utilizado)} / {mostrarNumeroExacto(insumo.peso_necesario)}{sufijoUnidad}
                {yaAsignado && (
                  <span className="ml-2 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">OK</span>
                )}
              </div>
            </div>

            {bultosAsignados.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Bultos ya asignados</div>

                <div className="bg-white rounded-lg border border-border overflow-hidden">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-max w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider">Bulto</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider">Usado</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-text uppercase tracking-wider">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {bultosAsignados.map((b) => {
                          const pesoUtilizado = Number(
                            b?.RegistroMateriaPrimaProduccionBulto?.peso_utilizado ?? 0
                          );
                          return (
                            <tr key={b.id}>
                              <td className="px-4 py-2 text-text font-medium">
                                {b.identificador || `Bulto ${b.id}`}
                              </td>
                              <td className="px-4 py-2 text-text">
                                {mostrarNumeroExacto(pesoUtilizado)}{sufijoUnidad}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs"
                                  onClick={() => openRevertModal(insumo.id, b)}
                                >
                                  Revertir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!yaAsignado && (
              <div className="space-y-2">
                {isVariable && (
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Materia prima
                    </label>
                    <select
                      className="w-full md:w-[360px] border border-border rounded-lg px-3 py-2 text-sm"
                      value={Number.isFinite(mpSeleccionada) ? String(mpSeleccionada) : ""}
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : "";
                        setMpSeleccionadaPorRegistro((prev) => ({
                          ...prev,
                          [insumo.id]: v,
                        }));
                      }}
                    >
                      {allowedMPs.map((mp) => (
                        <option key={mp.id} value={mp.id}>
                          {mp.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-xs text-gray-500">
                      Puedes mezclar bultos de distintas materias primas para completar el requerimiento.
                    </div>
                  </div>
                )}

                <div className="text-sm font-semibold text-gray-700 mb-2">Bultos disponibles</div>

                <div className="bg-white rounded-lg border border-border overflow-hidden">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-max w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider">Bulto</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-text uppercase tracking-wider">Unidades de consumo disponibles</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-text uppercase tracking-wider">Peso Unitario</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-text uppercase tracking-wider">Equivalente Disponible</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-text uppercase tracking-wider">Costo unit.</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider">Asignar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {bultos.map((b) => {
                          const equivalente = Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0);
                          const currentAssigned = asignaciones?.[insumo.id]?.find((x) => x.id_bulto === b.id);
                          const currentValue = currentAssigned?.peso_utilizado;
                          return (
                            <tr key={b.id}>
                              <td className="px-4 py-2 text-text font-medium">
                                {b.identificador ? `Bulto ${b.identificador}` : `Bulto #${b.id}`}
                              </td>
                              <td className="px-4 py-2 text-right text-text">
                                {mostrarNumeroExacto(b.unidades_disponibles)} / {mostrarNumeroExacto(b.cantidad_unidades)}
                              </td>
                              <td className="px-4 py-2 text-right text-text">
                                {mostrarNumeroExacto(b.peso_unitario)}{sufijoUnidad}
                              </td>
                              <td className="px-4 py-2 text-right text-text">
                                {mostrarNumeroExacto(equivalente)}{sufijoUnidad}
                              </td>
                              <td className="px-4 py-2 text-right text-text">
                                {b.costo_unitario != null ? `$${b.costo_unitario}` : "—"}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col">
                                  <input
                                    type="number"
                                    min="0"
                                    step={stepInput}
                                    value={currentValue ?? ""}
                                    onChange={(e) =>
                                      handlePesoChange(
                                        insumo.id,
                                        b.id,
                                        parseFloat(e.target.value)
                                      )
                                    }
                                    className="px-3 py-2 border border-border rounded-lg w-44"
                                    placeholder={`0${sufijoUnidad}`}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {bultos.length === 0 && (
                  <p className="text-sm text-red-600">
                    No hay bultos disponibles para este insumo.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() =>
                void runWithNoPasosConfirmation(
                  handleAsignar(insumo.id, insumo.peso_necesario, unidadMedida),
                  "asignar insumos"
                )
              }
              disabled={yaAsignado}
              className={`mt-4 px-4 py-2 rounded ${yaAsignado
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-primary text-white hover:bg-hover"
                }`}
            >
              {yaAsignado ? "Asignado" : "Asignar Insumo"}
            </button>
          </div>
        );
      })}

      <div className="mt-10 flex justify-center">
        <button
          onClick={() =>
            void runWithNoPasosConfirmation(
              handleConfirmarAsignacion,
              "confirmar la asignación"
            )
          }
          className="px-6 py-3 bg-primary text-white rounded-lg text-lg hover:bg-hover shadow"
        >
          Confirmar Asignación
        </button>
      </div>

      {orden && (() => {
        const estado = orden.estado;
        const puedeEjecutar = [
          "Insumos Asignados",
          "En Ejecución",
          "Validada",
          "Completado",
          "Esperando Salidas"
        ].includes(estado) && estado !== "Cerrada";
        
        return puedeEjecutar ? (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate(`/Orden_de_Manufactura/${id}/pasos`)}
              className="px-6 py-3 bg-primary text-white rounded-lg text-lg hover:bg-hover shadow"
            >
              Ejecutar Pasos de Producción
            </button>
          </div>
        ) : null;
      })()}
    </div>
  );
}