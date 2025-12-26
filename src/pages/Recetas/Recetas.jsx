import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";

function formatMoneyCL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

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

function recipeToSearchText(r) {
  return [
    r?.id,
    r?.nombre,
    getRecipeTypeLabel(r),
    getProducesLabel(r),
    r?.peso,
    r?.unidad_medida,
    getPautaLabel(r),
    r?.costo_referencial_produccion,
  ]
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join(" ");
}

export default function RecetasPage() {
  const navigate = useNavigate();
  const api = useApi();
  const [recetas, setRecetas] = useState([]);
  const [filteredRecetas, setFilteredRecetas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    const fetchRecetas = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api(`/recetas`, { method: "GET" });
        const sorted = response.sort((a, b) => a.id - b.id);
        setRecetas(sorted);
        setFilteredRecetas(sorted);
      } catch (err) {
        console.error("Error fetching recetas:", err);
        setError("No se pudo conectar al servidor. Verifica la conexión.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecetas();
  }, [api]);

  const columns = [
    { header: "ID", accessor: "id" },
    {
      header: "Receta",
      accessor: "nombre",
      Cell: ({ value }) => (
        <div className="max-w-[320px] truncate" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
      Cell: ({ row }) => (
        <span className="px-2 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-700">
          {getRecipeTypeLabel(row)}
        </span>
      ),
    },
    {
      header: "Produce",
      accessor: "id_producto_base",
      Cell: ({ row }) => (
        <div className="max-w-[260px] truncate" title={getProducesLabel(row)}>
          {getProducesLabel(row)}
        </div>
      ),
    },
    {
      header: "Pauta",
      accessor: "id_pauta_elaboracion",
      Cell: ({ row }) => (
        <div className="max-w-[220px] truncate" title={getPautaLabel(row)}>
          {getPautaLabel(row)}
        </div>
      ),
    },
    {
      header: "Rendimiento",
      accessor: "peso",
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
      Cell: ({ value }) => formatMoneyCL(value),
    }
  ];

  const handleSearch = (query) => {
    const lower = query.toLowerCase();
    const filtered = recetas.filter((r) => recipeToSearchText(r).includes(lower));
    setFilteredRecetas(filtered);
    setCurrentPage(1);
  };

  const handleDelete = async (idReceta) => {
    try {
      await api(`/recetas/${idReceta}`, { method: "DELETE" });
      setRecetas((prev) => prev.filter((r) => r.id !== idReceta));
      setFilteredRecetas((prev) => prev.filter((r) => r.id !== idReceta));
      setSuccessMessage("Receta eliminada correctamente.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting receta:", err);
      alert("Ocurrió un error al eliminar la receta.");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Recetas/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Recetas/${row.id}/edit`)} tooltipText="Editar Receta" />
      <TrashButton
        onConfirmDelete={() => handleDelete(row.id)}
        tooltipText="Eliminar Receta"
        entityName="receta"
      />
    </div>
  );

  const totalPages = Math.ceil(filteredRecetas.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredRecetas.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Recetas</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          onClick={() => navigate("/Recetas/add")}
        >
          Añadir Receta
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center mb-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <span className="ml-3 text-primary">Cargando recetas...</span>
        </div>
      )}

      {error && <div className="p-4 mb-6 text-red-700 bg-red-100 rounded-lg">{error}</div>}

      {successMessage && (
        <div className="p-4 mb-6 text-green-700 bg-green-100 rounded-lg">{successMessage}</div>
      )}

      {!isLoading && !error && (
        <>
          <div className="flex justify-between items-center mb-6">
            <RowsPerPageSelector
              onRowsChange={(value) => {
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              defaultRows={25}
              options={[25, 50, 100]}
            />
            <SearchBar onSearch={handleSearch} placeholder="Buscar receta..." />
          </div>

          <Table columns={columns} data={paginatedData} actions={actions} actionHeader="OPCIONES" />

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
