import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axiosInstance from "../../axiosInstance";
import { ModifyButton, DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [producto, setProducto] = useState(null);

  useEffect(() => {
    const fetchProducto = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/productos-base/${id}`);
        setProducto(response.data);
      } catch (error) {
        console.error("Error fetching producto:", error);
      }
    };

    fetchProducto();
  }, [id]);

  const handleDeleteProduct = async () => {
    try {
      await axiosInstance.delete(`${import.meta.env.VITE_BACKEND_URL}/productos-base/${id}`);
      console.log('Producto eliminado');
      navigate('/Productos');
    } catch (error) {
      console.error('Error eliminando producto:', error);
    }
  };

  if (!producto) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Productos" />
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle del Producto</h1>
        <div className="flex gap-4">
          <ModifyButton onClick={() => navigate(`/Productos/${id}/edit`)} />
          <DeleteButton
            baseUrl={`${import.meta.env.VITE_BACKEND_URL}/productos-base`}
            entityId={id}
            onConfirmDelete={handleDeleteProduct}
            tooltipText="Eliminar Producto"
            entityName="producto"
          />
        </div>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg">
        <h2 className="text-xl font-semibold text-text mb-2">Información del Producto</h2>
        <table className="w-full bg-white rounded-lg shadow overflow-hidden">
          <tbody>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">ID</td>
              <td className="px-6 py-4 text-sm text-text">{producto.id}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Nombre</td>
              <td className="px-6 py-4 text-sm text-text">{producto.nombre}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Cantidad</td>
              <td className="px-6 py-4 text-sm text-text">{producto.peso_unitario} {producto.unidad_medida}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Precio</td>
              <td className="px-6 py-4 text-sm text-text">${producto.precio_unitario}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Descripción</td>
              <td className="px-6 py-4 text-sm text-text">{producto.descripcion}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Unidades por Caja</td>
              <td className="px-6 py-4 text-sm text-text">{producto.unidades_por_caja}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Código EAN</td>
              <td className="px-6 py-4 text-sm text-text">{producto.codigo_ean}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Código SAP</td>
              <td className="px-6 py-4 text-sm text-text">{producto.codigo_sap}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
} 