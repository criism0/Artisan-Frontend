import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton, EditButton } from "../../components/Buttons/ActionButtons";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function DetailPVAPorProducto() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();

  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);

  const canReadPVAProduct = checkScope(ModelType.PVA_PRODUCTO, ScopeType.READ);

  const fetchDetalle = async () => {
    if (!canReadPVAProduct) {
      toast.permissionError([ModelType.PVA_PRODUCTO, ScopeType.READ]);
      setLoading(false);
      return;
    }
    try {
      const data = await api(`/pva-por-producto/${id}`, { method: "GET" });
      setDetalle(data);
    } catch {
      toast.error("Error al cargar el detalle del PVA por producto.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetalle();
  }, [id]);

  if (loading) return <PageLoader message="Cargando detalle" />;

  if (!detalle)
    return (
      <div className="p-6 text-center text-gray-600">
        No se encontró el PVA por producto.
      </div>
    );

  const pva = detalle.PvaPorProducto;
  const insumos = detalle.Insumos || [];

  const productoAsociado =
    pva.productoBase?.nombre ||
    pva.materiaPrima?.nombre ||
    "—";

  const unidadAsociada =
    pva.productoBase?.unidad_medida ||
    pva.materiaPrima?.unidad_medida ||
    "—";

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/PVAPorProducto" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle PVA por Producto</h1>
        <div className="flex gap-2">
          <EditButton
            onClick={() => navigate(`/PVAPorProducto/editar/${id}`)}
            tooltipText="Editar PVA por Producto"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4">Información del PVA</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <p className="text-gray-500 text-sm mb-1">Proceso</p>
            <p className="font-medium">{pva.procesoValorAgregado?.descripcion || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Producto Asociado</p>
            <p className="font-medium">{productoAsociado}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Unidad</p>
            <p className="font-medium">{unidadAsociada}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Comportamiento</p>
            <p className="font-medium">
              {pva.procesoValorAgregado?.utiliza_insumos ? "Utiliza insumos" : "No utiliza insumos"}
              {" · "}
              {pva.procesoValorAgregado?.genera_bultos_nuevos ? "Genera bultos nuevos" : "No genera bultos nuevos"}
            </p>
          </div>
        </div>
        <div className="border-t mt-4 pt-3 text-xs text-gray-500">
          Creado: {new Date(pva.createdAt).toLocaleString()} · Actualizado: {new Date(pva.updatedAt).toLocaleString()}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-text mb-4">Insumos Asociados</h2>
        {pva.procesoValorAgregado?.utiliza_insumos ? (
          insumos.length === 0 ? (
            <p className="text-gray-600 text-sm">No hay insumos registrados.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Materia Prima</th>
                  <th className="px-3 py-2 text-left">Unidad</th>
                  <th className="px-3 py-2 text-left">Cantidad por Bulto</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr key={insumo.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{insumo.materiaPrima?.nombre || "—"}</td>
                    <td className="px-3 py-2">{insumo.materiaPrima?.unidad_medida || "—"}</td>
                    <td className="px-3 py-2">{insumo.cantidad_por_bulto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <p className="text-gray-600 text-sm">Este proceso no utiliza insumos.</p>
        )}
      </div>
    </div>
  );
}
