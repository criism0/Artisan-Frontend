import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import DynamicFormWithSelect from "../../components/DynamicFormWithSelect";
import ProductosBaseManager from "../../components/ProductosBaseManager";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function ListaPrecioEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listaPrecioData, setListaPrecioData] = useState(null);
  const [productosBase, setProductosBase] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    const fetchListaPrecioData = async () => {
      try {
        const data = await api(`/lista-precio/${id}`);
        setListaPrecioData({
          data: {
            nombre: data.nombre,
            description: data.description
          },
          labels: {
            nombre: "Nombre de la Lista",
            description: "Descripción"
          }
        });
        if (Array.isArray(data?.productosBaseListaPrecio)) {
          setProductosBase(data.productosBaseListaPrecio);
        }
        setError(null);
      } catch (error) {
        setError("Error al cargar los datos de la lista de precio. Por favor, intenta nuevamente.");
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
      fetchListaPrecioData();
      // Fallback por si no vienen embebidos
      fetchProductos();
    } else {
      setLoading(false);
      setError("No se proporcionó ID de lista de precio.");
    }
  }, [id, api]);

  const validationRules = {
    nombre: (value) => {
      if (!value || value.trim().length < 3) {
        return 'El nombre de la lista debe tener al menos 3 caracteres';
      }
      return '';
    },
    description: (value) => {
      if (!value || value.trim().length < 10) {
        return 'La descripción debe tener al menos 10 caracteres';
      }
      return '';
    }
  };

  const selectOptions = {};

  const handleFormSubmit = async (formData) => {
    try {
      setError(null);
      const formattedData = {
        nombre: formData.nombre,
        description: formData.description
      };

      await api(`/lista-precio/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(formattedData) 
      });
      navigate(`/lista-precio/${id}`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          "Error al actualizar la lista de precio. Por favor, verifica los datos e intenta nuevamente.";
      setError(errorMessage);
    }
  };

  if (loading) return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-primary">Cargando datos...</span>
      </div>
    </div>
  );

  if (!listaPrecioData && !loading) return (
    <div className="p-6 bg-background min-h-screen">
      <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
        {error || "No se encontró la lista de precio"}
      </div>
    </div>
  );

  if (!listaPrecioData) return null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/lista-precio/${id}`} />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">Editar Lista de Precio</h1>
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <DynamicFormWithSelect 
        entity={listaPrecioData} 
        onSubmit={handleFormSubmit}
        validationRules={validationRules}
        selectOptions={selectOptions}
      />

      {/* Productos asociados: editar/eliminar usando el manager */}
      <div className="mt-8">
        <ProductosBaseManager
          listaPrecioId={id}
          productosBase={productosBase}
          onProductosBaseChange={setProductosBase}
          isEditing={true}
        />
      </div>
    </div>
  );
}
