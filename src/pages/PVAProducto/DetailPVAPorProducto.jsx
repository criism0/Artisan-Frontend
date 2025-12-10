import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function DetailPVAPorProducto() {
  const { id } = useParams();
  const api = useApi();
  const navigate = useNavigate();

  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetalle = async () => {
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

  if (loading)
    return <div className="p-6 text-center text-gray-600">Cargando...</div>;

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
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate("/PVAPorProducto")}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded"
        >
          ← Volver
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/PVAPorProducto/editar/${id}`)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded"
          >
            ✎ Editar
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">Detalle PVA por Producto</h1>

      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between">
          <p><strong>ID:</strong> {pva.id}</p>
          <p><strong>Proceso:</strong> {pva.procesoValorAgregado?.descripcion || "—"}</p>
        </div>

        <div className="flex flex-col md:flex-row md:justify-between">
          <p><strong>Producto Asociado:</strong> {productoAsociado}</p>
          <p><strong>Unidad:</strong> {unidadAsociada}</p>
        </div>

        <div>
          <p><strong>Genera Bultos Nuevos:</strong> {pva.procesoValorAgregado?.genera_bultos_nuevos ? "Sí" : "No"}</p>
          <p><strong>Utiliza Insumos:</strong> {pva.procesoValorAgregado?.utiliza_insumos ? "Sí" : "No"}</p>
        </div>

        <div className="border-t pt-4 mt-4">
          <h2 className="text-lg font-semibold mb-2">Insumos Asociados</h2>
          {pva.procesoValorAgregado?.utiliza_insumos ? (
            insumos.length === 0 ? (
              <p className="text-gray-600 text-sm">No hay insumos registrados.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border p-2">ID</th>
                    <th className="border p-2">Materia Prima</th>
                    <th className="border p-2">Unidad</th>
                    <th className="border p-2">Cantidad por Bulto</th>
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((insumo) => (
                    <tr key={insumo.id} className="hover:bg-gray-50">
                      <td className="border p-2">{insumo.id}</td>
                      <td className="border p-2">{insumo.materiaPrima?.nombre || "—"}</td>
                      <td className="border p-2">{insumo.materiaPrima?.unidad_medida || "—"}</td>
                      <td className="border p-2">{insumo.cantidad_por_bulto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <p className="text-gray-600 text-sm">Este proceso no utiliza insumos.</p>
          )}

        </div>

        <div className="border-t pt-4 mt-4 text-sm text-gray-600">
          <p><strong>Creado:</strong> {new Date(pva.createdAt).toLocaleString()}</p>
          <p><strong>Actualizado:</strong> {new Date(pva.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
