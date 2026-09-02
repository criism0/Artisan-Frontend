import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { FileDown, Receipt } from "lucide-react";
import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { formatCLP } from "../../services/formatHelpers";
import { dteService } from "../../services/dteService.js";
import { generarNotaVentaPDF } from "../../services/notaVentaPdf.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import EstadoPosteriorBadge from "../../components/Ventas/EstadoPosteriorBadge.jsx";
import { POSTERIOR_LABEL } from "../../utils/estadoPosteriorFactura.js";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

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
    { header: "N°", accessor: "id", sortable: true },
    {
      header: "Fecha",
      accessor: "fecha_orden",
      sortable: true,
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
      sortValue: (row) =>
        row.fecha_entrega ? new Date(row.fecha_entrega).getTime() : Number.MAX_SAFE_INTEGER,
      Cell: ({ value }) =>
        value ? fmtDate(value) : <span className="text-gray-400">—</span>,
    },
    {
      header: "Cliente",
      accessor: "cliente",
      sortable: true,
      sortValue: (row) => row.cliente?.nombre_empresa || "",
      Cell: ({ value }) => value?.nombre_empresa || "—",
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
      Cell: ({ value }) =>
        value ? (
          <span className="block max-w-[200px] truncate text-gray-600" title={value}>
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
      align: "right",
      Cell: ({ value }) => formatCLP(Number(value || 0), 0),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ value }) => <EstadoBadge estado={value} />,
    },
    {
      // Columna APARTE de "Estado" — pedido explícito de Cristóbal ("en segundo círculo"),
      // para que se pueda buscar/ordenar sin mezclarla con el paso del flujo.
      header: "Doc. posterior",
      accessor: "estado_dte_posterior",
      sortable: true,
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
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Órdenes de Venta"
      data={ordenes}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando órdenes de venta"
      defaultRowsPerPage={25}
      initialSort={{ key: "id", direction: "desc" }}
      emptyMessage="No hay órdenes de venta registradas."
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
