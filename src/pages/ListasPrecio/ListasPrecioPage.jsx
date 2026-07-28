import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import {
  ViewDetailButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function ListasPrecio() {
  const navigate = useNavigate();
  const [listasPrecio, setListasPrecio] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiFetch = useApi();

  const canDeletePriceList = checkScope(ModelType.LISTA_PRECIO, ScopeType.DELETE);

  useEffect(() => {
    const fetchListasPrecio = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/lista-precio`);
        setListasPrecio(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Error fetching listas de precio:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchListasPrecio();
  }, [apiFetch]);

  const handleDeleteListaPrecio = async (listaId) => {
    if (!canDeletePriceList) {
      toast.permissionError([ModelType.LISTA_PRECIO, ScopeType.DELETE]);
      return;
    }
    try {
      await apiFetch(`/lista-precio/${listaId}`, {
        method: "DELETE",
      });
      setListasPrecio((prev) => prev.filter((l) => l.id !== listaId));
    } catch (error) {
      console.error("Error eliminando lista de precio:", error);
    }
  };

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => (
        <div className="max-w-[320px] truncate font-medium" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Descripción",
      accessor: "description",
      sortable: true,
      Cell: ({ value }) => (
        <div className="max-w-[480px] truncate text-gray-600" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/lista-precio/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/lista-precio/${row.id}/edit`)}
        tooltipText="Editar Lista de Precio"
      />
      <TrashButton
        onConfirmDelete={() => handleDeleteListaPrecio(row.id)}
        tooltipText="Eliminar Lista de Precio"
        entityName={`lista de precio ${row.nombre || ""}`}
      />
    </div>
  );

  const getSearchText = (row) => [row?.nombre, row?.description].filter(Boolean).join(" ");

  return (
    <DataTable
      title="Listas de Precio"
      data={listasPrecio}
      columns={columns}
      actions={actions}
      getSearchText={getSearchText}
      loading={loading}
      loadingMessage="Cargando listas de precio"
      emptyMessage="No hay listas de precio registradas."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/lista-precio/add")}
        >
          Añadir Lista de Precio
        </button>
      }
    />
  );
}
