import { useState, useEffect } from "react";
import ProductoBaseModal from "./ProductoBaseModal";
import { EditButton, TrashButton } from "../Buttons/ActionButtons";
import { api } from "../../lib/api";
import toast from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

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

  const canWriteBaseProductPriceList = checkScope(ModelType.PRODUCTO_BASE_LISTA_PRECIO, ScopeType.WRITE);
  const canDeleteBaseProductPriceList = checkScope(ModelType.PRODUCTO_BASE_LISTA_PRECIO, ScopeType.DELETE);

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
    if (!canWriteBaseProductPriceList) {
      toast.permissionError([ModelType.PRODUCTO_BASE_LISTA_PRECIO, ScopeType.WRITE]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const existe = productosList.some(
        (p) => p.id_producto_base === productoData.id_producto_base && (!editingProducto || p.id !== editingProducto.id)
      );
      if (existe) {
        toast.warning("Solo se puede agregar 1 vez el producto");
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
        toast.warning("Solo se puede agregar 1 vez el producto");
      } else {
        toast.error("Error al guardar el producto");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProducto = async (productoId) => {
    if (!canDeleteBaseProductPriceList) {
      toast.permissionError([ModelType.PRODUCTO_BASE_LISTA_PRECIO, ScopeType.DELETE]);
      setLoading(false);
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
      toast.error("Error al eliminar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-text">
          Productos en la Lista
          <span className="ml-2 text-sm font-normal text-gray-500">
            {productosList.length} producto(s)
          </span>
        </h3>
        {isEditing && (
          <button
            type="button"
            onClick={handleAddProducto}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Añadir Producto
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
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-right">Unidades por caja</th>
              <th className="px-3 py-2 text-right">Precio por unidad</th>
              <th className="px-3 py-2 text-right">Precio por caja</th>
              {isEditing && <th className="px-3 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {productosList.map((producto) => (
              <tr key={producto.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {producto.nombre_producto || producto.productoBase?.nombre || `Producto #${producto.id_producto_base}`}
                </td>
                <td className="px-3 py-2 text-right">{producto.unidades_por_caja ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  ${producto.precio_unidad?.toLocaleString('es-CL') || '0'}
                </td>
                <td className="px-3 py-2 text-right">
                  ${producto.precio_caja?.toLocaleString('es-CL') || '0'}
                </td>
                {isEditing && (
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <EditButton
                        onClick={() => handleEditProducto(producto)}
                        tooltipText="Editar producto"
                      />
                      {canDeleteBaseProductPriceList && (
                        <TrashButton
                          onConfirmDelete={() => handleDeleteProducto(producto.id)}
                          tooltipText="Eliminar producto de la lista"
                          entityName={
                            producto.nombre_producto ||
                            producto.productoBase?.nombre ||
                            `Producto #${producto.id_producto_base}`
                          }
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
