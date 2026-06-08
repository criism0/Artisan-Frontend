import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ClipboardList } from "lucide-react";
import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { formatCLP } from "../../services/formatHelpers";

export default function OrdenesVentaPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [ordenes, setOrdenes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const fmtMoney = (n) => formatCLP(n, 0);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

  useEffect(() => {
    (async () => {
      try {
        const ordRes = await api("/ordenes-venta");
        const ordenesData = ordRes.data || ordRes || [];
        const data = [...ordenesData]
          .filter((o) => o.estado !== "PendienteIA")
          .sort((a, b) => new Date(b.fecha_orden) - new Date(a.fecha_orden));
        setOrdenes(data);
        setFiltered(data);
      } catch (err) {
        toast.error("Error al cargar órdenes");
      }
    })();
  }, [api]);

  // === Badges ===
  const getEstadoBadge = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium";
    switch (estado) {
      case "Creada":
        return <span className={`${base} bg-gray-200 text-gray-700`}>Creada</span>;
      case "Validada":
        return <span className={`${base} bg-blue-100 text-blue-700`}>Validada</span>;
      case "En picking":
        return <span className={`${base} bg-indigo-100 text-indigo-700`}>En picking</span>;
      case "Lista para facturación":
        return <span className={`${base} bg-cyan-100 text-cyan-700`}>Lista para facturación</span>;
      case "Facturada":
        return <span className={`${base} bg-yellow-100 text-yellow-700`}>Facturada</span>;
      case "Entregada":
        return <span className={`${base} bg-green-100 text-green-700`}>Entregada</span>;
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

  // === Acciones por fila ===
  const actions = (row) => {
    const puedeEditar = row.estado === "Creada";
    const tieneAsignacion = ["En picking", "Lista para facturación", "Facturada", "Entregada"].includes(row.estado);

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

        {tieneAsignacion && (
          <button
            onClick={() => navigate(`/ventas/ordenes/${row.id}/resumen-asignacion`)}
            className="text-gray-400 hover:text-blue-500"
            title="Ver resumen de asignación"
          >
            <ClipboardList className="w-5 h-5" />
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
        o.cliente?.nombre_empresa,
        fmtMoney(o.ingreso_venta),
        o.estado,
      ]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(s))
    );
    setFiltered(next);
    setPage(1);
  };

  const handleDelete = async (id) => {
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
                <td className="px-4 py-2">{row.cliente?.nombre_empresa || "—"}</td>
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
