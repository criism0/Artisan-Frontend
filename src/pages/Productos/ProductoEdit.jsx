import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import DynamicFormWithSelect from "../../components/DynamicFormWithSelect";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function ProductoEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [productoData, setProductoData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    const fetchProductoData = async () => {
      try {
        const data = await api(`/productos-base/${id}`);
        setProductoData({
          data: {
            nombre: data.nombre,
            descripcion: data.descripcion,
            peso: data.peso_unitario,
            unidad_medida: data.unidad_medida || '',
            precio: data.precio_unitario,
            unidades_por_caja: data.unidades_por_caja,
            codigo_ean: data.codigo_ean,
            codigo_sap: data.codigo_sap
          },
          labels: {
            nombre: "Nombre del Producto",
            descripcion: "Descripción",
            peso: "Cantidad por Unidad",
            precio: "Precio Unitario",
            unidad_medida: "Unidad de Medida",
            unidades_por_caja: "Unidades por Caja",
            codigo_ean: "Código EAN",
            codigo_sap: "Código SAP"
          }
        });
        setError(null);
      } catch (error) {
        console.error("Error fetching product data:", error);
        setError("Error al cargar los datos del producto. Por favor, intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProductoData();
    } else {
      setLoading(false);
      setError("No se proporcionó ID de producto.");
    }
  }, [id]);

  // Reglas de validación
  const validationRules = {
    nombre: (value) => {
      if (!value || value.trim().length < 3) {
        return 'El nombre del producto debe tener al menos 3 caracteres';
      }
      return '';
    },
    descripcion: (value) => {
      if (!value || value.trim().length < 10) {
        return 'La descripción debe tener al menos 10 caracteres';
      }
      return '';
    },
    peso: (value) => {
      if (!value) {
        return 'El peso es requerido';
      }
      const peso = parseFloat(value);
      if (isNaN(peso) || peso <= 0) {
        return 'El peso debe ser un número mayor a 0';
      }
      return '';
    },
    precio: (value) => {
      if (!value) {
        return 'El precio es requerido';
      }
      const precio = parseFloat(value);
      if (isNaN(precio) || precio <= 0) {
        return 'El precio debe ser un número mayor a 0';
      }
      return '';
    },

    unidades_por_caja: (value) => {
      if (!value) {
        return 'La cantidad de unidades por caja es requerida';
      }
      const unidades_por_caja = parseInt(value);
      if (isNaN(unidades_por_caja) || unidades_por_caja <= 0) {
        return 'La cantidad de unidades por caja debe ser un número mayor a 0';
      }
      return '';
    },
  };

  const selectOptions = {
    unidad_medida: [
      { value: "Kilogramos", label: "Kilogramos" },
      { value: "Litros", label: "Litros" },
      { value: "Unidades", label: "Unidades" }
    ]
  };

  const handleFormSubmit = async (formData) => {
    try {
      setError(null);
      const formattedData = {
        nombre: formData.nombre,
        precio_unitario: parseFloat(formData.precio),
        peso_unitario: parseFloat(formData.peso),
        descripcion: formData.descripcion,
        unidad_medida: formData.unidad_medida,
        unidades_por_caja: parseInt(formData.unidades_por_caja),
        codigo_ean: formData.codigo_ean,
        codigo_sap: formData.codigo_sap
      };

      await api(`/productos-base/${id}`, { method: 'PUT', body: JSON.stringify(formattedData) });
      navigate(`/Productos/${id}`);
    } catch (error) {
      console.error("Error updating product:", error);
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        "Error al actualizar el producto. Por favor, verifica los datos e intenta nuevamente.";
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

  if (!productoData && !loading) return (
    <div className="p-6 bg-background min-h-screen">
      <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
        {error || "No se encontró el producto"}
      </div>
    </div>
  );

  if (!productoData) return null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Productos/${id}`} />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">Editar Producto</h1>
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <DynamicFormWithSelect
        entity={productoData}
        onSubmit={handleFormSubmit}
        validationRules={validationRules}
        selectOptions={selectOptions}
      />
    </div>
  );
} 