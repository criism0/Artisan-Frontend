import { ViewDetailButton, EditButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatRutDisplay, toTitleCaseES, formatPhoneDisplay } from "../../services/formatHelpers";
import { toast } from "../../lib/toast";
import { useApi } from "../../lib/api";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

function EstadoChip({ activo }) {
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        activo ? "bg-green-100 text-green-800" : "bg-red-200 text-red-800"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

export default function ProveedoresPage() {
  const api = useApi();
  const [proveedores, setProveedores] = useState([]);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const canReadProvider = checkScope(ModelType.PROVEEDOR, ScopeType.READ);

  useEffect(() => {
    const fetchProveedores = async () => {
      if (!canReadProvider) {
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const response = await api(`/proveedores`, { method: "GET" });
        const normalized = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : response?.data?.proveedores || [];
        setProveedores(normalized);
      } catch (error) {
        toast.error("Error fetching providers:" + error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProveedores();
  }, [canReadProvider]);

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre_empresa",
      sortable: true,
      Cell: ({ row }) => toTitleCaseES(row.nombre_empresa),
    },
    {
      header: "RUT",
      accessor: "rut_empresa",
      Cell: ({ row }) => formatRutDisplay(row.rut_empresa),
    },
    {
      header: "Teléfono",
      accessor: "telefono",
      Cell: ({ row }) => formatPhoneDisplay(row.telefono),
    },
    {
      header: "Email",
      accessor: "email_transferencia",
      Cell: ({ row }) => String(row.email_transferencia || "").toLowerCase(),
    },
    {
      header: "Tipo Proveedor",
      accessor: "tipo_proveedor",
      sortable: true,
      Cell: ({ row }) => String(row.tipo_proveedor || ""),
    },
    {
      header: "Estado",
      accessor: "activo",
      sortable: true,
      align: "center",
      Cell: ({ row }) => (
        <div className="flex justify-center">
          <EstadoChip activo={row.activo === true} />
        </div>
      ),
    },
  ];

  const data = useMemo(
    () => (showOnlyActive ? proveedores.filter((p) => p.activo === true) : proveedores),
    [proveedores, showOnlyActive]
  );

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Proveedores/${row.id}`)} tooltipText="Ver Detalle" />
      <EditButton onClick={() => navigate(`/Proveedores/${row.id}/edit`)} tooltipText="Editar Proveedor" />
    </div>
  );

  const getSearchText = (p) =>
    [p.nombre_empresa, p.rut_empresa, p.telefono, p.email_transferencia, p.tipo_proveedor].join(" ");

  return (
    <DataTable
      title="Proveedores"
      data={data}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando proveedores"
      defaultRowsPerPage={20}
      emptyMessage="No hay proveedores registrados."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Proveedores/add")}
          aria-label="Añadir Proveedor"
        >
          Añadir Proveedor
        </button>
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
            <div className={`block w-14 h-8 rounded-full transition-colors ${showOnlyActive ? "bg-primary" : "bg-gray-300"}`}>
              <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${showOnlyActive ? "transform translate-x-6" : ""}`} />
            </div>
          </div>
        </label>
      }
    />
  );
}
