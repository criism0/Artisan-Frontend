import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { Trash2 } from "lucide-react";

export default function EditOrdenVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  const [clients, setClients] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [preciosLista, setPreciosLista] = useState([]);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [productErrors, setProductErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    id_cliente: "",
    id_local: "",
    numero_oc: "",
    costo_envio: "",
    fecha_orden: "",
    fecha_envio: "",
    fecha_facturacion: "",
    estado: "",
    condiciones: ""
  });

  const initialIdDireccion = useRef("");
  const isInitialLoad = useRef(true);

  const [productoForm, setProductoForm] = useState({
    id_producto: "",
    cantidad: "",
    precio_unitario: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const cliRes = await api("/clientes");
        const rawClients = Array.isArray(cliRes) ? cliRes : cliRes.data || [];
        setClients(
          rawClients.map(c => ({
            value: c.id.toString(),
            label: c.nombre_empresa
          }))
        );

        let orden = location.state?.orden;
        if (!orden) {
          const ordRes = await api(`/ordenes-venta/${id}/info`);
          orden = ordRes.data || ordRes;
        }

        // Obtener cliente desde la dirección (id_local es id_direccion)
        let clienteId = "";
        if (orden.id_local) {
          // Buscar el cliente que tiene esta dirección
          for (const cliente of rawClients) {
            const dirs = Array.isArray(cliente.direcciones) ? cliente.direcciones : [];
            if (dirs.some(d => d.id === orden.id_local)) {
              clienteId = cliente.id.toString();
              break;
            }
          }
        }
        
        initialIdDireccion.current = orden.id_local?.toString() || "";

        // Establecer el form inicial - id_local se establecerá después de cargar direcciones
        setForm({
          id_cliente: clienteId,
          id_local: "",
          numero_oc: orden.numero_oc || "",
          costo_envio: orden.costo_envio?.toString() || "",
          fecha_orden: orden.fecha_orden?.slice(0, 10) || "",
          fecha_envio: orden.fecha_envio?.slice(0, 10) || "",
          fecha_facturacion: orden.fecha_facturacion?.slice(0, 10) || "",
          estado: orden.estado || "",
          condiciones: orden.condiciones || ""
        });

        // Cargar direcciones y configuración del cliente si existe
        if (clienteId) {
          try {
            const clienteRes = await api(`/clientes/${clienteId}`);
            const clienteData = clienteRes.data || clienteRes;
            const dirs = Array.isArray(clienteData?.direcciones) ? clienteData.direcciones : [];
            setDirecciones(dirs);
            setClienteConfig({
              formato: clienteData?.formato_compra_predeterminado || "UNIDADES",
              id_lista_precio: clienteData?.id_lista_precio || null,
            });
            
            // Cargar lista de precios
            if (clienteData?.id_lista_precio) {
              try {
                const resLista = await api(`/lista-precio/${clienteData.id_lista_precio}`);
                const listaData = resLista.data || resLista;
                const productosLista = Array.isArray(listaData?.productosBaseListaPrecio) 
                  ? listaData.productosBaseListaPrecio 
                  : [];
                setPreciosLista(productosLista);
              } catch (e2) {
                toast.error("Error al cargar precios de lista");
              }
            }
            
            // Establecer la dirección directamente en el form si existe
            const direccionId = orden.id_local?.toString() || "";
            if (direccionId && dirs.some(d => String(d.id) === direccionId)) {
              setForm(f => ({ 
                ...f, 
                id_local: direccionId 
              }));
            }
          } catch (e) {
            toast.error("Error al cargar direcciones del cliente");
          }
        }

        // Cargar productos base y luego productos de la orden
        const productosRes = await api("/productos-base");
        const productosData = productosRes.data || productosRes || [];
        setProductos(productosData);

        // Cargar productos existentes de la orden
        try {
          const productosOrdenRes = await api(`/ordenes-venta/${id}/productos`);
          const productosExistentes = productosOrdenRes.data || productosOrdenRes || [];
          const productosConInfo = productosExistentes.map((item) => {
            const prod = productosData.find(p => p.id === item.id_producto);
            return {
              id_producto: item.id_producto,
              nombre: prod?.nombre || `Producto #${item.id_producto}`,
              cantidad: item.cantidad,
              precio_unitario: item.precio_venta,
              cantidad_formato: item.cantidad,
              formato_linea: "UNIDADES",
              unidades_reservadas: item.cantidad,
              total_linea: item.cantidad * item.precio_venta,
              dbId: item.id,
            };
          });
          setProductosAgregados(productosConInfo);
        } catch (e) {
          toast.error("Error al cargar productos de la orden");
        }
      } catch (err) {
        toast.error(err.message || "Error al cargar la orden");
      } finally {
        setLoading(false);
        isInitialLoad.current = false;
      }
    })();
  }, [id, location.state, api]);

  useEffect(() => {
    if (isInitialLoad.current) {
      return;
    }
    
    if (!form.id_cliente) {
      setDirecciones([]);
      setClienteConfig(null);
      setPreciosLista([]);
      if (form.id_local) {
        setForm(f => ({ ...f, id_local: "" }));
      }
      return;
    }
    
    (async () => {
      try {
        const clienteRes = await api(`/clientes/${form.id_cliente}`);
        const clienteData = clienteRes.data || clienteRes;
        const dirs = Array.isArray(clienteData?.direcciones) ? clienteData.direcciones : [];
        setDirecciones(dirs);
        setClienteConfig({
          formato: clienteData?.formato_compra_predeterminado || "UNIDADES",
          id_lista_precio: clienteData?.id_lista_precio || null,
        });
        
        // Cargar lista de precios
        if (clienteData?.id_lista_precio) {
          try {
            const resLista = await api(`/lista-precio/${clienteData.id_lista_precio}`);
            const listaData = resLista.data || resLista;
            const productosLista = Array.isArray(listaData?.productosBaseListaPrecio) 
              ? listaData.productosBaseListaPrecio 
              : [];
            setPreciosLista(productosLista);
          } catch (e2) {
            toast.error("Error al cargar precios de lista");
          }
        }
        
        // Si hay una dirección seleccionada y es válida en las nuevas direcciones, mantenerla
        if (form.id_local && dirs.some(d => String(d.id) === form.id_local)) {
          // La dirección ya está en el form y es válida, no hacer nada
          return;
        }
        
        // Si hay una dirección guardada en initialIdDireccion y existe en las direcciones, establecerla
        if (
          initialIdDireccion.current &&
          dirs.some(d => String(d.id) === initialIdDireccion.current)
        ) {
          setForm(f => ({ ...f, id_local: initialIdDireccion.current }));
          initialIdDireccion.current = "";
        }
      } catch (e) {
        toast.error("Error al cargar direcciones del cliente");
      }
    })();
  }, [form.id_cliente, api]);

  const handleClientChange = e => {
    setForm(f => ({ ...f, id_cliente: e.target.value, id_local: "" }));
    setClienteConfig(null);
    setPreciosLista([]);
  };

  const handleFieldChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleProductoChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...productoForm, [name]: value };

    // Limpiar errores cuando se cambia el producto
    if (name === "id_producto") {
      setProductErrors({});
    }

    if (name === "id_producto" && form.id_cliente) {
      const prodId = Number(value);
      const precioLista = preciosLista.find((x) => x.id_producto_base === prodId);
      
      const unidadesPorCaja = precioLista?.unidades_por_caja || productos.find(p => p.id === prodId)?.unidades_por_caja;
      const precioCaja = precioLista?.precio_caja;
      const precioUnidad = precioLista?.precio_unidad;

      const formato = (clienteConfig?.formato || "UNIDADES").toUpperCase();
      if (formato.includes("CAJA")) {
        if (precioCaja) {
          updatedForm.precio_unitario = Number(precioCaja);
        } else if (precioUnidad && unidadesPorCaja) {
          updatedForm.precio_unitario = Number(precioUnidad) * Number(unidadesPorCaja);
        } else {
          updatedForm.precio_unitario = "";
        }
      } else {
        if (precioUnidad) {
          updatedForm.precio_unitario = Number(precioUnidad);
        } else if (precioCaja && unidadesPorCaja) {
          updatedForm.precio_unitario = Number(precioCaja) / Number(unidadesPorCaja);
        } else {
          updatedForm.precio_unitario = "";
        }
      }
    }

    setProductoForm(updatedForm);
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
    const cantidadFormato = Number(productoForm.cantidad);
    const cantidadUnidades = formato.includes("CAJA") && unidadesPorCaja
      ? cantidadFormato * unidadesPorCaja
      : cantidadFormato;

    const newProd = {
      id_producto: prod.id,
      nombre: prod.nombre,
      cantidad: cantidadUnidades,
      precio_unitario: Number(productoForm.precio_unitario),
      cantidad_formato: cantidadFormato,
      formato_linea: formato.includes("CAJA") ? "CAJAS" : "UNIDADES",
      unidades_por_caja: unidadesPorCaja || null,
      total_linea: Number(productoForm.precio_unitario) * cantidadFormato,
      unidades_reservadas: cantidadUnidades,
      dbId: null,
    };
    setProductosAgregados((prev) => [...prev, newProd]);
    setProductoForm({ id_producto: "", cantidad: "", precio_unitario: "" });
    setProductErrors({});
  };

  const handleDeleteProduct = (id) => {
    setProductosAgregados((prev) => prev.filter((p) => p.id_producto !== id));
  };

  const validate = () => {
    const miss = [];
    if (!form.id_cliente) miss.push("Cliente");
    if (!form.id_local) miss.push("Dirección");
    if (!form.numero_oc.trim()) miss.push("Número OC");
    if (!form.costo_envio.trim()) miss.push("Costo de Envío");
    if (!form.fecha_orden.trim()) miss.push("Fecha Emisión OC");
    if (!form.estado.trim()) miss.push("Estado");
    return miss;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const missing = validate();
    if (missing.length) {
      toast.error(`Por favor completa: ${missing.join(", ")}`);
      return;
    }

    const fechaOrden = new Date(form.fecha_orden);
    const fechaEnvio = form.fecha_envio ? new Date(form.fecha_envio) : null;
    const fechaFacturacion = form.fecha_facturacion
      ? new Date(form.fecha_facturacion)
      : null;

    if (fechaEnvio && fechaEnvio < fechaOrden) {
      toast.error("La Fecha de Entrega no puede ser anterior a la Fecha de Emisión OC.");
      return;
    }

    if (fechaFacturacion && fechaFacturacion < fechaOrden) {
      toast.error("La Fecha de Facturación no puede ser anterior a la Fecha de Emisión OC.");
      return;
    }

    try {
      // Validar que la dirección seleccionada pertenece al cliente seleccionado
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
        fecha_envio: form.fecha_envio || null,
        fecha_facturacion: form.fecha_facturacion || null
      };
      await api(`/ordenes-venta/${id}`, { method: "PUT", body: JSON.stringify(payload) });

      // Obtener productos existentes en BD para comparar
      const productosExistentesRes = await api(`/ordenes-venta/${id}/productos`);
      const productosExistentes = productosExistentesRes.data || productosExistentesRes || [];

      // Procesar productos: crear nuevos, actualizar existentes, eliminar los que ya no están
      for (const producto of productosAgregados) {
        const existe = productosExistentes.find(p => p.id_producto === producto.id_producto);
        if (existe) {
          // Actualizar producto existente
          await api(`/ordenes-venta/${id}/productos/${existe.id}`, {
            method: "PUT",
            body: JSON.stringify({
              cantidad: producto.cantidad,
              precio_venta: producto.precio_unitario,
              porcentaje_descuento: 0,
            }),
          });
        } else {
          // Crear nuevo producto
          await api(`/ordenes-venta/${id}/productos`, {
            method: "POST",
            body: JSON.stringify({
              id_orden: Number(id),
              id_producto: producto.id_producto,
              cantidad: producto.cantidad,
              precio_venta: producto.precio_unitario,
              porcentaje_descuento: 0,
            }),
          });
        }
      }

      // Eliminar productos que ya no están en la lista
      for (const productoExistente of productosExistentes) {
        const sigueExistiendo = productosAgregados.some(p => p.id_producto === productoExistente.id_producto);
        if (!sigueExistiendo) {
          await api(`/ordenes-venta/${id}/productos/${productoExistente.id}`, { method: "DELETE" });
        }
      }

      toast.success("Orden actualizada correctamente.");
      navigate("/ventas/ordenes");
    } catch (err) {
      toast.error(err.message || "Error al actualizar la orden");
    }
  };

  if (loading) return <div className="p-6">Cargando orden…</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <BackButton to="/ventas/ordenes" />
        <h1 className="text-2xl font-bold">Editar Orden de Venta</h1>
        <div style={{ width: 100 }} />
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col">
          Cliente *
          <select
            name="id_cliente"
            value={form.id_cliente}
            onChange={handleClientChange}
            className="border px-2 py-1"
            required
          >
            <option value="">-- Seleccione cliente --</option>
            {clients.map(c => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          Dirección *
          <select
            name="id_local"
            value={form.id_local}
            onChange={handleFieldChange}
            className="border px-2 py-1"
            required
            disabled={!direcciones.length}
          >
            <option value="">-- Seleccione dirección --</option>
            {direcciones.map(d => {
              const label = [
                d.tipo_direccion,
                d.nombre_sucursal,
                [d.calle, d.numero].filter(Boolean).join(" "),
                d.comuna
              ]
                .filter(Boolean)
                .join(" - ");
              return (
                <option key={d.id} value={String(d.id)}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col">
          Número OC *
          <input
            type="text"
            name="numero_oc"
            value={form.numero_oc}
            onChange={handleFieldChange}
            className="border px-2 py-1"
            required
          />
        </label>

        <label className="flex flex-col">
          Costo de Envío *
          <input
            type="number"
            name="costo_envio"
            value={form.costo_envio}
            onChange={handleFieldChange}
            className="border px-2 py-1"
            required
          />
        </label>

        <label className="flex flex-col">
          Fecha Emisión OC *
          <input
            type="date"
            name="fecha_orden"
            value={form.fecha_orden}
            onChange={handleFieldChange}
            className="border px-2 py-1"
            required
          />
        </label>

        <label className="flex flex-col">
          Fecha de Entrega
          <input
            type="date"
            name="fecha_envio"
            value={form.fecha_envio}
            onChange={handleFieldChange}
            className="border px-2 py-1"
          />
        </label>

        <label className="flex flex-col">
          Fecha Facturación
          <input
            type="date"
            name="fecha_facturacion"
            value={form.fecha_facturacion}
            onChange={handleFieldChange}
            className="border px-2 py-1"
          />
        </label>

        <label className="flex flex-col">
          Estado *
          <input
            type="text"
            name="estado"
            value={form.estado}
            onChange={handleFieldChange}
            className="border px-2 py-1"
            required
          />
        </label>

        <label className="flex flex-col col-span-2">
          Condiciones
          <select
            name="condiciones"
            value={form.condiciones}
            onChange={handleFieldChange}
            className="border px-2 py-1"
          >
            <option value="Credito 30 dias">Crédito a 30 días</option>
            <option value="Credito 15 dias">Crédito a 15 días</option>
            <option value="Credito 45 dias">Crédito a 45 días</option>
            <option value="Credito 60 dias">Crédito a 60 días</option>
            <option value="Contado">Contado</option>
          </select>
        </label>
      </form>

      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Productos</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="flex flex-col">
            Producto *
            <select
              name="id_producto"
              value={productoForm.id_producto}
              onChange={handleProductoChange}
              className={`border px-2 py-1 rounded ${
                productErrors.id_producto ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Seleccione producto...</option>
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
              className={`border px-2 py-1 rounded ${
                productErrors.cantidad ? "border-red-500" : "border-gray-300"
              }`}
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
          className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
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
                <th className="px-4 py-2 text-left">Unidades Reservadas</th>
                <th className="px-4 py-2 text-left">Precio { (clienteConfig?.formato || 'UNIDADES').toUpperCase().includes('CAJA') ? 'por Caja' : 'Unitario' }</th>
                <th className="px-4 py-2 text-left">Total Línea</th>
                <th className="px-4 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosAgregados.map((p) => (
                <tr key={p.id_producto} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{p.nombre}</td>
                  <td className="px-4 py-2">{p.cantidad_formato}</td>
                  <td className="px-4 py-2">{p.formato_linea}</td>
                  <td className="px-4 py-2">{p.unidades_reservadas}</td>
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

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}

