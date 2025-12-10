import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function DeletePVAPorProducto() {
  const api = useApi();
  const navigate = useNavigate();
  const { id } = useParams();

  const [relacion, setRelacion] = useState(null);
  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [relRes, procRes, matRes, prodRes] = await Promise.all([
          api(`/pva-por-producto/${id}`, { method: "GET" }),
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
          api(`/materias-primas`, { method: "GET" }),
          api(`/productos`, { method: "GET" }),    // <--- NUEVO
        ]);

        setRelacion(relRes);
        setProcesos(procRes);
        setMateriasPrimas(matRes);
        setProductos(prodRes);

      } catch {
        toast.error("Error al cargar los datos de la relación.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);

  const getProcesoNombre = (idProc) => {
    const p = procesos.find((x) => x.id === idProc);
    return p ? p.descripcion : `#${idProc}`;
  };

  const getMateriaNombre = (idMat) => {
    const m = materiasPrimas.find((x) => x.id === idMat);
    return m ? m.nombre : `#${idMat}`;
  };

  const getProductoNombre = (idProd) => {
    const p = productos.find((x) => x.id === idProd);
    return p ? p.nombre : `#${idProd}`;
  };

  const handleDelete = async () => {
    try {
      await api(`/pva-por-producto/${id}`, { method: "DELETE" });
      toast.success("Relación PVA-Producto eliminada correctamente.");
      navigate("/PVAPorProducto");
    } catch {
      toast.error("Error al eliminar la relación.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">
        Cargando información de la relación...
      </div>
    );
  }

  if (!relacion) {
    return (
      <div className="p-6 text-center text-gray-600">
        No se encontró la relación PVA-Producto.
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/PVAPorProducto" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">
        Eliminar Relación PVA por Producto
      </h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-8">
        <p><strong>ID:</strong> {relacion.id}</p>
        <p><strong>Proceso:</strong> {getProcesoNombre(relacion.id_proceso)}</p>

        <p>
          <strong>Producto Asociado:</strong>{" "}
          {relacion.id_producto_base
            ? getProductoNombre(relacion.id_producto_base)
            : getMateriaNombre(relacion.id_materia_prima)}
        </p>

        <p><strong>Orden:</strong> {relacion.orden}</p>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          onClick={() => navigate("/PVAPorProducto")}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded"
        >
          Cancelar
        </button>
        <button
          onClick={handleDelete}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
        >
          Sí, eliminar
        </button>
      </div>
    </div>
  );
}
