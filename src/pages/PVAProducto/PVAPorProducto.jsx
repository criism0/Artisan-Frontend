import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { ViewDetailButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function PVAPorProducto() {
  const api = useApi();
  const navigate = useNavigate();

  const [relaciones, setRelaciones] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canReadAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ);
  const canReadPVAProduct = checkScope(ModelType.PVA_PRODUCTO, ScopeType.READ);
  const canDeletePVAProduct = checkScope(ModelType.PVA_PRODUCTO, ScopeType.DELETE);

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadPVAProduct || !canReadAddedValueProcess) {
        toast.permissionError(
          [ModelType.PVA_PRODUCTO, ScopeType.READ],
          [ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]
        );
        setIsLoading(false);
        return;
      }
      try {
        const [relRes, procRes, matRes, prodRes] = await Promise.all([
          api(`/pva-por-producto`, { method: "GET" }),
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
          api(`/materias-primas`, { method: "GET" }),
          api(`/productos-base`, { method: "GET" }),
        ]);
        setRelaciones(relRes || []);
        setProcesos(procRes || []);
        setMateriasPrimas(matRes || []);
        setProductosBase(prodRes || []);
      } catch {
        toast.error("Error al cargar los datos de PVA por producto.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, canReadAddedValueProcess]);

  const getProcesoNombre = (id) => {
    const p = procesos.find((x) => x.id === id);
    return p ? p.descripcion : `#${id}`;
  };

  const getNombreProducto = (r) => {
    if (r.id_producto_base) {
      const p = productosBase.find((x) => x.id === r.id_producto_base);
      return p ? p.nombre : `Producto Comercial #${r.id_producto_base}`;
    }
    if (r.id_materia_prima) {
      const m = materiasPrimas.find((x) => x.id === r.id_materia_prima);
      return m ? m.nombre : `Materia Prima #${r.id_materia_prima}`;
    }
    return "—";
  };

  const handleDelete = async (id) => {
    if (!canDeletePVAProduct) {
      toast.permissionError([ModelType.PVA_PRODUCTO, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/pva-por-producto/${id}`, { method: "DELETE" });
      setRelaciones((prev) => prev.filter((r) => r.id !== id));
      toast.success("Relación eliminada correctamente.");
    } catch {
      toast.error("No se pudo eliminar la relación.");
    }
  };

  const columns = [
    { header: "Proceso", accessor: "id_proceso", sortable: true, sortValue: (r) => getProcesoNombre(r.id_proceso), Cell: ({ row }) => getProcesoNombre(row.id_proceso) },
    { header: "Producto Asociado", accessor: "producto", sortable: true, sortValue: (r) => getNombreProducto(r), Cell: ({ row }) => getNombreProducto(row) },
    { header: "Orden del PVA", accessor: "orden", sortable: true, align: "center", Cell: ({ row }) => <div className="text-center">{row.orden}</div> },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton onClick={() => navigate(`/PVAPorProducto/${row.id}`)} tooltipText="Ver Detalle" />
      <TrashButton onConfirmDelete={() => handleDelete(row.id)} tooltipText="Eliminar relación" entityName="PVA por producto" />
    </div>
  );

  return (
    <DataTable
      title="Relaciones PVA por Producto"
      data={relaciones}
      columns={columns}
      actions={actions}
      getSearchText={(r) => [getProcesoNombre(r.id_proceso), getNombreProducto(r), r.orden].join(" ")}
      loading={isLoading}
      loadingMessage="Cargando PVA por producto"
      emptyMessage="No hay relaciones PVA-Producto registradas."
      headerActions={
        <button
          onClick={() => navigate("/PVAPorProducto/agregar")}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          + Añadir Relación
        </button>
      }
    />
  );
}
