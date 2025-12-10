import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ArrowLeft, Plus } from "lucide-react";

export default function AsignarVenta() {
  const { ordenId } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [orden, setOrden] = useState(null);
  const [pallets, setPallets] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [productosAgregados, setProductosAgregados] = useState({});
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [resumenProductos, setResumenProductos] = useState([]);
  const [asignacionesPendientes, setAsignacionesPendientes] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPallet, setIsCreatingPallet] = useState(false);
  const [palletEnEdicion, setPalletEnEdicion] = useState(null);
  const [unidadesADesasociar, setUnidadesADesasociar] = useState({});
  const [isRemovingBulto, setIsRemovingBulto] = useState(false);
  const [isRemovingPallet, setIsRemovingPallet] = useState(false);
  // Paginación client-side para bultos disponibles por producto
  const [productosDisponiblesPage, setProductosDisponiblesPage] = useState({});
  const PAGE_SIZE = 8; // items por página (ajustable)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar orden de venta
        const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
        const ordenData = resOrden.data || resOrden;
        setOrden(ordenData);

        // Obtener todos los pallets asociados a la orden desde productos_ingresados
        const palletsAsociados = [];
        if (ordenData.productos_ingresados && Array.isArray(ordenData.productos_ingresados)) {
          const palletsUnicos = new Map();
          for (const item of ordenData.productos_ingresados) {
            if (item.identificador && !palletsUnicos.has(item.identificador)) {
              palletsUnicos.set(item.identificador, item);
            }
          }
          palletsAsociados.push(...palletsUnicos.values());
        }

        setPallets(palletsAsociados);

        // Cargar productos agregados a la orden (los que ya están en pallets)
        const resProductosAgregados = await api(`/ordenes-venta/${ordenId}/added-products`);
        const productosAgregadosData = resProductosAgregados.data || resProductosAgregados || {};
        setProductosAgregados(productosAgregadosData);

        // Cargar productos base para obtener los nombres
        const productosBaseRes = await api(`/productos-base`);
        const productosBaseList = Array.isArray(productosBaseRes) 
          ? productosBaseRes 
          : productosBaseRes.data || [];
        setProductosBase(productosBaseList);

        // Cargar productos disponibles para asignación
        const resProductosDisponibles = await api(`/ordenes-venta/productos-disponibles`);
        const productosDisponiblesData = Array.isArray(resProductosDisponibles)
          ? resProductosDisponibles
          : resProductosDisponibles.data || [];
        setProductosDisponibles(productosDisponiblesData);

        // Calcular resumen de productos
        if (ordenData.productos && Array.isArray(ordenData.productos)) {
          const resumen = ordenData.productos.map((productoOrden) => {
            const idProducto = productoOrden.id_producto;
            const cantidadRequerida = productoOrden.cantidad || 0;

            // Obtener bultos ya asignados a este producto
            const bultosAsignados = productosAgregadosData[idProducto] || [];
            const cantidadAsignada = Array.isArray(bultosAsignados)
              ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
              : 0;

            const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);
            const productoBase = productosBaseList.find(p => p.id == idProducto);

            return {
              id: productoOrden.id,
              idProducto,
              nombreProducto: productoBase?.nombre || `Producto #${idProducto}`,
              cantidadRequerida,
              cantidadAsignada,
              cantidadFaltante,
              estado: cantidadFaltante === 0 ? 'completo' : 'pendiente'
            };
          });
          setResumenProductos(resumen);
        }
      } catch (err) {
        toast.error("Error al cargar los datos de la orden");
      }
    };

    fetchData();
  }, [ordenId, api]);

  const handleUnidadesChange = (productoId, bultoId, unidades) => {
    setAsignacionesPendientes((prev) => {
      const actuales = prev[productoId] || [];
      const yaExiste = actuales.find((b) => b.bulto_id === bultoId);

      let nuevos;
      if (yaExiste) {
        nuevos = actuales.map((b) =>
          b.bulto_id === bultoId ? { ...b, unidades_a_mover: Number(unidades) || 0 } : b
        );
      } else {
        nuevos = [
          ...actuales,
          { bulto_id: bultoId, unidades_a_mover: Number(unidades) || 0 },
        ];
      }

      // Filtrar asignaciones con unidades > 0
      return { ...prev, [productoId]: nuevos.filter((b) => b.unidades_a_mover > 0) };
    });
  };

  const calcularTotalAsignado = (productoId) => {
    const asignacionesProducto = asignacionesPendientes[productoId] || [];
    return asignacionesProducto.reduce(
      (acc, b) => acc + (b.unidades_a_mover || 0),
      0
    );
  };

  const obtenerBultosDisponiblesPorProducto = (idProducto) => {
    const bultosDisponibles = [];
    // Intentar obtener id de bodega de la orden (puede venir como bodega_id o como objeto bodega)
    const bodegaOrdenId = orden?.bodega_id ?? orden?.bodega?.id;

    // Obtener bultos sin orden desde productosDisponibles
    const producto = productosDisponibles.find(p => p.id == idProducto);
    if (producto && producto.lotesProductoFinal && Array.isArray(producto.lotesProductoFinal)) {
      for (const lote of producto.lotesProductoFinal) {
        if (lote.LoteProductoFinalBultos && Array.isArray(lote.LoteProductoFinalBultos)) {
          for (const bulto of lote.LoteProductoFinalBultos) {
            // Filtro por bodega: si conocemos la bodega de la orden, exigir coincidencia
            if (bodegaOrdenId != null && bulto.id_bodega != bodegaOrdenId) {
              // Este bulto no pertenece a la bodega desde la que se hace la orden
              continue;
            }

            // Filtro por pallet/orden: si el bulto tiene id_pallet pero el include 'pallet' vino como null,
            // significa que ese pallet no cumple el where (p. ej. pertenece a otra orden). Excluir.
            if (bulto.id_pallet && !bulto.pallet) {
              continue;
            }

            // Si el pallet está incluido, doble chequeo: si tiene id_orden_de_venta distinto a la actual, excluir
            if (bulto.pallet && bulto.pallet.id_orden_de_venta && bulto.pallet.id_orden_de_venta !== parseInt(ordenId)) {
              continue;
            }

            bultosDisponibles.push({
              id: bulto.id,
              identificador: bulto.identificador,
              cantidad_unidades: bulto.cantidad_unidades,
              unidades_disponibles: bulto.unidades_disponibles || bulto.cantidad_unidades,
              id_bodega: bulto.id_bodega,
            });
          }
        }
      }
    }

    // Incluir también bultos que ya están en la orden actual (productosAgregados)
    const bultosEnOrden = productosAgregados[idProducto] || [];
    for (const b of bultosEnOrden) {
      const bultoId = b.identificador || b.id;
      // Evitar duplicados comparando por identificador/id
      const existe = bultosDisponibles.find((bb) => (bb.identificador || bb.id) == bultoId);
      if (!existe) {
        bultosDisponibles.push({
          id: b.id,
          identificador: b.identificador,
          cantidad_unidades: b.cantidad_unidades,
          unidades_disponibles: b.unidades_disponibles || b.cantidad_unidades,
          id_bodega: b.id_bodega,
        });
      }
    }

    return bultosDisponibles;
  };

  const handleCrearPalletVacio = async () => {
    if (isCreatingPallet) return;
    setIsCreatingPallet(true);

    try {
      if (!orden) {
        toast.error("No se encontró la orden");
        setIsCreatingPallet(false);
        return;
      }

      // Crear un pallet vacío usando el endpoint POST
      await api(`/ordenes-venta/${ordenId}/crear-pallet`, {
        method: "POST",
      });

      // Recargar los datos de la orden para obtener los nuevos pallets
      const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
      const ordenActualizada = resOrden.data || resOrden;
      setOrden(ordenActualizada);

      // Actualizar lista de pallets
      const palletsAsociados = [];
      if (ordenActualizada.productos_ingresados && Array.isArray(ordenActualizada.productos_ingresados)) {
        const palletsUnicos = new Map();
        for (const item of ordenActualizada.productos_ingresados) {
          if (item.identificador && !palletsUnicos.has(item.identificador)) {
            palletsUnicos.set(item.identificador, item);
          }
        }
        palletsAsociados.push(...palletsUnicos.values());
      }
      setPallets(palletsAsociados);

      // Recargar productos agregados
      const resProductosAgregados = await api(`/ordenes-venta/${ordenId}/added-products`);
      const productosAgregadosData = resProductosAgregados.data || resProductosAgregados || {};
      setProductosAgregados(productosAgregadosData);

      // Recargar productos disponibles para que el bulto recién desasociado vuelva a aparecer
      try {
        const resProductosDisponibles = await api(`/ordenes-venta/productos-disponibles`);
        const productosDisponiblesData = Array.isArray(resProductosDisponibles)
          ? resProductosDisponibles
          : resProductosDisponibles.data || [];
        setProductosDisponibles(productosDisponiblesData);
      } catch (err) {
        // No bloquear el flujo si falla este fetch; mostramos un log para debugging
        console.log('Error recargando productos disponibles después de quitar bulto:', err);
      }

      // Recalcular resumen de productos
      if (ordenActualizada.productos && Array.isArray(ordenActualizada.productos)) {
        const resumen = ordenActualizada.productos.map((productoOrden) => {
          const idProducto = productoOrden.id_producto;
          const cantidadRequerida = productoOrden.cantidad || 0;
          
          const bultosAsignados = productosAgregadosData[idProducto] || [];
          const cantidadAsignada = Array.isArray(bultosAsignados)
            ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
            : 0;
          
          const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);
          const productoBase = productosBase.find(p => p.id == idProducto);

          return {
            id: productoOrden.id,
            idProducto,
            nombreProducto: productoBase?.nombre || `Producto #${idProducto}`,
            cantidadRequerida,
            cantidadAsignada,
            cantidadFaltante,
            estado: cantidadFaltante === 0 ? 'completo' : 'pendiente'
          };
        });
        setResumenProductos(resumen);
      }

      // Limpiar estado
      setUnidadesADesasociar({});
      setPalletEnEdicion(null);

      toast.success("Pallet creado exitosamente");
    } catch (err) {
      console.log(err);
      toast.error("Error al crear el pallet");
    } finally {
      setIsCreatingPallet(false);
    }
  };

  const handleAsignarBultoAPallet = async (palletId, productoOrdenId) => {
    const bultosAsignados = asignacionesPendientes[productoOrdenId] || [];

    if (bultosAsignados.length === 0) {
      toast.error("Debes asignar al menos un bulto con unidades válidas.");
      return;
    }

    try {
      // Asignar cada bulto al pallet específico
      for (const asignacion of bultosAsignados) {
        await api(`/ordenes-venta/${ordenId}/asociar-bulto-a-pallet`, {
          method: "PUT",
          body: JSON.stringify({
            pallet_id: palletId,
            bulto_id: asignacion.bulto_id,
            unidades_a_mover: asignacion.unidades_a_mover,
          }),
        });
      }

      // Recargar los datos
      const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
      const ordenActualizada = resOrden.data || resOrden;
      setOrden(ordenActualizada);

      // Actualizar pallets
      const palletsAsociados = [];
      if (ordenActualizada.productos_ingresados && Array.isArray(ordenActualizada.productos_ingresados)) {
        const palletsUnicos = new Map();
        for (const item of ordenActualizada.productos_ingresados) {
          if (item.identificador && !palletsUnicos.has(item.identificador)) {
            palletsUnicos.set(item.identificador, item);
          }
        }
        palletsAsociados.push(...palletsUnicos.values());
      }
      setPallets(palletsAsociados);

      // Recargar productos agregados
      const resProductosAgregados = await api(`/ordenes-venta/${ordenId}/added-products`);
      const productosAgregadosData = resProductosAgregados.data || resProductosAgregados || {};
      setProductosAgregados(productosAgregadosData);

      // Recalcular resumen de productos
      if (ordenActualizada.productos && Array.isArray(ordenActualizada.productos)) {
        const resumen = ordenActualizada.productos.map((productoOrden) => {
          const idProducto = productoOrden.id_producto;
          const cantidadRequerida = productoOrden.cantidad || 0;
          
          const bultosAsignados = productosAgregadosData[idProducto] || [];
          const cantidadAsignada = Array.isArray(bultosAsignados)
            ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
            : 0;
          
          const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);
          const productoBase = productosBase.find(p => p.id == idProducto);

          return {
            id: productoOrden.id,
            idProducto,
            nombreProducto: productoBase?.nombre || `Producto #${idProducto}`,
            cantidadRequerida,
            cantidadAsignada,
            cantidadFaltante,
            estado: cantidadFaltante === 0 ? 'completo' : 'pendiente'
          };
        });
        setResumenProductos(resumen);
      }

      // Limpiar asignaciones pendientes
      setAsignacionesPendientes((prev) => {
        const nuevas = { ...prev };
        delete nuevas[productoOrdenId];
        return nuevas;
      });

      toast.success("Bultos asignados al pallet exitosamente");
    } catch (err) {
      console.log(err);
      toast.error("Error al asignar bultos al pallet");
    }
  };

  const handleDesasociarPallet = async (palletId) => {
    if (isRemovingPallet) return;
    
    // Confirmar la acción
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas desasociar el pallet ${palletId}? Si tiene bultos, permanecerán en el inventario.`
    );
    
    if (!confirmDelete) return;

    setIsRemovingPallet(true);

    try {
      const params = new URLSearchParams();
      params.append("pallet_id", palletId);

      // Usar el endpoint DELETE para desasociar el pallet
      await api(`/ordenes-venta/${ordenId}/quitar-pallet?${params.toString()}`, {
        method: "DELETE",
      });

      // Recargar los datos de la orden
      const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
      const ordenActualizada = resOrden.data || resOrden;
      setOrden(ordenActualizada);

      // Actualizar lista de pallets
      const palletsAsociados = [];
      if (ordenActualizada.productos_ingresados && Array.isArray(ordenActualizada.productos_ingresados)) {
        const palletsUnicos = new Map();
        for (const item of ordenActualizada.productos_ingresados) {
          if (item.identificador && !palletsUnicos.has(item.identificador)) {
            palletsUnicos.set(item.identificador, item);
          }
        }
        palletsAsociados.push(...palletsUnicos.values());
      }
      setPallets(palletsAsociados);

      // Recargar productos agregados
      const resProductosAgregados = await api(`/ordenes-venta/${ordenId}/added-products`);
      const productosAgregadosData = resProductosAgregados.data || resProductosAgregados || {};
      setProductosAgregados(productosAgregadosData);

      // Recalcular resumen de productos
      if (ordenActualizada.productos && Array.isArray(ordenActualizada.productos)) {
        const resumen = ordenActualizada.productos.map((productoOrden) => {
          const idProducto = productoOrden.id_producto;
          const cantidadRequerida = productoOrden.cantidad || 0;
          
          const bultosAsignados = productosAgregadosData[idProducto] || [];
          const cantidadAsignada = Array.isArray(bultosAsignados)
            ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
            : 0;
          
          const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);
          const productoBase = productosBase.find(p => p.id == idProducto);

          return {
            id: productoOrden.id,
            idProducto,
            nombreProducto: productoBase?.nombre || `Producto #${idProducto}`,
            cantidadRequerida,
            cantidadAsignada,
            cantidadFaltante,
            estado: cantidadFaltante === 0 ? 'completo' : 'pendiente'
          };
        });
        setResumenProductos(resumen);
      }

      // Limpiar estado
      setPalletEnEdicion(null);

      toast.success("Pallet desasociado exitosamente");
    } catch (err) {
      toast.error("Error al desasociar el pallet");
    } finally {
      setIsRemovingPallet(false);
    }
  };

  const handleDesasociarBulto = async (palletId, bultoId, unidades) => {
    if (isRemovingBulto) return;

    // Validar que se ingresaron unidades
    if (!unidades || unidades <= 0) {
      toast.error("Ingresa una cantidad válida de unidades a desasociar");
      return;
    }

    setIsRemovingBulto(true);

    try {
      const params = new URLSearchParams();
      params.append("bulto_id", bultoId);
      params.append("unidades_a_mover", unidades);

      // Usar el endpoint DELETE para desasociar el bulto
      await api(`/ordenes-venta/${ordenId}/quitar-bulto?${params.toString()}`, {
        method: "DELETE",
      });

      // Recargar los datos de la orden
      const resOrden = await api(`/ordenes-venta/${ordenId}/info`);
      const ordenActualizada = resOrden.data || resOrden;
      setOrden(ordenActualizada);

      // Actualizar lista de pallets
      const palletsAsociados = [];
      if (ordenActualizada.productos_ingresados && Array.isArray(ordenActualizada.productos_ingresados)) {
        const palletsUnicos = new Map();
        for (const item of ordenActualizada.productos_ingresados) {
          if (item.identificador && !palletsUnicos.has(item.identificador)) {
            palletsUnicos.set(item.identificador, item);
          }
        }
        palletsAsociados.push(...palletsUnicos.values());
      }
      setPallets(palletsAsociados);

      // Recargar productos agregados
      const resProductosAgregados = await api(`/ordenes-venta/${ordenId}/added-products`);
      const productosAgregadosData = resProductosAgregados.data || resProductosAgregados || {};
      setProductosAgregados(productosAgregadosData);

      // Recalcular resumen de productos
      if (ordenActualizada.productos && Array.isArray(ordenActualizada.productos)) {
        const resumen = ordenActualizada.productos.map((productoOrden) => {
          const idProducto = productoOrden.id_producto;
          const cantidadRequerida = productoOrden.cantidad || 0;
          
          const bultosAsignados = productosAgregadosData[idProducto] || [];
          const cantidadAsignada = Array.isArray(bultosAsignados)
            ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
            : 0;
          
          const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);
          const productoBase = productosBase.find(p => p.id == idProducto);

          return {
            id: productoOrden.id,
            idProducto,
            nombreProducto: productoBase?.nombre || `Producto #${idProducto}`,
            cantidadRequerida,
            cantidadAsignada,
            cantidadFaltante,
            estado: cantidadFaltante === 0 ? 'completo' : 'pendiente'
          };
        });
        setResumenProductos(resumen);
      }

      // Limpiar estado
      setUnidadesADesasociar({});

      toast.success("Bulto desasociado exitosamente");
    } catch (err) {
      console.log(err);
      toast.error("Error al desasociar el bulto");
    } finally {
      setIsRemovingBulto(false);
    }
  };

  const handleMarcarListoParaDespacho = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Actualizar el estado de la orden a "Listo-para-despacho"
      await api(`/ordenes-venta/${ordenId}/listo-para-despacho`, {
        method: "PUT",
      });

      toast.success("Orden marcada como lista para despacho");
      
      // Redirigir a la vista de resumen
      navigate(`/ventas/ordenes/${ordenId}/resumen-asignacion`);
    } catch (err) {
      toast.error("Error al marcar la orden como lista para despacho");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <button
        onClick={() => navigate("/ventas/ordenes")}
        className="flex items-center text-primary mb-4 hover:underline"
      >
        <ArrowLeft size={18} className="mr-1" /> Volver
      </button>

      <h1 className="text-2xl font-bold mb-6 text-text">
        Asignar Bultos a la Orden #{ordenId}
      </h1>

      {/* SECCIÓN DE RESUMEN DE PRODUCTOS */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-text">Resumen de Productos</h2>
        
        {resumenProductos.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-gray-700">
              No hay productos en esta orden.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {resumenProductos.map((resumen) => (
              <div 
                key={resumen.id} 
                className={`border rounded-lg p-4 ${
                  resumen.estado === 'completo'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <h3 className={`text-lg font-semibold mb-3 ${
                  resumen.estado === 'completo'
                    ? 'text-green-900'
                    : 'text-yellow-900'
                }`}>
                  {resumen.nombreProducto}
                </h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm font-medium ${
                      resumen.estado === 'completo' ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      Cantidad Requerida:
                    </span>
                    <span className={`text-sm font-bold ${
                      resumen.estado === 'completo' ? 'text-green-900' : 'text-yellow-900'
                    }`}>
                      {resumen.cantidadRequerida}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className={`text-sm font-medium ${
                      resumen.estado === 'completo' ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      Cantidad Asignada:
                    </span>
                    <span className={`text-sm font-bold ${
                      resumen.estado === 'completo' ? 'text-green-900' : 'text-yellow-900'
                    }`}>
                      {resumen.cantidadAsignada}
                    </span>
                  </div>

                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className={`text-sm font-bold ${
                        resumen.estado === 'completo' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        Cantidad Faltante:
                      </span>
                      <span className={`text-sm font-bold px-2 py-1 rounded ${
                        resumen.estado === 'completo'
                          ? 'bg-green-200 text-green-900'
                          : 'bg-red-200 text-red-900'
                      }`}>
                        {resumen.cantidadFaltante}
                      </span>
                    </div>
                  </div>

                  {resumen.estado === 'completo' && (
                    <div className="mt-2 text-xs text-green-600 font-medium">
                      ✓ Este producto está completamente asignado
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN DE PALLETS ASIGNADOS */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-text">Pallets Asignados a la Orden</h2>
        
        {pallets.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-700">
              No hay pallets asignados a esta orden. Crea un pallet vacío para comenzar.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {pallets.map((pallet, index) => (
              <div key={pallet.identificador} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-blue-900">
                    Pallet {pallet.identificador} #{index + 1}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPalletEnEdicion(palletEnEdicion === pallet.identificador ? null : pallet.identificador)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      {palletEnEdicion === pallet.identificador ? "Cerrar" : "Editar"}
                    </button>
                    <button
                      onClick={() => handleDesasociarPallet(pallet.identificador)}
                      disabled={isRemovingPallet}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {isRemovingPallet ? "..." : "Desasociar"}
                    </button>
                  </div>
                </div>
                
                {/* Mostrar bultos del pallet */}
                {pallet.bultos && Array.isArray(pallet.bultos) && pallet.bultos.length > 0 ? (
                  <div className="ml-4 space-y-2 mb-4">
                    <p className="text-sm text-blue-700 font-medium">Bultos en este pallet:</p>
                    {pallet.bultos.map((bulto) => (
                      <div key={bulto.id} className="text-sm text-blue-600 bg-white rounded p-2 flex justify-between items-center">
                        <span>
                          • Bulto {bulto.identificador || bulto.id}: {bulto.cantidad_unidades || 0} unidades
                        </span>
                        {palletEnEdicion === pallet.identificador && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={bulto.cantidad_unidades || 0}
                              placeholder="Unidades"
                              value={unidadesADesasociar[`${pallet.identificador}-${bulto.identificador || bulto.id}`] || ""}
                              onChange={(e) =>
                                setUnidadesADesasociar((prev) => ({
                                  ...prev,
                                  [`${pallet.identificador}-${bulto.identificador || bulto.id}`]: Number(e.target.value) || 0,
                                }))
                              }
                              className="p-1 border border-red-300 rounded w-16 text-xs"
                            />
                            <button
                              onClick={() =>
                                handleDesasociarBulto(
                                  pallet.identificador,
                                  bulto.identificador || bulto.id,
                                  unidadesADesasociar[`${pallet.identificador}-${bulto.identificador || bulto.id}`] || null
                                )
                              }
                              disabled={isRemovingBulto}
                              className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:bg-gray-400"
                            >
                              {isRemovingBulto ? "..." : "Quitar"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-blue-600 italic mb-4">Este pallet está vacío (sin bultos asignados aún)</p>
                )}

                {/* Sección para asignar bultos a este pallet específico */}
                {palletEnEdicion === pallet.identificador && (
                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <p className="text-sm font-medium text-blue-900 mb-2">Asignar Bultos Disponibles a Este Pallet</p>
                    <div className="space-y-2">
                      {resumenProductos.map((resumen) => {
                        const bultosDisponibles = obtenerBultosDisponiblesPorProducto(resumen.idProducto);
                        const asignacionesProducto = asignacionesPendientes[resumen.idProducto] || [];
                        
                        return (
                          <div key={resumen.id} className="bg-white rounded p-2">
                            <p className="text-sm font-medium text-blue-800 mb-1">
                              {resumen.nombreProducto}
                            </p>
                            {bultosDisponibles.length === 0 ? (
                              <p className="text-xs text-gray-500 ml-2 italic">
                                No hay bultos disponibles para este producto
                              </p>
                            ) : (
                              <div className="space-y-1 ml-2">
                                {(() => {
                                  const currentPage = productosDisponiblesPage[resumen.idProducto] || 0;
                                  const total = bultosDisponibles.length;
                                  const start = currentPage * PAGE_SIZE;
                                  const end = Math.min(start + PAGE_SIZE, total);
                                  const paged = bultosDisponibles.slice(start, end);

                                  return (
                                    <>
                                      <div className="space-y-1">
                                        {paged.map((bulto) => {
                                          const bultoId = bulto.identificador || bulto.id;
                                          const asignacionActual = asignacionesProducto?.find((a) => a.bulto_id === bultoId);
                                          const unidadesDisponibles = bulto.unidades_disponibles ?? bulto.cantidad_unidades ?? 0;

                                          return (
                                            <div key={bultoId} className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                min="0"
                                                max={unidadesDisponibles}
                                                step="1"
                                                placeholder={`Máx: ${unidadesDisponibles}`}
                                                value={asignacionActual?.unidades_a_mover || ""}
                                                onChange={(e) =>
                                                  handleUnidadesChange(resumen.idProducto, bultoId, e.target.value)
                                                }
                                                className="p-1 border rounded w-20 text-xs"
                                              />
                                              <span className="text-xs text-gray-600">
                                                Bulto {bultoId} ({unidadesDisponibles} disponibles)
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {total > PAGE_SIZE && (
                                        <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                                          <div>
                                            Mostrando {start + 1}-{end} de {total}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() =>
                                                setProductosDisponiblesPage((prev) => ({
                                                  ...prev,
                                                  [resumen.idProducto]: Math.max(0, currentPage - 1),
                                                }))
                                              }
                                              disabled={currentPage === 0}
                                              className={`px-2 py-1 rounded ${currentPage === 0 ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}
                                            >
                                              Prev
                                            </button>
                                            <button
                                              onClick={() =>
                                                setProductosDisponiblesPage((prev) => ({
                                                  ...prev,
                                                  [resumen.idProducto]: Math.min(currentPage + 1, Math.floor((total - 1) / PAGE_SIZE)),
                                                }))
                                              }
                                              disabled={end >= total}
                                              className={`px-2 py-1 rounded ${end >= total ? 'bg-gray-200 text-gray-400' : 'bg-white border'}`}
                                            >
                                              Next
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() => {
                          const productoConBultos = resumenProductos.find(
                            (p) => (asignacionesPendientes[p.idProducto] || []).length > 0
                          );
                          if (productoConBultos) {
                            handleAsignarBultoAPallet(pallet.identificador, productoConBultos.idProducto);
                          } else {
                            toast.error("Debes seleccionar bultos para asignar");
                          }
                        }}
                        className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 w-full"
                      >
                        Asignar Bultos a Este Pallet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleCrearPalletVacio}
          disabled={isCreatingPallet}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isCreatingPallet
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <Plus size={20} />
          {isCreatingPallet ? "Creando pallet..." : "Crear Pallet Vacío"}
        </button>
      </div>

      {/* SECCIÓN DE ASIGNACIÓN DE BULTOS */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 text-text">Acciones de la Orden</h2>

        <button
          onClick={handleMarcarListoParaDespacho}
          disabled={isSaving || pallets.length === 0}
          className={`px-6 py-3 rounded-lg text-lg shadow ${
            isSaving || pallets.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {isSaving ? "Procesando..." : "Marcar como Listo para Despacho"}
        </button>
      </div>

      {/* BOTÓN PARA VOLVER */}
      <div className="mt-8">
        <button
          onClick={() => navigate(`/ventas/ordenes/${ordenId}`)}
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
        >
          Volver al detalle
        </button>
      </div>
    </div>
  );
}
