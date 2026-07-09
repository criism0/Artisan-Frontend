import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function BodegasPage() {
  const [bodegas, setBodegas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const apiFetch = useApi();

  const canDeleteWarehouse = checkScope(ModelType.BODEGA, ScopeType.DELETE);

  const columns = [
    { header: "Bodega", accessor: "nombre", sortable: true },
    { header: "Comuna", accessor: "comuna", sortable: true, Cell: ({ row }) => row.comuna || "—" },
  ];

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await apiFetch(`/bodegas`, { method: "GET" });
        const body = (await res?.json?.()) ?? res?.data ?? res ?? {};
        const lista = Array.isArray(body?.bodegas) ? body.bodegas
                    : Array.isArray(body?.data)    ? body.data
                    : [];
        setBodegas(lista.map((b) => ({ id: b.id, nombre: b.nombre, comuna: b.comuna })));
      } catch (error) {
        console.error("Error fetching bodegas:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBodegas();
  }, [apiFetch]);

  const handleDeleteBodega = async (id) => {
    if (!canDeleteWarehouse) {
      toast.permissionError([ModelType.BODEGA, ScopeType.DELETE]);
      return;
    }
    try {
      const res = await apiFetch(`/bodegas/${id}`, { method: "DELETE" });
      const st = res?.status ?? 200;
      if (st < 200 || st >= 300) {
        const body = (await res?.json?.()) ?? res?.data ?? {};
        throw new Error(body?.message || body?.error || "Error eliminando bodega.");
      }
      setBodegas((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Error eliminando bodega:", error);
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Bodegas/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Bodegas/${row.id}/edit`)} tooltipText="Editar Bodega" />
      <TrashButton onConfirmDelete={() => handleDeleteBodega(row.id)} tooltipText="Eliminar Bodega" entityName="bodega" />
    </div>
  );

  return (
    <DataTable
      title="Bodegas"
      data={bodegas}
      columns={columns}
      actions={actions}
      getSearchText={(b) => [b.nombre, b.comuna].join(" ")}
      loading={isLoading}
      loadingMessage="Cargando bodegas"
      defaultRowsPerPage={10}
      emptyMessage="No hay bodegas registradas."
      headerActions={
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Bodegas/add")}
        >
          Añadir Bodega
        </button>
      }
    />
  );
}
