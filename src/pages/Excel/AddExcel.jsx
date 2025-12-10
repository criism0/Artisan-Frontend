import { useState, useEffect } from 'react';
import { useApi } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../lib/toast';
import * as XLSX from 'xlsx';

export default function ExportOrdenVentaExcel() {
  const api = useApi();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');

  const [direcciones, setDirecciones] = useState([]);
  const [selectedDireccionId, setSelectedDireccionId] = useState('');

  const [bodegas, setBodegas] = useState([]);
  const [selectedBodegaId, setSelectedBodegaId] = useState('1');

  const [productosBase, setProductosBase] = useState([]);
  const [clienteConfig, setClienteConfig] = useState(null);
  const [preciosLista, setPreciosLista] = useState([]);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const data = await api('/clientes');
        if (Array.isArray(data)) {
          setClientes(data);
        } else if (Array.isArray(data?.data)) {
          setClientes(data.data);
        }
      } catch (_) {
        setClientes([]);
        setErrorMsg('No se pudieron cargar los clientes.');
      }
    };
    fetchClientes();
  }, [api]);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await api('/bodegas', { method: 'GET' });
        const body =
          (await res?.json?.()) ??
          res?.data ??
          res ??
          {};
        const lista =
          Array.isArray(body?.bodegas) ? body.bodegas :
          Array.isArray(body?.data)    ? body.data :
          Array.isArray(body)          ? body :
          [];

        setBodegas(lista);
        const bodega1 = lista.find(b => b.id === 1) || lista[0];
        if (bodega1) setSelectedBodegaId(String(bodega1.id));
      } catch (_) {
        setBodegas([]);
      }
    };

    fetchBodegas();
  }, [api]);

  useEffect(() => {
    const fetchProductosBase = async () => {
      try {
        const data = await api('/productos-base');
        if (Array.isArray(data)) {
          setProductosBase(data);
        } else if (Array.isArray(data?.data)) {
          setProductosBase(data.data);
        } else {
          setProductosBase([]);
        }
      } catch (_) {
        setProductosBase([]);
        setErrorMsg('No se pudieron cargar los productos base.');
      }
    };
    fetchProductosBase();
  }, [api]);

  useEffect(() => {
    const fetchDirecciones = async () => {
      setDirecciones([]);
      setSelectedDireccionId('');

      if (!selectedClienteId) return;

      try {
        const res = await api('/direcciones/', { method: 'GET' });
        const body =
          (await res?.json?.()) ??
          res?.data ??
          res ??
          [];

        const lista =
          Array.isArray(body) ? body :
          Array.isArray(body?.data) ? body.data :
          [];

        const direccionesCliente = lista.filter(
          (d) => String(d.cliente_id) === String(selectedClienteId)
        );

        setDirecciones(direccionesCliente);

        if (direccionesCliente.length > 0) {
          setSelectedDireccionId(String(direccionesCliente[0].id));
        }
      } catch (_) {
        setDirecciones([]);
      }
    };

    fetchDirecciones();
  }, [api, selectedClienteId]);

  useEffect(() => {
    const fetchClienteConfig = async () => {
      setClienteConfig(null);
      setPreciosLista([]);

      if (!selectedClienteId) return;

      try {
        const resCliente = await api(`/clientes/${selectedClienteId}`);
        const clienteData = resCliente?.data || resCliente || {};

        const config = {
          formato: clienteData?.formato_compra_predeterminado || 'UNIDADES',
          id_lista_precio: clienteData?.id_lista_precio || null,
        };
        setClienteConfig(config);

        if (config.id_lista_precio) {
          try {
            const resLista = await api(`/lista-precio/${config.id_lista_precio}`);
            const listaData = resLista?.data || resLista || {};
            const productosLista = Array.isArray(listaData?.productosBaseListaPrecio)
              ? listaData.productosBaseListaPrecio
              : Array.isArray(listaData)
              ? listaData
              : [];
            setPreciosLista(productosLista);
          } catch (_) {
            setPreciosLista([]);
          }
        }
      } catch (_) {
        setClienteConfig(null);
        setPreciosLista([]);
      }
    };

    fetchClienteConfig();
  }, [api, selectedClienteId]);

  const handleFileChange = (e) => {
    const selected = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(selected);
    setErrorMsg('');
  };

  const readExcelRows = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const pad2 = (n) => String(n).padStart(2, '0');

  const toDateString = (value) => {
    if (!value) return null;

    if (value instanceof Date && !isNaN(value)) {
      const y = value.getFullYear();
      const m = pad2(value.getMonth() + 1);
      const d = pad2(value.getDate());
      return `${y}-${m}-${d}`;
    }

    if (typeof value === 'number') {
      if (XLSX.SSF && XLSX.SSF.parse_date_code) {
        const d = XLSX.SSF.parse_date_code(value);
        if (d) {
          const y = d.y;
          const m = pad2(d.m);
          const day = pad2(d.d);
          return `${y}-${m}-${day}`;
        }
      }
      return null;
    }

    const s = String(value).trim();

    let match = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = pad2(match[2]);
      const d = pad2(match[3]);
      return `${y}-${m}-${d}`;
    }

    match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (match) {
      const d = pad2(match[1]);
      const m = pad2(match[2]);
      const y = match[3];
      return `${y}-${m}-${d}`;
    }

    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = pad2(dt.getMonth() + 1);
      const d = pad2(dt.getDate());
      return `${y}-${m}-${d}`;
    }

    return null;
  };

  const findProductoIdByNombre = (nombre) => {
    if (!nombre) return null;
    const target = nombre.toString().trim().toLowerCase();
    const found = productosBase.find(
      (pb) => (pb.nombre || '').trim().toLowerCase() === target
    );
    if (found) {
      return found.id_producto ?? found.id ?? null;
    }
    return null;
  };

  const calcularPrecioProducto = (productoId) => {
    if (!clienteConfig || !productoId) return 0;

    const precioLista = preciosLista.find(
      (x) =>
        x.id_producto_base === productoId ||
        x.id_producto === productoId
    );

    const productoBase = productosBase.find(
      (p) => (p.id_producto ?? p.id) === productoId
    );

    const unidadesPorCaja =
      Number(
        precioLista?.unidades_por_caja ||
        productoBase?.unidades_por_caja ||
        0
      ) || 0;

    const precioCaja = precioLista?.precio_caja;
    const precioUnidad = precioLista?.precio_unidad;
    const formato = (clienteConfig?.formato || 'UNIDADES').toUpperCase();

    if (formato.includes('CAJA')) {
      if (precioCaja) {
        return Number(precioCaja);
      } else if (precioUnidad && unidadesPorCaja) {
        return Number(precioUnidad) * unidadesPorCaja;
      }
    } else {
      if (precioUnidad) {
        return Number(precioUnidad);
      } else if (precioCaja && unidadesPorCaja) {
        return Number(precioCaja) / unidadesPorCaja;
      }
    }

    return 0;
  };

  const buildOrdenesAndRowsFromExcel = (rows, bodegaId, direccionId) => {
    const mapByOc = new Map();
    const rowsByOc = new Map();

    for (const row of rows) {
      const numeroOc =
        row['Número de Orden'] ??
        row['Numero de Orden'] ??
        row['N° Orden'] ??
        row['N° de Orden'] ??
        row['OC'] ??
        row['Oc'] ??
        row['oc'] ??
        null;

      if (!numeroOc) continue;
      const key = String(numeroOc).trim();
      if (!key) continue;

      const precioCostoEmp =
        Number(
          row['Precio Costo Empaque'] ??
          row['Precio Costo empaque'] ??
          row['Precio Costo'] ??
          row['Costo Empaque'] ??
          0
        ) || 0;

      const fechaEmision =
        row['Fecha Emisión'] ??
        row['Fecha Emision'] ??
        row['Fecha emisión'] ??
        row['Fecha emision'] ??
        null;

      const fechaEntrega =
        row['Fecha Entrega'] ??
        row['Fecha entrega'] ??
        null;

      if (!mapByOc.has(key)) {
        mapByOc.set(key, {
          numero_oc: key,
          ingreso_venta: 0,
          fecha_emision: fechaEmision,
          fecha_entrega: fechaEntrega,
        });
      }

      const current = mapByOc.get(key);
      current.ingreso_venta += precioCostoEmp;
      if (!current.fecha_emision && fechaEmision) {
        current.fecha_emision = fechaEmision;
      }
      if (!current.fecha_entrega && fechaEntrega) {
        current.fecha_entrega = fechaEntrega;
      }

      if (!rowsByOc.has(key)) {
        rowsByOc.set(key, []);
      }
      rowsByOc.get(key).push(row);
    }

    const bodegaIdNum = Number(bodegaId) || 1;
    const direccionIdNum = Number(direccionId);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

    const ordenesPayload = Array.from(mapByOc.values()).map((item) => {
      let fechaOrden = toDateString(item.fecha_emision);
      let fechaEnvio = toDateString(item.fecha_entrega);

      if (!fechaOrden) fechaOrden = fechaEnvio || todayStr;
      if (!fechaEnvio) fechaEnvio = fechaOrden;

      const fechaFacturacion = fechaOrden;

      return {
        id_local: direccionIdNum,
        numero_oc: item.numero_oc,
        costo_envio: 0,
        fecha_envio: fechaEnvio,
        fecha_orden: fechaOrden,
        fecha_facturacion: fechaFacturacion,
        condiciones: 'Pago a 30 días',
        ingreso_venta: item.ingreso_venta,
        bodega_id: bodegaIdNum,
      };
    });

    return { ordenesPayload, rowsByOc };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedClienteId) {
      setErrorMsg('Debes seleccionar un cliente.');
      return;
    }

    if (!selectedDireccionId) {
      setErrorMsg('Debes seleccionar una dirección.');
      return;
    }

    if (!file) {
      setErrorMsg('Debes seleccionar un archivo Excel.');
      return;
    }

    if (!productosBase || productosBase.length === 0) {
      setErrorMsg('No hay productos base cargados. No se pueden asignar productos.');
      return;
    }

    if (!clienteConfig || !clienteConfig.id_lista_precio || preciosLista.length === 0) {
      setErrorMsg(
        'El cliente seleccionado no tiene lista de precios asociada o no se pudo cargar. ' +
        'No se pueden calcular precios de venta.'
      );
      return;
    }

    try {
      setLoading(true);

      const rows = await readExcelRows(file);
      if (!rows || rows.length === 0) {
        setErrorMsg('El archivo no contiene datos.');
        setLoading(false);
        return;
      }

      const { ordenesPayload, rowsByOc } = buildOrdenesAndRowsFromExcel(
        rows,
        selectedBodegaId,
        selectedDireccionId
      );

      if (ordenesPayload.length === 0) {
        setErrorMsg('No se encontraron filas válidas (sin "Número de Orden").');
        setLoading(false);
        return;
      }

      let okOrdenes = 0;
      let failOrdenes = 0;
      let okProductos = 0;
      let failProductos = 0;

      for (const ordenPayload of ordenesPayload) {
        if (!ordenPayload.fecha_orden || !ordenPayload.fecha_envio || !ordenPayload.fecha_facturacion) {
          failOrdenes++;
          continue;
        }

        try {
          const ordenCreada = await api('/ordenes-venta', {
            method: 'POST',
            body: JSON.stringify(ordenPayload),
          });

          const ordenId = ordenCreada?.id;
          if (!ordenId) {
            failOrdenes++;
            continue;
          }
          okOrdenes++;

          const rowsOc = rowsByOc.get(ordenPayload.numero_oc) || [];

          for (const row of rowsOc) {
            const nombreProducto =
              row['Descripción'] ??
              row['Descripcion'] ??
              row['DESCRIPCIÓN'] ??
              row['DESCRIPCION'] ??
              null;

            const unidadesPorEmpaque =
              Number(
                row['Unidades por Empaque'] ??
                row['Unidades por empaque'] ??
                row['Unid x Empaque'] ??
                row['Unid por Empaque'] ??
                0
              ) || 0;

            const empaquesPedidos =
              Number(
                row['Empaques Pedidos'] ??
                row['Empaques pedidos'] ??
                row['Empaques'] ??
                0
              ) || 0;

            const idProducto = findProductoIdByNombre(nombreProducto);

            const cantidad = unidadesPorEmpaque * empaquesPedidos;

            const precioVenta = calcularPrecioProducto(idProducto);

            const productoJson = {
              id_producto: idProducto,
              cantidad,
              precio_venta: precioVenta,
              porcentaje_descuento: 0,
              cantidad_por_caja: unidadesPorEmpaque,
              producto_por_cajas: 1,
            };

            if (!idProducto || !unidadesPorEmpaque || !empaquesPedidos) {
              failProductos++;
              continue;
            }

            try {
              await api(`/ordenes-venta/${ordenId}/productos/`, {
                method: 'POST',
                body: JSON.stringify(productoJson),
              });
              okProductos++;
            } catch (_) {
              failProductos++;
            }
          }
        } catch (_) {
          failOrdenes++;
        }
      }

      setFile(null);

      if (okOrdenes > 0 && okProductos > 0) {
        toast.success('✅ OV creada con éxito');
        setTimeout(() => {
          navigate('/ventas/ordenes');
        }, 1500);
      } else {
        toast.error('❌ No se pudo crear OV');
      }
    } catch (_) {
      toast.error('❌ No se pudo crear OV');
      setErrorMsg('No se pudo procesar el archivo. Revisa el formato del Excel.');
    } finally {
      setLoading(false);
    }
  };

  const clienteSeleccionado =
    clientes.find((c) => String(c.id) === String(selectedClienteId)) || null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        Cargar OV - Excel
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Datos previos
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Cliente
            </label>
            <select
              value={selectedClienteId}
              onChange={(e) => setSelectedClienteId(e.target.value)}
              className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
            >
              <option value="">Selecciona un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_empresa || c.razon_social || `Cliente ${c.id}`}
                </option>
              ))}
            </select>
            {clienteSeleccionado && (
              <p className="text-xs text-gray-500 mt-1">
                Email: {clienteSeleccionado.email_comercial || clienteSeleccionado.email || 'No registrado'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Dirección (Local / Sucursal)
            </label>
            <select
              value={selectedDireccionId}
              onChange={(e) => setSelectedDireccionId(e.target.value)}
              className="border border-gray-300 px-3 py-2 w-full rounded text-gray-700"
              disabled={!selectedClienteId || direcciones.length === 0}
            >
              {!selectedClienteId && (
                <option value="">Selecciona primero un cliente</option>
              )}
              {selectedClienteId && direcciones.length === 0 && (
                <option value="">Este cliente no tiene direcciones</option>
              )}
              {direcciones.map((d) => (
                <option key={d.id} value={d.id}>
                  {`${d.tipo_direccion} - ${d.nombre_sucursal} - ${d.calle} ${d.numero}, ${d.comuna}`}
                </option>
              ))}
            </select>
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
              {bodegas.length === 0 && (
                <option value="">No hay bodegas disponibles</option>
              )}
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre || `Bodega ${b.id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">
              Archivo Excel
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700
                         file:mr-4 file:py-2 file:px-4
                         file:rounded file:border-0
                         file:text-sm file:font-semibold
                         file:bg-primary file:text-white
                         hover:file:bg-hover"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                Archivo seleccionado: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium disabled:opacity-60"
            >
              {loading ? 'Procesando...' : 'Crear órdenes de venta y productos'}
            </button>
          </div>
        </form>

        {errorMsg && (
          <p className="text-sm text-red-500 mt-4">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
