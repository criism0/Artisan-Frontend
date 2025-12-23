import { ViewDetailButton, TrashIconButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { toast } from "../../lib/toast";
import ConfirmDeletePreviewModal from "../../components/Modals/ConfirmDeletePreviewModal";

export default function OMList() {
  const [ordenes, setOrdenes] = useState([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

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
      case "cerrada":
        return <span className={`${base} bg-green-100 text-green-700`}>Cerrada</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>;
    }
  };

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
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
      header: "",
      accessor: "expand",
      Cell: ({ row }) => (
        <button
          onClick={() => toggleRow(row.id)}
          className="text-gray-500 hover:text-gray-700"
        >
          {expandedRows.has(row.id) ? <FiChevronDown /> : <FiChevronRight />}
        </button>
      ),
    },
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
      header: "Peso Objetivo",
      accessor: "peso_objetivo",
      Cell: ({ value }) => (value ? `${value} kg` : ""),
    },
    {
      header: "Estado PVA",
      accessor: "estado_pva",
      Cell: ({ row }) =>
        row.pautas && row.pautas.length > 0 ? (
          <span className="text-gray-700">
            {row.pautas.length > 1
              ? (row.pautas.every(
                (p) => p.estado === "Completado"
              ) ? `Múltiples (Completado)` : `Múltiples (En Progreso)`)
              : row.pautas[0].estado}
          </span>
        ) : (
          <span className="text-gray-400 text-xs italic">Sin PVA</span>
        ),
    },
    {
      header: "PVA",
      accessor: "pva",
      Cell: ({ row }) =>
        row.pautas && row.pautas.length > 0 ? (
          <div className="flex flex-col space-y-1">
            <span className="text-xs font-semibold text-gray-600 block mb-1">
              Lote #{row.lote?.id || 'N/A'}
            </span>
            {row.pautas.map((pauta, index) => (
              <button
                key={pauta.id}
                onClick={() => navigate(`/PautasValorAgregado/${pauta.id}`)}
                className={`px-3 py-1 rounded text-xs text-white 
                ${pauta.estado === "Completado"
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
              >
                Ver Pauta {row.pautas.length > 1 ? `#${index + 1}` : ''}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-xs italic">Sin PVA</span>
        ),
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

        const withPVA = await Promise.all(
          ordenesData.map(async (om) => {
            let lote = null;

            // 1. INTENTAR BUSCAR LOTE EN PROCESO
            try {
              const resProceso = await api(
                `/lotes-producto-en-proceso?id_orden_manufactura=${om.id}`
              );
              if (Array.isArray(resProceso) && resProceso.length > 0) {
                lote = resProceso[0];
              }
            } catch (err) { }

            // 2. SI NO HAY LOTE EN PROCESO, INTENTAR BUSCAR LOTE FINAL
            if (!lote) {
              try {
                const resFinal = await api(
                  `/lotes-producto-final?id_orden_manufactura=${om.id}`
                );
                if (Array.isArray(resFinal) && resFinal.length > 0) {
                  lote = resFinal[0];
                }
              } catch (err) { }
            }

            let pautasOM = [];

            // 3. SI HAY UN LOTE ENCONTRADO, BUSCAR TODAS SUS PAUTAS Y FILTRAR
            if (lote) {
              const loteId = lote.id;

              let query = '';
              let lotIdKey = '';

              // Lote Final: tiene id_producto_base. 
              if (lote.id_producto_base) {
                query = `/pautas-valor-agregado/lote?id_lote_productoFinal=${loteId}`;
                // *** CORRECCIÓN APLICADA AQUÍ: Asumiendo snake_case en el objeto de respuesta ***
                lotIdKey = 'id_lote_producto_final';
              }
              // Lote Proceso: tiene id_materia_prima.
              else if (lote.id_materia_prima) {
                query = `/pautas-valor-agregado/lote?id_lote_producto_en_proceso=${loteId}`;
                lotIdKey = 'id_lote_producto_en_proceso';
              }

              if (query) {
                try {
                  const resPautas = await api(query);

                  if (Array.isArray(resPautas)) {
                    // FILTRADO MANUAL CORREGIDO: Convertir a String para evitar errores de tipo.
                    pautasOM = resPautas.filter(pauta => String(pauta[lotIdKey]) === String(loteId));
                  }
                } catch (_) { }
              }
            }

            return { ...om, lote: lote, pautas: pautasOM };
          })
        );

        setOrdenes(withPVA);
        setFilteredOrdenes(withPVA);
        setBodegas(bodegasData);
      } catch (err) {
        console.error("FETCH ERROR:", err);
      }
    };

    fetchData();
  }, []);

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

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton
        onClick={() => navigate(`/Orden_de_Manufactura/${row.id}`)}
        tooltipText="Ver Detalle"
      />
      <TrashIconButton
        onClick={() => openDeleteModal(row.id)}
        tooltipText="Eliminar OM"
      />
    </div>
  );

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
        <h1 className="text-2xl font-bold">Lista de Elaboración</h1>
        <button
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
          onClick={() => navigate("/Orden_de_Manufactura/add")}
        >
          Ingresar Elaboración
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={setRowsPerPage} />
        <SearchBar onSearch={setFilteredOrdenes} />
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