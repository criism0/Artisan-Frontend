import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ArrowLeft, Trash2, Pencil, Check, X } from "lucide-react";
import Selector from "../../components/Forms/Selector";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import {
  netoLinea,
  problemaDeDescuento,
  descuentoAGuardar,
  formatearDescuento,
} from "../../utils/descuentoLinea.js";

export default function EditOrdenVenta() {
  const canWriteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE);
  const canWriteSaleOrderProduct = checkScope(ModelType.PRODUCTO_ORDEN, ScopeType.WRITE);
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  // La OV se pide por nombre de facturación (agrupa productos físicos equivalentes)
  const [nombres, setNombres] = useState([]);
  const [preciosLista, setPreciosLista] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [productErrors, setProductErrors] = useState({});
  const [editingProdId, setEditingProdId] = useState(null);
  const [editingCantidad, setEditingCantidad] = useState("");
  const [editingDescuento, setEditingDescuento] = useState("");

  const [form, setForm] = useState({
    numero_oc: "",
    fecha_orden: "",
    bodega_id: "",
    es_referencial: false,
    fecha_vencimiento_pago: "",
    comentario_cliente: "",
  });

  const [productoForm, setProductoForm] = useState({
    id_nombre_facturacion: "",
    cantidad: "",
    precio_unitario: "",
    porcentaje_descuento: "",
  });

  // ── Carga inicial ──
  useEffect(() => {
    (async () => {
      try {
        const [ordRes, nombresRes, bodRes] = await Promise.all([
          api(`/ordenes-venta/${id}/info`),
          api("/nombres-facturacion"),
          api("/bodegas"),
        ]);

        const ord = ordRes?.data || ordRes;
        setOrden(ord);
        setForm({
          numero_oc: ord.numero_oc || "",
          fecha_orden: ord.fecha_orden?.slice(0, 10) || "",
          bodega_id: ord.bodega_id ? String(ord.bodega_id) : "",
          es_referencial: ord.es_referencial ?? false,
          fecha_vencimiento_pago: ord.fecha_vencimiento_pago ? String(ord.fecha_vencimiento_pago).slice(0, 10) : "",
          comentario_cliente: ord.comentario_cliente || "",
        });

        const nombresData = Array.isArray(nombresRes) ? nombresRes : nombresRes?.data || [];
        setNombres(nombresData);

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

        // Cargar productos existentes de la orden (líneas por nombre de facturación;
        // legacy sin nombre se muestran por su descripción/producto)
        try {
          const prodOrdenRes = await api(`/ordenes-venta/${id}/productos`);
          const prodOrden = prodOrdenRes?.data || prodOrdenRes || [];
          setProductosAgregados(
            prodOrden.map((item) => {
              const nombreFact = nombresData.find((n) => n.id === item.id_nombre_facturacion);
              const nombreProducto = nombresData
                .flatMap((n) => n.productos || [])
                .find((p) => p.id === item.id_producto)?.nombre;
              // 🔴 SE CARGA TODO LO QUE EL SUBMIT VUELVE A ESCRIBIR.
              //
              // El descuento y el desglose de cajas NO se leían, y el submit los mandaba igual
              // con su valor por defecto: `porcentaje_descuento: 0` y `producto_por_cajas`
              // derivado de un `formato_linea` hardcodeado en "UNIDADES". O sea que abrir una
              // orden en «Editar» y guardarla BORRABA los tres campos, sin avisar.
              //
              // Medido en producción el 2026-08-16: la OV 746 (Cencosud, Validada) tiene tres
              // líneas al 13%, 13% y 15%. Guardarla la habría inflado de $7.351.714 a
              // $7.767.628 — **$415.914 de sobrecobro** en una factura a punto de emitirse.
              //
              // La regla que lo cierra: un formulario que reescribe un campo tiene que haberlo
              // leído. Si no lo muestra, igual tiene que conservarlo.
              const enCajas = Boolean(item.producto_por_cajas && item.cantidad_por_caja);
              return {
                id_nombre_facturacion: item.id_nombre_facturacion ?? null,
                nombre:
                  nombreFact?.nombre ||
                  nombreProducto ||
                  item.descripcion_original ||
                  `Línea #${item.id}`,
                cantidad: item.cantidad,
                precio_unitario: item.precio_venta,
                porcentaje_descuento: Number(item.porcentaje_descuento) || 0,
                unidades_por_caja: enCajas ? Number(item.cantidad_por_caja) : null,
                formato_linea: enCajas ? "CAJAS" : "UNIDADES",
                total_linea: netoLinea(item.cantidad, item.precio_venta, item.porcentaje_descuento),
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
  // Busca la entrada de la lista de precios para un nombre de facturación
  // (entradas nuevas van por id_nombre_facturacion; las legacy por producto del grupo)
  const buscarPrecioLista = (nombreId) => {
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const idsProductos = (nombreFact?.productos || []).map((p) => p.id);
    return preciosLista.find(
      (x) =>
        Number(x.id_nombre_facturacion) === nombreId ||
        (x.id_producto_base != null && idsProductos.includes(x.id_producto_base))
    );
  };

  const calcularPrecio = (nombreId) => {
    if (!nombreId || !clienteConfig) return "";
    const precioLista = buscarPrecioLista(nombreId);
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const unidadesPorCaja = Number(precioLista?.unidades_por_caja || nombreFact?.unidades_por_caja || nombreFact?.productos?.[0]?.unidades_por_caja || 0) || 0;
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
    if (name === "id_nombre_facturacion") {
      setProductErrors({});
      updated.precio_unitario = calcularPrecio(Number(value));
    }
    setProductoForm(updated);
  };

  const validateProducto = () => {
    const errs = {};
    if (!productoForm.id_nombre_facturacion) errs.id_nombre_facturacion = "Debes seleccionar un producto.";
    if (!productoForm.cantidad || Number(productoForm.cantidad) <= 0) errs.cantidad = "Cantidad debe ser mayor a 0.";
    if (!productoForm.precio_unitario || Number(productoForm.precio_unitario) <= 0) errs.precio_unitario = "Precio debe ser mayor a 0.";
    const problemaDesc = problemaDeDescuento(productoForm.porcentaje_descuento);
    if (problemaDesc) errs.porcentaje_descuento = problemaDesc;
    setProductErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddProduct = () => {
    if (!validateProducto()) return;
    const nombreId = Number(productoForm.id_nombre_facturacion);
    if (productosAgregados.some((p) => p.id_nombre_facturacion === nombreId)) {
      setProductErrors({ id_nombre_facturacion: "Este producto ya está agregado." });
      return;
    }
    const nombreFact = nombres.find((n) => n.id === nombreId);
    const precioLista = buscarPrecioLista(nombreId);
    const unidadesPorCaja = Number(precioLista?.unidades_por_caja || nombreFact?.unidades_por_caja || nombreFact?.productos?.[0]?.unidades_por_caja || 0) || 0;
    const esCajas = (clienteConfig?.formato || "UNIDADES").toUpperCase().includes("CAJA");
    const cantidadFormato = Number(productoForm.cantidad);
    const convertible = Boolean(esCajas && unidadesPorCaja);

    // 🔴 LAS DOS MITADES SE CONVIERTEN JUNTAS, O NINGUNA.
    //
    // Acá se convertía la cantidad a unidades y se guardaba `precio_unitario` tal cual —que para
    // un cliente en cajas ES EL PRECIO DE LA CAJA, porque así lo devuelve `calcularPrecio`—. La
    // línea quedaba con 128 unidades a $11.984 en vez de a $749: dieciséis veces el pedido.
    //
    // Y era invisible porque `total_linea` se calculaba con la cantidad SIN convertir, así que
    // la tabla mostraba el total correcto mientras lo que se iba a guardar estaba mal.
    const cantidadUnidades = convertible ? cantidadFormato * unidadesPorCaja : cantidadFormato;
    const precioPorUnidad = convertible
      ? Number(productoForm.precio_unitario) / unidadesPorCaja
      : Number(productoForm.precio_unitario);

    const descuento = descuentoAGuardar(productoForm.porcentaje_descuento);

    setProductosAgregados((prev) => [
      {
        id_nombre_facturacion: nombreId,
        nombre: nombreFact?.nombre || `Nombre #${nombreId}`,
        cantidad: cantidadUnidades,
        precio_unitario: precioPorUnidad,
        // ⚠️ El descuento NO entra en la conversión: un porcentaje no cambia al reexpresar
        // cajas en unidades. Se convierten en pareja la cantidad y el precio, nada más.
        porcentaje_descuento: descuento,
        unidades_por_caja: convertible ? unidadesPorCaja : null,
        formato_linea: convertible ? "CAJAS" : "UNIDADES",
        // El total sale de lo que se va a GUARDAR, no de lo que se tecleó. Si difieren, es que
        // la conversión está mal — y así se nota en pantalla en vez de en la base.
        total_linea: netoLinea(cantidadUnidades, precioPorUnidad, descuento),
        dbId: null,
      },
      ...prev,
    ]);
    setProductoForm({ id_nombre_facturacion: "", cantidad: "", precio_unitario: "" });
    setProductErrors({});
  };

  const rowKey = (p) => p.dbId ?? `nf-${p.id_nombre_facturacion}`;

  const handleDeleteProduct = (key) => {
    setProductosAgregados((prev) => prev.filter((p) => rowKey(p) !== key));
  };

  const handleStartEdit = (prod) => {
    setEditingProdId(rowKey(prod));
    setEditingCantidad(String(prod.cantidad));
    setEditingDescuento(prod.porcentaje_descuento ? String(prod.porcentaje_descuento) : "");
  };

  const handleConfirmEdit = () => {
    const nuevaCantidad = Number(editingCantidad);
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad <= 0) {
      toast.error("Ingresa una cantidad válida mayor a 0");
      return;
    }
    const problemaDesc = problemaDeDescuento(editingDescuento);
    if (problemaDesc) {
      toast.error(problemaDesc);
      return;
    }
    const nuevoDescuento = descuentoAGuardar(editingDescuento);
    setProductosAgregados((prev) =>
      prev.map((p) =>
        rowKey(p) === editingProdId
          ? {
              ...p,
              cantidad: nuevaCantidad,
              porcentaje_descuento: nuevoDescuento,
              total_linea: netoLinea(nuevaCantidad, p.precio_unitario, nuevoDescuento),
            }
          : p
      )
    );
    setEditingProdId(null);
    setEditingCantidad("");
    setEditingDescuento("");
  };

  const handleCancelEdit = () => {
    setEditingProdId(null);
    setEditingCantidad("");
    setEditingDescuento("");
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!canWriteSaleOrder || !canWriteSaleOrderProduct) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.WRITE], [ModelType.PRODUCTO_ORDEN, ScopeType.WRITE]);
      return;
    }
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
          es_referencial: form.es_referencial,
          // La fecha de pago es un término de la VENTA, no de la facturación: se edita acá y
          // quien factura sólo la confirma. Vacía significa «al contado, sin vencimiento».
          fecha_vencimiento_pago: form.fecha_vencimiento_pago || null,
          comentario_cliente: form.comentario_cliente || null,
        }),
      });

      // Sincronizar productos (las líneas existentes se matchean por su id de BD)
      const prodExisRes = await api(`/ordenes-venta/${id}/productos`);
      const prodExistentes = prodExisRes?.data || prodExisRes || [];

      for (const prod of productosAgregados) {
        // Desglose comercial en cajas (la cantidad SIEMPRE viaja en unidades)
        const lineaEnCajas = Boolean(prod.formato_linea === "CAJAS" && prod.unidades_por_caja);
        const camposCajas = {
          producto_por_cajas: lineaEnCajas,
          cantidad_por_caja: lineaEnCajas ? prod.unidades_por_caja : 0,
        };
        // El descuento viaja tal cual: es un porcentaje y no se convierte junto con las cajas.
        const descuento = descuentoAGuardar(prod.porcentaje_descuento);
        if (prod.dbId != null) {
          await api(`/ordenes-venta/${id}/productos/${prod.dbId}`, {
            method: "PUT",
            body: JSON.stringify({ cantidad: prod.cantidad, precio_venta: prod.precio_unitario, porcentaje_descuento: descuento, ...camposCajas }),
          });
        } else {
          await api(`/ordenes-venta/${id}/productos`, {
            method: "POST",
            body: JSON.stringify({ id_orden: Number(id), id_nombre_facturacion: prod.id_nombre_facturacion, cantidad: prod.cantidad, precio_venta: prod.precio_unitario, porcentaje_descuento: descuento, ...camposCajas }),
          });
        }
      }

      for (const existente of prodExistentes) {
        if (!productosAgregados.some((p) => p.dbId === existente.id)) {
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

  if (loading) return <PageLoader message="Cargando orden" />;
  if (!orden) return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">No se encontró la orden.</div>;

  return (
    <div>
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

            {/* 🔴 Fecha de pago: es un término de la VENTA, no de la facturación. Sale impresa
                en la factura como vencimiento y como pago programado, y quien factura sólo la
                confirma. Los pedidos EDI del retail la traen declarada. */}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Fecha de pago</span>
              <input
                type="date"
                value={form.fecha_vencimiento_pago}
                onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento_pago: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-xs text-gray-400 italic">
                {form.fecha_vencimiento_pago
                  ? "Sale en la factura como vencimiento y como pago programado."
                  : "Sin fecha, la factura sale al contado y sin vencimiento."}
                {condicionPago ? ` Condición: ${condicionPago}.` : ""}
              </span>
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

            {/* Comentario del cliente — reporte de Hernán, 2026-08-17: un pedido web declaraba a
                qué LOCAL iba y no había dónde guardarlo. */}
            <label className="flex flex-col gap-1 col-span-2">
              <span className="text-sm font-medium text-gray-700">Comentario del cliente</span>
              <textarea
                rows={2}
                placeholder="Instrucciones de despacho, horario, con quién coordinar…"
                value={form.comentario_cliente}
                onChange={(e) => setForm((f) => ({ ...f, comentario_cliente: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-y"
              />
            </label>

          </div>

          {/* Orden referencial — toggle editable */}
          <label className="flex items-center gap-3 cursor-pointer select-none col-span-2 w-fit">
            <div className="relative shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={form.es_referencial}
                onChange={(e) => setForm((f) => ({ ...f, es_referencial: e.target.checked }))}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.es_referencial ? "bg-primary" : "bg-gray-200"}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.es_referencial ? "translate-x-4" : ""}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">Orden referencial</span>
              <span className="text-xs text-gray-400">
                El picking no se realiza con QR, se declara la cantidad directamente
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* ── Card: Productos ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Productos</h2>

          {/* Formulario agregar producto */}
          <div className="grid grid-cols-4 gap-x-6 gap-y-4 mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Producto *</span>
              <select
                name="id_nombre_facturacion"
                value={productoForm.id_nombre_facturacion}
                onChange={handleProductoChange}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  productErrors.id_nombre_facturacion ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Seleccionar producto…</option>
                {nombres
                  .filter((n) => !productosAgregados.some((pa) => pa.id_nombre_facturacion === n.id))
                  .map((n) => (
                    <option key={n.id} value={n.id}>{n.nombre}</option>
                  ))}
              </select>
              {productErrors.id_nombre_facturacion && <span className="text-red-500 text-xs">{productErrors.id_nombre_facturacion}</span>}
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

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Descuento (%)</span>
              <input
                type="number"
                name="porcentaje_descuento"
                min="0"
                max="100"
                step="any"
                placeholder="Sin descuento"
                value={productoForm.porcentaje_descuento}
                onChange={handleProductoChange}
                className={`border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  productErrors.porcentaje_descuento ? "border-red-500" : "border-gray-300"
                }`}
              />
              {productErrors.porcentaje_descuento && <span className="text-red-500 text-xs">{productErrors.porcentaje_descuento}</span>}
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
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">% Desc.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productosAgregados.map((p) => {
                    const isEditing = editingProdId === rowKey(p);
                    return (
                    <tr key={rowKey(p)} className={`transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}>
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
                      <td className="px-4 py-2.5 text-sm text-gray-700">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            placeholder="0"
                            value={editingDescuento}
                            onChange={(e) => setEditingDescuento(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmEdit(); if (e.key === "Escape") handleCancelEdit(); }}
                            className="w-20 border border-blue-400 px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          formatearDescuento(p.porcentaje_descuento)
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-800">
                        ${Math.round(
                          isEditing
                            ? netoLinea(editingCantidad, p.precio_unitario, descuentoAGuardar(editingDescuento))
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
                              onClick={() => handleDeleteProduct(rowKey(p))}
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
