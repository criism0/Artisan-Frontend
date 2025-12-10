import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState } from "react";
import { useApi } from "../../lib/api";
import ProductosBaseManager from "../../components/ProductosBaseManager";

export default function AddListaPrecio() {
  const navigate = useNavigate();
  const api = useApi();
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    description: ""
  });
  const [errors, setErrors] = useState({});
  const [productosBase, setProductosBase] = useState([]);
  const [listaPrecioId, setListaPrecioId] = useState(null);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim() || formData.nombre.trim().length < 3) 
      newErrors.nombre = "El nombre de la lista debe tener al menos 3 caracteres";
    if (!formData.description.trim() || formData.description.trim().length < 10) 
      newErrors.description = "La descripción debe tener al menos 10 caracteres.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setError(null);
      const formattedData = {
        nombre: formData.nombre,
        description: formData.description
      };

      if (productosBase.length > 0) {
        const listaResponse = await api("/lista-precio", {
          method: "POST",
          body: JSON.stringify(formattedData)
        });

        const nuevaListaId = listaResponse.id;

        try {
          for (const producto of productosBase) {
            const productoData = {
              id_lista_precio: nuevaListaId,
              id_producto_base: producto.id_producto_base,
              unidades_por_caja: producto.unidades_por_caja,
              precio_unidad: producto.precio_unidad,
              precio_caja: producto.precio_caja
            };
            await api("/producto-base-lista-precio", {
              method: "POST",
              body: JSON.stringify(productoData)
            });
          }
        } catch (productoError) {
          alert("Lista de precio creada pero hubo un error al guardar algunos productos. Puedes editarlos después.");
        }
      } else {
        await api("/lista-precio", {
          method: "POST",
          body: JSON.stringify(formattedData)
        });
      }

      navigate("/lista-precio");
    } catch (error) {
      setError(
        "No se pudo crear la lista de precio. Verifica los datos e intenta nuevamente."
      );
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/lista-precio" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-6">
        Añadir Lista de Precio
      </h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4"
      >
        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de la Lista *
          </label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Lista Precios 2024"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        {/* DESCRIPCIÓN */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Descripción *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Ej: Lista de precios vigente para el año 2024, incluye todos los productos con descuentos especiales."
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.description ? "border-red-500" : "border-gray-300"
            }`}
            rows={4}
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        {/* SECCIÓN DE PRODUCTOS BASE */}
        <div className="mt-8 mb-6">
          <ProductosBaseManager 
            listaPrecioId={listaPrecioId}
            productosBase={productosBase}
            onProductosBaseChange={setProductosBase}
            isEditing={true}
          />
        </div>

        {/* BOTÓN */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
          >
            Crear Lista de Precio
          </button>
        </div>
      </form>
    </div>
  );
}

