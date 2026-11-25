import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

function SiNo({ value }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
      {value ? "Sí" : "No"}
    </span>
  );
}

export default function ProcesosValorAgregado() {
  const navigate = useNavigate();
  const api = useApi();
  const [pvas, setPvas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canReadAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ);
  const canDeleteAddedValueProcess = checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.DELETE);

  /** Borrar se confirma en el mismo botón (antes abría una página aparte que volvía a preguntar). */
  const eliminar = async (row) => {
    if (!canDeleteAddedValueProcess) {
      toast.permissionError([ModelType.PROCESO_VALOR_AGREGADO, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/procesos-de-valor-agregado/${row.id}`, { method: "DELETE" });
      setPvas((prev) => prev.filter((p) => p.id !== row.id));
      toast.success("Proceso de valor agregado eliminado.");
    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error(err?.message || "No se pudo eliminar el proceso.");
    }
  };

  useEffect(() => {
    const fetchPvas = async () => {
      if (!canReadAddedValueProcess) {
        toast.permissionError([ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await api(`/procesos-de-valor-agregado`, { method: "GET" });
        setPvas(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error("Error fetching pvas:", err);
        toast.error("No se pudo conectar al servidor. Verifica la conexión.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPvas();
  }, [api, canReadAddedValueProcess]);

  const columns = [
    { header: "Nombre", accessor: "descripcion", sortable: true },
    { header: "Costo estimado", accessor: "costo_estimado", sortable: true, Cell: ({ row }) => row.costo_estimado ?? "—" },
    {
      header: "Tiempo estimado",
      accessor: "tiempo_estimado",
      sortable: true,
      Cell: ({ row }) => (row.tiempo_estimado ? `${row.tiempo_estimado} ${row.unidad_tiempo || ""}` : "—"),
    },
    { header: "Tiene pasos", accessor: "tiene_pasos", align: "center", Cell: ({ row }) => <div className="flex justify-center"><SiNo value={row.tiene_pasos} /></div> },
    { header: "Genera bultos", accessor: "genera_bultos_nuevos", align: "center", Cell: ({ row }) => <div className="flex justify-center"><SiNo value={row.genera_bultos_nuevos} /></div> },
    { header: "Utiliza insumos", accessor: "utiliza_insumos", align: "center", Cell: ({ row }) => <div className="flex justify-center"><SiNo value={row.utiliza_insumos} /></div> },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/catalogo/procesos-valor-agregado/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/catalogo/procesos-valor-agregado/${row.id}/editar`)} tooltipText="Editar Proceso" />
      <TrashButton
        onConfirmDelete={() => eliminar(row)}
        tooltipText="Eliminar Proceso Valor Agregado"
        entityName="proceso valor agregado"
      />
    </div>
  );

  return (
    <DataTable
      title="Procesos de Valor Agregado"
      data={pvas}
      columns={columns}
      actions={actions}
      getSearchText={(p) => [p.descripcion, p.costo_estimado, p.tiempo_estimado].join(" ")}
      loading={isLoading}
      loadingMessage="Cargando procesos de valor agregado"
      defaultRowsPerPage={25}
      emptyMessage="No hay procesos de valor agregado registrados."
      headerActions={
        <button
          className="btn btn-primario"
          onClick={() => navigate("/catalogo/procesos-valor-agregado/nuevo")}
        >
          Añadir Proceso
        </button>
      }
    />
  );
}
