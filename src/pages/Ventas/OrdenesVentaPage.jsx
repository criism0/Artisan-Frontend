import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { FileDown, Receipt } from "lucide-react";
import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { usePersistedState } from "../../hooks/useTablaPersistida";
import {
  FILTROS_VACIOS,
  ordenPasaFiltros,
  contarFiltrosActivos,
  recortarParaTooltip,
} from "../../utils/filtrosOrdenesVenta";
import { formatCLP } from "../../services/formatHelpers";
import { dteService } from "../../services/dteService.js";
import { generarNotaVentaPDF } from "../../services/notaVentaPdf.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import EstadoPosteriorBadge from "../../components/Ventas/EstadoPosteriorBadge.jsx";
import { POSTERIOR_LABEL } from "../../utils/estadoPosteriorFactura.js";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

/** Una sola clave para la tabla y para los filtros de esta página: se guardan y se borran juntos. */
const CLAVE_UI = "ventas_ordenes_v1";

function EstadoBadge({ estado }) {
  const base = "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap";
  const map = {
    "Creada": "bg-gray-200 text-gray-700",
    "Validada": "bg-blue-100 text-blue-700",
    "En picking": "bg-indigo-100 text-indigo-700",
    "Lista para facturación": "bg-cyan-100 text-cyan-700",
    "Facturada": "bg-yellow-100 text-yellow-700",
    "Entregada": "bg-green-100 text-green-700",
  };
  return <span className={`${base} ${map[estado] || "bg-gray-100 text-gray-600"}`}>{estado}</span>;
}


export default function OrdenesVentaPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [ordenes, setOrdenes] = useState([]);
  const [descargando, setDescargando] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Los filtros propios de esta lista viven acá porque acá se sabe qué significan; se guardan
  // bajo la MISMA clave que usa el DataTable para su búsqueda/orden/columnas.
  const [filtros, setFiltros] = usePersistedState(CLAVE_UI, "filtrosOV", FILTROS_VACIOS);
  const setFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));

  const canDeleteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.DELETE);
  const canReadClients = checkScope(ModelType.CLIENTE, ScopeType.READ);

  useEffect(() => {
    (async () => {
      if (!canReadClients) {
        toast.permissionError([ModelType.CLIENTE, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const ordRes = await api("/ordenes-venta");
        const ordenesData = ordRes.data || ordRes || [];
        setOrdenes(ordenesData.filter((o) => o.estado !== "PendienteIA"));
      } catch {
        toast.error("Error al cargar órdenes");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [api, canReadClients]);

  const handleDelete = async (id) => {
    if (!canDeleteSaleOrder) {
      toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/ordenes-venta/${id}`, { method: "DELETE" });
      setOrdenes((prev) => prev.filter((x) => x.id !== id));
      toast.success("Orden eliminada correctamente");
    } catch {
      toast.error("No se pudo eliminar la orden");
    }
  };

  const columns = [
    { header: "N°", accessor: "id", sortable: true, hideable: false, filtro: "numero" },
    {
      header: "Fecha",
      accessor: "fecha_orden",
      sortable: true,
      filtro: "fecha",
      sortValue: (row) => (row.fecha_orden ? new Date(row.fecha_orden).getTime() : 0),
      Cell: ({ value }) => fmtDate(value),
    },
    {
      // Cuándo hay que entregar — lo que pidió Hernán para poder ordenar el día por urgencia.
      // Va inmediatamente después de la fecha de emisión porque la comparación entre las dos
      // es la que dice si el pedido está apretado.
      //
      // ⚠️ Las órdenes sin fecha comprometida se ordenan AL FINAL, no como el año 0: con el 0
      // el orden ascendente empieza por todas las que no tienen fecha, que es justo lo que no
      // se está buscando cuando alguien ordena por entrega.
      header: "Entrega",
      accessor: "fecha_entrega",
      sortable: true,
      filtro: "fecha",
      sortValue: (row) =>
        row.fecha_entrega ? new Date(row.fecha_entrega).getTime() : Number.MAX_SAFE_INTEGER,
      Cell: ({ value }) =>
        value ? fmtDate(value) : <span className="text-gray-400">—</span>,
    },
    {
      // Se acota igual que la OC: medido en producción hay nombres de hasta 41 caracteres
      // («Lokal - Emitir Guias despacho NO facturar»), 16 filas sobre 28, y sin tope esa fila
      // empujaba el resto de las columnas fuera de la pantalla.
      header: "Cliente",
      accessor: "cliente",
      sortable: true,
      filtro: "valores",
      sortValue: (row) => row.cliente?.nombre_empresa || "",
      Cell: ({ value }) =>
        value?.nombre_empresa ? (
          <span className="block max-w-[190px] truncate" title={value.nombre_empresa}>
            {value.nombre_empresa}
          </span>
        ) : (
          "—"
        ),
    },
    {
      // Comuna de despacho — pedido de Hernán, para armar las rutas del día sin abrir orden por
      // orden. Sale de la dirección de despacho ya asignada: 189 de 220 la tienen (86%), y las
      // 31 restantes muestran el motivo en vez de un guion mudo.
      header: "Comuna",
      accessor: "comuna_despacho",
      sortable: true,
      filtro: "valores",
      sortValue: (row) => row.direccion?.comuna || "",
      Cell: ({ row }) =>
        row.direccion?.comuna ? (
          <span className="whitespace-nowrap">{row.direccion.comuna}</span>
        ) : (
          <span className="text-gray-400 italic text-xs">sin dirección</span>
        ),
    },
    {
      // El número de OC que mandó el cliente. Ya se podía buscar por él pero no se veía, así
      // que había que entrar al detalle para cruzarlo con lo que pregunta el cliente por
      // teléfono. Está en 235 de las 290 órdenes.
      // Algunos clientes mandan la OC con dirección/horario/nombre pegado al número (ver
      // §0-centies-ter): sin acotar el ancho, esa fila empujaba el resto de las columnas fuera
      // de la pantalla. Se trunca con elipsis y el texto completo queda en el `title`.
      header: "OC cliente",
      accessor: "numero_oc",
      sortable: true,
      filtro: "texto",
      Cell: ({ value }) =>
        value ? (
          <span
            className="font-mono text-xs block max-w-[220px] truncate"
            title={value}
          >
            {value}
          </span>
        ) : (
          "—"
        ),
    },
    {
      // Instrucciones de despacho, horario, con quién coordinar — lo que el cliente escribió al
      // pedir (§0-centies-sexies). Trunca con elipsis para no romper el ancho de la tabla; el
      // texto completo queda en el `title` y también se ve entero en el detalle de la orden.
      header: "Comentario",
      accessor: "comentario_cliente",
      filtro: "texto",
      Cell: ({ value }) =>
        value ? (
          <span
            className="block max-w-[180px] truncate text-gray-600"
            title={recortarParaTooltip(value)}
          >
            {value}
          </span>
        ) : (
          "—"
        ),
    },
    {
      // Neto, sin IVA: es el número con el que se trabaja la venta. El total con impuesto lo
      // dice la factura, y mostrarlo acá obligaba a hacer la cuenta al revés para conciliar.
      header: "Total neto",
      accessor: "ingreso_venta",
      sortable: true,
      filtro: "numero",
      align: "right",
      Cell: ({ value }) => formatCLP(Number(value || 0), 0),
    },
    {
      // Total bruto — pedido de Hernán. Lo calcula el backend con la misma tasa de IVA que arma
      // el DTE (`services/montoBruto.ts`), no la vista: la tasa es la clase de constante que se
      // cambia en un lugar y se olvida en el otro.
      //
      // ⚠️ Es la cara bruta de «Total neto», o sea el valor de lo PEDIDO. Cuando hubo despacho
      // parcial la factura declara lo PICKEADO y su total es menor (§0-centies-quater): ese
      // número vive en la columna de Estado, junto al folio, y los dos son correctos.
      header: "Total bruto",
      accessor: "monto_bruto",
      sortable: true,
      filtro: "numero",
      align: "right",
      Cell: ({ value }) =>
        value == null ? (
          <span className="text-gray-400">—</span>
        ) : (
          formatCLP(Number(value), 0)
        ),
    },
    {
      // 🔴 El N° de factura va DENTRO de esta columna, no en una propia — pedido literal de
      // Hernán («que salga el N° de factura en la columna Estado»). Y además es lo correcto de
      // ancho: la tabla ya scrollea horizontal, y el folio sólo tiene sentido leído junto al
      // estado que lo explica.
      //
      // Averiguar el folio de una orden obligaba hasta ahora a entrar al detalle y abrir el
      // centro de documentos, y es la consulta más frecuente del día: el cliente llama citando
      // un folio, o hay que cruzar la orden contra la cartola.
      header: "Estado",
      accessor: "estado",
      sortable: true,
      hideable: false,
      filtro: "valores",
      Cell: ({ row, value }) => (
        <div className="flex flex-col items-start gap-0.5">
          <EstadoBadge estado={value} />
          {row.factura?.folio != null && (
            <span
              className={`text-[11px] font-mono ${
                row.factura.estado_sii === "ANULADO"
                  ? "text-gray-400 line-through"
                  : "text-gray-600"
              }`}
              title={
                row.factura.estado_sii === "ANULADO"
                  ? `Documento ${row.factura.tipo_dte}-${row.factura.folio} — ANULADO`
                  : `${row.factura.tipo_dte === 39 ? "Boleta" : "Factura"} N° ${row.factura.folio}` +
                    ` · ${formatCLP(Number(row.factura.monto_total || 0), 0)} bruto facturado` +
                    (row.factura.origen === "EXTERNO" ? " · emitida fuera del ERP" : "")
              }
            >
              N° {row.factura.folio}
              {row.factura.origen === "EXTERNO" && (
                <span className="ml-1 text-[10px] text-amber-600" title="Emitida fuera del ERP">ext</span>
              )}
            </span>
          )}
        </div>
      ),
    },
    {
      // Columna APARTE de "Estado" — pedido explícito de Cristóbal ("en segundo círculo"),
      // para que se pueda buscar/ordenar sin mezclarla con el paso del flujo.
      header: "Doc. posterior",
      accessor: "estado_dte_posterior",
      sortable: true,
      filtro: "valores",
      // Se filtra por la etiqueta que se LEE en pantalla ("NC Total"), no por el código
      // interno: nadie busca "NC_TOTAL" en una lista de opciones.
      filtroValor: (row) =>
        row.estado_dte_posterior ? POSTERIOR_LABEL[row.estado_dte_posterior.estado] : null,
      sortValue: (row) => row.estado_dte_posterior?.estado ?? "",
      Cell: ({ row }) => <EstadoPosteriorBadge info={row.estado_dte_posterior} />,
    },
  ];

  // Descarga la factura de una orden sin entrar al detalle: es la consulta más frecuente y
  // hacían falta tres clics y una pestaña nueva para llegar.
  //
  // Los documentos se piden AL APRETAR, no al pintar la tabla: precargarlos sería una petición
  // por fila para algo que casi nunca se abre.
  const handleDescargarFactura = async (row) => {
    setDescargando(`factura-${row.id}`);
    try {
      const lista = await dteService.listarPorOrden(row.id);
      const factura = (lista ?? []).find((d) => Number(d.tipo_dte) === 33);
      if (!factura) {
        toast.warning("Esta orden todavía no tiene factura emitida");
        return;
      }
      await dteService.descargarPDF(factura);
    } catch (err) {
      toast.error(`No se pudo descargar la factura: ${err?.message ?? "error desconocido"}`);
    } finally {
      setDescargando(null);
    }
  };

  // Nota de Venta: se puede descargar en cualquier estado (no depende de que haya factura), a
  // diferencia de "Descargar factura" arriba. Antes había que entrar al detalle para bajarla —
  // es la consulta más frecuente en la operación diaria de despacho.
  const handleDescargarNV = async (row) => {
    setDescargando(`nv-${row.id}`);
    try {
      await generarNotaVentaPDF({ api, ordenId: row.id });
    } catch (err) {
      toast.error(`No se pudo generar la Nota de Venta: ${err?.message ?? "error desconocido"}`);
    } finally {
      setDescargando(null);
    }
  };

  const actions = (row) => {
    const puedeEditar = row.estado === "Creada";
    // Sólo donde puede haber factura. El estado es el único dato de la fila que lo dice sin
    // pedir los documentos de las 290 órdenes.
    const puedeTenerFactura = ["Facturada", "Entregada"].includes(row.estado);

    return (
      <div className="flex gap-2 justify-center items-center">
        <ViewDetailButton
          onClick={() => navigate(`/ventas/ordenes/${row.id}`)}
          tooltipText="Ver detalle"
        />
        {puedeEditar && (
          <EditButton
            onClick={() => navigate(`/ventas/ordenes/${row.id}/edit`)}
            tooltipText="Editar"
          />
        )}
        <button
          onClick={() => handleDescargarNV(row)}
          disabled={descargando === `nv-${row.id}`}
          className="text-gray-400 hover:text-[#7A5AF8] disabled:opacity-40"
          title="Descargar Nota de Venta"
        >
          <Receipt className="w-5 h-5" />
        </button>
        {puedeTenerFactura && (
          <button
            onClick={() => handleDescargarFactura(row)}
            disabled={descargando === `factura-${row.id}`}
            className="text-gray-400 hover:text-[#7A5AF8] disabled:opacity-40"
            title="Descargar factura"
          >
            <FileDown className="w-5 h-5" />
          </button>
        )}
        <TrashButton
          onConfirmDelete={() => handleDelete(row.id)}
          tooltipText="Eliminar"
          entityName={`Orden de Venta #${row.id}`}
        />
      </div>
    );
  };

  // 🔴 El filtrado va ANTES del DataTable, no en su `filterFn`: esa función sólo corre cuando
  // hay texto en la búsqueda, así que un filtro implementado ahí no haría nada con el buscador
  // vacío — que es como se usa el 99% de las veces.
  //
  // Acá queda sólo lo que NO es una columna: todo lo demás (estado, cliente, comuna, fechas,
  // montos, documento posterior) se filtra desde el embudo de su propia columna.
  const ordenesFiltradas = useMemo(
    () => ordenes.filter((o) => ordenPasaFiltros(o, filtros)),
    [ordenes, filtros],
  );

  const filtrosActivos = contarFiltrosActivos(filtros);

  const panelFiltros = (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 min-w-[200px]">
        <span className="text-xs font-medium text-gray-600">Facturación</span>
        <select
          value={filtros.facturacion}
          onChange={(e) => setFiltro("facturacion", e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas</option>
          <option value="con">Con factura emitida</option>
          <option value="sin">Sin factura</option>
        </select>
      </label>

      <p className="text-xs text-gray-500 max-w-md">
        El resto se filtra desde el embudo de cada columna: estado, cliente, comuna, fechas,
        montos y documento posterior. Lo que dejes puesto se recuerda al volver a esta pantalla.
      </p>

      {/* Un filtro que se recuerda entre visitas puede dejar la lista "vacía" sin que se vea
          por qué. Por eso el conteo y el botón de limpiar están siempre a la vista. */}
      <div className="flex items-center gap-3 ml-auto text-sm">
        <span className="text-gray-500">
          {ordenesFiltradas.length} de {ordenes.length} órdenes
        </span>
        {filtrosActivos > 0 && (
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_VACIOS)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );

  const getSearchText = (row) =>
    [
      row.id,
      fmtDate(row.fecha_orden),
      row.cliente?.nombre_empresa,
      row.numero_oc,
      row.estado,
      row.comentario_cliente,
      // "NC Total"/"NC Parcial" buscables tal como se leen en pantalla, no el código interno.
      row.estado_dte_posterior && POSTERIOR_LABEL[row.estado_dte_posterior.estado],
      row.estado_dte_posterior?.motivo,
      // El folio se busca tal como lo dice el cliente por teléfono: "la 24322" tiene que
      // encontrar su orden sin que nadie tenga que saber a qué OV corresponde.
      row.factura?.folio,
      row.direccion?.comuna,
      fmtDate(row.fecha_entrega),
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Órdenes de Venta"
      data={ordenesFiltradas}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      filters={panelFiltros}
      loading={isLoading}
      loadingMessage="Cargando órdenes de venta"
      defaultRowsPerPage={25}
      initialSort={{ key: "id", direction: "desc" }}
      // Búsqueda, orden, filas por página, panel de filtros y columnas visibles se recuerdan al
      // volver del detalle — pedido de Hernán, y es como ya funciona Inventario de Bultos.
      persistKey={CLAVE_UI}
      emptyMessage={
        filtrosActivos > 0
          ? "Ninguna orden calza con los filtros puestos."
          : "No hay órdenes de venta registradas."
      }
      headerActions={
        <>
          <button
            className="px-3 py-2 bg-green-300 text-green-900 rounded-md hover:bg-green-400"
            onClick={() => navigate("/Excel/products")}
          >
            Cargar Excel
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/ventas/ordenes/add")}
          >
            Añadir Orden
          </button>
        </>
      }
    />
  );
}
