import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import {
  BackButton,
  ViewDetailButton,
} from "../../components/Buttons/ActionButtons";
import { listarFormularios } from "../../services/calidad";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short" });
};

export default function AprobacionFormularios() {
  const navigate = useNavigate();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);

  useEffect(() => {
    if (!canReadForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listarFormularios()
      .then((data) => {
        if (cancelled) return;
        const pendientes = (Array.isArray(data) ? data : []).filter((f) => !f.aprobado);
        setFormularios(pendientes);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err?.message || "Error al cargar formularios.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { header: "Código", accessor: "codigo", sortable: true },
    { header: "Nombre", accessor: "nombre", sortable: true },
    {
      header: "Versión",
      accessor: "version",
      sortable: true,
      Cell: ({ value }) => `v${value}`,
    },
    {
      header: "Frecuencia",
      accessor: "frecuencia_esperada",
      Cell: ({ value }) => value || "—",
    },
    {
      header: "Creado",
      accessor: "created_at",
      sortable: true,
      sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
      Cell: ({ value }) => formatoFecha(value),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      <ViewDetailButton
        onClick={() => navigate(`/calidad/formularios/aprobaciones/${row.id}`)}
        tooltipText="Revisar formulario"
      />
    </div>
  );

  const getSearchText = (f) =>
    [f.codigo, f.nombre, f.descripcion, f.frecuencia_esperada].filter(Boolean).join(" ");

  return (
    <DataTable
      title="Aprobación de Formularios"
      data={formularios}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      loading={loading}
      loadingMessage="Cargando formularios"
      initialSort={{ key: "created_at", direction: "desc" }}
      emptyMessage="No hay formularios pendientes de aprobación."
      headerActions={<BackButton to="/calidad/formularios" />}
      toolbarStart={
        <span className="text-sm text-gray-500">
          Pendientes de revisión: apruébalos o recházalos desde el detalle.
        </span>
      }
    />
  );
}
