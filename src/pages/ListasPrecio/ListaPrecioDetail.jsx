import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { ModifyButton, DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";
import ProductosBaseManager from "../../components/ProductosBaseManager";

export default function ListaPrecioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listaPrecio, setListaPrecio] = useState(null);
  const [productosBase, setProductosBase] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useApi();

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
    try {
      await api(`/lista-precio/${id}`, {
        method: "DELETE",
      });
      navigate('/lista-precio');
    } catch (error) {
      console.error('Error eliminando lista de precio:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text">Cargando lista de precio...</p>
        </div>
      </div>
    );
  }

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
        <div className="flex gap-4">
          <ModifyButton onClick={() => navigate(`/lista-precio/${id}/edit`)} />
          <DeleteButton 
            onConfirmDelete={handleDeleteListaPrecio}
            tooltipText="Eliminar Lista de Precio"
            entityName="lista de precio"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <tbody>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Nombre</td>
              <td className="px-6 py-4 text-sm text-text">{listaPrecio.nombre}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-sm font-medium text-text">Descripción</td>
              <td className="px-6 py-4 text-sm text-text">{listaPrecio.description}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        {/* Mostrar en modo solo lectura reusando el manager sin acciones */}
        <ProductosBaseManager
          listaPrecioId={id}
          productosBase={productosBase}
          onProductosBaseChange={() => {}}
          isEditing={false}
        />
      </div>
    </div>
  );
}
