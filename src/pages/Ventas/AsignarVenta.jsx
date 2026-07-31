import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ArrowLeft, Plus } from "lucide-react";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { useConfirm } from "../../components/Modals/ConfirmProvider.jsx";

// Sin búsqueda, la lista de bultos disponibles se colapsa a estas filas para no
// saturar la vista; con búsqueda activa se muestran todas las coincidencias.
const BULTOS_VISIBLES = 8;

export default function AsignarVenta() {
  const { ordenId } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const confirm = useConfirm();

  const [orden, setOrden] = useState(null);
  const [pallets, setPallets] = useState([]);
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
  const [isLoading, setIsLoading] = useState(true);
  // Búsqueda + colapso de bultos disponibles por línea (nombre de facturación)
  const [busquedaPorNombre, setBusquedaPorNombre] = useState({});
  const [mostrarTodosPorNombre, setMostrarTodosPorNombre] = useState({});

  const canWriteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE);
  const canWriteBulk = checkScope(ModelType.BULTO, ScopeType.WRITE);

  // Resumen por línea de la orden. Las líneas van por nombre de facturación:
  // el picking admite cualquier producto físico del grupo, y added-products
  // viene agrupado por id_nombre_facturacion.
  const construirResumen = (ordenData, productosAgregadosData) => {
    if (!ordenData?.productos || !Array.isArray(ordenData.productos)) return [];
    return ordenData.productos.map((productoOrden) => {
      const idNombre = productoOrden.id_nombre_facturacion;
      const cantidadRequerida = productoOrden.cantidad || 0;

      const bultosAsignados = productosAgregadosData[idNombre] || [];
      const cantidadAsignada = Array.isArray(bultosAsignados)
        ? bultosAsignados.reduce((sum, bulto) => sum + (bulto.cantidad_unidades || 0), 0)
        : 0;

      const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadAsignada);

      return {
        id: productoOrden.id,
        idNombre,
        nombreProducto:
          productoOrden.NombreFacturacion?.nombre ||
          productoOrden.ProductoBase?.nombre ||
          productoOrden.descripcion_original ||
          `Línea #${productoOrden.id}`,
        cantidadRequerida,
        cantidadAsignada,
        cantidadFaltante,
        estado:
          cantidadFaltante === 0
            ? "completo"
            : cantidadAsignada > 0
              ? "parcial"
              : "pendiente",
      };
    });
  };

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

        // Cargar productos disponibles para asignación
        // (nueva forma: nombres de facturación con productos[] anidados)
        const resProductosDisponibles = await api(`/ordenes-venta/productos-disponibles`);
        const productosDisponiblesData = Array.isArray(resProductosDisponibles)
          ? resProductosDisponibles
          : resProductosDisponibles.data || [];
        setProductosDisponibles(productosDisponiblesData);

        // Calcular resumen de productos
        setResumenProductos(construirResumen(ordenData, productosAgregadosData));
      } catch (err) {
        toast.error("Error al cargar los datos de la orden");
      } finally {
        setIsLoading(false);
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

  // Bultos disponibles para una línea (nombre de facturación): cualquier bulto
  // de cualquier producto físico del grupo sirve. Se etiqueta cada bulto con su
  // producto para el desglose.
  const obtenerBultosDisponiblesPorNombre = (idNombre) => {
    const bultosDisponibles = [];
    // Intentar obtener id de bodega de la orden (puede venir como bodega_id o como objeto bodega)
    const bodegaOrdenId = orden?.bodega_id ?? orden?.bodega?.id;

    // Obtener bultos sin orden desde productosDisponibles (nombres → productos → lotes → bultos)
    const nombreFact = productosDisponibles.find((n) => n.id == idNombre);
    for (const producto of nombreFact?.productos || []) {
      for (const lote of producto.lotesProductoFinal || []) {
        for (const bulto of lote.LoteProductoFinalBultos || []) {
          // Filtro por bodega: si conocemos la bodega de la orden, exigir coincidencia
          if (bodegaOrdenId != null && bulto.id_bodega != bodegaOrdenId) {
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
            producto_nombre: producto.nombre,
          });
        }
      }
    }

    // Incluir también bultos que ya están en la orden actual (productosAgregados)
    const bultosEnOrden = productosAgregados[idNombre] || [];
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
          producto_nombre: b.producto_nombre,
        });
      }
    }

    return bultosDisponibles;
  };

  const handleCrearPalletVacio = async () => {
    if (isCreatingPallet) return;

    if (!canWriteSaleOrder) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE]);
      setIsCreatingPallet(false);
      return;
    }

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
      } catch {
        // No bloquear el flujo si falla este fetch
      }

      // Recalcular resumen de productos
      setResumenProductos(construirResumen(ordenActualizada, productosAgregadosData));

      // Limpiar estado
      setUnidadesADesasociar({});
      setPalletEnEdicion(null);

      toast.success("Pallet creado exitosamente");
    } catch (err) {
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

    if (!canWriteSaleOrder || !canWriteBulk) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE], [ModelType.BULTO, ScopeType.WRITE]);
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
      setResumenProductos(construirResumen(ordenActualizada, productosAgregadosData));

      // Limpiar asignaciones pendientes
      setAsignacionesPendientes((prev) => {
        const nuevas = { ...prev };
        delete nuevas[productoOrdenId];
        return nuevas;
      });

      toast.success("Bultos asignados al pallet exitosamente");
    } catch (err) {
      toast.error("Error al asignar bultos al pallet");
    }
  };

  const handleDesasociarPallet = async (palletId) => {
    if (isRemovingPallet) return;

    if (!canWriteSaleOrder) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE]);
      setIsRemovingPallet(false);
      return;
    }
    
    // Confirmar la acción
    const confirmDelete = await confirm({
      title: "¿Desasociar pallet?",
      message: `El pallet ${palletId} se desasociará de la orden. Si tiene bultos, permanecerán en el inventario.`,
      confirmText: "Desasociar",
      danger: true,
    });

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
      setResumenProductos(construirResumen(ordenActualizada, productosAgregadosData));

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

    if (!canWriteSaleOrder || !canWriteBulk) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE], [ModelType.BULTO, ScopeType.WRITE]);
      setIsRemovingBulto(false);
      return;
    }

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
      setResumenProductos(construirResumen(ordenActualizada, productosAgregadosData));

      // Limpiar estado
      setUnidadesADesasociar({});

      toast.success("Bulto desasociado exitosamente");
    } catch (err) {
      toast.error("Error al desasociar el bulto");
    } finally {
      setIsRemovingBulto(false);
    }
  };

  const handleMarcarListoParaDespacho = async () => {
    if (isSaving) return;

    if (!canWriteSaleOrder) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE]);
      setIsSaving(false);
      return;
    }

    setIsSaving(true);

    try {
      // Actualizar el estado de la orden a "Lista para facturación"
      await api(`/ordenes-venta/${ordenId}/lista-para-facturacion`, {
        method: "PUT",
      });

      toast.success("Orden marcada como lista para facturación");

      // Redirigir a la vista de resumen
      navigate(`/ventas/ordenes/${ordenId}/resumen-asignacion`);
    } catch (err) {
      toast.error("Error al marcar la orden como lista para facturación");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoader message="Cargando orden" />;

  const totalLineas = resumenProductos.length;
  const lineasCompletas = resumenProductos.filter((r) => r.estado === "completo").length;
  const todoAsignado = totalLineas > 0 && lineasCompletas === totalLineas;

  return (
    <div>
      {(isSaving || isCreatingPallet || isRemovingBulto || isRemovingPallet) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
      <button
        onClick={() => navigate("/ventas/ordenes")}
        className="flex items-center text-primary mb-4 hover:underline"
      >
        <ArrowLeft size={18} className="mr-1" /> Volver
      </button>

      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">
            Asignar Bultos a la Orden #{ordenId}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Crea pallets y asígnales bultos para cubrir cada línea de la orden.
          </p>
        </div>
        {totalLineas > 0 && (
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              todoAsignado ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {lineasCompletas} de {totalLineas} líneas completas
          </span>
        )}
      </div>

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
            {resumenProductos.map((resumen) => {
              const chip =
                resumen.estado === "completo"
                  ? { label: "Completo", cls: "bg-green-100 text-green-800" }
                  : resumen.estado === "parcial"
                    ? { label: "Parcial", cls: "bg-yellow-100 text-yellow-800" }
                    : { label: "Pendiente", cls: "bg-gray-100 text-gray-700" };
              const progresoPct =
                resumen.cantidadRequerida > 0
                  ? Math.min(100, (resumen.cantidadAsignada / resumen.cantidadRequerida) * 100)
                  : 100;
              return (
                <div
                  key={resumen.id}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-semibold text-text min-w-0">
                      {resumen.nombreProducto}
                    </h3>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${chip.cls}`}>
                      {chip.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          resumen.estado === "completo" ? "bg-green-500" : "bg-primary"
                        }`}
                        style={{ width: `${progresoPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {Math.round(progresoPct)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      Asignado:{" "}
                      <span className="font-semibold text-text">{resumen.cantidadAsignada}</span> de{" "}
                      {resumen.cantidadRequerida}
                    </span>
                    {resumen.cantidadFaltante > 0 && (
                      <span className="text-red-600 font-medium">
                        Faltan {resumen.cantidadFaltante}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
                        const bultosDisponibles = obtenerBultosDisponiblesPorNombre(resumen.idNombre);
                        const asignacionesProducto = asignacionesPendientes[resumen.idNombre] || [];

                        const busqueda = String(busquedaPorNombre[resumen.idNombre] || "").trim().toLowerCase();
                        const bultosFiltrados = busqueda
                          ? bultosDisponibles.filter((b) =>
                              String(b.identificador || b.id).toLowerCase().includes(busqueda)
                            )
                          : bultosDisponibles;
                        // Con búsqueda activa se muestran todas las coincidencias; sin
                        // búsqueda, se colapsa a las primeras filas para no saturar.
                        const mostrarTodos = !!mostrarTodosPorNombre[resumen.idNombre] || !!busqueda;
                        const bultosVisibles = mostrarTodos
                          ? bultosFiltrados
                          : bultosFiltrados.slice(0, BULTOS_VISIBLES);
                        const bultosOcultos = bultosFiltrados.length - bultosVisibles.length;

                        return (
                          <div key={resumen.id} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-gray-800">
                                {resumen.nombreProducto}
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  {bultosFiltrados.length}
                                  {busqueda ? ` de ${bultosDisponibles.length}` : ""} bulto(s)
                                </span>
                              </p>
                              {bultosDisponibles.length > BULTOS_VISIBLES && (
                                <input
                                  type="text"
                                  value={busquedaPorNombre[resumen.idNombre] || ""}
                                  onChange={(e) =>
                                    setBusquedaPorNombre((prev) => ({
                                      ...prev,
                                      [resumen.idNombre]: e.target.value,
                                    }))
                                  }
                                  placeholder="Buscar bulto por identificador…"
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs w-56"
                                />
                              )}
                            </div>
                            {bultosDisponibles.length === 0 ? (
                              <p className="text-xs text-gray-500 ml-1 italic">
                                No hay bultos disponibles para este producto
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {bultosVisibles.map((bulto) => {
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
                                          handleUnidadesChange(resumen.idNombre, bultoId, e.target.value)
                                        }
                                        className="p-1 border border-gray-300 rounded w-20 text-xs"
                                      />
                                      <span className="text-xs text-gray-600">
                                        Bulto {bultoId} ({unidadesDisponibles} disponibles)
                                        {bulto.producto_nombre ? (
                                          <span className="text-gray-400"> · {bulto.producto_nombre}</span>
                                        ) : null}
                                      </span>
                                    </div>
                                  );
                                })}

                                {bultosOcultos > 0 && (
                                  <button
                                    type="button"
                                    className="text-xs text-primary hover:underline mt-1"
                                    onClick={() =>
                                      setMostrarTodosPorNombre((prev) => ({
                                        ...prev,
                                        [resumen.idNombre]: true,
                                      }))
                                    }
                                  >
                                    Mostrar los {bultosOcultos} restantes
                                  </button>
                                )}
                                {busqueda && bultosFiltrados.length === 0 && (
                                  <p className="text-xs text-gray-500 italic">
                                    Ningún bulto coincide con la búsqueda.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() => {
                          const productoConBultos = resumenProductos.find(
                            (p) => (asignacionesPendientes[p.idNombre] || []).length > 0
                          );
                          if (productoConBultos) {
                            handleAsignarBultoAPallet(pallet.identificador, productoConBultos.idNombre);
                          } else {
                            toast.error("Debes seleccionar bultos para asignar");
                          }
                        }}
                        className="mt-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark w-full"
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
              ? "bg-gray-400 cursor-not-allowed text-white"
              : "bg-primary text-white hover:bg-primary-dark"
          }`}
        >
          <Plus size={20} />
          {isCreatingPallet ? "Creando pallet..." : "Crear Pallet Vacío"}
        </button>
      </div>

      {/* BARRA DE ACCIONES */}
      <div className="mt-8 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          {pallets.length === 0
            ? "Crea al menos un pallet y asígnale bultos para poder despachar."
            : todoAsignado
              ? "Todas las líneas están completas. Puedes marcar la orden como lista para despacho."
              : `${lineasCompletas} de ${totalLineas} líneas completas.`}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/ventas/ordenes/${ordenId}`)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Volver al detalle
          </button>
          <button
            onClick={handleMarcarListoParaDespacho}
            disabled={isSaving || pallets.length === 0}
            className={`px-6 py-2 rounded-lg shadow ${
              isSaving || pallets.length === 0
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-primary text-white hover:bg-primary-dark"
            }`}
          >
            {isSaving ? "Procesando..." : "Marcar como Listo para Despacho"}
          </button>
        </div>
      </div>
    </div>
  );
}
