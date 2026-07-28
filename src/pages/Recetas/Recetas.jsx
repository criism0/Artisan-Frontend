import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatCLP } from "../../services/formatHelpers";

function getRecipeTypeLabel(r) {
  if (r?.tipo) return String(r.tipo);
  if (r?.id_producto_base != null) return "Producto terminado";
  if (r?.id_materia_prima != null) return "PIP";
  return "—";
}

function getProducesLabel(r) {
  const producto = r?.productoBase?.nombre;
  if (producto) return producto;
  const mp = r?.materiaPrima?.nombre;
  if (mp) return mp;
  if (r?.id_producto_base != null) return `Producto #${r.id_producto_base}`;
  if (r?.id_materia_prima != null) return `MP #${r.id_materia_prima}`;
  return "—";
}

function getPautaLabel(r) {
  const name = r?.pautaElaboracion?.name;
  if (name) return name;
  if (r?.id_pauta_elaboracion != null) return `Pauta #${r.id_pauta_elaboracion}`;
  return "Sin pauta";
}

export default function RecetasPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [recetas, setRecetas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const canDeleteRecipe = checkScope(ModelType.RECETA, ScopeType.DELETE);

  useEffect(() => {
    const fetchRecetas = async () => {
      try {
        const response = await api(`/recetas`, { method: "GET" });
        setRecetas(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error("Error fetching recetas:", err);
        toast.error("No se pudieron cargar las recetas");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecetas();
  }, [api]);

  const columns = [
    {
      header: "Receta",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => (
        <div className="max-w-[320px] truncate" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
      sortable: true,
      sortValue: (row) => getRecipeTypeLabel(row),
      Cell: ({ row }) => (
        <span className="px-2 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-700 whitespace-nowrap">
          {getRecipeTypeLabel(row)}
        </span>
      ),
    },
    {
      header: "Produce",
      accessor: "id_producto_base",
      sortable: true,
      sortValue: (row) => getProducesLabel(row),
      Cell: ({ row }) => (
        <div className="max-w-[260px] truncate" title={getProducesLabel(row)}>
          {getProducesLabel(row)}
        </div>
      ),
    },
    {
      header: "Pauta",
      accessor: "id_pauta_elaboracion",
      sortable: true,
      sortValue: (row) => getPautaLabel(row),
      Cell: ({ row }) => (
        <div className="max-w-[220px] truncate" title={getPautaLabel(row)}>
          {getPautaLabel(row)}
        </div>
      ),
    },
    {
      header: "Rendimiento",
      accessor: "peso",
      sortable: true,
      Cell: ({ row }) => {
        const peso = row?.peso;
        const unidad = row?.unidad_medida;
        if (peso == null || unidad == null) return "—";
        return `${peso} ${unidad}`;
      },
    },
    {
      header: "Costo ref.",
      accessor: "costo_referencial_produccion",
      sortable: true,
      align: "right",
      Cell: ({ value }) => formatCLP(value, 0),
    },
  ];

  const handleDelete = async (idReceta) => {
    if (!canDeleteRecipe) {
      toast.permissionError([ModelType.RECETA, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/recetas/${idReceta}`, { method: "DELETE" });
      setRecetas((prev) => prev.filter((r) => r.id !== idReceta));
      toast.success("Receta eliminada correctamente");
    } catch (err) {
      console.error("Error deleting receta:", err);
      toast.error("Ocurrió un error al eliminar la receta.");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Recetas/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Recetas/${row.id}/edit`)} tooltipText="Editar Receta" />
      <TrashButton
        onConfirmDelete={() => handleDelete(row.id)}
        tooltipText="Eliminar Receta"
        entityName={`receta ${row.nombre || ""}`}
      />
    </div>
  );

  const getSearchText = (r) =>
    [
      r?.nombre,
      getRecipeTypeLabel(r),
      getProducesLabel(r),
      getPautaLabel(r),
      r?.peso,
      r?.unidad_medida,
    ]
      .filter((v) => v != null)
      .join(" ");

  return (
    <DataTable
      title="Recetas"
      data={recetas}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando recetas"
      defaultRowsPerPage={25}
      initialSort={{ key: "nombre", direction: "asc" }}
      emptyMessage="No hay recetas registradas."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Recetas/add")}
        >
          Añadir Receta
        </button>
      }
    />
  );
}
