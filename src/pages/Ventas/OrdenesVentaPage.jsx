import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import {
  Eye,
  Edit,
  Trash2,
  FilePen,
  Receipt,
  Truck,
  CheckCircle,
  Undo2,
  ClipboardList,
} from "lucide-react";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";

export default function OrdenesVentaPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [ordenes, setOrdenes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [direccionToCliente, setDireccionToCliente] = useState({});
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const fmtMoney = (n) =>
    typeof n === "number"
      ? n.toLocaleString("es-CL", {
          style: "currency",
          currency: "CLP",
          maximumFractionDigits: 0,
        })
      : "—";

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

  useEffect(() => {
    (async () => {
      try {
        const [ordRes, clientesRes] = await Promise.all([
          api("/ordenes-venta"),
          api("/clientes"),
        ]);

        const direccionToClienteId = {};
        const clienteNombre = {};
        
        const clientesData = clientesRes.data || clientesRes || [];
        clientesData.forEach((c) => {
          clienteNombre[c.id] = c.nombre_empresa;
          if (Array.isArray(c.direcciones)) {
            c.direcciones.forEach((direccion) => {
              direccionToClienteId[direccion.id] = c.id;
            });
          }
        });

        const d2c = {};
        Object.entries(direccionToClienteId).forEach(([direccionId, clienteId]) => {
          d2c[direccionId] = clienteNombre[clienteId] || "—";
        });
        setDireccionToCliente(d2c);

        const ordenesData = ordRes.data || ordRes || [];
        const data = [...ordenesData].sort(
          (a, b) => new Date(b.fecha_orden) - new Date(a.fecha_orden)
        );
        setOrdenes(data);
        setFiltered(data);
      } catch (err) {
        toast.error("Error al cargar órdenes");
      }
    })();
  }, [api]);

  // === Transiciones de estado ===
  const estados = ["Pendiente", "Asignado", "Facturado", "Enviado", "Entregado"];

  const avanzarEstado = async (row) => {
    try {
      const idx = estados.indexOf(row.estado);
      if (idx === -1 || idx === estados.length - 1) return;
      const nuevoEstado = estados[idx + 1];

      await api(`/ordenes-venta/${row.id}`, { method: "PUT", body: JSON.stringify({ estado: nuevoEstado }) });

      setOrdenes((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: nuevoEstado } : o))
      );
      setFiltered((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: nuevoEstado } : o))
      );
      toast.success("Estado actualizado correctamente");
    } catch (err) {
      toast.error("No se pudo avanzar el estado");
    }
  };

  const retrocederEstado = async (row) => {
    try {
      const idx = estados.indexOf(row.estado);
      if (idx <= 0) return;
      const nuevoEstado = estados[idx - 1];

      await api(`/ordenes-venta/${row.id}`, { method: "PUT", body: JSON.stringify({ estado: nuevoEstado }) });

      setOrdenes((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: nuevoEstado } : o))
      );
      setFiltered((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: nuevoEstado } : o))
      );
      toast.success("Estado actualizado correctamente");
    } catch (err) {
      toast.error("No se pudo retroceder el estado");
    }
  };

  // === Badges ===
  const getEstadoBadge = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium";
    switch (estado) {
      case "Pendiente":
        return <span className={`${base} bg-gray-200 text-gray-700`}>Pendiente</span>;
      case "Asignado":
        return <span className={`${base} bg-blue-100 text-blue-700`}>Asignado</span>;
      case "Listo-para-despacho":
        return <span className={`${base} bg-cyan-100 text-cyan-700`}>Listo-para-despacho</span>;
      case "Facturado":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>Facturado</span>;
      case "Enviado":
        return <span className={`${base} bg-purple-100 text-purple-700`}>Enviado</span>;
      case "Entregado":
        return <span className={`${base} bg-green-100 text-green-700`}>Entregado</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>;
    }
  };

  // === Ordenamiento ===
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }
    setSortConfig({ key, direction });

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (key === "fecha_orden") {
        return direction === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = aVal?.toString().toLowerCase() || "";
      const bStr = bVal?.toString().toLowerCase() || "";
      return direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    setFiltered(sorted);
    setPage(1);
  };

  const renderHeader = (label, accessor) => {
    const isActive = sortConfig.key === accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(accessor)}
      >
        <span>{label}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  // === Botón dinámico según estado ===
  const BotonEstado = ({ row }) => {
    switch (row.estado) {
      case "Pendiente":
        return (
          <button
            onClick={() => navigate(`/ventas/ordenes/${row.id}/asignar`)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-primary"
            title="Asignar productos"
          >
            <FilePen size={18} strokeWidth={1.5} />
          </button>
        );

      case "Asignado":
        return (
          <>
            <button
              onClick={() => avanzarEstado(row)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-yellow-600"
              title="Facturar"
            >
              <Receipt size={18} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => retrocederEstado(row)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-600"
              title="Volver a Pendiente"
            >
              <Undo2 size={18} strokeWidth={1.5} />
            </button>
          </>
        );

      case "Facturado":
        return (
          <>
            <button
              onClick={() => avanzarEstado(row)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-purple-600"
              title="Enviar"
            >
              <Truck size={18} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => retrocederEstado(row)}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-yellow-600"
              title="Volver a Asignado"
            >
              <Undo2 size={18} strokeWidth={1.5} />
            </button>
          </>
        );

      case "Enviado":
        // No mostrar botones aquí, el botón de entregar se maneja en actions()
        return null;

      case "Entregado":
        // No se puede retroceder desde Entregado
        return null;

      default:
        return null;
    }
  };

  // === Acciones por fila ===
  const actions = (row) => {
    const estadoListoDespacho = row.estado === "Listo-para-despacho";
    const estadoEnviado = row.estado === "Enviado";
    const estadoEntregado = row.estado === "Entregado";
    const puedeEditar = !estadoListoDespacho && !estadoEnviado && !estadoEntregado;
    const puedeVerResumen = estadoListoDespacho || estadoEnviado || estadoEntregado;
    
    return (
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => navigate(`/ventas/ordenes/${row.id}`)}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-primary"
          title="Ver Detalle"
        >
          <Eye size={18} strokeWidth={1.5} />
        </button>

        {puedeEditar && (
          <button
            onClick={() => navigate(`/ventas/ordenes/${row.id}/edit`)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-primary"
            title="Editar"
          >
            <Edit size={18} strokeWidth={1.5} />
          </button>
        )}

        {puedeVerResumen && (
          <button
            onClick={() => navigate(`/ventas/ordenes/${row.id}/resumen-asignacion`)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
            title="Ver Resumen de Asignación"
          >
            <ClipboardList size={18} strokeWidth={1.5} />
          </button>
        )}

        {estadoListoDespacho && (
          <button
            onClick={() => handleEnviarOrden(row)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-purple-600"
            title="Enviar orden"
          >
            <Truck size={18} strokeWidth={1.5} />
          </button>
        )}

        {(estadoEnviado || estadoListoDespacho) && (
          <button
            onClick={() => handleEntregarOrden(row)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-green-600"
            title="Entregar orden"
          >
            <CheckCircle size={18} strokeWidth={1.5} />
          </button>
        )}

        <BotonEstado row={row} />

        <button
          onClick={() => handleDelete(row.id)}
          className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
          title="Eliminar"
        >
          <Trash2 size={18} strokeWidth={1.5} />
        </button>
      </div>
    );
  };

  const handleSearch = (q) => {
    const s = q.trim().toLowerCase();
    if (!s) {
      setFiltered(ordenes);
      setPage(1);
      return;
    }
    const next = ordenes.filter((o) =>
      [
        String(o.id),
        fmtDate(o.fecha_orden),
        direccionToCliente[o.id_local],
        fmtMoney(o.ingreso_venta),
        o.estado,
      ]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(s))
    );
    setFiltered(next);
    setPage(1);
  };

  const handleEnviarOrden = async (row) => {
    if (!window.confirm("¿Enviar esta orden de venta?")) return;
    try {
      await api(`/ordenes-venta/${row.id}/enviar-orden`, { method: "PUT" });
      setOrdenes((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: "Enviado" } : o))
      );
      setFiltered((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: "Enviado" } : o))
      );
      toast.success("Orden enviada correctamente");
    } catch (err) {
      toast.error("No se pudo enviar la orden");
    }
  };

  const handleEntregarOrden = async (row) => {
    if (!window.confirm("¿Confirmar la entrega exitosa de esta orden de venta?")) return;
    try {
      await api(`/ordenes-venta/${row.id}/entregar-orden`, { method: "PUT" });
      setOrdenes((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: "Entregado" } : o))
      );
      setFiltered((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, estado: "Entregado" } : o))
      );
      toast.success("Orden entregada correctamente");
    } catch (err) {
      toast.error("No se pudo entregar la orden");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta orden de venta?")) return;
    try {
      await api(`/ordenes-venta/${id}`, { method: "DELETE" });
      setOrdenes((prev) => prev.filter((x) => x.id !== id));
      setFiltered((prev) => prev.filter((x) => x.id !== id));
      toast.success("Orden eliminada correctamente");
    } catch (e) {
      toast.error("No se pudo eliminar la orden");
    }
  };

  // === Render ===
  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const dataSlice = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Órdenes de Venta</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 bg-green-300 text-green-900 rounded-md hover:bg-green-400"
            onClick={() => navigate("/Excel/products")}
          >
            Cargar Excel
          </button>
          <button
            className="px-3 py-2 bg-green-300 text-green-900 rounded-md hover:bg-green-400"
            onClick={() => navigate("/jumpseller/products")}
          >
            Cargar Jumpseller
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
            onClick={() => navigate("/ventas/ordenes/add")}
          >
            Añadir Orden
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <RowsPerPageSelector
            defaultValue={25}
            onRowsChange={(n) => {
              setRowsPerPage(n);
              setPage(1);
            }}
          />
          <span>órdenes por página</span>
        </div>
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto bg-white rounded shadow">
          <thead className="bg-gray-100 text-gray-800 text-sm">
            <tr>
              <th className="px-4 py-2 text-left">{renderHeader("N°", "id")}</th>
              <th className="px-4 py-2 text-left">{renderHeader("FECHA", "fecha_orden")}</th>
              <th className="px-4 py-2 text-left">{renderHeader("CLIENTE", "id_local")}</th>
              <th className="px-4 py-2 text-left">{renderHeader("TOTAL NETO", "ingreso_venta")}</th>
              <th className="px-4 py-2 text-left">{renderHeader("ESTADO", "estado")}</th>
              <th className="px-4 py-2 text-center">ACCIONES</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {dataSlice.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">{row.id}</td>
                <td className="px-4 py-2">{fmtDate(row.fecha_orden)}</td>
                <td className="px-4 py-2">{direccionToCliente[row.id_local] || "—"}</td>
                <td className="px-4 py-2">{fmtMoney(row.ingreso_venta * 1.19)}</td>
                <td className="px-4 py-2">{getEstadoBadge(row.estado)}</td>
                <td className="px-4 py-2 text-center">{actions(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
