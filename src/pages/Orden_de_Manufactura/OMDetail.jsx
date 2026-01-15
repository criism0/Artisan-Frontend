import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function OMDetail() {
  const { id } = useParams();
  const [om, setOM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productosFinales, setProductosFinales] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [showSubproductos, setShowSubproductos] = useState(false);
  const [insumosAsignados, setInsumosAsignados] = useState(false);
  const [tieneRegistrosInsumo, setTieneRegistrosInsumo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOM = async () => {
      try {
        const response = await api(`/ordenes_manufactura/${id}`);
        setOM(response);
      } catch {
        setError("Error al cargar la Orden de Manufactura");
      } finally {
        setLoading(false);
      }
    };

    const fetchProductosFinales = async () => {
      try {
        const res = await api(`/ordenes_manufactura/${id}/productos_finales`);
        setProductosFinales(res.productosFinales || []);
        setSubproductos(res.subproductos || []);
      } catch {
        setProductosFinales([]);
        setSubproductos([]);
      }
    };

    const fetchInsumos = async () => {
      try {
        const res = await api(`/registros-insumo-produccion?id_orden_manufactura=${id}`);
        const registros = res.registros || [];
        setTieneRegistrosInsumo(registros.length > 0);

        // Si no hay registros de insumo, no hay nada que asignar.
        const todosAsignados = registros.length === 0 ? true : registros.every((insumo) => {
          const pesoUtilizado = Number(insumo.peso_utilizado) || 0;
          const pesoNecesario = Number(insumo.peso_necesario) || 0;

          if (pesoNecesario === 0) {
            return pesoUtilizado > 0.0001;
          }

          const diferencia = Math.abs(pesoUtilizado - pesoNecesario);
          const tolerancia = Math.max(0.0001, pesoNecesario * 0.01);

          return pesoUtilizado > 0.0001 && diferencia <= tolerancia;
        });
        setInsumosAsignados(todosAsignados);
      } catch {
        setInsumosAsignados(false);
        setTieneRegistrosInsumo(false);
      }
    };

    fetchOM();
    fetchProductosFinales();
    fetchInsumos();
  }, [id]);

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  if (error)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  if (!om)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center text-gray-500">
        No se encontró la Orden de Manufactura
      </div>
    );

  const getEstadoBadge = (estado) => {
    if (!estado) return "";
    const normalized = estado.toLowerCase();
    const base = "px-3 py-1 rounded-full text-sm font-medium";
    switch (normalized) {
      case "borrador":
        return (
          <span className={`${base} bg-gray-200 text-gray-700`}>Borrador</span>
        );
      case "insumos asignados":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            Insumos asignados
          </span>
        );
      case "en ejecución":
        return (
          <span className={`${base} bg-cyan-100 text-cyan-700`}>
            En ejecución
          </span>
        );
      case "esperando salidas":
        return (
          <span className={`${base} bg-orange-100 text-orange-700`}>
            Esperando salidas
          </span>
        );
      case "cerrada":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>Cerrada</span>
        );
      default:
        return (
          <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>
        );
    }
  };

  const estado = om.estado;
  const hasPasos = (om?.registrosPasoProduccion?.length ?? 0) > 0;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Orden_de_Manufactura" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Orden de Manufactura: {om.id}</h1>
        <div>{getEstadoBadge(om.estado)}</div>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg">
        <table className="w-full bg-white rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-100 text-sm text-gray-600">
            <tr>
              <th className="px-6 py-3 text-xl font-semibold text-left mb-2">INFORMACIÓN</th>
              <th className="px-6 py-3 text-xl font-semibold text-left mb-2">DATO</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Receta</td>
              <td className="px-6 py-4 text-sm text-text">{om.receta?.nombre || om.id_receta || "—"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Encargado</td>
              <td className="px-6 py-4 text-sm text-text">
                {om.elaboradorEncargado?.nombre || om.id_elaborador_encargado || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Bodega</td>
              <td className="px-6 py-4 text-sm text-text">{om.bodega?.nombre || om.id_bodega || "—"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Fecha</td>
              <td className="px-6 py-4 text-sm text-text">
                {om.fecha ? new Date(om.fecha).toLocaleDateString() : "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Peso objetivo</td>
              <td className="px-6 py-4 text-sm text-text">{om.peso_objetivo ? `${om.peso_objetivo} kg` : "—"}</td>
            </tr>
            {om.estado === "Cerrada" && (
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Peso obtenido</td>
                <td className="px-6 py-4 text-sm text-text">{om.peso_obtenido ? `${om.peso_obtenido} kg` : "—"}</td>
              </tr>
            )}
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Costo referencial</td>
              <td className="px-6 py-4 text-sm text-text">{om.receta?.costo_referencial_produccion != null ? `$${om.receta.costo_referencial_produccion}` : "—"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Costo total</td>
              <td className="px-6 py-4 text-sm text-text">{om.costo_total != null ? `$${om.costo_total}` : "—"}</td>
            </tr>
            {om.estado === "Cerrada" && om.peso_objetivo && om.peso_obtenido && (
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Rendimiento</td>
                <td className="px-6 py-4 text-sm text-text">{((om.peso_obtenido / om.peso_objetivo) * 100).toFixed(2)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {estado === "Borrador" && !insumosAsignados && tieneRegistrosInsumo && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate(`/Orden_de_Manufactura/${id}/insumos`)}
          >
            Asignar Insumos
          </button>
        )}

        {(hasPasos && (insumosAsignados || [
          "Insumos Asignados",
          "En ejecución",
          "Validada",
          "Completado",
          "Esperando Salidas",
        ].includes(estado)) && estado !== "Cerrada") && (
            <button
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
              onClick={() => navigate(`/Orden_de_Manufactura/${id}/pasos`)}
            >
              Ejecutar Pasos de Producción
            </button>
          )}

        {["Esperando Salidas"].includes(estado) && subproductos.length > 0 && (
          <button
            className="px-4 py-2 bg-blue-300 text-blue-700 rounded hover:bg-blue-400"
            onClick={() =>
              navigate(`/Orden_de_Manufactura/${id}/subproductos-decision`)
            }
          >
            Verificar Subproductos
          </button>
        )}

        {(
          ["Completado", "Esperando Salidas"].includes(estado) ||
          (!hasPasos && estado === "Insumos Asignados")
        ) && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() =>
              navigate(`/Orden_de_Manufactura/${id}/produccion-final`)
            }
          >
            Producción Final
          </button>
        )}

        {["Cerrada"].includes(estado) && subproductos.length > 0 && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => setShowSubproductos(true)}
          >
            Ver subproductos
          </button>
        )}

        {["Cerrada"].includes(estado) && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() =>
              navigate(
                `/Orden_de_Manufactura/${id}/historial-pasos`
              )
            }
          >
            Ver registro de pasos
          </button>
        )}
      </div>

      {productosFinales && productosFinales.length > 0 && (
        <div className="mt-8 bg-gray-200 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-text">Productos finales</h2>
          </div>
          <table className="w-full bg-white rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-100 text-sm text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Producto
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Peso (kg)
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Peso Referencial (kg)
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Fecha Vencimiento
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Costo
                </th>
              </tr>
            </thead>
            <tbody>
              {productosFinales.map((prod) => (
                <tr key={prod.id} className="border-b border-border">
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.productoBase?.nombre || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.peso_unitario}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.productoBase?.peso_unitario || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.fecha_vencimiento
                      ? new Date(prod.loteProductoFinal?.fecha_vencimiento).toLocaleDateString()
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {(prod.costo_unitario).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subproductos Modal */}
      {showSubproductos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Subproductos Registrados</h2>
                <button
                  onClick={() => setShowSubproductos(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {subproductos.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No se encontraron subproductos registrados.
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    // Group subproductos by materia prima ID
                    const groupedSubproductos = subproductos.reduce((acc, subproducto) => {
                      const materiaPrimaId = subproducto.id_materia_prima;
                      if (!acc[materiaPrimaId]) {
                        acc[materiaPrimaId] = [];
                      }
                      acc[materiaPrimaId].push(subproducto);
                      return acc;
                    }, {});

                    return Object.entries(groupedSubproductos).map(([materiaPrimaId, subproductosGroup]) => {
                      // Calculate totals for this group
                      const totalPeso = subproductosGroup.reduce((sum, sp) => sum + sp.peso, 0);
                      const allBultos = subproductosGroup.flatMap(sp => sp.RegistroSubproductoBultos || []);

                      return (
                        <div key={materiaPrimaId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-medium text-gray-800">
                              Materia Prima: {subproductosGroup[0].materiaPrima?.nombre || "-"}
                            </h3>
                            <span className="text-sm text-gray-500">
                              {subproductosGroup.length} registro{subproductosGroup.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Peso Total:</span>
                              <p className="text-gray-800">{totalPeso} kg</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Fecha Elaboración:</span>
                              <p className="text-gray-800">
                                {new Date(subproductosGroup[0].fecha_elaboracion).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Fecha Vencimiento:</span>
                              <p className="text-gray-800">
                                {new Date(subproductosGroup[0].fecha_vencimiento).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {/* Bultos de todos los subproductos de esta materia prima */}
                          {allBultos.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Bultos Asociados ({allBultos.length}):</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-300">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Identificador</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Cantidad Unidades</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Peso Unitario</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Unidades Disponibles</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Precio Unitario</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allBultos.map((bulto) => (
                                      <tr key={bulto.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.identificador}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.cantidad_unidades}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.peso_unitario} kg
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.unidades_disponibles}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          ${bulto.precio_unitario}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
