import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { EditButton, TrashButton, BackButton } from "../../components/Buttons/ActionButtons";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { getNombreComercial } from "../../utils/nombreComercial.js";
import toast from "../../lib/toast.js";

export default function ListaPrecioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listaPrecio, setListaPrecio] = useState(null);
  const [productosBase, setProductosBase] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

  const canDeletePriceList = checkScope(ModelType.LISTA_PRECIO, ScopeType.DELETE);

  useEffect(() => {
    const fetchListaPrecio = async () => {
      try {
        setLoading(true);
        const response = await api(`/lista-precio/${id}`);
        setListaPrecio(response);
        if (Array.isArray(response?.productosBaseListaPrecio)) {
          setProductosBase(response.productosBaseListaPrecio);
        }
        setError(null);
      } catch (error) {
        setError("Error al cargar la lista de precio. Por favor, intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    const fetchProductos = async () => {
      try {
        const res1 = await api(`/producto-base-lista-precio/lista/${id}`);
        if (Array.isArray(res1)) {
          setProductosBase(res1);
          return;
        }
      } catch (_) {}
      try {
        const res2 = await api(`/producto-base-lista-precio?listaPrecioId=${id}`);
        setProductosBase(Array.isArray(res2) ? res2 : []);
      } catch (e) {
        setProductosBase([]);
      }
    };

    if (id) {
      fetchListaPrecio();
      // Fallback solo si no vinieron embebidos
      fetchProductos();
    }
  }, [id, api]);

  const handleDeleteListaPrecio = async () => {
    if (!canDeletePriceList) {
      toast.permissionError([ModelType.LISTA_PRECIO, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/lista-precio/${id}`, {
        method: "DELETE",
      });
      navigate('/lista-precio');
    } catch (error) {
      console.error('Error eliminando lista de precio:', error);
    }
  };

  if (loading) return <PageLoader message="Cargando lista de precio" />;

  if (error) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="mb-4">
          <BackButton to="/lista-precio" />
        </div>
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!listaPrecio) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="mb-4">
          <BackButton to="/lista-precio" />
        </div>
        <div className="p-3 bg-yellow-100 text-yellow-700 rounded mb-4 text-sm">
          No se encontró la lista de precio
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/lista-precio" />
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de la Lista de Precio</h1>
        <div className="flex gap-2 items-center">
          <EditButton
            onClick={() => navigate(`/lista-precio/${id}/edit`)}
            tooltipText="Editar Lista de Precio"
          />
          <TrashButton
            onConfirmDelete={handleDeleteListaPrecio}
            tooltipText="Eliminar Lista de Precio"
            entityName={`lista de precio ${listaPrecio.nombre || ""}`}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-text mb-4">Información de la Lista</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Nombre</p>
            <p className="font-medium">{listaPrecio.nombre || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Descripción</p>
            <p className="font-medium">{listaPrecio.description || "—"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-lg font-semibold text-text">
            Productos en la Lista
            <span className="ml-2 text-sm font-normal text-gray-500">
              {productosBase.length} producto(s)
            </span>
          </h2>
          <button
            onClick={() => navigate(`/lista-precio/${id}/edit`)}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Administrar productos
          </button>
        </div>

        {productosBase.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay productos en esta lista.</p>
        ) : (
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-right">Unidades por caja</th>
                <th className="px-3 py-2 text-right">Precio por unidad</th>
                <th className="px-3 py-2 text-right">Precio por caja</th>
              </tr>
            </thead>
            <tbody>
              {productosBase.map((producto) => (
                <tr key={producto.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {getNombreComercial(producto)}
                  </td>
                  <td className="px-3 py-2 text-right">{producto.unidades_por_caja ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    ${producto.precio_unidad?.toLocaleString("es-CL") || "0"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    ${producto.precio_caja?.toLocaleString("es-CL") || "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
