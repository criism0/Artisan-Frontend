import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../../axiosInstance";

export default function InventarioProductosTerminados() {
  const { idBodega } = useParams();
  const [bodegas, setBodegas] = useState([]);
  const [bodega, setBodega] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/bodegas`);
        setBodegas(res.data.bodegas || []);
        if (idBodega && idBodega !== 'global') {
          const found = (res.data.bodegas || []).find(b => String(b.id) === String(idBodega));
          setBodega(found);
        }
      } catch {
        setError("Error al cargar bodegas");
      }
    };
    fetchBodegas();
  }, [idBodega]);

  useEffect(() => {
    const fetchProductos = async () => {
      setLoading(true);
      try {
        if (idBodega === 'global') {
          // Obtener productos de todas las bodegas
          const all = [];
          for (const bodega of bodegas) {
            try {
              const res = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/bodegas/${bodega.id}/productos_finales`);
              const productosBodega = (res.data.productos || []).map(p => ({ ...p, bodega: bodega.nombre }));
              all.push(...productosBodega);
            } catch {}
          }
          setProductos(all);
        } else {
          const res = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/bodegas/${idBodega}/productos_finales`);
          setProductos(res.data.productos || []);
        }
      } catch {
        setError("Error al cargar inventario de productos terminados");
      } finally {
        setLoading(false);
      }
    };
    if (idBodega) fetchProductos();
  }, [idBodega, bodegas]);

  if (loading) return <div className="p-8 text-center">Cargando inventario...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Inventario de Productos Terminados{idBodega === 'global' ? ' (Global)' : ''}</h1>
      {idBodega !== 'global' && <h2 className="text-lg font-semibold mb-4 text-primary">{bodega ? bodega.nombre : "Bodega"}</h2>}
      <div className="bg-white rounded shadow p-4">
        {productos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border rounded-lg text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {idBodega === 'global' && <th className="px-4 py-3 text-left font-semibold text-gray-700">Bodega</th>}
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Peso (kg)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Peso Referencial (kg)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha Vencimiento</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Precio Venta</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Costo</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((prod, idx) => (
                  <tr key={prod.id + (prod.bodega || '')} className="border-b hover:bg-gray-50">
                    {idBodega === 'global' && <td className="px-4 py-3">{prod.bodega}</td>}
                    <td className="px-4 py-3">{prod.productoBase?.nombre || prod.nombre}</td>
                    <td className="px-4 py-3">{prod.peso}</td>
                    <td className="px-4 py-3">{prod.peso_referencial}</td>
                    <td className="px-4 py-3">{prod.fecha_vencimiento ? new Date(prod.fecha_vencimiento).toLocaleDateString() : ''}</td>
                    <td className="px-4 py-3">{prod.precio_venta}</td>
                    <td className="px-4 py-3">{prod.costo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500">No hay productos terminados{idBodega === 'global' ? ' en ninguna bodega.' : ' en esta bodega.'}</div>
        )}
      </div>
    </div>
  );
} 