import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { getTodayDate } from "../../lib/dateUtils";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from "lucide-react";
import Selector from "../../components/Forms/Selector";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import {
  unidadVentaDe,
  admiteFraccion,
  stepDeUnidad,
  problemaDeCantidad,
  cantidadConUnidad,
} from "../../utils/unidadVenta.js";

export default function AddOrdenVenta() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canWriteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE);
  const canWriteSaleOrderProduct = checkScope(ModelType.PRODUCTO_ORDEN, ScopeType.WRITE);
  const canReadClients = checkScope(ModelType.CLIENTE, ScopeType.READ);
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  /**
   * Borrador que llega desde un correo apartado de la Cola IA (`PanelApartados`).
   *
   * La precarga es DELIBERADAMENTE PARCIAL: se llenan la cabecera y el cliente, y las líneas
   * quedan en un panel aparte con un botón "Usar" que carga el formulario de producto. No se
   * insertan directo en la orden a propósito — el precio correcto sale de la lista del cliente,
   * no del correo, y ese cálculo ya vive en `handleProductChange`. Meterlas por fuera obligaría
   * a duplicar la lógica de precios, que es justo donde se cometen los errores caros.
   */
  const borrador = location.state?.borrador ?? null;
  const [lineasDelCorreo, setLineasDelCorreo] = useState(() =>
    (borrador?.lineas ?? []).map((l, i) => ({ ...l, _key: i })),
  );
  // La precarga corre una sola vez: si el operario borra el número de OC, no se lo reponemos.
  const yaPrecargado = useRef(false);
  const [clients, setClients] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  // La OV se pide por nombre de facturación (agrupa productos físicos equivalentes)
  const [nombres, setNombres] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [preciosLista, setPreciosLista] = useState([]);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [isProductosExpanded, setIsProductosExpanded] = useState(false);
  const [errors, setErrors] = useState({});
  const [productErrors, setProductErrors] = useState({});
  const [condicionPagoCliente, setCondicionPagoCliente] = useState(null);
  const [editingProdId, setEditingProdId] = useState(null);
  const [editingCantidad, setEditingCantidad] = useState("");

  const [form, setForm] = useState({
    id_cliente: "",
    numero_oc: "",
    fecha_orden: getTodayDate(),
    bodega_id: "",
    es_referencial: false,
  });

  const [productoForm, setProductoForm] = useState({
    id_nombre_facturacion: "",
    cantidad: "",
    precio_unitario: "",
  });

  useEffect(() => {
    if (!canReadClients) {
      toast.permissionError([ModelType.CLIENTE, ScopeType.READ]);
      setIsLoading(false);
      return;
    }
    Promise.all([api("/clientes"), api("/nombres-facturacion"), api("/bodegas")])
      .then(([clientesRes, nombresRes, bodegasRes]) => {
        setClients(clientesRes.data || clientesRes);
        setNombres(Array.isArray(nombresRes) ? nombresRes : nombresRes?.data || []);
        const bodegasData = Array.isArray(bodegasRes?.bodegas)
          ? bodegasRes.bodegas
          : Array.isArray(bodegasRes?.data)
          ? bodegasRes.data
          : Array.isArray(bodegasRes)
          ? bodegasRes
          : [];
        setBodegas(bodegasData);
      })
      .finally(() => setIsLoading(false));
  }, [api, canReadClients]);

  // Precarga desde el correo apartado. Corre después de la carga inicial porque
  // `handleClientChange` va a buscar la lista de precios del cliente.
  useEffect(() => {
    if (!borrador || isLoading || yaPrecargado.current) return;
    yaPrecargado.current = true;

    setForm((prev) => ({
      ...prev,
      numero_oc: borrador.numero_oc || prev.numero_oc,
      fecha_orden: borrador.fecha_orden || prev.fecha_orden,
    }));

    if (borrador.id_cliente) handleClientChange(String(borrador.id_cliente));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador, isLoading]);

  /** Carga una línea del correo en el formulario de producto, para revisarla y agregarla. */
  const usarLineaDelCorreo = (linea) => {
    if (!form.id_cliente) {
      toast.error("Elige primero el cliente: el precio sale de su lista");
      return;
    }
    // ⚠️ Se arma UNA sola actualización a propósito. `setProductoField` construye el objeto
    // desde `productoForm` del closure, así que dos llamadas seguidas hacen que la segunda
    // parta del estado viejo y pise a la primera.
    setProductErrors({});
    setProductoForm((prev) => {
      const siguiente = { ...prev };
      if (linea.id_nombre_facturacion) {
        siguiente.id_nombre_facturacion = String(linea.id_nombre_facturacion);
        // El precio sale de la lista del cliente, NO del correo: es el mismo cálculo que hace
        // elegir el producto a mano.
        siguiente.precio_unitario = calcularPrecioProducto(
          Number(linea.id_nombre_facturacion), preciosLista, clienteConfig,
        );
      }
      if (linea.cantidad != null) siguiente.cantidad = String(linea.cantidad);
      return siguiente;
    });

    setLineasDelCorreo((prev) => prev.filter((l) => l._key !== linea._key));
    if (!linea.id_nombre_facturacion) {
      toast.info("La IA no reconoció este producto: elígelo del catálogo");
    }
  };

  // Busca la entrada de la lista de precios para un nombre de facturación
  // (entradas nuevas van por id_nombre_facturacion; las legacy por producto del grupo)
  const buscarPrecioLista = (nombreId, preciosListaActual) => {
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const idsProductos = (nombreFact?.productos || []).map((p) => p.id);
    return preciosListaActual.find(
      (x) =>
        Number(x.id_nombre_facturacion) === nombreId ||
        (x.id_producto_base != null && idsProductos.includes(x.id_producto_base))
    );
  };

  const calcularPrecioProducto = (nombreId, preciosListaActual, clienteConfigActual) => {
    if (!clienteConfigActual || !nombreId) return "";
    const precioLista = buscarPrecioLista(nombreId, preciosListaActual);
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const unidadesPorCaja = Number(
      precioLista?.unidades_por_caja || nombreFact?.unidades_por_caja || nombreFact?.productos?.[0]?.unidades_por_caja || 0
    ) || 0;
    const precioCaja = precioLista?.precio_caja;
    const precioUnidad = precioLista?.precio_unidad;
    const formato = (clienteConfigActual?.formato || "UNIDADES").toUpperCase();
    if (formato.includes("CAJA")) {
      if (precioCaja) return Number(precioCaja);
      else if (precioUnidad && unidadesPorCaja) return Number(precioUnidad) * Number(unidadesPorCaja);
    } else {
      if (precioUnidad) return Number(precioUnidad);
      else if (precioCaja && unidadesPorCaja) return Number(precioCaja) / Number(unidadesPorCaja);
    }
    return "";
  };

  const recalcularPreciosProductos = (productosActuales, preciosListaActual, clienteConfigActual) => {
    if (!clienteConfigActual || productosActuales.length === 0) return productosActuales;
    const formato = (clienteConfigActual?.formato || "UNIDADES").toUpperCase();
    const esCajas = formato.includes("CAJA");
    return productosActuales.map((prod) => {
      const nuevoPrecio = calcularPrecioProducto(prod.id_nombre_facturacion, preciosListaActual, clienteConfigActual);
      const precioLista = buscarPrecioLista(prod.id_nombre_facturacion, preciosListaActual);
      const nombreFact = nombres.find((n) => n.id === prod.id_nombre_facturacion);
      const unidadesPorCaja = Number(
        precioLista?.unidades_por_caja || nombreFact?.unidades_por_caja || nombreFact?.productos?.[0]?.unidades_por_caja || prod.unidades_por_caja || 0
      ) || 0;
      return {
        ...prod,
        precio_unitario: nuevoPrecio || 0,
        cantidad: prod.cantidad,
        formato_linea: esCajas ? "CAJAS" : "UNIDADES",
        unidades_por_caja: unidadesPorCaja || null,
        total_linea: (nuevoPrecio || 0) * prod.cantidad,
      };
    });
  };

  const handleClientChange = async (eOrValue) => {
    const id_cliente = eOrValue?.target ? eOrValue.target.value : eOrValue;
    setDirecciones([]);
    setClienteConfig(null);
    setPreciosLista([]);
    setCondicionPagoCliente(null);
    if (!id_cliente) {
      setProductoForm({ id_nombre_facturacion: "", cantidad: "", precio_unitario: "" });
      setForm(prev => ({ ...prev, id_cliente: "" }));
      return;
    }
    setForm(prev => ({ ...prev, id_cliente }));
    try {
      const resCliente = await api(`/clientes/${id_cliente}`);
      const clienteData = resCliente.data || resCliente;
      const dirs = Array.isArray(clienteData?.direcciones) ? clienteData.direcciones : [];
      setDirecciones(dirs);
      const nuevoClienteConfig = {
        formato: clienteData?.formato_compra_predeterminado || "UNIDADES",
        id_lista_precio: clienteData?.id_lista_precio || null,
      };
      setClienteConfig(nuevoClienteConfig);
      setCondicionPagoCliente(clienteData?.condicion_pago);
      let productosLista = [];
      if (clienteData?.id_lista_precio) {
        try {
          const resLista = await api(`/lista-precio/${clienteData.id_lista_precio}`);
          const listaData = resLista.data || resLista;
          productosLista = Array.isArray(listaData?.productosBaseListaPrecio)
            ? listaData.productosBaseListaPrecio
            : [];
          setPreciosLista(productosLista);
        } catch {
          toast.error("Error al cargar precios de lista");
        }
      }
      if (productosAgregados.length > 0) {
        setProductosAgregados(recalcularPreciosProductos(productosAgregados, productosLista, nuevoClienteConfig));
      }
      if (productoForm.id_nombre_facturacion) {
        const nuevoPrecio = calcularPrecioProducto(Number(productoForm.id_nombre_facturacion), productosLista, nuevoClienteConfig);
        setProductoForm((prev) => ({ ...prev, precio_unitario: nuevoPrecio }));
      }
      if (productosAgregados.length > 0 || productoForm.id_nombre_facturacion) {
        toast.success("Precios y formatos actualizados según la lista del cliente seleccionado");
      }
    } catch {
      toast.error("Error al cargar datos del cliente");
    }
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const setProductoField = (name, value) => {
    let updatedForm = { ...productoForm, [name]: value };
    if (name === "id_nombre_facturacion") setProductErrors({});
    if (name === "id_nombre_facturacion" && form.id_cliente) {
      updatedForm.precio_unitario = calcularPrecioProducto(Number(value), preciosLista, clienteConfig);
    }
    setProductoForm(updatedForm);
  };

  const handleProductoChange = (e) => {
    const { name, value } = e.target;
    setProductoField(name, value);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.id_cliente) { newErrors.id_cliente = "Debes seleccionar un cliente."; setErrors(newErrors); toast.error("Debes seleccionar un cliente."); return false; }
    if (!form.bodega_id) { newErrors.bodega_id = "Debes seleccionar una bodega."; setErrors(newErrors); toast.error("Debes seleccionar una bodega."); return false; }
    if (!form.fecha_orden) { newErrors.fecha_orden = "La fecha de emisión es obligatoria."; setErrors(newErrors); toast.error("La fecha de emisión es obligatoria."); return false; }
    setErrors({});
    return true;
  };

  const validateProducto = () => {
    const prodErrors = {};
    if (!productoForm.id_nombre_facturacion) prodErrors.id_nombre_facturacion = "Debes seleccionar un producto.";
    // 🔴 Mismo criterio que el backend. Antes esto sólo miraba «> 0», así que un 1,5 pasaba la
    // validación, se veía en la tabla con su total calculado y reventaba recién al guardar.
    // En cajas la cantidad siempre es entera: media caja no se despacha.
    const problemaCantidad = esCajas
      ? (Number(productoForm.cantidad) > 0 && Number.isInteger(Number(productoForm.cantidad))
          ? null : "La cantidad en cajas tiene que ser un número entero mayor a 0.")
      : problemaDeCantidad(productoForm.cantidad, unidadProductoElegido);
    if (problemaCantidad) prodErrors.cantidad = problemaCantidad;
    if (!productoForm.precio_unitario || productoForm.precio_unitario <= 0) prodErrors.precio_unitario = "Precio debe ser mayor a 0.";
    setProductErrors(prodErrors);
    return Object.keys(prodErrors).length === 0;
  };

  const handleAddProduct = () => {
    if (!form.id_cliente) { toast.error("Debes seleccionar un cliente antes de agregar productos"); return; }
    if (!validateProducto()) return;
    const nombreId = Number(productoForm.id_nombre_facturacion);
    if (productosAgregados.some(p => p.id_nombre_facturacion === nombreId)) {
      setProductErrors({ id_nombre_facturacion: "Este producto ya está agregado a la orden." });
      return;
    }
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const formato = (clienteConfig?.formato || "UNIDADES").toUpperCase();
    const precioLista = buscarPrecioLista(nombreId, preciosLista);
    const unidadesPorCaja = Number(precioLista?.unidades_por_caja || nombreFact?.unidades_por_caja || nombreFact?.productos?.[0]?.unidades_por_caja || 0) || 0;
    const cantidad = Number(productoForm.cantidad);
    setProductosAgregados((prev) => [
      {
        id_nombre_facturacion: nombreId,
        nombre: nombreFact?.nombre || `Nombre #${nombreId}`,
        precio_unitario: Number(productoForm.precio_unitario),
        cantidad,
        formato_linea: formato.includes("CAJA") ? "CAJAS" : "UNIDADES",
        unidades_por_caja: unidadesPorCaja || null,
        total_linea: Number(productoForm.precio_unitario) * cantidad,
      },
      ...prev,
    ]);
    setIsProductosExpanded(false);
    setProductoForm({ id_nombre_facturacion: "", cantidad: "", precio_unitario: "" });
    setProductErrors({});
  };

  const handleDeleteProduct = (id) => {
    setProductosAgregados((prev) => prev.filter((p) => p.id_nombre_facturacion !== id));
  };

  const handleStartEdit = (prod) => {
    setEditingProdId(prod.id_nombre_facturacion);
    setEditingCantidad(String(prod.cantidad));
  };

  const handleConfirmEdit = () => {
    const nuevaCantidad = Number(editingCantidad);
    // Mismo criterio que al agregar y que el backend: acá también se podía escribir 1,5 y el
    // rechazo llegaba recién al guardar la orden completa.
    const lineaEditada = productosAgregados.find((p) => p.id_nombre_facturacion === editingProdId);
    const problema = esCajas
      ? (nuevaCantidad > 0 && Number.isInteger(nuevaCantidad)
          ? null : "La cantidad en cajas tiene que ser un número entero mayor a 0.")
      : problemaDeCantidad(editingCantidad, unidadDeLinea(lineaEditada));
    if (problema) {
      toast.error(problema);
      return;
    }
    setProductosAgregados((prev) =>
      prev.map((p) =>
        p.id_nombre_facturacion === editingProdId
          ? { ...p, cantidad: nuevaCantidad, total_linea: p.precio_unitario * nuevaCantidad }
          : p
      )
    );
    setEditingProdId(null);
    setEditingCantidad("");
  };

  const handleCancelEdit = () => {
    setEditingProdId(null);
    setEditingCantidad("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (productosAgregados.length === 0) { toast.error("Debes agregar al menos un producto a la orden."); return; }
    if (!canWriteSaleOrder || !canWriteSaleOrderProduct) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE], [ModelType.PRODUCTO_ORDEN, ScopeType.WRITE]);
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        id_cliente: Number(form.id_cliente),
        numero_oc: form.numero_oc,
        fecha_orden: form.fecha_orden,
        bodega_id: Number(form.bodega_id),
        es_referencial: Boolean(form.es_referencial),
      };
      const res = await api("/ordenes-venta", { method: "POST", body: JSON.stringify(payload) });
      const created = res?.data || res || {};
      const id_orden = created.id;
      if (!id_orden) { toast.error("No se pudo crear la orden (ID no recibido)."); return; }

      // 🔴 DESDE ACÁ LA ORDEN YA EXISTE. Lo que sigue son N peticiones que agregan sus líneas, y
      // si una falla la orden NO desaparece: queda creada y a medio llenar. Decir «No se pudo
      // crear la orden» era falso y dejaba al operario repitiendo el formulario entero. Es lo
      // que le pasó a Hernán con el Parmesano Rueda: escribía 1,5, el backend lo rechazaba y el
      // mensaje hablaba de otra cosa.
      for (const p of productosAgregados) {
        const formato = (clienteConfig?.formato || "UNIDADES").toUpperCase();
        const enCajas = formato.includes("CAJA");
        const cantidadEnUnidades = enCajas && p.unidades_por_caja ? p.cantidad * p.unidades_por_caja : p.cantidad;
        try {
          await api(`/ordenes-venta/${id_orden}/productos`, {
            method: "POST",
            body: JSON.stringify({
              id_orden,
              id_nombre_facturacion: p.id_nombre_facturacion,
              descripcion_original: p.nombre ?? null,
              cantidad: cantidadEnUnidades,
              precio_venta: p.precio_unitario,
              porcentaje_descuento: 0,
              // Desglose comercial en cajas (la cantidad SIEMPRE viaja en unidades)
              producto_por_cajas: Boolean(enCajas && p.unidades_por_caja),
              cantidad_por_caja: enCajas && p.unidades_por_caja ? p.unidades_por_caja : 0,
            }),
          });
        } catch (err) {
          // El servidor sabe POR QUÉ falló (p. ej. «se vende por unidad y se pidió 1,5»). Ese
          // motivo vale más que cualquier frase genérica nuestra.
          const motivo = err?.message || err?.data?.message || "";
          toast.error(
            `La orden #${id_orden} se creó, pero no se pudo agregar «${p.nombre ?? "un producto"}»` +
            (motivo ? `: ${motivo}` : ".") +
            " Ábrela y corrige esa línea."
          );
          navigate(`/ventas/ordenes/${id_orden}`);
          return;
        }
      }
      toast.success("Orden creada correctamente.");
      navigate("/ventas/ordenes");
    } catch (err) {
      toast.error(err?.message ? `No se pudo crear la orden: ${err.message}` : "No se pudo crear la orden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const esCajas = (clienteConfig?.formato || "UNIDADES").toUpperCase().includes("CAJA");

  // La unidad del producto que está seleccionado en el formulario de agregar línea. Decide la
  // etiqueta, el `step` y si la cantidad puede llevar decimales.
  const unidadProductoElegido = unidadVentaDe(
    nombres.find((n) => String(n.id) === String(productoForm.id_nombre_facturacion)),
  );

  /** La unidad de una línea ya agregada, buscada en el catálogo por su nombre de facturación. */
  const unidadDeLinea = (linea) =>
    unidadVentaDe(nombres.find((n) => String(n.id) === String(linea?.id_nombre_facturacion)));

  if (isLoading) return <PageLoader message="Cargando datos" />;

  return (
    <div>
      <button
        onClick={() => navigate("/ventas/ordenes")}
        className="flex items-center text-primary mb-4 hover:underline"
      >
        <ArrowLeft size={18} className="mr-1" /> Volver
      </button>

      <h1 className="text-2xl font-bold mb-6">Nueva Orden de Venta</h1>

      {/* ── Card: Datos del pedido ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Datos del pedido</h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">

            {/* Cliente (ocupa ambas columnas) */}
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm font-medium text-gray-700">Cliente *</span>
              <Selector
                options={clients.map((c) => ({
                  value: String(c.id),
                  label: c.nombre_empresa,
                  searchText: [c.nombre_empresa, c.rut, c.giro].filter(Boolean).join(" "),
                }))}
                selectedValue={form.id_cliente}
                onSelect={(value) => handleClientChange(value)}
                useFuzzy
                className={`w-full px-3 py-2 border ${
                  errors.id_cliente ? "border-red-500" : "border-gray-300"
                } rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
              />
              {errors.id_cliente && <span className="text-red-500 text-xs">{errors.id_cliente}</span>}
              <span className="text-xs text-gray-400 italic">La dirección de entrega se asignará al momento de facturar la orden</span>
            </label>

            {/* Número OC */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Número OC</span>
              <input
                type="text"
                name="numero_oc"
                placeholder="Ej. 7000537546"
                value={form.numero_oc}
                onChange={handleFieldChange}
                className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>

            {/* Fecha Emisión */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Fecha Emisión OC *</span>
              <input
                type="date"
                name="fecha_orden"
                value={form.fecha_orden}
                onChange={handleFieldChange}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  errors.fecha_orden ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.fecha_orden && <span className="text-red-500 text-xs">{errors.fecha_orden}</span>}
            </label>

            {/* Bodega */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Bodega de origen *</span>
              <Selector
                options={bodegas.map((b) => ({
                  value: String(b.id),
                  label: b.nombre || `Bodega ${b.id}`,
                  searchText: b.nombre || `Bodega ${b.id}`,
                }))}
                selectedValue={form.bodega_id}
                onSelect={(value) => setForm((prev) => ({ ...prev, bodega_id: value }))}
                useFuzzy
                className={`w-full px-3 py-2 border ${
                  errors.bodega_id ? "border-red-500" : "border-gray-300"
                } rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
              />
              {errors.bodega_id && <span className="text-red-500 text-xs">{errors.bodega_id}</span>}
            </label>

            {/* Condición de pago (solo lectura) */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Condición de pago</span>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-md text-sm text-gray-700 min-h-[40px] flex items-center">
                {condicionPagoCliente
                  ? `${condicionPagoCliente} días`
                  : <span className="text-gray-400">—</span>}
              </div>
              <span className="text-xs text-gray-400 italic">Obtenida automáticamente del cliente</span>
            </div>

          </div>

          {/* Orden referencial */}
          <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              name="es_referencial"
              checked={form.es_referencial}
              onChange={(e) => setForm(prev => ({ ...prev, es_referencial: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-amber-800">Orden referencial (sin picking)</span>
              <p className="text-xs text-amber-600 mt-0.5">
                Activa esta opción cuando la producción no está registrada en el sistema. La orden irá directo a Facturada sin pasar por picking.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* ── Card: Productos ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-800">Productos</h2>
            {!form.id_cliente && (
              <span className="text-sm text-gray-400">Selecciona un cliente para agregar productos</span>
            )}
          </div>

          {/*
            Líneas que venían en el correo apartado. Se muestran acá, al lado del formulario,
            en vez de obligar a tener Gmail abierto en otra ventana. "Usar" carga la línea en
            el formulario para revisarla; el precio lo pone la lista del cliente, no el correo.
          */}
          {lineasDelCorreo.length > 0 && (
            <div className="mb-5 border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-amber-200">
                <p className="text-sm font-medium text-amber-900">
                  Del correo: {lineasDelCorreo.length}{" "}
                  {lineasDelCorreo.length === 1 ? "línea por cargar" : "líneas por cargar"}
                </p>
              </div>
              <ul className="divide-y divide-amber-100">
                {lineasDelCorreo.map((l) => (
                  <li key={l._key} className="flex items-center gap-3 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate">
                        {l.descripcion || "(sin descripción)"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Cantidad: {l.cantidad ?? "—"}
                        {l.precio_unitario != null && ` · en el correo: $${l.precio_unitario}`}
                        {!l.id_nombre_facturacion && " · producto no reconocido"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => usarLineaDelCorreo(l)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-medium"
                    >
                      Usar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Formulario agregar producto */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Producto *</span>
              <Selector
                options={nombres
                  .filter((n) => !productosAgregados.some((pa) => pa.id_nombre_facturacion === n.id))
                  .map((n) => ({
                    value: String(n.id),
                    label: n.nombre,
                    searchText: [n.nombre, ...(n.productos || []).map((p) => p.nombre)].join(" "),
                  }))}
                selectedValue={productoForm.id_nombre_facturacion}
                onSelect={(value) => setProductoField("id_nombre_facturacion", value)}
                disabled={!form.id_cliente}
                useFuzzy
                className={`w-full px-3 py-2 border ${
                  productErrors.id_nombre_facturacion ? "border-red-500" : "border-gray-300"
                } rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  !form.id_cliente ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                }`}
              />
              {productErrors.id_nombre_facturacion && (
                <span className="text-red-500 text-xs">{productErrors.id_nombre_facturacion}</span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Cantidad {esCajas ? "(Cajas)" : unidadProductoElegido === "Kilogramos" ? "(Kg)"
                  : unidadProductoElegido === "Litros" ? "(Litros)" : "(Unidades)"} *
              </span>
              <input
                type="number"
                name="cantidad"
                // El `step` es la primera línea de defensa: para lo que se vende por pieza el
                // navegador ya no deja escribir decimales, en vez de aceptarlos y fallar al
                // guardar con «No se pudo crear la orden».
                step={esCajas ? "1" : stepDeUnidad(unidadProductoElegido)}
                placeholder={admiteFraccion(unidadProductoElegido) && !esCajas ? "Ej. 1,5" : "Ej. 10"}
                value={productoForm.cantidad}
                onChange={handleProductoChange}
                disabled={!form.id_cliente}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  productErrors.cantidad ? "border-red-500" : "border-gray-300"
                } ${!form.id_cliente ? "bg-gray-100 cursor-not-allowed" : ""}`}
              />
              {productErrors.cantidad && (
                <span className="text-red-500 text-xs">{productErrors.cantidad}</span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Precio {esCajas ? "por Caja" : "Unitario"} *
              </span>
              <input
                type="number"
                name="precio_unitario"
                placeholder="Se llenará automáticamente"
                value={productoForm.precio_unitario || ""}
                readOnly
                className={`border px-3 py-2 rounded-md bg-gray-100 cursor-not-allowed ${
                  productErrors.precio_unitario ? "border-red-500" : "border-gray-300"
                }`}
              />
              {productErrors.precio_unitario && (
                <span className="text-red-500 text-xs">{productErrors.precio_unitario}</span>
              )}
            </label>
          </div>

          <button
            type="button"
            onClick={handleAddProduct}
            disabled={!form.id_cliente}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !form.id_cliente
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-hover"
            }`}
          >
            Agregar producto
          </button>

          {/* Tabla de productos */}
          {productosAgregados.length > 0 && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cantidad</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Formato</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Precio {esCajas ? "/ Caja" : "Unitario"}
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(isProductosExpanded ? productosAgregados : productosAgregados.slice(0, 5)).map((p) => {
                    const isEditing = editingProdId === p.id_nombre_facturacion;
                    return (
                    <tr key={p.id_nombre_facturacion} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <td className="px-4 py-2.5 text-sm text-gray-800">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step={esCajas ? "1" : stepDeUnidad(unidadDeLinea(p))}
                            value={editingCantidad}
                            onChange={(e) => setEditingCantidad(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmEdit(); if (e.key === "Escape") handleCancelEdit(); }}
                            autoFocus
                            className="w-24 border border-blue-400 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          // La unidad va pegada al número. Un «1,5» a secas se lee como una pieza
                          // y media; la unidad es lo que hace que se lea como kilo y medio.
                          esCajas ? p.cantidad : cantidadConUnidad(p.cantidad, unidadDeLinea(p))
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">
                        {esCajas ? p.formato_linea
                          : admiteFraccion(unidadDeLinea(p))
                            ? <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">A granel</span>
                            : p.formato_linea}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        ${p.precio_unitario.toLocaleString("es-CL")}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                        ${(isEditing
                          ? p.precio_unitario * (Number(editingCantidad) || 0)
                          : p.total_linea
                        ).toLocaleString("es-CL")}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <button
                              type="button"
                              onClick={handleConfirmEdit}
                              aria-label="Confirmar edición"
                              className="p-1 rounded hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                              title="Confirmar"
                            >
                              <Check size={16} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              aria-label="Cancelar edición"
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Cancelar"
                            >
                              <X size={16} strokeWidth={2} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-center">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              aria-label="Editar cantidad"
                              className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar cantidad"
                            >
                              <Pencil size={15} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id_nombre_facturacion)}
                              aria-label="Eliminar producto"
                              className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                {productosAgregados.length > 5 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            if (editingProdId !== null) handleCancelEdit();
                            setIsProductosExpanded((v) => !v);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          {isProductosExpanded ? (
                            <><ChevronUp size={15} /> Mostrar menos</>
                          ) : (
                            <><ChevronDown size={15} /> Ver todos ({productosAgregados.length})</>
                          )}
                        </button>
                        {!isProductosExpanded && (
                          <p className="mt-1.5 text-center text-xs text-gray-400">
                            Mostrando {Math.min(5, productosAgregados.length)} de {productosAgregados.length} productos
                          </p>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium transition-colors"
        >
          {isSubmitting ? "Guardando..." : "Guardar Orden"}
        </button>
      </div>
    </div>
  );
}
