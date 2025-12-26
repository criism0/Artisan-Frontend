import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../axiosInstance";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

export default function LotesList() {
  const [lotes, setLotes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const toggleRow = (id) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  const normalized = useMemo(() => {
    return filtered.map((l) => {
      const isFinal = l.__tipoLote === "FINAL";
      const bultos = Array.isArray(
        isFinal ? l.LoteProductoFinalBultos : l.LoteProductoEnProcesoBultos
      )
        ? isFinal
          ? l.LoteProductoFinalBultos
          : l.LoteProductoEnProcesoBultos
        : [];
      const cantidadInicial = bultos.reduce(
        (acc, b) => acc + (Number(b.cantidad_unidades) || 0),
        0
      );
      const cantidadActual = bultos.reduce(
        (acc, b) => acc + (Number(b.unidades_disponibles) || 0),
        0
      );
      const primerIdentificador = bultos[0]?.identificador;
      const numeroLote =
        l.numero_lote ||
        l.codigo ||
        primerIdentificador ||
        `LOTE-${l.id}`;
      const nElaboracion =
        l.n_elaboracion ||
        l.ordenManufactura?.id ||
        l.id_orden_manufactura ||
        "";
      const producto =
        l.productoBase?.nombre ||
        l.producto?.nombre ||
        l.materiaPrima?.nombre ||
        l.producto_nombre ||
        "";
      const fechaElab =
        l.fecha_elaboracion ||
        l.fecha ||
        l.ordenManufactura?.fecha ||
        l.createdAt;

      return {
        ...l,
        numeroLote,
        nElaboracion,
        producto,
        cantidadInicial,
        cantidadActual,
        fechaElab,
      };
    });
  }, [filtered]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;

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
    setCurrentPage(1);
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

  const columns = [
    {
      header: "",
      accessor: "expand",
      Cell: ({ row }) => (
        <button
          onClick={() => toggleRow(row.id)}
          className="text-gray-500 hover:text-gray-700"
        >
          {expandedRows.has(row.id) ? <FiChevronDown /> : <FiChevronRight />}
        </button>
      ),
    },
    {
      header: renderHeader("N° LOTE", "numeroLote"),
      accessor: "numeroLote",
      Cell: ({ row }) => (
        <Link
          className="font-medium text-primary-700 hover:underline"
          to={
            row.__tipoLote === "FINAL"
              ? `/lotes-producto-final/${row.id}`
              : `/lotes-producto-en-proceso/${row.id}`
          }
        >
          {row.numeroLote}
        </Link>
      ),
    },
    {
      header: renderHeader("TIPO", "__tipoLote"),
      accessor: "__tipoLote",
      Cell: ({ row }) => (row.__tipoLote === "FINAL" ? "Producto Final" : "PIP"),
    },
    {
      header: renderHeader("FECHA DE ELABORACIÓN", "fechaElab"),
      accessor: "fechaElab",
      Cell: ({ row }) =>
        row.fechaElab
          ? new Date(row.fechaElab).toLocaleDateString("es-CL")
          : "",
    },
    {
      header: renderHeader("N° ELABORACIÓN", "nElaboracion"),
      accessor: "nElaboracion",
    },
    {
      header: renderHeader("PRODUCTO", "producto"),
      accessor: "producto",
    },
    {
      header: renderHeader("CANTIDAD", "cantidadInicial"),
      accessor: "cantidadInicial",
      Cell: ({ row }) => (
        <div className="leading-tight">
          <div>Cantidad Inicial: {row.cantidadInicial}</div>
          <div>Cantidad Actual: {row.cantidadActual}</div>
        </div>
      ),
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = import.meta.env.VITE_BACKEND_URL;
        const safeGet = async (url) => {
          try {
            const { data } = await axiosInstance.get(url);
            const arr = Array.isArray(data?.lotes || data) ? data.lotes || data : [];
            return arr;
          } catch {
            // Si no hay registros, backend ahora debería devolver [], pero toleramos 404 antiguos.
            return [];
          }
        };

        const [lotesPip, lotesFinal] = await Promise.all([
          safeGet(`${base}/lotes-producto-en-proceso/`),
          safeGet(`${base}/lotes-producto-final/`),
        ]);

        const merged = [
          ...lotesPip.map((l) => ({ ...l, __tipoLote: "PIP" })),
          ...lotesFinal.map((l) => ({ ...l, __tipoLote: "FINAL" })),
        ].sort((a, b) => {
          const aDate = new Date(a.fecha_elaboracion || a.createdAt || 0).getTime();
          const bDate = new Date(b.fecha_elaboracion || b.createdAt || 0).getTime();
          return bDate - aDate;
        });

        setLotes(merged);
        setFiltered(merged);
      } catch (err) {
        console.error("Error cargando lotes:", err);
        setLotes([]);
        setFiltered([]);
      }
    };
    fetchData();
  }, []);

  const handleSearch = (query) => {
    const q = (query || "").toLowerCase().trim();
    if (!q) {
      setFiltered(lotes);
      setCurrentPage(1);
      return;
    }

    const filteredRes = lotes.filter((l) => {
      const isFinal = l.__tipoLote === "FINAL";
      const bultos = Array.isArray(
        isFinal ? l.LoteProductoFinalBultos : l.LoteProductoEnProcesoBultos
      )
        ? isFinal
          ? l.LoteProductoFinalBultos
          : l.LoteProductoEnProcesoBultos
        : [];
      const primerIdentificador = bultos[0]?.identificador || "";

      const texto = [
        l.id,
        l.numero_lote,
        l.codigo,
        primerIdentificador,
        l.ordenManufactura?.id,
        l.id_orden_manufactura,
        l.materiaPrima?.nombre,
        l.productoBase?.nombre,
        l.producto?.nombre,
        l.__tipoLote,
        l.fecha_elaboracion,
        l.fecha,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(q);
    });

    setFiltered(filteredRes);
    setCurrentPage(1);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(normalized.length / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageData = normalized.slice(startIndex, startIndex + rowsPerPage);

  const renderExpandedRow = (row) => {
    if (!expandedRows.has(row.id)) return null;
    return (
      <tr key={`${row.id}-expanded`}>
        <td colSpan={columns.length + 1} className="bg-gray-50 px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-semibold">OM:</span> {row.nElaboracion}
            </div>
            <div>
              <span className="font-semibold">Producto:</span> {row.producto}
            </div>
            <div>
              <span className="font-semibold">Tipo:</span>{" "}
              {row.__tipoLote === "FINAL" ? "Producto Final" : "PIP"}
            </div>
            <div>
              <span className="font-semibold">Fecha Elab.:</span>{" "}
              {row.fechaElab
                ? new Date(row.fechaElab).toLocaleString("es-CL")
                : ""}
            </div>
            <div>
              <span className="font-semibold">Peso Lote:</span>{" "}
              {row.peso ?? "--"}
            </div>
          </div>

          <div className="mt-4">
            <Link
              to={
                row.__tipoLote === "FINAL"
                  ? `/lotes-producto-final/${row.id}`
                  : `/lotes-producto-en-proceso/${row.id}`
              }
              className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 shadow"
            >
              Ver detalle
            </Link>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lotes</h1>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      <Table
        columns={columns}
        data={pageData}
        renderExpandedRow={renderExpandedRow}
      />

      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
