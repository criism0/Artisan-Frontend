import { ViewDetailButton, EditButton, ToggleActiveButton, BackButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import HeaderConTooltip from "../../components/Tables/HeaderConTooltip";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { fuzzyMatch, insumoToSearchText } from "../../services/fuzzyMatch";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function PIPList() {
  const [pipItems, setPIPItems] = useState([]);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const api = useApi();

  const canWriteRawMaterial = checkScope(ModelType.MATERIA_PRIMA, ScopeType.WRITE);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchPIPItems = async () => {
      try {
        const response = await api(`/materias-primas/buscar-categoria?nombre=PIP`);
        const raw = response || [];
        // Normalizar shape para reusar lógica de Insumos (categoria)
        const normalized = Array.isArray(raw)
          ? raw.map((x) => ({
            ...x,
            categoria: x?.categoria || x?.CategoriaMateriaPrima || null,
          }))
          : [];

        setPIPItems(normalized);
      } catch (error) {
        console.error("Error fetching PIP items:", error);
        toast.error("Error al cargar PIPs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPIPItems();
  }, []);

  const handleToggleActivePip = async (id) => {
    if (!canWriteRawMaterial) {
      toast.permissionError([ModelType.MATERIA_PRIMA, ScopeType.WRITE]);
      return;
    }
    try {
      const updated = await api(`/materias-primas/${id}/toggle-active`, { method: "PUT" });
      setPIPItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, activo: updated.activo } : i))
      );
    } catch (error) {
      toast.error("Error activando/desactivando PIP");
      console.error(error);
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
      header: (
        <HeaderConTooltip
          label="Stock Crítico"
          tooltip="Cuando el inventario de este PIP sea igual o menor a este número, el sistema generará una alerta de bajo stock."
        />
      ),
      accessor: "stock_critico",
      sortable: true,
    },
    {
      header: (
        <HeaderConTooltip
          label="Semanas de Seguridad"
          tooltip="Semanas de anticipación con las que se debe generar la compra de este PIP, de modo que la nueva reposición llegue antes de que el stock caiga por debajo del stock crítico."
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
        entityName={row.nombre || "PIP"}
        onToggleActive={() => handleToggleActivePip(row.id)}
      />
    </div>
  );

  const data = useMemo(
    () => (showOnlyActive ? pipItems.filter((i) => i.activo === true) : pipItems),
    [pipItems, showOnlyActive]
  );

  return (
    <DataTable
      title="Productos en Proceso (PIP)"
      data={data}
      columns={columns}
      actions={actions}
      filterFn={(row, q) => fuzzyMatch(insumoToSearchText(row), q)}
      loading={isLoading}
      loadingMessage="Cargando PIPs"
      emptyMessage="No hay PIPs registrados."
      headerActions={
        <>
          <BackButton to={`/InsumosPIPProductos`} />
          <button
            className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
            onClick={() => navigate("/Insumos")}
          >
            Ver Insumos
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
