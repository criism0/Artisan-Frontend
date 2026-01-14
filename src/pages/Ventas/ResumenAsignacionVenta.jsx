import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ArrowLeft } from "lucide-react";

export default function ResumenAsignacionVenta() {
  const { ordenId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  const [orden, setOrden] = useState(null);
  const [resumenAsignaciones, setResumenAsignaciones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [palletIdNum, setPalletIdNum] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Obtener datos pasados desde la navegación o cargar desde el backend
        if (location.state?.resumen && location.state?.orden) {
          // Cargar productos base para obtener los nombres si no vienen en el resumen
          const productosBaseRes = await api(`/productos-base`);
          const productosBase = Array.isArray(productosBaseRes) 
            ? productosBaseRes 
            : productosBaseRes.data || [];
          
          // Actualizar los nombres de productos en el resumen si es necesario
          const resumenConNombres = {
            ...location.state.resumen,
            productosAsignados: location.state.resumen.productosAsignados?.map((producto) => {
              const productoBase = productosBase.find(p => p.id === producto.id_producto);
              return {
                ...producto,
                nombre: productoBase?.nombre || producto.nombre || `Producto #${producto.id_producto}`,
              };
            }) || [],
          };
          
          setResumenAsignaciones(resumenConNombres);
          setOrden(location.state.orden);
          // Obtener el pallet ID desde la orden para poder usarlo en el botón
          const palletFromState = location.state.orden.productos_ingresados?.[0];
          if (palletFromState?.id) {
            setPalletIdNum(palletFromState.id);
          }
          setLoading(false);
          return;
        }
        // Cargar productos base para obtener los nombres
        const productosBaseRes = await api(`/productos-base`);
        const productosBase = Array.isArray(productosBaseRes) 
          ? productosBaseRes 
          : productosBaseRes.data || [];
        
        // Obtener bultos asignados por producto desde el endpoint
        const bultosPorProductoBase = await api(`/ordenes-venta/${ordenId}/added-products`);
        
        // Si no vienen datos, cargar desde el backend
        const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
        const ordenData = resOrden.data || resOrden;
        setOrden(ordenData);

        // Obtener el pallet desde productos_ingresados
        const pallet = ordenData.productos_ingresados?.[0];
        const palletId = pallet?.identificador;
        const palletIdNumValue = pallet?.id;
        const bodegaId = ordenData.bodega_id || ordenData.bodega?.id;

        if (!palletId || !palletIdNumValue) {
          toast.error("La orden no tiene un pallet asociado");
          setLoading(false);
          return;
        }

        // Guardar el ID del pallet para usarlo en el botón de volver a pendiente
        setPalletIdNum(palletIdNumValue);

        // Obtener productos de la orden
        const productosOrden = ordenData.productos || ordenData.productosOrden || [];

        // Construir el resumen usando los bultos asignados por Producto Comercial
        const productosAsignados = productosOrden.map((productoOrden) => {
          // Buscar el nombre del producto en la lista de productos base
          const productoBase = productosBase.find(p => p.id === productoOrden.id_producto);
          const nombreProducto = productoBase?.nombre || `Producto #${productoOrden.id_producto}`;
          
          // Obtener los bultos asignados para este Producto Comercial
          const idProductoBase = String(productoOrden.id_producto);
          const bultosProducto = Array.isArray(bultosPorProductoBase[idProductoBase]) 
            ? bultosPorProductoBase[idProductoBase] 
            : [];

          // Calcular el total de unidades asignadas
          const totalAsignado = bultosProducto.reduce(
            (sum, b) => sum + (Number(b.cantidad_unidades) || Number(b.unidades_disponibles) || 0),
            0
          );

          return {
            id_producto: productoOrden.id_producto,
            nombre: nombreProducto,
            cantidad_requerida: Number(productoOrden.cantidad) || 0,
            total_asignado: totalAsignado,
            bultos: bultosProducto.map((b) => ({
              bulto_id: b.identificador || b.id,
              identificador: b.identificador || b.id,
              unidades_a_mover: Number(b.cantidad_unidades) || Number(b.unidades_disponibles) || 0,
              unidades_disponibles: Number(b.unidades_disponibles) || Number(b.cantidad_unidades) || 0,
              cantidad_unidades: Number(b.cantidad_unidades) || 0,
            })),
          };
        });

        setResumenAsignaciones({
          productosAsignados,
          palletId,
          bodegaId,
        });
      } catch (err) {
        toast.error("Error al cargar los datos de la orden");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ordenId, location.state, api]);

  const handleVolverAPendiente = async () => {
    const palletIdentificador = resumenAsignaciones?.palletId;
    if (!palletIdentificador) {
      toast.error("No se encontró el pallet asociado");
      return;
    }

    if (!window.confirm("¿Estás seguro de volver esta orden a estado Pendiente? Esto eliminará el pallet actual y creará uno nuevo vacío.")) {
      return;
    }

    setIsProcessing(true);
    try {

      // Volver la orden a estado "Pendiente"
      await api(`/ordenes-venta/${ordenId}/volver-a-pendiente`, {
        method: "PUT",
      });
      toast.success("Estado actualizado a Pendiente");

      // Navegar a la vista de asignar productos
      navigate(`/ventas/ordenes/${ordenId}/asignar`);
    } catch (err) {
      toast.error("Error al procesar la solicitud. Por favor, intenta nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  if (!orden || !resumenAsignaciones) {
    return <div className="p-6">No se pudieron cargar los datos</div>;
  }

  const { productosAsignados, palletId, bodegaId } = resumenAsignaciones;

  // Verificar el estado de la orden
  const puedeVolverAPendiente = orden.estado === "Listo-para-despacho";

  return (
    <div className="p-6 bg-background min-h-screen">
      <button
        onClick={() => navigate("/ventas/ordenes")}
        className="flex items-center text-primary mb-4 hover:underline"
      >
        <ArrowLeft size={18} className="mr-1" /> Volver a Órdenes
      </button>

      <h1 className="text-2xl font-bold mb-6 text-text">
        Resumen de Asignación - Orden #{ordenId}
      </h1>

      {/* Información de la Orden */}
      <div className="bg-white shadow rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Información de la Orden</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Número OC:</span> {orden.numero_oc || "—"}
          </div>
          <div>
            <span className="font-medium">Estado:</span> {orden.estado || "—"}
          </div>
          <div>
            <span className="font-medium">Fecha de Orden:</span>{" "}
            {orden.fecha_orden
              ? new Date(orden.fecha_orden).toLocaleDateString("es-CL")
              : "—"}
          </div>
          <div>
            <span className="font-medium">Fecha de Entrega:</span>{" "}
            {orden.fecha_envio
              ? new Date(orden.fecha_envio).toLocaleDateString("es-CL")
              : "—"}
          </div>
          <div>
            <span className="font-medium">Pallet:</span> {palletId || "—"}
          </div>
          <div>
            <span className="font-medium">Bodega ID:</span> {bodegaId || "—"}
          </div>
        </div>
      </div>

      {/* Resumen de Productos Asignados */}
      <div className="bg-white shadow rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Resumen de Productos Asignados</h2>
        <div className="space-y-4">
          {productosAsignados.map((producto, index) => (
            <div key={index} className="border-b pb-4 last:border-b-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">
                    {producto.nombre || `Producto #${producto.id_producto}`}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Cantidad requerida: {producto.cantidad_requerida} unidades
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">
                    {producto.total_asignado} unidades asignadas
                  </p>
                  {producto.total_asignado >= producto.cantidad_requerida ? (
                    <span className="text-xs text-green-600">✓ Completo</span>
                  ) : (
                    <span className="text-xs text-orange-600">
                      Faltan {producto.cantidad_requerida - producto.total_asignado} unidades
                    </span>
                  )}
                </div>
              </div>

              {/* Bultos asignados para este producto */}
              {producto.bultos && producto.bultos.length > 0 && (
                <div className="mt-3 ml-4">
                  <p className="text-sm font-medium mb-2">Bultos asignados:</p>
                  <div className="space-y-1">
                    {producto.bultos.map((bulto, bIndex) => (
                      <div
                        key={bIndex}
                        className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                      >
                        <span>
                          Bulto {bulto.identificador || bulto.bulto_id} -{" "}
                          {bulto.unidades_a_mover} unidades
                        </span>
                        <span className="text-gray-600">
                          Disponible: {bulto.unidades_disponibles || bulto.cantidad_unidades}{" "}
                          unidades
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resumen Total */}
      <div className="bg-white shadow rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Resumen Total</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total de productos:</span>
            <span className="font-semibold">{productosAsignados.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Total de unidades asignadas:</span>
            <span className="font-semibold">
              {productosAsignados.reduce(
                (sum, p) => sum + (p.total_asignado || 0),
                0
              )}{" "}
              unidades
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total de bultos asignados:</span>
            <span className="font-semibold">
              {productosAsignados.reduce(
                (sum, p) => sum + (p.bultos?.length || 0),
                0
              )}{" "}
              bultos
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-4 justify-end">
        {puedeVolverAPendiente && (
          <button
            onClick={handleVolverAPendiente}
            disabled={isProcessing}
            className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Procesando..." : "Volver a Estado Pendiente"}
          </button>
        )}
        <button
          onClick={() => navigate(`/ventas/ordenes/${ordenId}`)}
          className="px-6 py-2 bg-gray-300 hover:bg-gray-400 rounded"
        >
          Ver Detalle de Orden
        </button>
        <button
          onClick={() => navigate("/ventas/ordenes")}
          className="px-6 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Volver a Lista de Órdenes
        </button>
      </div>
    </div>
  );
}

