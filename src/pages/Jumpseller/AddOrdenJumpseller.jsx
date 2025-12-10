import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJumpsellerOrdenPorId } from '../../services/jumpseller';
import { useApi } from '../../lib/api';
import { toast } from '../../lib/toast';

function formatRut(raw) {
  if (!raw) return "";
  const clean = raw.replace(/\D/g, "");
  if (clean.length < 2) return raw;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const rev = cuerpo.split("").reverse();
  const partes = [];
  for (let i = 0; i < rev.length; i += 3) {
    partes.push(rev.slice(i, i + 3).join(""));
  }

  const cuerpoConPuntos = partes
    .map((p) => p.split("").reverse().join(""))
    .reverse()
    .join(".");

  return `${cuerpoConPuntos}-${dv}`;
}

function mapJumpsellerOrderToClienteBase(order) {
  const billingInfo = order.billing_information || {};
  const billingAddr = order.billing_address || {};
  const customer = order.customer || {};

  const email = customer.email || "";

  return {
    nombre_empresa: `${billingAddr.name || ""} ${billingAddr.surname || ""}`.trim(),
    razon_social: billingInfo.company_name || "",
    rut: formatRut(billingAddr.taxid || ""),
    giro: billingInfo.business_activity || "",
    email_transferencia: email,
    email_comercial: email,
    email_finanzas: email,
    contacto_comercial: customer.fullname || "",
    telefono_comercial: (customer.phone_prefix || "") + (customer.phone || ""),
    contacto_finanzas: customer.fullname || "",
    telefono_finanzas: (customer.phone_prefix || "") + (customer.phone || ""),
  };
}

function extractNumeroFromAddress(address) {
  if (!address) return "";
  const matches = address.match(/\d+/g);
  if (!matches || matches.length === 0) return "";
  return matches[matches.length - 1];
}

function stripNumbersFromAddress(address) {
  if (!address) return "";
  const sinNumeros = address.replace(/\d+/g, " ");
  return sinNumeros.replace(/\s{2,}/g, " ").trim();
}

function normalizeAddressString(s) {
  return (s || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mismaDireccion(nueva, existente) {
  if (String(nueva.cliente_id) !== String(existente.cliente_id)) return false;

  if (
    (nueva.tipo_direccion || "").toLowerCase() !==
    (existente.tipo_direccion || "").toLowerCase()
  ) {
    return false;
  }

  const fullNueva = normalizeAddressString(`${nueva.calle} ${nueva.numero || ""}`);
  const fullExistente = normalizeAddressString(
    `${existente.calle || ""} ${existente.numero || ""}`
  );

  return fullNueva === fullExistente;
}

function getDateOnlyFromUtcString(utcString) {
  if (!utcString) return "";
  return utcString.slice(0, 10);
}

function addDaysToDateString(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function OrdenVentaJumpseller() {
  const api = useApi();
  const navigate = useNavigate();

  const [orderId, setOrderId] = useState('');
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [canales, setCanales] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [selectedCanalId, setSelectedCanalId] = useState('');
  const [selectedListaPrecioId, setSelectedListaPrecioId] = useState('');
  const [selectedTipoPrecio, setSelectedTipoPrecio] = useState('UNIDADES');
  const tiposPrecio = ['UNIDADES', 'CAJAS'];

  const [bodegas, setBodegas] = useState([]);
  const [selectedBodegaId, setSelectedBodegaId] = useState('1');
  const [costoEnvio, setCostoEnvio] = useState('0');
  const [fechaEnvio, setFechaEnvio] = useState('');

  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [selectedDireccionId, setSelectedDireccionId] = useState('');
  const [jumpsellerOrder, setJumpsellerOrder] = useState(null);
  const [clienteIdActual, setClienteIdActual] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dataCanales = await api('/canales');
        if (Array.isArray(dataCanales)) {
          setCanales(dataCanales);
          const canal1 = dataCanales.find(c => c.id === 1) || dataCanales[0];
          if (canal1) setSelectedCanalId(String(canal1.id));
        }

        const dataListas = await api('/lista-precio');
        if (Array.isArray(dataListas)) {
          setListasPrecio(dataListas);
          const lista1 = dataListas.find(l => l.id === 1) || dataListas[0];
          if (lista1) setSelectedListaPrecioId(String(lista1.id));
        }

        const resBodegas = await api('/bodegas', { method: 'GET' });
        const bodyB =
          (await resBodegas?.json?.()) ??
          resBodegas?.data ??
          resBodegas ??
          {};
        const listaB = Array.isArray(bodyB?.bodegas)
          ? bodyB.bodegas
          : Array.isArray(bodyB?.data)
          ? bodyB.data
          : [];

        setBodegas(listaB);
        const bodega1 = listaB.find(b => b.id === 1) || listaB[0];
        if (bodega1) setSelectedBodegaId(String(bodega1.id));
      } catch (_) {}
    };

    fetchData();
  }, [api]);

  const buildDireccionFromOrder = (order, clienteId) => {
    const addr = order.shipping_address || order.billing_address;
    if (!addr) return null;

    const rawAddress = addr.address || "";
    const numero = extractNumeroFromAddress(rawAddress);
    const calle = stripNumbersFromAddress(rawAddress);

    return {
      cliente_id: clienteId,
      tipo_direccion: "Despacho",
      nombre_sucursal: addr.name || "",
      calle,
      numero,
      comuna: addr.municipality || "",
      region: addr.region || "",
    };
  };

  const ensureDireccionFromOrder = async (order, clienteId) => {
    if (!clienteId) return;

    const direccionBase = buildDireccionFromOrder(order, clienteId);
    if (!direccionBase) return;

    let direcciones = [];
    try {
      direcciones = await api('/direcciones');
    } catch (_) {
      return;
    }

    if (!Array.isArray(direcciones)) direcciones = [];

    const direccionesClienteFiltradas = direcciones.filter(
      (d) => String(d.cliente_id) === String(clienteId)
    );

    const yaExiste = direccionesClienteFiltradas.some((d) => mismaDireccion(direccionBase, d));
    if (yaExiste) return;

    const yaTeniaDirecciones = direccionesClienteFiltradas.length > 0;

    const direccionData = {
      ...direccionBase,
      es_principal: !yaTeniaDirecciones,
      tipo_recinto: "BODEGA"
    };

    try {
      await api("/direcciones", {
        method: "POST",
        body: JSON.stringify(direccionData),
      });
    } catch (_) {}
  };

  const loadDireccionesCliente = async (clienteId) => {
    try {
      let direcciones = await api('/direcciones');
      if (!Array.isArray(direcciones)) direcciones = [];
      const delCliente = direcciones.filter(
        (d) => String(d.cliente_id) === String(clienteId)
      );
      setDireccionesCliente(delCliente);
      if (delCliente.length > 0) {
        setSelectedDireccionId(String(delCliente[0].id));
      } else {
        setSelectedDireccionId('');
      }
    } catch (_) {
      setDireccionesCliente([]);
      setSelectedDireccionId('');
    }
  };

  const createProductosParaOrden = async (order, ordenId) => {
    if (!order || !ordenId) return;

    const items = Array.isArray(order.products) ? order.products : [];

    for (const it of items) {
      const nombreProducto = it.name || it.product_name || "";
      if (!nombreProducto) continue;

      let resultadoBusqueda;
      try {
        resultadoBusqueda = await api(`/productos-base/buscar?nombre=${encodeURIComponent(nombreProducto)}`);
      } catch (_) {
        continue;
      }

      const listaEncontrados = Array.isArray(resultadoBusqueda)
        ? resultadoBusqueda
        : Array.isArray(resultadoBusqueda?.data)
        ? resultadoBusqueda.data
        : [];

      if (!listaEncontrados.length) continue;

      const base = listaEncontrados[0];
      const unidadesPorCaja = base.unidades_por_caja || 1;
      const cantidad = Number(it.quantity || it.qty || 0) || 0;
      if (!cantidad) continue;

      const precioBase = Number(base.precio_unitario || it.price || it.unit_price || 0) || 0;

      const payloadProducto = {
        id_producto: base.id,
        cantidad,
        precio_venta: precioBase,
        porcentaje_descuento: 0,
        cantidad_por_caja: unidadesPorCaja,
        producto_por_cajas:
          selectedTipoPrecio === "CAJAS"
            ? Math.round(cantidad / unidadesPorCaja)
            : 0
      };

      try {
        await api(`/ordenes-venta/${ordenId}/productos`, {
          method: "POST",
          body: JSON.stringify(payloadProducto),
        });
      } catch (_) {}
    }
  };

  const createOrdenVenta = async (order, clienteId, direccionId) => {
    if (!clienteId || !order || !direccionId) return;

    const fechaOrden = getDateOnlyFromUtcString(order.completed_at);
    let fechaEnvioFinal = fechaEnvio;
    if (!fechaEnvioFinal) {
      fechaEnvioFinal = addDaysToDateString(fechaOrden, 5);
      setFechaEnvio(fechaEnvioFinal);
    }

    const payloadOV = {
      id_local: parseInt(direccionId, 10),
      numero_oc: String(order.id),
      costo_envio: Number(costoEnvio) || 0,
      fecha_envio: fechaEnvioFinal || null,
      fecha_orden: fechaOrden || null,
      fecha_facturacion: fechaEnvioFinal || null,
      condiciones: "Contado",
      ingreso_venta: order.total ?? 0,
      bodega_id: parseInt(selectedBodegaId, 10) || 1
    };

    try {
      const res = await api('/ordenes-venta', {
        method: 'POST',
        body: JSON.stringify(payloadOV),
      });

      const ovCreada = res?.data || res;
      const ordenId = ovCreada?.id;

      if (ordenId) {
        await createProductosParaOrden(order, ordenId);
        toast.success("Orden de venta creada correctamente");
        setTimeout(() => {
          navigate('/ventas/ordenes');
        }, 800);
      } else {
        toast.error("No se pudo obtener el ID de la orden creada para agregar productos");
      }
    } catch (_) {
      toast.error("No se pudo crear la orden de venta");
    }
  };

  const handleCargarOrden = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setCliente(null);
    setDireccionesCliente([]);
    setSelectedDireccionId('');
    setJumpsellerOrder(null);
    setClienteIdActual(null);

    if (!orderId.trim()) {
      setErrorMsg('Ingresa un número de orden');
      return;
    }

    try {
      setLoading(true);

      const data = await getJumpsellerOrdenPorId(orderId.trim());
      if (!data || !data.order) {
        setErrorMsg('Respuesta de Jumpseller inválida');
        return;
      }
      const order = data.order;
      setJumpsellerOrder(order);

      const baseCliente = mapJumpsellerOrderToClienteBase(order);

      const idCanal =
        selectedCanalId
          ? parseInt(selectedCanalId, 10)
          : (canales[0]?.id ?? null);

      const idListaPrecio =
        selectedListaPrecioId
          ? parseInt(selectedListaPrecioId, 10)
          : (listasPrecio[0]?.id ?? null);

      const clientePayload = {
        ...baseCliente,
        condicion_pago: 30,
        id_canal: idCanal,
        id_lista_precio: idListaPrecio,
        tipo_precio: selectedTipoPrecio,
        cuenta_corriente: "",
        banco: ""
      };

      const clientes = await api('/clientes');
      let clienteId = null;

      const clienteExistente = Array.isArray(clientes)
        ? clientes.find(
            (c) =>
              c.nombre_empresa &&
              c.nombre_empresa.trim().toLowerCase() ===
                (clientePayload.nombre_empresa || '').trim().toLowerCase()
          )
        : null;

      if (clienteExistente) {
        clienteId = clienteExistente.id;
        setCliente(clientePayload);
      } else {
        const creado = await api('/clientes', {
          method: 'POST',
          body: JSON.stringify(clientePayload),
        });

        const creadoBody = creado?.data || creado;
        clienteId = creadoBody?.id ?? null;
        setCliente(clientePayload);
      }

      if (clienteId) {
        setClienteIdActual(clienteId);
        await ensureDireccionFromOrder(order, clienteId);
        await loadDireccionesCliente(clienteId);
      }
    } catch (_) {
      setErrorMsg('No se pudo obtener la orden o crear el cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearOVClick = async () => {
    if (!jumpsellerOrder || !clienteIdActual || !selectedDireccionId) {
      toast.error('Faltan datos: carga la orden y selecciona una dirección');
      return;
    }
    await createOrdenVenta(jumpsellerOrder, clienteIdActual, selectedDireccionId);
  };

  const clienteSeleccionado = cliente;

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        Agregar Orden de Venta - Jumpseller
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Orden de Jumpseller
        </h2>

        <form
          onSubmit={handleCargarOrden}
          className="flex flex-col md:flex-row gap-3 md:items-center"
        >
          <input
            type="text"
            placeholder="Número de orden"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="border border-gray-300 px-4 py-2 rounded w-full md:w-1/2 text-gray-700 placeholder-gray-400"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium"
          >
            Cargar
          </button>
        </form>

        {loading && <p className="text-sm text-gray-600 mt-3">Cargando orden / cliente...</p>}
        {errorMsg && <p className="text-sm text-red-500 mt-3">{errorMsg}</p>}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
            1
          </span>
          Clasificación Comercial Predeterminada
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Canal
            </label>
            <select
              value={selectedCanalId}
              onChange={(e) => setSelectedCanalId(e.target.value)}
              className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
            >
              {canales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Lista de Precios Asignada
            </label>
            <select
              value={selectedListaPrecioId}
              onChange={(e) => setSelectedListaPrecioId(e.target.value)}
              className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
            >
              {listasPrecio.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Formato de Compra Predeterminado
            </label>
            <select
              value={selectedTipoPrecio}
              onChange={(e) => setSelectedTipoPrecio(e.target.value)}
              className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
            >
              {tiposPrecio.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {clienteSeleccionado && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Cliente procesado
          </h2>
          <p className="text-sm text-gray-600">
            {clienteSeleccionado.nombre_empresa} — {clienteSeleccionado.email_comercial}
          </p>
        </div>
      )}

      {clienteSeleccionado && direccionesCliente.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-purple-100 text-purple-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
              2
            </span>
            Dirección asociada a la OV (id_local)
          </h2>

          <label className="block text-gray-700 font-medium mb-2">
            Dirección de cliente
          </label>
          <select
            value={selectedDireccionId}
            onChange={(e) => setSelectedDireccionId(e.target.value)}
            className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
          >
            {direccionesCliente.map((d) => (
              <option key={d.id} value={d.id}>
                {`${d.nombre_sucursal || ''} - ${d.calle} ${d.numero}, ${d.comuna}, ${d.region}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {clienteSeleccionado && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
              3
            </span>
            Parámetros de Orden de Venta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Costo de envío (CLP)
              </label>
              <input
                type="number"
                value={costoEnvio}
                onChange={(e) => setCostoEnvio(e.target.value)}
                className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Fecha de envío
              </label>
              <input
                type="date"
                value={fechaEnvio}
                onChange={(e) => setFechaEnvio(e.target.value)}
                className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Bodega
              </label>
              <select
                value={selectedBodegaId}
                onChange={(e) => setSelectedBodegaId(e.target.value)}
                className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
              >
                {bodegas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre || `Bodega ${b.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {clienteSeleccionado && (
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6 flex justify-end">
          <button
            type="button"
            onClick={handleCrearOVClick}
            disabled={
              !jumpsellerOrder ||
              !clienteIdActual ||
              !selectedDireccionId
            }
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium disabled:opacity-60"
          >
            Crear OV
          </button>
        </div>
      )}
    </div>
  );
}

