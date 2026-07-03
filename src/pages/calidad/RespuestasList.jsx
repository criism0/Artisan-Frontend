import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Table from "../../components/Tables/Table";
import Pagination from "../../components/UI/Pagination";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
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
import { Spinner } from "../../components/UI/Spinner";
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
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);
  const canReadResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ);
  const canDeleteResponses = checkScope(ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.DELETE);

  const cargar = async () => {
    if (!canReadForms || !canReadResponses) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ], [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]);
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

  const totalPages = Math.max(1, Math.ceil(respuestas.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginated = useMemo(
    () => respuestas.slice(startIndex, startIndex + rowsPerPage),
    [respuestas, startIndex, rowsPerPage]
  );

  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "Usuario",
      accessor: "id_usuario",
      Cell: ({ value }) => value ?? "—",
    },
    {
      header: "Completado en",
      accessor: "completado_en",
      Cell: ({ value }) => formatoFecha(value),
    },
    {
      header: "Creado en",
      accessor: "created_at",
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
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <BackButton to="/calidad/formularios" />
          <button
            onClick={() => navigate(`/calidad/formularios/${id}/completar`)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
          >
            Nuevo registro
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">
            Respuestas {formulario ? `· ${formulario.nombre}` : ""}
          </h1>
          {formulario && (
            <p className="text-sm text-gray-500 mt-1">
              {formulario.codigo} · v{formulario.version}
            </p>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <RowsPerPageSelector
            onRowsChange={(v) => {
              setRowsPerPage(v);
              setCurrentPage(1);
            }}
          />
          <p className="text-sm text-gray-500">
            Total: {respuestas.length} respuesta{respuestas.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow flex justify-center">
            <Spinner size="md"/>
          </div>
        ) : respuestas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500 text-sm">
              Este formulario aún no tiene respuestas registradas.
            </p>
          </div>
        ) : (
          <>
            <Table columns={columns} data={paginated} actions={actions} />
            <div className="mt-6 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
