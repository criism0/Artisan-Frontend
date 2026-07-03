import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../../components/Tables/Table";
import Pagination from "../../components/UI/Pagination";
import RowsPerPageSelector from "../../components/UI/RowsPerPageSelector";
import SearchBar from "../../components/UI/SearchBar";
import {
  BackButton,
  ViewDetailButton,
} from "../../components/Buttons/ActionButtons";
import { fuzzyMatch } from "../../services/fuzzyMatch";
import { listarFormularios } from "../../services/calidad";
import { toast } from "../../lib/toast";
import { Spinner } from "../../components/UI/Spinner";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short" });
};

const toSearchText = (f) =>
  [f.codigo, f.nombre, f.descripcion, f.frecuencia_esperada]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function AprobacionFormularios() {
  const navigate = useNavigate();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
        const pendientes = (Array.isArray(data) ? data : []).filter(
          (f) => !f.aprobado
        );
        setFormularios(pendientes);
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
    return formularios.filter((f) => fuzzyMatch(toSearchText(f), searchQuery));
  }, [formularios, searchQuery]);

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
      header: "Creado",
      accessor: "created_at",
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

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <BackButton to="/calidad/formularios" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text">
            Aprobación de Formularios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Formularios pendientes de revisión. Revisa cada uno y apruébalo o
            recházalo.
          </p>
        </div>

        <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
          <RowsPerPageSelector
            onRowsChange={(v) => {
              setRowsPerPage(v);
              setCurrentPage(1);
            }}
          />
          <SearchBar
            onSearch={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
          />
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow flex justify-center">
            <Spinner size="md"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500 text-sm">
              {formularios.length === 0
                ? "No hay formularios pendientes de aprobación."
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
    </div>
  );
}
