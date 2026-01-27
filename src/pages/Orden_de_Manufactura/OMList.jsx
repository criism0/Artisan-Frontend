import { ViewDetailButton, TrashIconButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { FiClipboard, FiPlay, FiPackage, FiLayers } from "react-icons/fi";
import { toast } from "../../lib/toast";
import ConfirmDeletePreviewModal from "../../components/Modals/ConfirmDeletePreviewModal";

const BadgeEstadoPVA = ({ value }) => {
  const v = String(value || "").toLowerCase();
  const base = "px-2 py-0.5 rounded-full text-xs font-semibold";
  if (!v) return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
  if (v.includes("pend")) return <span className={`${base} bg-amber-100 text-amber-800`}>Pendiente</span>;
  if (v.includes("progres") || v.includes("ejec") || v.includes("inici"))
    return <span className={`${base} bg-blue-100 text-blue-700`}>En progreso</span>;
  if (v.includes("termin") || v.includes("complet"))
    return <span className={`${base} bg-green-100 text-green-700`}>Completado</span>;
  if (v.includes("cancel")) return <span className={`${base} bg-red-100 text-red-700`}>Cancelado</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>{value}</span>;
};

export default function OMList() {
  const [ordenes, setOrdenes] = useState([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // Detalles bajo demanda (reduce ruido + llamadas por fila)
  const [omExtrasById, setOmExtrasById] = useState({});
  const [omExtrasLoading, setOmExtrasLoading] = useState(new Set());

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState(null);

  const navigate = useNavigate();

  const getEstadoBadge = (estado) => {
    if (!estado) return "";
    const normalized = estado.toLowerCase();
    const base = "px-3 py-1 rounded-full text-xs font-medium";
    switch (normalized) {
      case "borrador":
        return <span className={`${base} bg-gray-200 text-gray-700`}>Borrador</span>;
      case "insumos asignados":
        return <span className={`${base} bg-blue-100 text-blue-700`}>Insumos asignados</span>;
      case "esperando salidas":
        return <span className={`${base} bg-orange-100 text-orange-700`}>Esperando salidas</span>;
      case "en ejecución":
        return <span className={`${base} bg-cyan-100 text-cyan-700`}>En ejecución</span>;
      case "esperando pvas":
        return <span className={`${base} bg-purple-100 text-purple-700`}>Esperando PVAs</span>;
      case "cerrada":
        return <span className={`${base} bg-green-100 text-green-700`}>Cerrada</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>;
    }
  };

  const getPvaResumenBadge = (row) => {
    const isLoading = omExtrasLoading.has(row.id);
    const extra = omExtrasById[row.id];
    const pautas = Array.isArray(extra?.pautas) ? extra.pautas : [];

    const base = "px-2 py-0.5 rounded-full text-xs font-semibold";
    if (isLoading) return <span className={`${base} bg-gray-100 text-gray-600`}>Cargando…</span>;
    if (!extra) return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
    if (pautas.length === 0) return <span className={`${base} bg-gray-100 text-gray-600`}>Sin PVA</span>;

    const completadas = pautas.filter((p) => String(p?.estado || "").toLowerCase().includes("complet")).length;
    if (completadas === pautas.length) {
      return <span className={`${base} bg-green-100 text-green-700`}>PVAs completadas</span>;
    }

    const enProceso = pautas.some((p) => {
      const v = String(p?.estado || "").toLowerCase();
      return v.includes("progres") || v.includes("ejec") || v.includes("inici");
    });
    if (enProceso) {
      return <span className={`${base} bg-blue-100 text-blue-700`}>PVA en progreso</span>;
    }

    return <span className={`${base} bg-amber-100 text-amber-800`}>PVAs pendientes</span>;
  };

  const ensureOmExtrasLoaded = async (id) => {
    if (omExtrasById[id]) return omExtrasById[id];
    if (omExtrasLoading.has(id)) return null;

    const nextLoading = new Set(omExtrasLoading);
    nextLoading.add(id);
    setOmExtrasLoading(nextLoading);

    try {
      let lote = null;
      try {
        const resProceso = await api(
          `/lotes-producto-en-proceso?id_orden_manufactura=${id}`
        );
        if (Array.isArray(resProceso) && resProceso.length > 0) {
          lote = resProceso[0];
        }
      } catch (_) {
        // noop
      }

      if (!lote) {
        try {
          const resFinal = await api(
            `/lotes-producto-final?id_orden_manufactura=${id}`
          );
          if (Array.isArray(resFinal) && resFinal.length > 0) {
            lote = resFinal[0];
          }
        } catch (_) {
          // noop
        }
      }

      let pautas = [];
      if (lote?.id) {
        const loteId = lote.id;

        let query = "";
        let lotIdKey = "";

        if (lote.id_producto_base) {
          // FIX: nombre de query param correcto
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
              pautas = resPautas.filter(
                (pauta) => String(pauta[lotIdKey]) === String(loteId)
              );
            }
          } catch (_) {
            // noop
          }
        }
      }

      const result = { lote, pautas };
      setOmExtrasById((prev) => ({
        ...prev,
        [id]: result,
      }));

      return result;
    } finally {
      setOmExtrasLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key)
      direction = sortConfig.direction === "asc" ? "desc" : "asc";

    setSortConfig({ key, direction });

    const sorted = [...filteredOrdenes].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number")
        return direction === "asc" ? aVal - bVal : bVal - aVal;

      return direction === "asc"
        ? String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase())
        : String(bVal).toLowerCase().localeCompare(String(aVal).toLowerCase());
    });

    setFilteredOrdenes(sorted);
    setCurrentPage(1);
  };

  const columns = [
    {
      header: "Receta",
      accessor: "receta",
      Cell: ({ row }) => row.receta?.nombre || row.id_receta,
    },
    {
      header: "Bodega",
      accessor: "bodega",
      Cell: ({ row }) =>
        row.bodega?.nombre ||
        bodegas.find((b) => b.id === row.id_bodega)?.nombre ||
        row.id_bodega,
    },
    {
      header: "Fecha",
      accessor: "fecha",
      Cell: ({ value }) => (value ? new Date(value).toLocaleDateString() : ""),
    },
    {
      header: "Estado",
      accessor: "estado",
      Cell: ({ value }) => getEstadoBadge(value),
    },
    {
      header: "PVA",
      accessor: "pva_resumen",
      Cell: ({ row }) => getPvaResumenBadge(row),
    },
    {
      header: "Peso Objetivo",
      accessor: "peso_objetivo",
      Cell: ({ value }) => (value ? `${value} kg` : ""),
    },
  ];

  useEffect(() => {
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
        setFilteredOrdenes(ordenesData);
        setBodegas(bodegasData);
      } catch (err) {
        console.error("FETCH ERROR:", err);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (query) => {
    const q = String(query || "").toLowerCase().trim();
    if (!q) {
      setFilteredOrdenes(ordenes);
      setCurrentPage(1);
      return;
    }

    const filtered = ordenes.filter((om) => {
      const receta = om.receta?.nombre || "";
      const bodega = om.bodega?.nombre ||
        bodegas.find((b) => b.id === om.id_bodega)?.nombre ||
        "";
      const estado = om.estado || "";
      const idStr = String(om.id ?? "");
      return (
        idStr.toLowerCase().includes(q) ||
        String(receta).toLowerCase().includes(q) ||
        String(bodega).toLowerCase().includes(q) ||
        String(estado).toLowerCase().includes(q)
      );
    });

    setFilteredOrdenes(filtered);
    setCurrentPage(1);
  };

  const openDeleteModal = async (id) => {
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
      const estaPendiente = estadoLower.includes("pend");
      if (estaPendiente) {
        await api(`/pautas-valor-agregado/${siguiente.id}/comenzar`, { method: "PUT" });
      }
      navigate(`/PautasValorAgregado/ejecutar/${siguiente.id}`);
    } catch (err) {
      const msg = err?.error || err?.message;
      toast.error(msg || "No se pudo comenzar la pauta");
    }
  };

  const actions = (row) => {
    const estado = String(row?.estado || "");
    const normalized = estado.toLowerCase();
    const hasPasos = (row?.registrosPasoProduccion?.length ?? 0) > 0;
    const isEsperandoPVAs = normalized === "esperando pvas";

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
            <FiClipboard className="w-5 h-5" />
          </button>
        ) : null}

        {normalized === "insumos asignados" || normalized === "en ejecución" ? (
          hasPasos ? (
            <button
              className="text-gray-400 hover:text-blue-500"
              title="Ejecutar pasos"
              onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/pasos`)}
            >
              <FiPlay className="w-5 h-5" />
            </button>
          ) : (
            <button
              className="text-gray-400 hover:text-green-600"
              title="Producción final"
              onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/produccion-final`)}
            >
              <FiPackage className="w-5 h-5" />
            </button>
          )
        ) : null}

        {normalized === "esperando salidas" ? (
          <button
            className="text-gray-400 hover:text-green-600"
            title="Producción final"
            onClick={() => navigate(`/Orden_de_Manufactura/${row.id}/produccion-final`)}
          >
            <FiPackage className="w-5 h-5" />
          </button>
        ) : null}

        {isEsperandoPVAs ? (
          <button
            className="text-gray-400 hover:text-purple-600"
            title="Ejecutar PVAs pendientes"
            onClick={() => void goToNextPva(row.id)}
          >
            <FiLayers className="w-5 h-5" />
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
    try {
      await api(`/ordenes_manufactura/${id}`, { method: "DELETE" });
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
      setFilteredOrdenes((prev) => prev.filter((o) => o.id !== id));
      toast.success(`OM #${id} eliminada correctamente`);
    } catch {
      toast.error("Error al eliminar la orden de manufactura");
    }
  };

  const totalPages = Math.ceil(filteredOrdenes.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageData = filteredOrdenes.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    for (const row of pageData) {
      void ensureOmExtrasLoaded(row.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageData]);

  return (
    <div className="p-6 bg-background min-h-screen">
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

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Órdenes de Manufactura</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Orden_de_Manufactura/add")}
        >
          Añadir OM
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={setRowsPerPage} />
        <SearchBar onSearch={handleSearch} />
      </div>

      <Table
        columns={columns}
        data={pageData}
        actions={actions}
      />

      <div className="mt-6 flex justify-end">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}