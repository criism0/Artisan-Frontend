import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import DataTable from "../../components/Tables/DataTable";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import Selector from "../../components/Forms/Selector";
import { formatCLP } from "../../services/formatHelpers";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function CostoMarginalList() {
  const api = useApi();
  const navigate = useNavigate();
  const [bodegas, setBodegas] = useState([]);
  const [bodegaFilter, setBodegaFilter] = useState(0);
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canReadMarginalCost = checkScope(ModelType.COSTO_MARGINAL, ScopeType.READ);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const b = await api("/bodegas");
        const list = Array.isArray(b?.bodegas) ? b.bodegas : Array.isArray(b) ? b : [];
        setBodegas(list);
      } catch {
        setBodegas([]);
      }
    };
    fetchBodegas();
     
  }, [api]);

  // Los filtros de tipo/bodega se resuelven en el server
  useEffect(() => {
    const fetchData = async () => {
      if (!canReadMarginalCost) {
        toast.permissionError([ModelType.COSTO_MARGINAL, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (bodegaFilter && +bodegaFilter > 0) params.set("id_bodega", bodegaFilter);
        if (tipoFilter && tipoFilter !== "todos") params.set("tipo", tipoFilter);
        const qs = params.toString() ? `?${params}` : "";
        const res = await api(`/costo-marginal${qs}`);
        setItems(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Error fetching costo marginal:", err);
        toast.error("No se pudo cargar el costo marginal");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [bodegaFilter, tipoFilter, api, canReadMarginalCost]);

  const columns = [
    {
      header: "Lote - Tipo",
      accessor: "lote_tipo",
      sortable: true,
      sortValue: (row) => `${row.lote ?? row.id ?? ""}`,
      Cell: ({ row }) => `${row.lote ?? row.id ?? "-"} - ${row.tipo ?? "-"}`,
    },
    {
      header: "Nombre",
      accessor: "nombre_producto",
      sortable: true,
      sortValue: (row) => row.productoBase?.nombre || row.materiaPrima?.nombre || "",
      Cell: ({ row }) => row.productoBase?.nombre || row.materiaPrima?.nombre || "-",
    },
    {
      header: "Bodega",
      accessor: "bodega",
      sortable: true,
      sortValue: (row) => {
        const idB = row?.orden?.id_bodega ?? row.id_bodega ?? row.idBodega ?? null;
        const b = bodegas.find((x) => String(x.id) === String(idB));
        return b?.nombre || "";
      },
      Cell: ({ row }) => {
        const idB = row?.orden?.id_bodega ?? row.id_bodega ?? row.idBodega ?? null;
        const b = bodegas.find((x) => (x.id ?? x._id) === idB || String(x.id) === String(idB));
        return b ? b.nombre : (idB ? `#${idB}` : "-");
      },
    },
    {
      header: "Costo total",
      accessor: "costo",
      sortable: true,
      align: "right",
      Cell: ({ value }) => (value == null ? "-" : formatCLP(Number(value), 0)),
    },
  ];

  const actions = (row) => (
    <ViewDetailButton
      onClick={() => navigate(`/CostoMarginal/${row.tipo}/${row.id}`)}
      tooltipText="Ver detalle"
    />
  );

  const tipoOptions = useMemo(
    () => [
      { value: "todos", label: "Todos" },
      { value: "ProductoFinal", label: "Producto Final" },
      { value: "ProductoEnProceso", label: "Producto en Proceso (PIP)" },
    ],
    []
  );

  const bodegaOptions = useMemo(() => {
    const base = [{ value: 0, label: "Todas" }];
    const opts = bodegas
      .filter((b) => (b.nombre || "").toLowerCase() !== "en tránsito")
      .map((b) => ({ value: b.id ?? b._id, label: b.nombre }));
    return base.concat(opts);
  }, [bodegas]);

  const getSearchText = (row) =>
    [
      row.lote ?? row.id,
      row.tipo,
      row.productoBase?.nombre,
      row.materiaPrima?.nombre,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Costo Marginal"
      data={items}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando costo marginal"
      emptyMessage="No hay valores que cumplan con esos filtros."
      filters={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <Selector
              options={tipoOptions}
              selectedValue={tipoFilter}
              onSelect={(v) => setTipoFilter(v)}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bodega</label>
            <Selector
              options={bodegaOptions}
              selectedValue={String(bodegaFilter)}
              onSelect={(v) => setBodegaFilter(v)}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      }
    />
  );
}
