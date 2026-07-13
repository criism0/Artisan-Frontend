import DataTable from "../../components/Tables/DataTable";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function LotesList() {
  const [lotes, setLotes] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const canReadInProgress = checkScope(ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ);
  const canReadFinished = checkScope(ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ);

  const api = useApi();

  const toggleRow = (uid) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  useEffect(() => {
    if (!canReadInProgress && !canReadFinished) {
      toast.permissionError(
        [ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ],
        [ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ]
      );
      setIsLoading(false);
      setLotes([]);
      return;
    }
    const fetchData = async () => {
      try {
        const safeGet = async (path) => {
          try {
            const data = await api(path);
            const arr = Array.isArray(data?.lotes || data) ? data.lotes || data : [];
            return arr;
          } catch {
            // Si no hay registros, backend ahora debería devolver [], pero toleramos 404 antiguos.
            return [];
          }
        };

        if (!canReadInProgress) {
          toast.permissionError([ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ]);
        }
        if (!canReadFinished) {
          toast.permissionError([ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ]);
        }

        const requests = [
          canReadInProgress ? safeGet(`/lotes-producto-en-proceso/`) : Promise.resolve([]),
          canReadFinished ? safeGet(`/lotes-producto-final/`) : Promise.resolve([]),
        ];

        const [lotesPip, lotesFinal] = await Promise.all(requests);

        setLotes([
          ...lotesPip.map((l) => ({ ...l, __tipoLote: "PIP" })),
          ...lotesFinal.map((l) => ({ ...l, __tipoLote: "FINAL" })),
        ]);
      } catch (err) {
        toast.error("Error cargando lotes: " + (err?.message || ""));
        setLotes([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadInProgress, canReadFinished]);

  // Normalización de campos derivados (los ids de PIP y FINAL pueden coincidir,
  // por eso cada fila lleva un uid compuesto tipo-id)
  const normalized = useMemo(() => {
    return lotes.map((l) => {
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
      const numeroLote = l.numero_lote || l.codigo || primerIdentificador || `LOTE-${l.id}`;
      const nElaboracion = l.n_elaboracion || l.ordenManufactura?.id || l.id_orden_manufactura || "";
      const producto =
        l.productoBase?.nombre || l.producto?.nombre || l.materiaPrima?.nombre || l.producto_nombre || "";
      const fechaElab = l.fecha_elaboracion || l.fecha || l.ordenManufactura?.fecha || l.createdAt;

      return {
        ...l,
        uid: `${l.__tipoLote}-${l.id}`,
        numeroLote,
        nElaboracion,
        producto,
        cantidadInicial,
        cantidadActual,
        fechaElab,
      };
    });
  }, [lotes]);

  const columns = [
    {
      header: "",
      accessor: "expand",
      Cell: ({ row }) => (
        <button
          onClick={() => toggleRow(row.uid)}
          className="text-gray-500 hover:text-gray-700"
        >
          {expandedRows.has(row.uid) ? <ChevronDown /> : <ChevronRight />}
        </button>
      ),
    },
    {
      header: "N° Lote",
      accessor: "numeroLote",
      sortable: true,
      Cell: ({ row }) => (
        <Link
          className="font-medium text-primary hover:underline"
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
      header: "Tipo",
      accessor: "__tipoLote",
      sortable: true,
      Cell: ({ row }) => (row.__tipoLote === "FINAL" ? "Producto Final" : "PIP"),
    },
    {
      header: "Fecha de Elaboración",
      accessor: "fechaElab",
      sortable: true,
      sortValue: (row) => (row.fechaElab ? new Date(row.fechaElab).getTime() : 0),
      Cell: ({ row }) =>
        row.fechaElab ? new Date(row.fechaElab).toLocaleDateString("es-CL") : "",
    },
    { header: "N° Elaboración", accessor: "nElaboracion", sortable: true },
    { header: "Producto", accessor: "producto", sortable: true },
    {
      header: "Cantidad",
      accessor: "cantidadInicial",
      sortable: true,
      Cell: ({ row }) => (
        <div className="leading-tight">
          <div>Cantidad Inicial: {row.cantidadInicial}</div>
          <div>Cantidad Actual: {row.cantidadActual}</div>
        </div>
      ),
    },
  ];

  const renderExpandedRow = (row) => {
    if (!expandedRows.has(row.uid)) return null;
    return (
      <tr key={`${row.uid}-expanded`}>
        <td colSpan={columns.length} className="bg-gray-50 px-6 py-4">
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
              {row.fechaElab ? new Date(row.fechaElab).toLocaleString("es-CL") : ""}
            </div>
            <div>
              <span className="font-semibold">Peso Lote:</span> {row.peso ?? "--"}
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

  const getSearchText = (row) =>
    [
      row.numeroLote,
      row.nElaboracion,
      row.producto,
      row.__tipoLote === "FINAL" ? "Producto Final" : "PIP",
      row.fechaElab,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Lotes"
      data={normalized}
      columns={columns}
      getSearchText={getSearchText}
      renderExpandedRow={renderExpandedRow}
      loading={isLoading}
      loadingMessage="Cargando lotes"
      initialSort={{ key: "fechaElab", direction: "desc" }}
      emptyMessage="No hay lotes registrados."
    />
  );
}
