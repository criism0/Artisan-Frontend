import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import {
  BackButton,
  ViewDetailButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import {
  obtenerFormulario,
  listarRespuestas,
  eliminarRespuesta,
} from "../../services/calidad";
import { toast } from "../../lib/toast";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export default function RespuestasList() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [loading, setLoading] = useState(true);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canReadResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ);
  const canDeleteResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE);

  const cargar = async () => {
    if (!canReadForms || !canReadResponses) {
      toast.permissionError(
        [ModelType.FORMULARIO_CALIDAD, ScopeType.READ],
        [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [form, resp] = await Promise.all([
        obtenerFormulario(id),
        listarRespuestas(id),
      ]);
      setFormulario(form);
      setRespuestas(Array.isArray(resp) ? resp : []);
    } catch (err) {
      toast.error(err?.message || "Error al cargar respuestas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleEliminar = async (respuestaId) => {
    if (!canDeleteResponses) {
      toast.permissionError([ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE]);
      return;
    }
    try {
      await eliminarRespuesta(respuestaId);
      toast.success("Respuesta eliminada.");
      await cargar();
    } catch (err) {
      toast.error(err?.message || "No se pudo eliminar.");
    }
  };

  const columns = [
    { header: "ID", accessor: "id", sortable: true },
    {
      header: "Usuario",
      accessor: "id_usuario",
      sortable: true,
      Cell: ({ value }) => value ?? "—",
    },
    {
      header: "Completado en",
      accessor: "completado_en",
      sortable: true,
      sortValue: (row) => (row.completado_en ? new Date(row.completado_en).getTime() : 0),
      Cell: ({ value }) => formatoFecha(value),
    },
    {
      header: "Creado en",
      accessor: "created_at",
      sortable: true,
      sortValue: (row) => (row.created_at ? new Date(row.created_at).getTime() : 0),
      Cell: ({ value }) => formatoFecha(value),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      <ViewDetailButton
        onClick={() => navigate(`/calidad/respuestas/${row.id}`)}
        tooltipText="Ver / editar respuesta"
      />
      <TrashButton
        onConfirmDelete={() => handleEliminar(row.id)}
        tooltipText="Eliminar respuesta"
        entityName="respuesta"
      />
    </div>
  );

  return (
    <DataTable
      title={`Respuestas${formulario ? ` · ${formulario.nombre}` : ""}`}
      data={respuestas}
      columns={columns}
      actions={actions}
      getSearchText={(r) => [r.id, r.id_usuario, r.completado_en, r.created_at].filter(Boolean).join(" ")}
      loading={loading}
      loadingMessage="Cargando respuestas"
      initialSort={{ key: "created_at", direction: "desc" }}
      emptyMessage="Este formulario aún no tiene respuestas registradas."
      headerActions={
        <>
          <BackButton to="/calidad/formularios" />
          <button
            onClick={() => navigate(`/calidad/formularios/${id}/completar`)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover text-sm"
          >
            Nuevo registro
          </button>
        </>
      }
      toolbarStart={
        formulario ? (
          <span className="text-sm text-gray-500">
            {formulario.codigo} · v{formulario.version} · {respuestas.length} respuesta{respuestas.length === 1 ? "" : "s"}
          </span>
        ) : null
      }
    />
  );
}
