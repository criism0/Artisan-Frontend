import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { TrashButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function PVAPorProducto() {
  const api = useApi();
  const navigate = useNavigate();

  const [relaciones, setRelaciones] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canReadAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ);
  const canReadPVAProduct = checkScope(ModelType.PVA_PRODUCTO, ScopeType.READ);
  const canDeletePVAProduct = checkScope(ModelType.PVA_PRODUCTO, ScopeType.DELETE);

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadPVAProduct || !canReadAddedValueProcess) {
        toast.permissionError(
          [ModelType.PVA_PRODUCTO, ScopeType.READ],
          [ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]
        );
        setIsLoading(false);
        return;
      }
      try {
        const [relRes, procRes, matRes, prodRes] = await Promise.all([
          api(`/pva-por-producto`, { method: "GET" }),
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
          api(`/materias-primas`, { method: "GET" }),
          api(`/productos-base`, { method: "GET" }),
        ]);

        setRelaciones(relRes || []);
        setProcesos(procRes || []);
        setMateriasPrimas(matRes || []);
        setProductosBase(prodRes || []);
      } catch {
        toast.error("Error al cargar los datos de PVA por producto.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, canReadAddedValueProcess]);

  const getProcesoNombre = (id) => {
    const p = procesos.find((x) => x.id === id);
    return p ? p.descripcion : `#${id}`;
  };

  const getNombreProducto = (r) => {
    if (r.id_producto_base) {
      const p = productosBase.find((x) => x.id === r.id_producto_base);
      return p ? p.nombre : `Producto Comercial #${r.id_producto_base}`;
    }
    if (r.id_materia_prima) {
      const m = materiasPrimas.find((x) => x.id === r.id_materia_prima);
      return m ? m.nombre : `Materia Prima #${r.id_materia_prima}`;
    }
    return "—";
  };

  const handleDelete = async (id) => {
    if (!canDeletePVAProduct) {
      toast.permissionError([ModelType.PVA_PRODUCTO, ScopeType.DELETE]);
      return;
    }
    if (!window.confirm("¿Seguro que deseas eliminar esta relación PVA-Producto?")) return;
    try {
      await api(`/pva-por-producto/${id}`, { method: "DELETE" });
      setRelaciones((prev) => prev.filter((r) => r.id !== id));
      toast.success("Relación eliminada correctamente.");
    } catch {
      toast.error("No se pudo eliminar la relación.");
    }
  };

  if (isLoading) return <PageLoader message="Cargando PVA por producto" />;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Relaciones PVA por Producto</h1>
        <button
          onClick={() => navigate("/PVAPorProducto/agregar")}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded"
        >
          + Añadir Relación
        </button>
      </div>

      {relaciones.length === 0 ? (
        <p className="text-gray-600">No hay relaciones PVA-Producto registradas.</p>
      ) : (
        <table className="min-w-full bg-white rounded-lg shadow border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Proceso</th>
              <th className="px-4 py-2 text-left">Producto Asociado</th>
              <th className="px-4 py-2 text-left">Orden del PVA</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {relaciones.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b">{r.id}</td>
                <td className="px-4 py-2 border-b">{getProcesoNombre(r.id_proceso)}</td>
                <td className="px-4 py-2 border-b">{getNombreProducto(r)}</td>
                <td className="px-4 py-2 border-b">{r.orden}</td>
                <td className="px-4 py-2 border-b text-center flex justify-center gap-2">
                  <button
                    onClick={() => navigate(`/PVAPorProducto/${r.id}`)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Ver Detalle
                  </button>
                  <TrashButton
                    onConfirmDelete={() => handleDelete(r.id)}
                    tooltipText="Eliminar relación"
                    entityName="PVA por producto"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
