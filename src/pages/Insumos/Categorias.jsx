import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton, EditButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const api = useApi();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const response = await api(`/categorias-materia-prima`);
        setCategorias(Array.isArray(response) ? response : []);
      } catch (error) {
        toast.error(`Error cargando categorías: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { header: "Nombre", accessor: "nombre", sortable: true },
    { header: "Descripción", accessor: "descripcion" },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <EditButton
        onClick={() => navigate(`/Insumos/Categorias/edit/${row.id}`)}
        tooltipText="Editar Categoría"
      />
    </div>
  );

  return (
    <DataTable
      title="Categorías de Insumos"
      data={categorias}
      columns={columns}
      actions={actions}
      getSearchText={(c) => [c.nombre, c.descripcion].filter(Boolean).join(" ")}
      loading={isLoading}
      loadingMessage="Cargando categorías"
      initialSort={{ key: "nombre", direction: "asc" }}
      emptyMessage="No hay categorías registradas."
      headerActions={
        <>
          <BackButton to="/Insumos" />
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Insumos/Categorias/add")}
          >
            Añadir Categoría
          </button>
        </>
      }
    />
  );
}
