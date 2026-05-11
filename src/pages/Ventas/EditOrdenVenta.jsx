import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ArrowLeft, Trash2, Pencil, Check, X } from "lucide-react";
import Selector from "../../components/Selector";

export default function EditOrdenVenta() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [preciosLista, setPreciosLista] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [productErrors, setProductErrors] = useState({});
  const [editingProdId, setEditingProdId] = useState(null);
  const [editingCantidad, setEditingCantidad] = useState("");

  const [form, setForm] = useState({
    numero_oc: "",
    fecha_orden: "",
    bodega_id: "",
  });

  const [productoForm, setProductoForm] = useState({
    id_producto: "",
    cantidad: "",
    precio_unitario: "",
  });

  // ── Carga inicial ──
  useEffect(() => {
    (async () => {
      try {
        const [ordRes, prodRes, bodRes] = await Promise.all([
          api(`/ordenes-venta/${id}/info`),
          api("/productos-base"),
          api("/bodegas"),
        ]);

        const ord = ordRes?.data || ordRes;
        setOrden(ord);
        setForm({
          numero_oc: ord.numero_oc || "",
          fecha_orden: ord.fecha_orden?.slice(0, 10) || "",
          bodega_id: ord.bodega_id ? String(ord.bodega_id) : "",
        });

        const productosData = prodRes?.data || prodRes || [];
        setProductos(productosData);

        const bodegasData = Array.isArray(bodRes?.bodegas)
          ? bodRes.bodegas
          : Array.isArray(bodRes?.data)
          ? bodRes.data
          : Array.isArray(bodRes)
          ? bodRes
          : [];
        setBodegas(bodegasData);

        // Cargar lista de precios del cliente
        const clienteId = ord.cliente?.id || ord.id_cliente;
        if (clienteId) {
          try {
            const cliRes = await api(`/clientes/${clienteId}`);
            const cliData = cliRes?.data || cliRes;
            setClienteConfig({
              formato: cliData?.formato_compra_predeterminado || "UNIDADES",
              id_lista_precio: cliData?.id_lista_precio || null,
            });
            if (cliData?.id_lista_precio) {
              const listaRes = await api(`/lista-precio/${cliData.id_lista_precio}`);
              const listaData = listaRes?.data || listaRes;
              setPreciosLista(
                Array.isArray(listaData?.productosBaseListaPrecio)
                  ? listaData.productosBaseListaPrecio
                  : []
              );
            }
          } catch {
            // Sin lista de precios — no es crítico
          }
        }

        // Cargar productos existentes de la orden
        try {
          const prodOrdenRes = await api(`/ordenes-venta/${id}/productos`);
          const prodOrden = prodOrdenRes?.data || prodOrdenRes || [];
          setProductosAgregados(
            prodOrden.map((item) => {
              const prod = productosData.find((p) => p.id === item.id_producto);
              return {
                id_producto: item.id_producto,
                nombre: prod?.nombre || `Producto #${item.id_producto}`,
                cantidad: item.cantidad,
                precio_unitario: item.precio_venta,
                formato_linea: "UNIDADES",
                total_linea: item.cantidad * item.precio_venta,
                dbId: item.id,
              };
            })
          );
        } catch {
          toast.error("Error al cargar productos de la orden");
        }
      } catch (err) {
        toast.error(err.message || "Error al cargar la orden");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, api]);

  // ── Producto form helpers ──
  const calcularPrecio = (prodId) => {
    if (!prodId || !clienteConfig) return "";
    const precioLista = preciosLista.find((x) => x.id_producto_base === prodId);
    const productoBase = productos.find((p) => p.id === prodId);
    const unidadesPorCaja = Number(precioLista?.unidades_por_caja || productoBase?.unidades_por_caja || 0) || 0;
    const precioCaja = precioLista?.precio_caja;
    const precioUnidad = precioLista?.precio_unidad;
    const esCajas = (clienteConfig?.formato || "UNIDADES").toUpperCase().includes("CAJA");
    if (esCajas) {
      if (precioCaja) return Number(precioCaja);
      if (precioUnidad && unidadesPorCaja) return Number(precioUnidad) * Number(unidadesPorCaja);
    } else {
      if (precioUnidad) return Number(precioUnidad);
      if (precioCaja && unidadesPorCaja) return Number(precioCaja) / Number(unidadesPorCaja);
    }
    return "";
  };

  const handleProductoChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...productoForm, [name]: value };
    if (name === "id_producto") {
      setProductErrors({});
      updated.precio_unitario = calcularPrecio(Number(value));
    }
    setProductoForm(updated);
  };

  const validateProducto = () => {
    const errs = {};
    if (!productoForm.id_producto) errs.id_producto = "Debes seleccionar un producto.";
    if (!productoForm.cantidad || Number(productoForm.cantidad) <= 0) errs.cantidad = "Cantidad debe ser mayor a 0.";
    if (!productoForm.precio_unitario || Number(productoForm.precio_unitario) <= 0) errs.precio_unitario = "Precio debe ser mayor a 0.";
    setProductErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddProduct = () => {
    if (!validateProducto()) return;
    const productoId = Number(productoForm.id_producto);
    if (productosAgregados.some((p) => p.id_producto === productoId)) {
      setProductErrors({ id_producto: "Este producto ya está agregado." });
      return;
    }
    const prod = productos.find((p) => p.id === productoId);
    const precioLista = preciosLista.find((x) => x.id_producto_base === prod.id);
    const unidadesPorCaja = Number(precioLista?.unidades_por_caja || prod.unidades_por_caja || 0) || 0;
    const esCajas = (clienteConfig?.formato || "UNIDADES").toUpperCase().includes("CAJA");
    const cantidadFormato = Number(productoForm.cantidad);
    const cantidadUnidades = esCajas && unidadesPorCaja ? cantidadFormato * unidadesPorCaja : cantidadFormato;
    setProductosAgregados((prev) => [
      {
        id_producto: prod.id,
        nombre: prod.nombre,
        cantidad: cantidadUnidades,
        precio_unitario: Number(productoForm.precio_unitario),
        formato_linea: esCajas ? "CAJAS" : "UNIDADES",
        total_linea: Number(productoForm.precio_unitario) * cantidadFormato,
        dbId: null,
      },
      ...prev,
    ]);
    setProductoForm({ id_producto: "", cantidad: "", precio_unitario: "" });
    setProductErrors({});
  };

  const handleDeleteProduct = (prodId) => {
    setProductosAgregados((prev) => prev.filter((p) => p.id_producto !== prodId));
  };

  const handleStartEdit = (prod) => {
    setEditingProdId(prod.id_producto);
    setEditingCantidad(String(prod.cantidad));
  };

  const handleConfirmEdit = () => {
    const nuevaCantidad = Number(editingCantidad);
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad <= 0) {
      toast.error("Ingresa una cantidad válida mayor a 0");
      return;
    }
    setProductosAgregados((prev) =>
      prev.map((p) =>
        p.id_producto === editingProdId
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

  // ── Submit ──
  const handleSubmit = async () => {
    if (!form.fecha_orden) { toast.error("La fecha de emisión es obligatoria."); return; }
    if (!form.bodega_id) { toast.error("Debes seleccionar una bodega."); return; }
    if (productosAgregados.length === 0) { toast.error("Debes agregar al menos un producto."); return; }

    try {
      await api(`/ordenes-venta/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          numero_oc: form.numero_oc,
          fecha_orden: form.fecha_orden,
          bodega_id: Number(form.bodega_id),
        }),
      });

      // Sincronizar productos
      const prodExisRes = await api(`/ordenes-venta/${id}/productos`);
      const prodExistentes = prodExisRes?.data || prodExisRes || [];

      for (const prod of productosAgregados) {
        const existente = prodExistentes.find((p) => p.id_producto === prod.id_producto);
        if (existente) {
          await api(`/ordenes-venta/${id}/productos/${existente.id}`, {
            method: "PUT",
            body: JSON.stringify({ cantidad: prod.cantidad, precio_venta: prod.precio_unitario, porcentaje_descuento: 0 }),
          });
        } else {
          await api(`/ordenes-venta/${id}/productos`, {
            method: "POST",
            body: JSON.stringify({ id_orden: Number(id), id_producto: prod.id_producto, cantidad: prod.cantidad, precio_venta: prod.precio_unitario, porcentaje_descuento: 0 }),
          });
        }
      }

      for (const existente of prodExistentes) {
        if (!productosAgregados.some((p) => p.id_producto === existente.id_producto)) {
          await api(`/ordenes-venta/${id}/productos/${existente.id}`, { method: "DELETE" });
        }
      }

      toast.success("Orden actualizada correctamente.");
      navigate("/ventas/ordenes");
    } catch (err) {
      toast.error(err.message || "Error al actualizar la orden");
    }
  };

  const esCajas = (clienteConfig?.formato || "UNIDADES").toUpperCase().includes("CAJA");
  const cliente = orden?.cliente || {};
  const condicionPago = orden?.condiciones;

  if (loading) return <div className="p-6 bg-background min-h-screen flex items-center justify-center text-gray-500">Cargando orden…</div>;
  if (!orden) return <div className="p-6 bg-background min-h-screen flex items-center justify-center text-gray-500">No se encontró la orden.</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <button
        onClick={() => navigate("/ventas/ordenes")}
        className="flex items-center text-primary mb-4 hover:underline"
      >
        <ArrowLeft size={18} className="mr-1" /> Volver
      </button>

      <h1 className="text-2xl font-bold mb-6">Editar Orden de Venta #{id}</h1>

      {/* ── Card: Datos del pedido ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Datos del pedido</h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">

            {/* Cliente (solo lectura) */}
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-sm font-medium text-gray-700">Cliente</span>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-md text-sm text-gray-800 font-medium">
                {cliente.nombre_empresa || "—"}
                {cliente.rut && <span className="ml-2 text-xs text-gray-400 font-normal">RUT {cliente.rut}</span>}
              </div>
              <span className="text-xs text-gray-400 italic">El cliente no se puede cambiar en edición</span>
            </div>

            {/* Número OC */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Número OC</span>
              <input
                type="text"
                value={form.numero_oc}
                onChange={(e) => setForm((f) => ({ ...f, numero_oc: e.target.value }))}
                placeholder="Ej. 7000537546"
                className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>

            {/* Fecha Emisión OC */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Fecha Emisión OC *</span>
              <input
                type="date"
                value={form.fecha_orden}
                onChange={(e) => setForm((f) => ({ ...f, fecha_orden: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
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
                onSelect={(value) => setForm((f) => ({ ...f, bodega_id: value }))}
                useFuzzy
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </label>

            {/* Condición de pago (solo lectura) */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Condición de pago</span>
              <div className="border border-gray-200 bg-gray-50 px-3 py-2 rounded-md text-sm text-gray-700 min-h-[40px] flex items-center">
                {condicionPago || <span className="text-gray-400">—</span>}
              </div>
              <span className="text-xs text-gray-400 italic">Obtenida del cliente al crear la orden</span>
            </div>

          </div>

          {/* Orden referencial (solo lectura) */}
          {orden?.es_referencial && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="mt-0.5 w-4 h-4 rounded bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <div>
                <span className="text-sm font-medium text-amber-800">Orden referencial (sin picking)</span>
                <p className="text-xs text-amber-600 mt-0.5">
                  Esta orden irá directo a Facturada sin pasar por picking.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Card: Productos ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Productos</h2>

          {/* Formulario agregar producto */}
          <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Producto *</span>
              <select
                name="id_producto"
                value={productoForm.id_producto}
                onChange={handleProductoChange}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  productErrors.id_producto ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Seleccionar producto…</option>
                {productos
                  .filter((p) => !productosAgregados.some((pa) => pa.id_producto === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
              </select>
              {productErrors.id_producto && <span className="text-red-500 text-xs">{productErrors.id_producto}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Cantidad {esCajas ? "(Cajas)" : "(Unidades)"} *
              </span>
              <input
                type="number"
                name="cantidad"
                placeholder="Ej. 10"
                value={productoForm.cantidad}
                onChange={handleProductoChange}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  productErrors.cantidad ? "border-red-500" : "border-gray-300"
                }`}
              />
              {productErrors.cantidad && <span className="text-red-500 text-xs">{productErrors.cantidad}</span>}
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
              {productErrors.precio_unitario && <span className="text-red-500 text-xs">{productErrors.precio_unitario}</span>}
            </label>
          </div>

          <button
            type="button"
            onClick={handleAddProduct}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-hover transition-colors"
          >
            Agregar producto
          </button>

          {/* Tabla productos */}
          {productosAgregados.length > 0 && (
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Producto</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Cantidad (u)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Formato</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Precio {esCajas ? "/ Caja" : "Unitario"}
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productosAgregados.map((p) => {
                    const isEditing = editingProdId === p.id_producto;
                    return (
                    <tr key={p.id_producto} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                      <td className="px-4 py-2.5 text-sm text-gray-800">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editingCantidad}
                            onChange={(e) => setEditingCantidad(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmEdit(); if (e.key === "Escape") handleCancelEdit(); }}
                            autoFocus
                            className="w-24 border border-blue-400 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : p.cantidad}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{p.formato_linea}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        ${Number(p.precio_unitario).toLocaleString("es-CL")}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                        ${Number(isEditing
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
                              onClick={() => handleDeleteProduct(p.id_producto)}
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
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
