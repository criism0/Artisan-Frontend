import { ViewDetailButton, EditButton, ToggleActiveButton, BackButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fuzzyMatch, insumoToSearchText } from "../../services/fuzzyMatch";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import HeaderConTooltip from "../../components/Tables/HeaderConTooltip";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState([]);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const api = useApi();

  const canWriteRawMaterial = checkScope(ModelType.MATERIA_PRIMA, ScopeType.WRITE);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        const response = await api(`/materias-primas`);
        setInsumos(Array.isArray(response) ? response : []);
      } catch (error) {
        toast.error(`Error fetching insumos: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsumos();
  }, []);

  const handleToggleActiveInsumo = async (id) => {
    if (!canWriteRawMaterial) {
      toast.permissionError([ModelType.MATERIA_PRIMA, ScopeType.WRITE]);
      return;
    }

    try {
      const updated = await api(`/materias-primas/${id}/toggle-active`, { method: "PUT" });
      setInsumos(prev =>
        prev.map(insumo =>
          insumo.id === id
            ? { ...insumo, activo: updated.activo }
            : insumo
        )
      );
    } catch (error) {
      toast.error(`Error activando/desactivando insumo: ${error.message}`);
    }
  };

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => <span className="font-medium">{value || "—"}</span>,
    },
    { header: "Unidad de Medida", accessor: "unidad_medida", sortable: true },
    {
      header: "Categoría",
      accessor: "categoria",
      sortable: true,
      sortValue: (row) => row.categoria?.nombre || "",
      Cell: ({ value }) => value?.nombre || "Sin categoría",
    },
    {
      header: (
        <HeaderConTooltip
          label="Stock Crítico"
          tooltip="Cuando el inventario de este insumo sea igual o menor a este número, el sistema generará una alerta de bajo stock."
        />
      ),
      accessor: "stock_critico",
      sortable: true,
    },
    {
      header: (
        <HeaderConTooltip
          label="Semanas de Seguridad"
          tooltip="Semanas de anticipación con las que se debe generar la compra de este insumo, de modo que la nueva reposición llegue antes de que el stock caiga por debajo del stock crítico."
        />
      ),
      accessor: "semanas_seguridad",
      sortable: true,
      Cell: ({ value }) => (value == null ? "—" : value),
    },
    {
      header: "Estado",
      accessor: "activo",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.activo ? 1 : 0),
      Cell: ({ value }) => (
        <div className="flex justify-center">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {value ? "Activo" : "Inactivo"}
          </span>
        </div>
      ),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Insumos/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/Insumos/${row.id}/edit`)}
        tooltipText="Editar Insumo"
      />
      <ToggleActiveButton
        isActive={row.activo}
        entityName={row.nombre || "Insumo"}
        onToggleActive={() => handleToggleActiveInsumo(row.id)}
      />
    </div>
  );

  const data = useMemo(
    () => (showOnlyActive ? insumos.filter((i) => i.activo === true) : insumos),
    [insumos, showOnlyActive]
  );

  return (
    <DataTable
      title="Insumos"
      data={data}
      columns={columns}
      actions={actions}
      filterFn={(row, q) => fuzzyMatch(insumoToSearchText(row), q)}
      loading={isLoading}
      loadingMessage="Cargando insumos"
      emptyMessage="No hay insumos registrados."
      headerActions={
        <>
          <BackButton to="/Home" />
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Insumos/add")}
          >
            Añadir Insumo
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Insumos/asociar")}
          >
            Asociar Insumo
          </button>
          <button
            className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
            onClick={() => navigate("/Insumos/Categorias")}
          >
            Ver Categorías
          </button>
        </>
      }
      toolbarStart={
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-700">Solo activos</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={() => setShowOnlyActive((v) => !v)}
              className="sr-only"
            />
            <div
              className={`block w-14 h-8 rounded-full transition-colors ${
                showOnlyActive ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                  showOnlyActive ? "transform translate-x-6" : ""
                }`}
              />
            </div>
          </div>
        </label>
      }
    />
  );
}
