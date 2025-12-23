import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";

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

  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState(null); // { registroId, bulto, unidadMedida, pesoUtilizado, unidades }

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
      const idMP = insumo.id_materia_prima;
      if (!idMP) continue;

      try {
        const resBultos = await api(
          `/bultos/disponibles?id_bodega=${bodega}&id_materia_prima=${idMP}`,
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
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await cargarInsumosYBultos();
      } catch {
        alert("No se pudieron cargar los datos");
      }
    };

    fetchData();
  }, [id]);

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

    console.log("=== ANTES DE FORMATEAR ===");
    console.log("Peso necesario (raw):", pesoNecesario, "tipo:", typeof pesoNecesario);
    console.log("Bultos asignados (raw):", bultosAsignados);
    bultosAsignados.forEach((b, idx) => {
      console.log(`Bulto ${idx}:`, b.peso_utilizado, "tipo:", typeof b.peso_utilizado);
    });

    const bultosFormateados = bultosAsignados.map(b => ({
      ...b,
      peso_utilizado: formatDecimal(b.peso_utilizado)
    }));

    console.log("=== DESPUÉS DE FORMATEAR ===");
    console.log("Bultos formateados:", bultosFormateados);
    bultosFormateados.forEach((b, idx) => {
      console.log(`Bulto ${idx} formateado:`, b.peso_utilizado, "tipo:", typeof b.peso_utilizado, "JSON:", JSON.stringify(b.peso_utilizado));
    });

    const totalAsignado = bultosFormateados.reduce(
      (acc, b) => acc + b.peso_utilizado,
      0
    );

    console.log("=== COMPARACIÓN ===");
    console.log("Peso necesario (BACKEND ESPERA):", pesoNecesario, "JSON:", JSON.stringify(pesoNecesario));
    console.log("Total asignado:", totalAsignado, "JSON:", JSON.stringify(totalAsignado));
    console.log("Diferencia:", totalAsignado - pesoNecesario);

    const tolerancia = Math.max(0.0001, pesoNecesario * 0.01);
    const diferencia = totalAsignado - pesoNecesario;
    
    if (diferencia > 0 && diferencia <= tolerancia) {
      console.log("⚠️ Ajustando último bulto para coincidir exactamente con el backend");
      const ultimoBulto = bultosFormateados[bultosFormateados.length - 1];
      const sumaAnteriores = bultosFormateados.slice(0, -1).reduce((acc, b) => acc + b.peso_utilizado, 0);
      const pesoAjustado = pesoNecesario - sumaAnteriores;
      
      if (pesoAjustado > 0) {
        ultimoBulto.peso_utilizado = formatDecimal(pesoAjustado);
        console.log("Último bulto ajustado de", bultosFormateados[bultosFormateados.length - 1].peso_utilizado, "a", ultimoBulto.peso_utilizado);
        console.log("Nuevo total:", bultosFormateados.reduce((acc, b) => acc + b.peso_utilizado, 0));
      }
    }
    
    const totalFinal = bultosFormateados.reduce((acc, b) => acc + b.peso_utilizado, 0);
    const diferenciaFinal = totalFinal - pesoNecesario;
    
    if (diferenciaFinal > tolerancia) {
      console.log("❌ VALIDACIÓN FALLÓ - Excede el peso necesario");
      const u = unidadMedida ? ` ${unidadMedida}` : "";
      const intentando = mostrarNumeroExacto(totalFinal);
      const faltan = mostrarNumeroExacto(pesoFaltante);
      toast.error(
        `Estás intentando asignar ${intentando}${u} pero solo hacen falta ${faltan}${u}. Corrige las cantidades para continuar.`
      );
      return;
    }
    
    console.log("✅ VALIDACIÓN PASÓ - Total:", totalFinal, "Necesario:", pesoNecesario);

    try {
      const payload = {
        bultos: bultosFormateados,
      };
      
      console.log("=== ENVIANDO AL BACKEND ===");
      console.log("Payload completo:", JSON.stringify(payload, null, 2));
      console.log("Bultos formateados:", bultosFormateados);
      console.log("Peso necesario:", pesoNecesario);
      console.log("Total asignado:", totalAsignado);
      console.log("==========================");
      
      const response = await api(`/registros-insumo-produccion/${idRegistro}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      
      console.log("=== RESPUESTA DEL BACKEND ===");
      console.log("Response completa:", response);
      console.log("============================");
      
      const resInsumos = await api(`/registros-insumo-produccion?id_orden_manufactura=${id}`, {
        method: "GET",
      });
      const insumoRecargado = resInsumos.registros.find(r => r.id === idRegistro);
      
      console.log("=== DATOS RECARGADOS ===");
      console.log("Insumo recargado:", insumoRecargado?.ingredienteReceta?.materiaPrima?.nombre);
      console.log("Peso utilizado recargado:", insumoRecargado?.peso_utilizado);
      console.log("Peso necesario:", insumoRecargado?.peso_necesario);
      console.log("Tipo de peso_utilizado:", typeof insumoRecargado?.peso_utilizado);
      console.log("Tipo de peso_necesario:", typeof insumoRecargado?.peso_necesario);
      console.log("========================");
      
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
        
        console.log(`=== ASIGNAR TODO - ${insumo.ingredienteReceta.materiaPrima.nombre} ===`);
        console.log("Payload:", JSON.stringify(payload, null, 2));
        console.log("Peso necesario:", pesoNecesario);
        console.log("Total asignado:", totalAsignado);
        console.log("=========================================");
        
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
      
      toast.success("Todos los insumos fueron asignados correctamente");

      await cargarInsumosYBultos();
    } catch {
      toast.error("Error al asignar los insumos");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
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

      <h1 className="text-2xl font-bold mb-6 text-text">
        Asignar Insumos a OM #{id}
      </h1>

      {insumos.map((insumo) => {
        const bultos = bultosPorInsumo[insumo.id] || [];
        const yaAsignado = insumo.peso_utilizado >= insumo.peso_necesario;

        const unidadMedida = insumo?.ingredienteReceta?.unidad_medida || "";
        const sufijoUnidad = unidadMedida ? ` ${unidadMedida}` : "";
        const stepInput = unidadMedida === "unidades" ? "1" : "0.001";

        const bultosAsignados = insumo?.bultos || insumo?.Bultos || [];

        return (
          <div key={insumo.id} className="mb-6 bg-white shadow rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-2">
              {insumo.ingredienteReceta.materiaPrima.nombre} (
              {mostrarNumeroExacto(insumo.peso_utilizado)} /{" "}
              {mostrarNumeroExacto(insumo.peso_necesario)}{sufijoUnidad})
            </h2>

            {yaAsignado && (
              <p className="text-sm text-green-700 font-medium mb-2">
                ✔ Insumo ya asignado.
              </p>
            )}

            {bultosAsignados.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  Bultos ya asignados
                </div>
                <div className="space-y-2">
                  {bultosAsignados.map((b) => {
                    const pesoUtilizado = Number(
                      b?.RegistroMateriaPrimaProduccionBulto?.peso_utilizado ?? 0
                    );
                    const pesoUnitario = Number(b?.peso_unitario ?? 0);
                    const unidades = pesoUnitario > 0 ? pesoUtilizado / pesoUnitario : 0;

                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-4 border rounded p-2"
                      >
                        <div className="text-sm">
                          <div className="font-medium text-gray-800">
                            {b.identificador || `Bulto ${b.id}`}
                          </div>
                          <div className="text-gray-600">
                            Usado: {mostrarNumeroExacto(pesoUtilizado)}{sufijoUnidad} (
                            {unidades.toFixed(6)} unidades)
                          </div>
                        </div>
                        <button
                          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                          onClick={() => openRevertModal(insumo.id, b)}
                        >
                          Revertir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!yaAsignado && (
              <div className="space-y-2">
                {bultos.map((b) => (
                  <div key={b.id} className="border rounded p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-800">
                          {b.identificador ? `Bulto ${b.identificador}` : `Bulto #${b.id}`}
                        </div>
                        {b?.Pallet?.identificador && (
                          <div className="text-gray-600">Pallet: {b.Pallet.identificador}</div>
                        )}
                        {b?.LoteMateriaPrima?.identificador_proveedor && (
                          <div className="text-gray-600">
                            Lote proveedor: {b.LoteMateriaPrima.identificador_proveedor}
                          </div>
                        )}
                        {b?.LoteMateriaPrima?.fecha_vencimiento && (
                          <div className="text-gray-600">
                            Vence: {new Date(b.LoteMateriaPrima.fecha_vencimiento).toLocaleDateString()}
                          </div>
                        )}

                        <div className="text-gray-600">
                          Stock: {mostrarNumeroExacto(b.unidades_disponibles)} unidades
                        </div>
                        <div className="text-gray-600">
                          Conversión: 1 unidad = {mostrarNumeroExacto(b.peso_unitario)}{sufijoUnidad}
                        </div>
                        <div className="text-gray-600">
                          Equivalente disponible: {mostrarNumeroExacto(b.unidades_disponibles * b.peso_unitario)}{sufijoUnidad}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 text-right">
                        {b.costo_unitario != null && (
                          <div>Costo unitario: ${b.costo_unitario}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <input
                        type="number"
                        min="0"
                        step={stepInput}
                        placeholder={`Necesario: ${mostrarNumeroExacto(insumo.peso_necesario)}${sufijoUnidad}`}
                        onChange={(e) =>
                          handlePesoChange(
                            insumo.id,
                            b.id,
                            parseFloat(e.target.value)
                          )
                        }
                        className="p-2 border rounded w-40"
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        Necesario: {mostrarNumeroExacto(insumo.peso_necesario)}{sufijoUnidad}
                      </span>
                    </div>
                  </div>
                ))}

                {bultos.length === 0 && (
                  <p className="text-sm text-red-600">
                    No hay bultos disponibles para este insumo.
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleAsignar(insumo.id, insumo.peso_necesario, unidadMedida)}
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
          onClick={handleAsignarTodo}
          className="px-6 py-3 bg-primary text-white rounded-lg text-lg hover:bg-hover shadow"
        >
          Asignar TODOS los insumos
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
              className="px-6 py-3 bg-green-600 text-white rounded-lg text-lg hover:bg-green-700 shadow"
            >
              Ejecutar Pasos de Producción
            </button>
          </div>
        ) : null;
      })()}

      <div className="mt-8">
        <button
          onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
        >
          Volver al detalle
        </button>
      </div>

    </div>
  );
}