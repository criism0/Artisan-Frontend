import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { FileDown } from "lucide-react";
import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { formatCLP } from "../../services/formatHelpers";
import { dteService } from "../../services/dteService.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

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
      header: "OC cliente",
      accessor: "numero_oc",
      sortable: true,
      Cell: ({ value }) =>
        value ? <span className="font-mono text-xs">{value}</span> : "—",
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
  ];

  // Descarga la factura de una orden sin entrar al detalle: es la consulta más frecuente y
  // hacían falta tres clics y una pestaña nueva para llegar.
  //
  // Los documentos se piden AL APRETAR, no al pintar la tabla: precargarlos sería una petición
  // por fila para algo que casi nunca se abre.
  const handleDescargarFactura = async (row) => {
    setDescargando(row.id);
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
        {puedeTenerFactura && (
          <button
            onClick={() => handleDescargarFactura(row)}
            disabled={descargando === row.id}
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
    [row.id, fmtDate(row.fecha_orden), row.cliente?.nombre_empresa, row.numero_oc, row.estado]
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
      initialSort={{ key: "fecha_orden", direction: "desc" }}
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
