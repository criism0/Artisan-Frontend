import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { getTodayDate } from "../../lib/dateUtils";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function AddOrdenVenta() {
  const navigate = useNavigate();
  const api = useApi();
  const [clients, setClients] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [preciosLista, setPreciosLista] = useState([]);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [errors, setErrors] = useState({});
  const [productErrors, setProductErrors] = useState({});
  const [condicionPagoCliente, setCondicionPagoCliente] = useState(null);

  const [form, setForm] = useState({
    id_cliente: "",
    id_local: "",
    numero_oc: "",
    costo_envio: "",
    fecha_orden: getTodayDate(),
    fecha_envio: "",
    fecha_facturacion: "",
    condiciones: "Contado",
    bodega_id: "",
  });

  const [productoForm, setProductoForm] = useState({
    id_producto: "",
    cantidad: "",
    precio_unitario: "",
  });

  useEffect(() => {
    api("/clientes").then((res) => setClients(res.data || res));
    api("/productos-base").then((res) => setProductos(res.data || res));
    api("/bodegas").then((res) => {
      const bodegasData = Array.isArray(res?.bodegas) 
        ? res.bodegas 
        : Array.isArray(res?.data) 
        ? res.data 
        : Array.isArray(res) 
        ? res 
        : [];
      setBodegas(bodegasData);
    });
  }, [api]);

  // Efecto para calcular automáticamente la fecha de facturación cuando cambian fecha_orden o condicionPagoCliente
  useEffect(() => {
    if (condicionPagoCliente && condicionPagoCliente > 0 && form.fecha_orden) {
      const fechaFacturacion = calcularFechaFacturacion(form.fecha_orden, condicionPagoCliente);
      setForm(prev => {
        // Solo actualizar si la fecha calculada es diferente a la actual
        if (prev.fecha_facturacion !== fechaFacturacion) {
          return { ...prev, fecha_facturacion: fechaFacturacion };
        }
        return prev;
      });
    }
  }, [form.fecha_orden, condicionPagoCliente]);

  // Función helper para calcular el precio de un producto según la lista de precios
  const calcularPrecioProducto = (productoId, preciosListaActual, clienteConfigActual) => {
    if (!clienteConfigActual || !productoId) return "";
    
    const precioLista = preciosListaActual.find((x) => x.id_producto_base === productoId);
    const productoBase = productos.find((p) => p.id === productoId);
    const unidadesPorCaja = Number(
      precioLista?.unidades_por_caja || productoBase?.unidades_por_caja || 0
    ) || 0;
    
    const precioCaja = precioLista?.precio_caja;
    const precioUnidad = precioLista?.precio_unidad;
    const formato = (clienteConfigActual?.formato || "UNIDADES").toUpperCase();
    
    if (formato.includes("CAJA")) {
      if (precioCaja) {
        return Number(precioCaja);
      } else if (precioUnidad && unidadesPorCaja) {
        return Number(precioUnidad) * Number(unidadesPorCaja);
      }
    } else {
      if (precioUnidad) {
        return Number(precioUnidad);
      } else if (precioCaja && unidadesPorCaja) {
        return Number(precioCaja) / Number(unidadesPorCaja);
      }
    }
    
    return "";
  };

  // Función para recalcular precios y formatos de productos ya agregados
  const recalcularPreciosProductos = (productosActuales, preciosListaActual, clienteConfigActual) => {
    if (!clienteConfigActual || productosActuales.length === 0) return productosActuales;
    
    const formato = (clienteConfigActual?.formato || "UNIDADES").toUpperCase();
    const esCajas = formato.includes("CAJA");
    
    return productosActuales.map((prod) => {
      const nuevoPrecio = calcularPrecioProducto(prod.id_producto, preciosListaActual, clienteConfigActual);
      
      // Obtener unidades_por_caja del producto
      const precioLista = preciosListaActual.find((x) => x.id_producto_base === prod.id_producto);
      const productoBase = productos.find((p) => p.id === prod.id_producto);
      const unidadesPorCaja = Number(
        precioLista?.unidades_por_caja || productoBase?.unidades_por_caja || prod.unidades_por_caja || 0
      ) || 0;
      
      // Mantener cantidad igual (el número original que el usuario ingresó)
      return {
        ...prod,
        precio_unitario: nuevoPrecio || 0,
        cantidad: prod.cantidad, // Se mantiene igual (número original ingresado)
        formato_linea: esCajas ? "CAJAS" : "UNIDADES",
        unidades_por_caja: unidadesPorCaja || null,
        total_linea: (nuevoPrecio || 0) * prod.cantidad,
      };
    });
  };

  // Función para sumar días a una fecha y devolver en formato YYYY-MM-DD
  const sumarDiasAFecha = (fechaStr, dias) => {
    if (!fechaStr || !dias || dias <= 0) return "";
    const fecha = new Date(fechaStr);
    fecha.setDate(fecha.getDate() + Number(dias));
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para calcular la fecha de facturación basada en la condición de pago
  const calcularFechaFacturacion = (fechaBase, condicionPago) => {
    if (!fechaBase || !condicionPago || condicionPago <= 0) return "";
    return sumarDiasAFecha(fechaBase, condicionPago);
  };

  const handleClientChange = async (e) => {
    const id_cliente = e.target.value;
    setDirecciones([]);
    setClienteConfig(null);
    setPreciosLista([]);
    setCondicionPagoCliente(null);
    
    // Limpiar formulario de producto si no hay cliente
    if (!id_cliente) {
      setProductoForm({ id_producto: "", cantidad: "", precio_unitario: "" });
      setForm(prev => ({ ...prev, id_cliente: "", id_local: "", fecha_facturacion: "" }));
      return;
    }
    
    // Actualizar id_cliente e id_local primero
    setForm(prev => ({ ...prev, id_cliente, id_local: "" }));
    
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
      
      // Guardar condición de pago del cliente
      const condicionPago = clienteData?.condicion_pago;
      setCondicionPagoCliente(condicionPago);
      
      // Calcular fecha de facturación si hay condición de pago
      if (condicionPago && condicionPago > 0) {
        setForm(prev => {
          const fechaBase = prev.fecha_orden || getTodayDate();
          const fechaFacturacion = calcularFechaFacturacion(fechaBase, condicionPago);
          return { ...prev, fecha_facturacion: fechaFacturacion };
        });
      } else {
        // Si no hay condición de pago, limpiar la fecha de facturación
        setForm(prev => ({ ...prev, fecha_facturacion: "" }));
      }
      
      let productosLista = [];
      if (clienteData?.id_lista_precio) {
        try {
          const resLista = await api(`/lista-precio/${clienteData.id_lista_precio}`);
          const listaData = resLista.data || resLista;
          productosLista = Array.isArray(listaData?.productosBaseListaPrecio) 
            ? listaData.productosBaseListaPrecio 
            : [];
          setPreciosLista(productosLista);
        } catch (e2) {
          toast.error("Error al cargar precios de lista");
        }
      }
      
      // Recalcular precios de productos ya agregados
      if (productosAgregados.length > 0) {
        const productosActualizados = recalcularPreciosProductos(
          productosAgregados,
          productosLista,
          nuevoClienteConfig
        );
        setProductosAgregados(productosActualizados);
      }
      
      // Recalcular precio del producto en el formulario si hay uno seleccionado
      if (productoForm.id_producto) {
        const nuevoPrecio = calcularPrecioProducto(
          Number(productoForm.id_producto),
          productosLista,
          nuevoClienteConfig
        );
        setProductoForm((prev) => ({
          ...prev,
          precio_unitario: nuevoPrecio,
        }));
      }
      
      if (productosAgregados.length > 0 || productoForm.id_producto) {
        toast.success("Precios y formatos actualizados según la lista del cliente seleccionado");
      }
    } catch (err) {
      toast.error("Error al cargar datos del cliente");
    }
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...form, [name]: value };
    
    // Si cambia la fecha_orden y hay condición de pago del cliente, recalcular fecha_facturacion
    if (name === "fecha_orden" && condicionPagoCliente && condicionPagoCliente > 0) {
      const fechaFacturacion = calcularFechaFacturacion(value, condicionPagoCliente);
      updatedForm.fecha_facturacion = fechaFacturacion;
    }
    
    setForm(updatedForm);
  };

  const handleProductoChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...productoForm, [name]: value };

    if (name === "id_producto") {
      setProductErrors({});
    }

    if (name === "id_producto" && form.id_cliente) {
      const prodId = Number(value);
      const nuevoPrecio = calcularPrecioProducto(prodId, preciosLista, clienteConfig);
      updatedForm.precio_unitario = nuevoPrecio;
    }

    setProductoForm(updatedForm);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.id_cliente) {
      newErrors.id_cliente = "Debes seleccionar un cliente.";
      setErrors(newErrors);
      toast.error("Debes seleccionar un cliente.");
      return false;
    }
    if (!form.id_local) {
      newErrors.id_local = "Debes seleccionar una dirección.";
      setErrors(newErrors);
      toast.error("Debes seleccionar una dirección.");
      return false;
    }
    if (!form.bodega_id) {
      newErrors.bodega_id = "Debes seleccionar una bodega.";
      setErrors(newErrors);
      toast.error("Debes seleccionar una bodega.");
      return false;
    }
    if (!form.costo_envio || form.costo_envio <= 0) {
      newErrors.costo_envio = "Ingresa un costo de envío mayor a 0.";
      setErrors(newErrors);
      toast.error("Ingresa un costo de envío mayor a 0.");
      return false;
    }
    if (!form.fecha_orden) {
      newErrors.fecha_orden = "La fecha de emisión es obligatoria.";
      setErrors(newErrors);
      toast.error("La fecha de emisión es obligatoria.");
      return false;
    }
    if (!form.fecha_envio) {
      newErrors.fecha_envio = "Debes ingresar la fecha de entrega.";
      setErrors(newErrors);
      toast.error("Debes ingresar la fecha de entrega.");
      return false;
    }
    
    setErrors({});
    return true;
  };

  const validateProducto = () => {
    const prodErrors = {};
    if (!productoForm.id_producto)
      prodErrors.id_producto = "Debes seleccionar un producto.";
    if (!productoForm.cantidad || productoForm.cantidad <= 0)
      prodErrors.cantidad = "Cantidad debe ser mayor a 0.";
    if (!productoForm.precio_unitario || productoForm.precio_unitario <= 0)
      prodErrors.precio_unitario = "Precio debe ser mayor a 0.";
    setProductErrors(prodErrors);
    return Object.keys(prodErrors).length === 0;
  };

  const handleAddProduct = () => {
    if (!form.id_cliente) {
      toast.error("Debes seleccionar un cliente antes de agregar productos");
      return;
    }
    
    if (!validateProducto()) return;
    
    // Verificar si el producto ya está agregado
    const productoId = Number(productoForm.id_producto);
    if (productosAgregados.some(p => p.id_producto === productoId)) {
      setProductErrors({ id_producto: "Este producto ya está agregado a la orden." });
      return;
    }
    
    const prod = productos.find((p) => p.id === productoId);
    const formato = (clienteConfig?.formato || "UNIDADES").toUpperCase();
    const precioLista = preciosLista.find((x) => x.id_producto_base === prod.id);
    const unidadesPorCaja = Number(
      precioLista?.unidades_por_caja || prod.unidades_por_caja || 0
    ) || 0;
    const cantidad = Number(productoForm.cantidad);

    const newProd = {
      id_producto: prod.id,
      nombre: prod.nombre,
      precio_unitario: Number(productoForm.precio_unitario),
      cantidad: cantidad, 
      formato_linea: formato.includes("CAJA") ? "CAJAS" : "UNIDADES",
      unidades_por_caja: unidadesPorCaja || null,
      total_linea: Number(productoForm.precio_unitario) * cantidad,
    };
    setProductosAgregados((prev) => [...prev, newProd]);
    setProductoForm({ id_producto: "", cantidad: "", precio_unitario: "" });
    setProductErrors({});
  };

  const handleDeleteProduct = (id) => {
    setProductosAgregados((prev) => prev.filter((p) => p.id_producto !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (form.fecha_envio && form.fecha_envio < form.fecha_orden) {
      toast.error("La fecha de entrega no puede ser anterior a la emisión.");
      return;
    }
    if (productosAgregados.length === 0) {
      toast.error("Debes agregar al menos un producto a la orden.");
      return;
    }
    try {
      const direccionSeleccionada = direcciones.find(d => d.id === Number(form.id_local));
      if (!direccionSeleccionada) {
        toast.error("La dirección seleccionada no es válida. Por favor, selecciona una dirección del cliente.");
        return;
      }
      if (direccionSeleccionada.cliente_id && Number(direccionSeleccionada.cliente_id) !== Number(form.id_cliente)) {
        toast.error("La dirección seleccionada no pertenece al cliente seleccionado.");
        return;
      }
      
      const payload = {
        ...form,
        id_cliente: Number(form.id_cliente),
        id_local: Number(form.id_local),
        costo_envio: Number(form.costo_envio),
        bodega_id: Number(form.bodega_id),
      };
      
      const res = await api("/ordenes-venta", { method: "POST", body: JSON.stringify(payload) });
      const created = res?.data || res || {};
      const id_orden = created.id;
      
      if (!id_orden) {
        toast.error("No se pudo crear la orden (ID no recibido).");
        return;
      }
      for (const p of productosAgregados) {
        // Calcular cantidad en unidades según el formato actual del cliente
        const formato = (clienteConfig?.formato || "UNIDADES").toUpperCase();
        const esCajas = formato.includes("CAJA");
        const cantidadEnUnidades = esCajas && p.unidades_por_caja
          ? p.cantidad * p.unidades_por_caja
          : p.cantidad;
        
        await api(`/ordenes-venta/${id_orden}/productos`, {
          method: "POST",
          body: JSON.stringify({
            id_orden,
            id_producto: p.id_producto,
            cantidad: cantidadEnUnidades, // Calcular unidades desde cantidad según formato
            precio_venta: p.precio_unitario,
            porcentaje_descuento: 0,
          }),
        });
      }
      
      toast.success("Orden creada correctamente.");
      navigate("/ventas/ordenes");
    } catch (err) {
      toast.error("No se pudo crear la orden.");
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

      <h1 className="text-2xl font-bold mb-6">Nueva Orden de Venta</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 bg-white p-4 rounded shadow">
        <label className="flex flex-col">
          Cliente *
          <select
            name="id_cliente"
            value={form.id_cliente}
            onChange={handleClientChange}
            className={`border px-2 py-1 rounded ${
              errors.id_cliente ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccione cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_empresa}
              </option>
            ))}
          </select>
          {errors.id_cliente && <span className="text-red-500 text-sm mt-1">{errors.id_cliente}</span>}
        </label>

        <label className="flex flex-col">
          Dirección *
          <select
            name="id_local"
            value={form.id_local}
            onChange={handleFieldChange}
            disabled={!direcciones.length}
            className={`border px-2 py-1 rounded ${
              errors.id_local ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccione dirección...</option>
            {direcciones.map((d) => {
              const label = [
                d.tipo_direccion,
                d.nombre_sucursal,
                [d.calle, d.numero].filter(Boolean).join(" "),
                d.comuna
              ]
                .filter(Boolean)
                .join(" - ");
              return (
                <option key={d.id} value={d.id}>
                  {label}
                </option>
              );
            })}
          </select>
          {errors.id_local && <span className="text-red-500 text-sm mt-1">{errors.id_local}</span>}
        </label>

        <label className="flex flex-col">
          Número OC
          <input
            type="text"
            name="numero_oc"
            placeholder="Ejemplo: 7000537546"
            value={form.numero_oc}
            onChange={handleFieldChange}
            className="border border-gray-300 px-2 py-1 rounded"
          />
        </label>

        <label className="flex flex-col">
          Costo de Envío *
          <input
            type="number"
            name="costo_envio"
            placeholder="Ejemplo: 5000"
            value={form.costo_envio}
            onChange={handleFieldChange}
            className={`border px-2 py-1 rounded ${
              errors.costo_envio ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.costo_envio && <span className="text-red-500 text-sm mt-1">{errors.costo_envio}</span>}
        </label>

        <label className="flex flex-col">
          Fecha Emisión OC *
          <input
            type="date"
            name="fecha_orden"
            value={form.fecha_orden}
            onChange={handleFieldChange}
            className={`border px-2 py-1 rounded ${
              errors.fecha_orden ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.fecha_orden && <span className="text-red-500 text-sm mt-1">{errors.fecha_orden}</span>}
        </label>

        <label className="flex flex-col">
          Fecha de Entrega *
          <input
            type="date"
            name="fecha_envio"
            value={form.fecha_envio}
            onChange={handleFieldChange}
            className={`border px-2 py-1 rounded ${
              errors.fecha_envio ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.fecha_envio && <span className="text-red-500 text-sm mt-1">{errors.fecha_envio}</span>}
        </label>

        <label className="flex flex-col">
          Fecha de Facturación
          <input
            type="date"
            name="fecha_facturacion"
            value={form.fecha_facturacion}
            onChange={handleFieldChange}
            className="border border-gray-300 px-2 py-1 rounded"
          />
        </label>

        <label className="flex flex-col">
          Condiciones
          <select
            name="condiciones"
            value={form.condiciones}
            onChange={handleFieldChange}
            className="border border-gray-300 px-2 py-1 rounded"
          >
            <option>Contado</option>
            <option>Crédito a 15 días</option>
            <option>Crédito a 30 días</option>
            <option>Crédito a 45 días</option>
            <option>Crédito a 60 días</option>
          </select>
        </label>

        <label className="flex flex-col">
          Bodega *
          <select
            name="bodega_id"
            value={form.bodega_id}
            onChange={handleFieldChange}
            className={`border px-2 py-1 rounded ${
              errors.bodega_id ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccione bodega...</option>
            {bodegas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre || `Bodega ${b.id}`}
              </option>
            ))}
          </select>
          {errors.bodega_id && <span className="text-red-500 text-sm mt-1">{errors.bodega_id}</span>}
        </label>
      </form>

      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Agregar Productos</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="flex flex-col">
            Producto *
            <select
              name="id_producto"
              value={productoForm.id_producto}
              onChange={handleProductoChange}
              disabled={!form.id_cliente}
              className={`border px-2 py-1 rounded ${
                productErrors.id_producto ? "border-red-500" : "border-gray-300"
              } ${!form.id_cliente ? "bg-gray-100 cursor-not-allowed" : ""}`}
            >
              <option value="">
                {!form.id_cliente ? "Seleccione cliente primero..." : "Seleccione producto..."}
              </option>
              {productos
                .filter(p => !productosAgregados.some(pa => pa.id_producto === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
            {productErrors.id_producto && (
              <span className="text-red-500 text-sm mt-1">{productErrors.id_producto}</span>
            )}
            {!form.id_cliente && (
              <span className="text-gray-500 text-sm mt-1">Debes seleccionar un cliente primero</span>
            )}
          </label>

          <label className="flex flex-col">
            {`Cantidad ${
              (clienteConfig?.formato || 'UNIDADES').toUpperCase().includes('CAJA')
                ? '(Cajas)'
                : '(Unidades)'
            } *`}
            <input
              type="number"
              name="cantidad"
              placeholder="Ejemplo: 10"
              value={productoForm.cantidad}
              onChange={handleProductoChange}
              disabled={!form.id_cliente}
              className={`border px-2 py-1 rounded ${
                productErrors.cantidad ? "border-red-500" : "border-gray-300"
              } ${!form.id_cliente ? "bg-gray-100 cursor-not-allowed" : ""}`}
            />
            {productErrors.cantidad && (
              <span className="text-red-500 text-sm mt-1">{productErrors.cantidad}</span>
            )}
          </label>

          <label className="flex flex-col">
            {`Precio ${
              (clienteConfig?.formato || 'UNIDADES').toUpperCase().includes('CAJA')
                ? 'por Caja'
                : 'Unitario'
            } *`}
            <input
              type="number"
              name="precio_unitario"
              placeholder="Se llenará automáticamente"
              value={productoForm.precio_unitario || ""}
              readOnly
              className={`border px-2 py-1 rounded bg-gray-100 cursor-not-allowed ${
                productErrors.precio_unitario ? "border-red-500" : "border-gray-300"
              }`}
            />
            {productErrors.precio_unitario && (
              <span className="text-red-500 text-sm mt-1">{productErrors.precio_unitario}</span>
            )}
          </label>
        </div>

        <button
          type="button"
          onClick={handleAddProduct}
          disabled={!form.id_cliente}
          className={`px-4 py-2 rounded ${
            !form.id_cliente
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-primary text-white hover:bg-hover"
          }`}
        >
          Agregar Producto
        </button>

        {productosAgregados.length > 0 && (
          <table className="w-full mt-6 bg-white rounded shadow">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Producto</th>
                <th className="px-4 py-2 text-left">Cantidad (Formato)</th>
                <th className="px-4 py-2 text-left">Formato</th>
                <th className="px-4 py-2 text-left">Precio { (clienteConfig?.formato || 'UNIDADES').toUpperCase().includes('CAJA') ? 'por Caja' : 'Unitario' }</th>
                <th className="px-4 py-2 text-left">Total Línea</th>
                <th className="px-4 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosAgregados.map((p) => (
                <tr key={p.id_producto} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{p.nombre}</td>
                  <td className="px-4 py-2">{p.cantidad}</td>
                  <td className="px-4 py-2">{p.formato_linea}</td>
                  <td className="px-4 py-2">${p.precio_unitario}</td>
                  <td className="px-4 py-2">${p.total_linea}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDeleteProduct(p.id_producto)}
                      className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 size={18} strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Guardar Orden
        </button>
      </div>
    </div>
  );
}
