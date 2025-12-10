import { useState, useEffect } from "react";
import ProductoBaseModal from "./ProductoBaseModal";
import { api } from "../lib/api";

export default function ProductosBaseManager({ 
  listaPrecioId, 
  productosBase = [], 
  onProductosBaseChange,
  isEditing = false 
}) {
  const [productosList, setProductosList] = useState(productosBase);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setProductosList(productosBase);
  }, [productosBase]);

  const handleAddProducto = () => {
    setEditingProducto(null);
    setIsModalOpen(true);
  };

  const handleEditProducto = (producto) => {
    setEditingProducto(producto);
    setIsModalOpen(true);
  };

  const handleSaveProducto = async (productoData, productosParaActualizar = null) => {
    setLoading(true);
    try {
      const existe = productosList.some(
        (p) => p.id_producto_base === productoData.id_producto_base && (!editingProducto || p.id !== editingProducto.id)
      );
      if (existe) {
        alert("Solo se puede agregar 1 vez el producto");
        return;
      }

      let updatedProducto = null;
      let nuevoProducto = null;
      
      if (editingProducto) {
        // Actualizar producto existente
        if (listaPrecioId && !editingProducto.id.toString().startsWith('temp-')) {
          // Si la lista ya existe y el producto no es temporal, actualizar en el backend
          updatedProducto = await api(`/producto-base-lista-precio/${editingProducto.id}`, {
            method: "PUT",
            body: JSON.stringify(productoData)
          });
          
          setProductosList(prev => 
            prev.map(prod => prod.id === editingProducto.id ? updatedProducto : prod)
          );
        } else {
          // Si la lista no existe aún o el producto es temporal, actualizar solo localmente
          updatedProducto = {
            ...editingProducto,
            ...productoData,
            id: editingProducto.id || `temp-${Date.now()}`
          };
          
          setProductosList(prev => 
            prev.map(prod => prod.id === editingProducto.id ? updatedProducto : prod)
          );
        }
      } else {
        // Crear nuevo producto
        if (listaPrecioId) {
          // Si la lista ya existe, crear en el backend
          nuevoProducto = await api("/producto-base-lista-precio", {
            method: "POST",
            body: JSON.stringify({
              ...productoData,
              id_lista_precio: listaPrecioId
            })
          });
          
          setProductosList(prev => [...prev, nuevoProducto]);
        } else {
          // Si la lista no existe aún, crear solo localmente
          nuevoProducto = {
            ...productoData,
            id: `temp-${Date.now()}`,
            id_lista_precio: null
          };
          
          setProductosList(prev => [...prev, nuevoProducto]);
        }
      }
      
      // Notificar al componente padre con los productos actualizados
      if (onProductosBaseChange) {
        let updatedProductos;
        if (editingProducto) {
          // Actualizando producto existente
          updatedProductos = productosList.map(prod => 
            prod.id === editingProducto.id ? updatedProducto : prod
          );
        } else {
          // Agregando nuevo producto
          updatedProductos = [...productosList, nuevoProducto];
        }
        
        onProductosBaseChange(updatedProductos);
      }
    } catch (error) {
      const backendMsg = error?.response?.data?.error || error?.response?.data?.message || "";
      if (error?.response?.status === 409 || /unique|duplicado|ya existe/i.test(backendMsg)) {
        alert("Solo se puede agregar 1 vez el producto");
      } else {
        alert("Error al guardar el producto");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProducto = async (productoId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este producto de la lista?")) {
      return;
    }

    setLoading(true);
    try {
      if (listaPrecioId && !productoId.toString().startsWith('temp-')) {
        await api(`/producto-base-lista-precio/${productoId}`, { method: "DELETE" });
      }
      
      // Eliminar de la lista local (tanto si es temporal como si no)
      setProductosList(prev => prev.filter(prod => prod.id !== productoId));
      
      if (onProductosBaseChange) {
        onProductosBaseChange(productosList.filter(prod => prod.id !== productoId));
      }
    } catch (error) {
      alert("Error al eliminar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Productos en la Lista</h3>
        {isEditing && (
          <button
            type="button"
            onClick={handleAddProducto}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Añadir Producto
          </button>
        )}
      </div>

      {productosList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <p>No hay productos en esta lista</p>
          {isEditing && (
            <p className="text-sm mt-1">Haz clic en "Añadir Producto" para comenzar</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {productosList.map((producto) => (
            <div
              key={producto.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">📦</span>
                    <span className="font-medium text-gray-900">
                      {producto.nombre_producto || producto.productoBase?.nombre || `Producto #${producto.id_producto_base}`}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Unidades por caja:</strong> {producto.unidades_por_caja}</p>
                    <p><strong>Precio por unidad:</strong> ${producto.precio_unidad?.toLocaleString('es-CL') || '0'}</p>
                    <p><strong>Precio por caja:</strong> ${producto.precio_caja?.toLocaleString('es-CL') || '0'}</p>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEditProducto(producto)}
                      disabled={loading}
                      className="px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-sm disabled:opacity-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProducto(producto.id)}
                      disabled={loading}
                      className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-sm disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductoBaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProducto}
        producto={editingProducto}
        isEditing={!!editingProducto}
      />
    </div>
  );
}
