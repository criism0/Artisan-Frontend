import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import { ViewDetailButton, EditButton, TrashButton, BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { formatNumberCL } from "../../services/formatHelpers";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function Productos() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const canDeleteBaseProduct = checkScope(ModelType.PRODUCTO_BASE, ScopeType.DELETE);

  const apiFetch = useApi();

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await apiFetch(`/productos-base`);
        setProductos(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error("Error fetching productos:", error);
        toast.error("No se pudieron cargar los productos");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { header: "Nombre", accessor: "nombre", sortable: true },
    {
      header: "Nombre de Facturación",
      accessor: "nombreFacturacion",
      sortable: true,
      sortValue: (row) => row.nombreFacturacion?.nombre || "",
      Cell: ({ value }) => value?.nombre || "—",
    },
    {
      header: "Cantidad",
      accessor: "peso_unitario",
      sortable: true,
      Cell: ({ row }) => {
        const unidadLabel =
          { Kilogramos: "kg", Litros: "L", Unidades: "unid." }[row.unidad_medida] || "";
        return `${formatNumberCL(row.peso_unitario, 2)} ${unidadLabel}`;
      },
    },
    {
      header: "Unidades por Caja",
      accessor: "unidades_por_caja",
      sortable: true,
      Cell: ({ value }) => `${formatNumberCL(value ?? 0, 0)}`,
    },
  ];

  const handleDeleteProduct = async (productId) => {
    if (!canDeleteBaseProduct) {
      toast.permissionError([ModelType.PRODUCTO_BASE, ScopeType.DELETE]);
      return;
    }
    try {
      await apiFetch(`/productos-base/${productId}`, { method: "DELETE" });
      setProductos((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Producto eliminado");
    } catch (error) {
      console.error("Error eliminando producto:", error);
      toast.error("No se pudo eliminar el producto");
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Productos/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <EditButton
        onClick={() => navigate(`/Productos/${row.id}/edit`)}
        tooltipText="Editar Producto"
      />
      <TrashButton
        onConfirmDelete={() => handleDeleteProduct(row.id)}
        tooltipText="Eliminar Producto"
        entityName={`producto ${row.nombre || ""}`}
      />
    </div>
  );

  const getSearchText = (row) =>
    [row.nombre, row.nombreFacturacion?.nombre, row.codigo_ean, row.codigo_sap]
      .filter(Boolean)
      .join(" ");

  return (
    <DataTable
      title="Productos"
      data={productos}
      columns={columns}
      actions={actions}
      stickyActions
      getSearchText={getSearchText}
      loading={isLoading}
      loadingMessage="Cargando productos"
      initialSort={{ key: "nombre", direction: "asc" }}
      emptyMessage="No hay productos registrados."
      headerActions={
        <>
          <BackButton to="/Home" />
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Productos/crear")}
          >
            Añadir Producto Terminado
          </button>
        </>
      }
    />
  );
}
