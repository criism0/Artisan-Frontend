import { useEffect, useState, useMemo } from "react";
import { useApi } from "../../lib/api";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";

export default function Inventario() {
  const [inventario, setInventario] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [bodegaFilter, setBodegaFilter] = useState(0);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const api = useApi();

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
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

  const formatCantidadStock = (r) => {
    if (r?.unidades_disponibles !== undefined && r?.unidades_disponibles !== null)
      return formatNumberCL(r.unidades_disponibles, 0);
    if (r?.unidades_producidas !== undefined && r?.unidades_producidas !== null)
      return `${formatNumberCL(r.unidades_producidas, 0)} unidades`;

    if (r?.peso_total !== undefined && r?.peso_total !== null) {
      const n = Number(r.peso_total);
      return Number.isFinite(n) ? `${formatNumberCL(n, 2)} kg` : r.peso_total;
    }

    if (r?.stock_disponible !== undefined && r?.stock_disponible !== null)
      return `${formatNumberCL(r.stock_disponible, 2)} kg`;
    return "-";
  };

  const columns = useMemo(
    () => [
      {
        header: renderHeader("Nombre", "nombre"),
        accessor: "nombre",
        Cell: ({ row }) =>
          row.materiaPrima?.nombre ||
          row.nombre_producto ||
          row.materiaPrima?.nombre ||
          "",
      },
      {
        header: renderHeader("Categoría", "categoria"),
        accessor: "categoria",
        Cell: ({ row }) =>
          row.categoria ||
          row.materiaPrima?.categoria?.nombre ||
          row.categoria ||
          "",
      },
      {
        header: renderHeader("Cantidad / Stock", "unidades_disponibles"),
        accessor: "unidades_disponibles",
        Cell: ({ row }) => formatCantidadStock(row),
      },
      {
        header: renderHeader("Precio / Costo total", "precio_total"),
        accessor: "precio_total",
        Cell: ({ row }) => {
          const r = row;
          const value =
            r.precio_total ??
            r.costo_total ??
            r.precio_venta_unitario ??
            null;
          if (value === null || value === undefined) return "-";
          return formatCLP(value, 0);
        },
      },
      {
        header: renderHeader("Estado", "estado_stock"),
        accessor: "estado_stock",
        Cell: ({ row }) => {
          const s = row.estado_stock || row.categoria || "";
          const isGood = (s || "").toLowerCase() === "bien";
          return (
            <span
              className={
                `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ` +
                (isGood
                  ? "text-green-700 ring-1 ring-green-700/30 bg-transparent"
                  : "bg-red-100 text-red-800")
              }
            >
              {s}
            </span>
          );
        },
      },
      {
        header: renderHeader("Último movimiento", "ultimo_movimiento"),
        accessor: "ultimo_movimiento",
        Cell: ({ row }) => {
          const v =
            row.ultimo_movimiento ?? row.fecha_elaboracion ?? row.fecha;
          return v ? new Date(v).toLocaleString() : "";
        },
      },
    ],
    [sortConfig]
  );

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const inv = await api("/inventario/general");
        setInventario(Array.isArray(inv) ? inv : []);
        setFiltered(Array.isArray(inv) ? inv : []);
        try {
          const res = await api("/bodegas");
          const data = Array.isArray(res?.bodegas)
            ? res.bodegas
            : Array.isArray(res)
            ? res
            : [];
          //const bodegasActivos = data.filter((b) => b.nombre !== "En tránsito"); // Si debe parece en transito
          setBodegas(data);
        } catch {
          setBodegas([]);
        }
      } catch (error) {
        console.error("Error fetching inventario:", error);
      }
    };
    fetchAll();
  }, [api]);

  useEffect(() => {
    const applyFilters = async () => {
      try {
        let data = inventario;

        if (bodegaFilter && +bodegaFilter > 0) {
          const res = await api(`/inventario/${bodegaFilter}`);
          data = Array.isArray(res) ? res : [];
        }

        if (tipoFilter && tipoFilter !== "todos") {
          try {
            const idB =
              bodegaFilter && +bodegaFilter > 0
                ? `&id_bodega=${bodegaFilter}`
                : "";
            if (tipoFilter === "materia_prima") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_materia_prima${idB}`
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "pip") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_lote_producto_en_proceso${idB}`
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "merma") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=merma_produccion${idB}`
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "subproducto") {
              const res = await api(
                `/inventario/filtrosMateriaPrima?id_categoria=id_registro_subproducto${idB}`
              );
              data = Array.isArray(res) ? res : [];
            } else if (tipoFilter === "producto_terminado") {
              const res = await api(
                `/inventario/productosFinales?id_bodega=${
                  bodegaFilter && +bodegaFilter > 0 ? bodegaFilter : ""
                }`
              );
              data = Array.isArray(res) ? res : [];
            }
          } catch {
            data = [];
          }
        }

        if (query && query.trim().length > 0) {
          const q = query.toLowerCase();
          data = data.filter(
            (d) =>
              (d.materiaPrima?.nombre || "")
                .toString()
                .toLowerCase()
                .includes(q) ||
              (d.materiaPrima?.categoria?.nombre || "")
                .toString()
                .toLowerCase()
                .includes(q) ||
              (d.pesoDisponible || "").toString().toLowerCase().includes(q)
          );
        }

        if (sortConfig.key) {
          data = [...data].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (typeof aVal === "number" && typeof bVal === "number") {
              return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
            }
            const aStr = aVal?.toString().toLowerCase() || "";
            const bStr = bVal?.toString().toLowerCase() || "";
            return sortConfig.direction === "asc"
              ? aStr.localeCompare(bStr)
              : bStr.localeCompare(aStr);
          });
        }

        setFiltered(data);
        setPage(1);
      } catch (err) {
        console.error("Error applying filters:", err);
      }
    };
    applyFilters();
  }, [bodegaFilter, tipoFilter, query, inventario, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const start = (page - 1) * rowsPerPage;
  const pageData = filtered.slice(start, start + rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventario</h1>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Bodega</label>
          <select
            value={bodegaFilter}
            onChange={(e) => setBodegaFilter(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value={0}>Todas</option>
            {bodegas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo</label>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            <option value="todos">Todos</option>
            <option value="materia_prima">Materias Primas</option>
            <option value="pip">Productos en Proceso (PIP)</option>
            <option value="producto_terminado">Productos Terminados</option>
            <option value="merma">Mermas</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Buscar</label>
          <SearchBar onSearch={(q) => setQuery(q)} />
        </div>

        <div className="flex items-end">
          <RowsPerPageSelector
            onRowsChange={(v) => {
              setRowsPerPage(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto bg-white rounded shadow">
        <Table columns={columns} data={pageData} />
      </div>

      <div className="md:hidden space-y-4">
        {pageData.length === 0 && (
          <div className="text-sm text-gray-500">No hay datos</div>
        )}
        {pageData.map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">
                  {item.materiaPrima?.nombre ||
                    item.nombre_producto ||
                    "-"}
                </div>
                <div className="text-sm text-gray-500">
                  {item.materiaPrima?.categoria?.nombre || item.categoria || ""}
                </div>
              </div>
              <div className="text-sm text-right">
                <div className="font-medium">
                  {formatCantidadStock(item)}
                </div>
                <div className="text-xs text-gray-500">
                  {item.estado_stock || ""}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-700">
              <div>
                Precio/Costo:{" "}
                {item.precio_total
                  ? formatCLP(item.precio_total, 0)
                  : item.costo_total
                  ? formatCLP(item.costo_total, 0)
                  : "-"}
              </div>
              <div className="text-xs text-gray-500">
                Último movimiento:{" "}
                {item.ultimo_movimiento
                  ? new Date(item.ultimo_movimiento).toLocaleString()
                  : item.fecha_elaboracion
                  ? new Date(item.fecha_elaboracion).toLocaleString()
                  : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
