import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import {
  ViewDetailButton,
  EditButton,
  TrashButton,
  ToggleActiveButton,
} from "../../components/Buttons/ActionButtons";
import { FileText } from "lucide-react";
import {
  listarFormularios,
  eliminarFormulario,
  toggleActivoFormulario,
} from "../../services/calidad";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const TIPOS_FIRMA = {
  digital: "Digital",
  manual: "Manual",
  no_requiere: "No requiere",
};

export default function FormulariosList() {
  const navigate = useNavigate();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canUpdateForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE);
  const canDeleteForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.DELETE);

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
        if (!cancelled) setFormularios(Array.isArray(data) ? data : []);
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

  const pendientesCount = useMemo(
    () => formularios.filter((f) => !f.aprobado).length,
    [formularios]
  );

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
      header: "Tipo firma",
      accessor: "tipo_firma",
      Cell: ({ value }) => TIPOS_FIRMA[value] ?? value ?? "—",
    },
    {
      header: "Estado",
      accessor: "activo",
      sortable: true,
      sortValue: (row) => (!row.activo ? 0 : row.aprobado ? 2 : 1),
      Cell: ({ row }) => {
        if (!row.activo) {
          return (
            <span className="px-2 py-1 rounded-full text-xs bg-gray-200 text-gray-700">
              Inactivo
            </span>
          );
        }
        if (row.aprobado) {
          return (
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
              Aprobado
            </span>
          );
        }
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
            Borrador
          </span>
        );
      },
    },
  ];

  const refrescar = async () => {
    if (!canReadForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ]);
      return;
    }
    try {
      const data = await listarFormularios();
      setFormularios(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.message || "Error al recargar formularios.");
    }
  };

  const handleEliminar = async (id) => {
    if (!canDeleteForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.DELETE]);
      return;
    }
    try {
      await eliminarFormulario(id);
      toast.success("Formulario eliminado.");
      await refrescar();
    } catch (err) {
      toast.error(err?.message || "No se pudo eliminar.");
    }
  };

  const handleToggleActivo = async (id) => {
    if (!canUpdateForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE]);
      return;
    }
    await toggleActivoFormulario(id);
    await refrescar();
  };

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      {row.activo && row.aprobado && (
        <ViewDetailButton
          onClick={() => navigate(`/calidad/formularios/${row.id}/completar`)}
          tooltipText="Completar formulario"
        />
      )}
      {row.activo && row.aprobado && (
        <button
          onClick={() => navigate(`/calidad/formularios/${row.id}/respuestas`)}
          className="text-blue-600 hover:text-blue-700"
          title="Ver respuestas"
        >
          <FileText className="w-5 h-5" />
        </button>
      )}
      <EditButton
        onClick={() => navigate(`/calidad/formularios/${row.id}/edit`)}
        tooltipText="Editar formulario"
      />
      <ToggleActiveButton
        isActive={!!row.activo}
        onToggleActive={() => handleToggleActivo(row.id)}
        entityName="formulario"
      />
      <TrashButton
        onConfirmDelete={() => handleEliminar(row.id)}
        tooltipText="Eliminar formulario"
        entityName={`formulario ${row.nombre || ""}`}
      />
    </div>
  );

  const getSearchText = (f) =>
    [f.codigo, f.nombre, f.descripcion, f.frecuencia_esperada].filter(Boolean).join(" ");

  return (
    <DataTable
      title="Formularios de Calidad"
      data={formularios}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      loading={loading}
      loadingMessage="Cargando formularios"
      initialSort={{ key: "codigo", direction: "asc" }}
      emptyMessage="Aún no hay formularios. Crea el primero."
      headerActions={
        <>
          <button
            onClick={() => navigate("/calidad/formularios/aprobaciones")}
            className="px-4 py-2 border border-yellow-400 text-yellow-800 bg-yellow-50 rounded-lg hover:bg-yellow-100 text-sm flex items-center gap-2"
          >
            Aprobaciones pendientes
            {pendientesCount > 0 && (
              <span className="bg-yellow-400 text-yellow-900 text-xs font-semibold rounded-full px-2 py-0.5">
                {pendientesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/calidad/formularios/nuevo")}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover text-sm"
          >
            Nuevo Formulario
          </button>
        </>
      }
    />
  );
}
