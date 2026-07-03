import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../../components/Tables/Table";
import SearchBar from "../../components/UI/SearchBar";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
import Pagination from "../../components/UI/Pagination";
import {
  ViewDetailButton,
  EditButton,
  TrashButton,
  ToggleActiveButton,
} from "../../components/Buttons/ActionButtons";
import { FileText } from "lucide-react";
import { fuzzyMatch } from "../../services/fuzzyMatch";
import {
  listarFormularios,
  eliminarFormulario,
  toggleActivoFormulario,
} from "../../services/calidad";
import { toast } from "../../lib/toast";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const formularioToSearchText = (f) =>
  [f.codigo, f.nombre, f.descripcion, f.frecuencia_esperada]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const TIPOS_FIRMA = {
  digital: "Digital",
  manual: "Manual",
  no_requiere: "No requiere",
};

export default function FormulariosList() {
  const navigate = useNavigate();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return formularios;
    return formularios.filter((f) =>
      fuzzyMatch(formularioToSearchText(f), searchQuery)
    );
  }, [formularios, searchQuery]);

  const pendientesCount = useMemo(
    () => formularios.filter((f) => !f.aprobado).length,
    [formularios]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);

  const columns = [
    { header: "Código", accessor: "codigo" },
    { header: "Nombre", accessor: "nombre" },
    {
      header: "Versión",
      accessor: "version",
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
    if (!canDeleteForms){
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
        entityName="formulario"
      />
    </div>
  );

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-text">Formularios de Calidad</h1>
        <div className="flex gap-2 items-center">
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
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
          >
            Nuevo Formulario
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-lg shadow flex justify-center">
          <Spinner size="lg"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <p className="text-gray-500 text-sm">
            {formularios.length === 0
              ? "Aún no hay formularios. Crea el primero."
              : "No se encontraron formularios que coincidan con la búsqueda."}
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
  );
}
