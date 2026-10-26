import { ViewDetailButton, TrashIconButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { Clipboard, Play, Package, Layers } from "lucide-react";
import { toast } from "../../lib/toast";
import ConfirmDeletePreviewModal from "../../components/Modals/ConfirmDeletePreviewModal";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";
import { formatFecha } from "../../lib/dateUtils";
import { EstadoOMBadge, ResumenPVABadge } from "../../components/Produccion/EstadoOM.jsx";

// Celda de resumen PVA: dispara la carga perezosa de extras al montarse
// (solo se montan las filas visibles de la página actual del DataTable).
function PvaBadgeCell({ row, extra, isLoading, onNeedsLoad }) {
  useEffect(() => {
    onNeedsLoad(row.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  if (isLoading) return <span className="text-xs text-gray-400">Cargando…</span>;
  if (!extra) return <span className="text-xs text-gray-400">—</span>;
  return <ResumenPVABadge pautas={extra?.pautas} />;
}

export default function OMList() {
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Detalles bajo demanda (reduce ruido + llamadas por fila)
  const [omExtrasById, setOmExtrasById] = useState({});
  const [omExtrasLoading, setOmExtrasLoading] = useState(new Set());

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState(null);

  const canReadInProgress = checkScope(ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ);
  const canReadFinished = checkScope(ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ);
  const canReadManufacture = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.READ);
  const canDeleteManufacture = checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.DELETE);
  const canReadAddedValueGuideline = checkScope(ModelType.PAUTA_VALOR_AGREGADO, ScopeType.READ);

  const navigate = useNavigate();

  const ensureOmExtrasLoaded = async (id) => {
    if (omExtrasById[id]) return omExtrasById[id];
    if (omExtrasLoading.has(id)) return null;

    if (!canReadInProgress && !canReadFinished) return null;

    setOmExtrasLoading((prev) => new Set(prev).add(id));

    try {
      let lote = null;

      if (canReadInProgress) {
        try {
          const resProceso = await api(`/lotes-producto-en-proceso?id_orden_manufactura=${id}`);
          if (Array.isArray(resProceso) && resProceso.length > 0) lote = resProceso[0];
        } catch {
          // noop
        }
      }

      if (!lote && canReadFinished) {
        try {
          const resFinal = await api(`/lotes-producto-final?id_orden_manufactura=${id}`);
          if (Array.isArray(resFinal) && resFinal.length > 0) lote = resFinal[0];
        } catch {
          // noop
        }
      }

      let pautas = [];
      if (lote?.id && canReadAddedValueGuideline) {
        const loteId = lote.id;
        let query = "";
        let lotIdKey = "";

        if (lote.id_producto_base) {
          query = `/pautas-valor-agregado/lote?id_lote_producto_final=${loteId}`;
          lotIdKey = "id_lote_producto_final";
        } else if (lote.id_materia_prima) {
          query = `/pautas-valor-agregado/lote?id_lote_producto_en_proceso=${loteId}`;
          lotIdKey = "id_lote_producto_en_proceso";
        }

        if (query) {
          try {
            const resPautas = await api(query);
            if (Array.isArray(resPautas)) {
              pautas = resPautas.filter((pauta) => String(pauta[lotIdKey]) === String(loteId));
            }
          } catch {
            // noop
          }
        }
      }

      const result = { lote, pautas };
      setOmExtrasById((prev) => ({ ...prev, [id]: result }));
      return result;
    } finally {
      setOmExtrasLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!canReadManufacture) {
      toast.permissionError([ModelType.ORDEN_MANUFACTURA, ScopeType.READ]);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [omResponse, bodegasResponse] = await Promise.all([
          api(`/ordenes_manufactura`),
          api(`/bodegas`),
        ]);

        const ordenesData = Array.isArray(omResponse)
          ? omResponse
          : omResponse.ordenes_manufactura || [];
        const bodegasData = bodegasResponse.bodegas || [];

        for (const om of ordenesData) {
          om.bodega = bodegasData.find((b) => b.id === om.id_bodega) || null;
        }

        setOrdenes(ordenesData);
      } catch (err) {
        console.error("FETCH ERROR:", err);
        toast.error("No se pudieron cargar las órdenes de manufactura");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [canReadManufacture]);

  const columns = [
    {
      header: "# OM",
      accessor: "id",
      sortable: true,
      Cell: ({ value }) => (
        <span className="font-mono text-sm font-semibold text-primary">#{value}</span>
      ),
    },
    {
      header: "Producto / PIP",
      accessor: "receta",
      sortable: true,
      sortValue: (row) =>
        row.productoBase?.nombre || row.materiaPrima?.nombre || row.receta?.nombre || "",
      Cell: ({ row }) =>
        row.productoBase?.nombre || row.materiaPrima?.nombre || row.receta?.nombre || "—",
    },
    {
      header: "Bodega",
      accessor: "bodega",
      sortable: true,
      sortValue: (row) => row.bodega?.nombre || String(row.id_bodega ?? ""),
      Cell: ({ row }) => row.bodega?.nombre || row.id_bodega,
    },
    {
      header: "Fecha",
      accessor: "fecha",
      sortable: true,
      sortValue: (row) => (row.fecha ? new Date(row.fecha).getTime() : 0),
      Cell: ({ value }) => (value ? formatFecha(value) : ""),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ value }) => <EstadoOMBadge estado={value} />,
    },
    {
      header: "PVA",
      accessor: "pva_resumen",
      Cell: ({ row }) => (
        <PvaBadgeCell
          row={row}
          extra={omExtrasById[row.id]}
          isLoading={omExtrasLoading.has(row.id)}
          onNeedsLoad={(id) => void ensureOmExtrasLoaded(id)}
        />
      ),
    },
    {
      header: "Peso Objetivo",
      accessor: "peso_objetivo",
      sortable: true,
      Cell: ({ value }) => (value ? `${value} kg` : ""),
    },
  ];

  const openDeleteModal = async (id) => {
    if (!canReadManufacture) {
      toast.permissionError([ModelType.ORDEN_MANUFACTURA, ScopeType.READ]);
      return;
    }

    setDeleteTargetId(id);
    setDeleteModalOpen(true);
    setDeletePreview(null);
    setDeletePreviewError(null);
    setDeletePreviewLoading(true);

    try {
      const preview = await api(`/ordenes_manufactura/${id}/delete_preview`, { method: "GET" });
      setDeletePreview(preview);
    } catch (err) {
      console.error("Error obteniendo delete_preview:", err);
      setDeletePreviewError(err);
    } finally {
      setDeletePreviewLoading(false);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
    setDeletePreview(null);
    setDeletePreviewError(null);
    setDeletePreviewLoading(false);
  };

  const goToNextPva = async (omId) => {
    if (!canReadAddedValueGuideline) {
      toast.permissionError([ModelType.PAUTA_VALOR_AGREGADO, ScopeType.WRITE]);
      return;
    }
    const extra = (await ensureOmExtrasLoaded(omId)) || omExtrasById[omId];
    const pautas = Array.isArray(extra?.pautas) ? extra.pautas : [];
    if (pautas.length === 0) {
      toast.info("La OM no tiene PVAs pendientes");
      return;
    }

    const ordenadas = [...pautas].sort(
      (a, b) => Number(a?.pvaPorProducto?.orden || 0) - Number(b?.pvaPorProducto?.orden || 0)
    );
    const siguiente = ordenadas.find((p) => !String(p?.estado || "").toLowerCase().includes("complet")) || null;
    if (!siguiente?.id) {
      toast.success("Todas las PVAs ya están completadas");
      return;
    }

    try {
      const estadoLower = String(siguiente?.estado || "").toLowerCase();
      if (estadoLower.includes("pend")) {
        await api(`/pautas-valor-agregado/${siguiente.id}/comenzar`, { method: "PUT" });
      }
      navigate(`/PautasValorAgregado/ejecutar/${siguiente.id}`);
    } catch (err) {
      const msg = err?.error || err?.message;
      toast.error(msg || "No se pudo comenzar la pauta");
    }
  };

  const actions = (row) => {
    const normalized = String(row?.estado || "").toLowerCase();
    const hasPasos = (row?.registrosPasoProduccion?.length ?? 0) > 0;

    return (
      <div className="flex gap-2">
        <ViewDetailButton
          onClick={() => navigate(`/Orden_de_Manufactura/${row.id}`)}
          tooltipText="Ver Detalle"
        />

        {normalized === "borrador" ? (
          <button
            className="text-gray-400 hover:text-blue-500"
            title="Asignar insumos"
            onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/insumos`)}
          >
            <Clipboard className="w-5 h-5" />
          </button>
        ) : null}

        {normalized === "insumos asignados" || normalized === "en ejecución" ? (
          hasPasos ? (
            <button
              className="text-gray-400 hover:text-blue-500"
              title="Ejecutar pasos"
              onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/pasos`)}
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              className="text-gray-400 hover:text-green-600"
              title="Producción final"
              onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/produccion-final`)}
            >
              <Package className="w-5 h-5" />
            </button>
          )
        ) : null}

        {normalized === "esperando salidas" ? (
          <button
            className="text-gray-400 hover:text-green-600"
            title="Producción final"
            onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/produccion-final`)}
          >
            <Package className="w-5 h-5" />
          </button>
        ) : null}

        {normalized === "esperando pvas" ? (
          <button
            className="text-gray-400 hover:text-purple-600"
            title="Ejecutar PVAs pendientes"
            onClick={() => void goToNextPva(row.id)}
          >
            <Layers className="w-5 h-5" />
          </button>
        ) : null}

        {normalized === "borrador" ? (
          <TrashIconButton
            onClick={() => openDeleteModal(row.id)}
            tooltipText="Eliminar OM"
          />
        ) : null}
      </div>
    );
  };

  const handleDelete = async (id) => {
    if (!canDeleteManufacture) {
      toast.permissionError([ModelType.ORDEN_MANUFACTURA, ScopeType.DELETE]);
      return;
    }

    try {
      await api(`/ordenes_manufactura/${id}`, { method: "DELETE" });
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
      toast.success(`OM #${id} eliminada correctamente`);
    } catch {
      toast.error("Error al eliminar la orden de manufactura");
    }
  };

  const getSearchText = (om) =>
    [
      om.id,
      om.receta?.nombre,
      om.productoBase?.nombre,
      om.materiaPrima?.nombre,
      om.bodega?.nombre,
      om.estado,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <>
      <ConfirmDeletePreviewModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={async () => {
          if (deleteTargetId == null) return;

          // Si el backend bloquea, el modal ya lo muestra.
          if (deletePreview?.canDelete === false) return;

          // Si no pudimos obtener preview, permitimos eliminar igualmente.
          if (deletePreviewError) {
            toast.error("No se pudo cargar el detalle; eliminando igualmente…");
          }

          await handleDelete(deleteTargetId);
          closeDeleteModal();
        }}
        entityName={deleteTargetId != null ? `OM #${deleteTargetId}` : "Orden de Manufactura"}
        title={deleteTargetId != null ? `¿Eliminar OM #${deleteTargetId}?` : "¿Eliminar Orden de Manufactura?"}
        preview={deletePreview}
        loading={deletePreviewLoading}
        error={deletePreviewError}
      />

      <DataTable
        title="Órdenes de Manufactura"
        data={ordenes}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        loading={isLoading}
        loadingMessage="Cargando órdenes de manufactura"
        initialSort={{ key: "id", direction: "desc" }}
        emptyMessage="No hay órdenes de manufactura registradas."
        headerActions={
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Orden_de_Manufactura/add")}
          >
            Añadir OM
          </button>
        }
      />
    </>
  );
}
