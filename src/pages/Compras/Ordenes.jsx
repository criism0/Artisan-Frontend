import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import {
  ViewDetailButton,
  UndoButton,
  ValidarButton,
  PagarButton,
  AddButton
} from "../../components/Buttons/ActionButtons";
import { FiTrash2 } from "react-icons/fi";
import ConfirmModal from "../../components/ConfirmModal";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";

export default function Ordenes() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showRetrocederModal, setShowRetrocederModal] = useState(false);
  const [selectedOrdenId, setSelectedOrdenId] = useState(null);
  const [retrocederPreview, setRetrocederPreview] = useState(null);
  const [loadingRetrocederPreview, setLoadingRetrocederPreview] = useState(false);
  const [showValidarModal, setShowValidarModal] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [isCompactView, setIsCompactView] = useState(false);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const emailSender = async (selectedOrdenId) => {
    try {
      const ordenData = await api(
        `/proceso-compra/ordenes/${selectedOrdenId}`
      );
      const items = buildOcEmailItemsFromOrden(ordenData);
      const bodegaId = ordenData.BodegaSolicitante?.id;
      let encargados = [];
      if (bodegaId) {
        const bodegaData = await api(
          `/bodegas/${bodegaId}`
        );
        encargados = Array.isArray(bodegaData?.Encargados) ? bodegaData.Encargados : [];
      }
      // Destinatarios y nombres para el template
      const to = encargados
        .map((e) => e?.usuario?.email)
        .filter(Boolean)
        .map((email) => ({ email }));
      const encargadosNames =
        encargados.map((e) => e?.usuario?.nombre).filter(Boolean).join(", ") ||
        "Sin encargados";
      
      // Enviar correo de notificación
      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: selectedOrdenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: ordenData.estado || "Estado desconocido",
        bodega: ordenData.BodegaSolicitante?.nombre || "No especificada",
        clientNames: encargadosNames || "",
        items,
      });
    } catch (emailError) {
      console.error("Error enviando correo de notificación:", emailError); // porque la orden igual se valida aunque falle el email
      }
  };

  const confirmRetrocederOrden = async (id) => {
    setSelectedOrdenId(id);
    setShowRetrocederModal(true);
    setLoadingRetrocederPreview(true);
    setRetrocederPreview(null);
    try {
      const orden = await api(`/proceso-compra/ordenes/${id}`, { method: "GET" });
      const bultos = Array.isArray(orden?.Bultos) ? orden.Bultos : (Array.isArray(orden?.bultos) ? orden.bultos : []);
      setRetrocederPreview({
        estado: orden?.estado,
        bultos,
      });
    } catch (e) {
      setRetrocederPreview(null);
    } finally {
      setLoadingRetrocederPreview(false);
    }
  };

  const handleRetrocederConfirm = async () => {
    try {
      await api(
        `/proceso-compra/ordenes/${selectedOrdenId}/retroceder`, { method: "PUT" }
      );
      try {
        emailSender(selectedOrdenId)
      } catch (emailErr) {
        toast.error("Error enviando email tras retroceder orden:", emailErr);
      }
      toast.success("Orden retrocedida correctamente");
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "No se pudo retroceder la orden. Intente nuevamente.";
      toast.error(errorMessage);
    } finally {
      setShowRetrocederModal(false);
      setSelectedOrdenId(null);
      setRetrocederPreview(null);
    }
  };

  const confirmValidarOrden = (id) => {
    setSelectedOrdenId(id);
    setShowValidarModal(true);
  };

  const handleValidarConfirm = async () => {
    try {
      await api(
        `/proceso-compra/ordenes/${selectedOrdenId}/validar`, { method: "PUT" }
      );
      toast.success("Orden validada correctamente");
      try {
        emailSender(selectedOrdenId)
      } catch (emailErr) {
        toast.error("Error enviando email tras validar orden:", emailErr);
      }
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "No se pudo validar la orden. Intente nuevamente.";
      toast.error(errorMessage);
    } finally {
      setShowValidarModal(false);
      setSelectedOrdenId(null);
    }
  };

  const formatCLP = (num) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(num);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }
    setSortConfig({ key, direction });
    const sortedData = [...filteredOrdenes].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    setFilteredOrdenes(sortedData);
    setCurrentPage(1);
  };

  const getEstadoChip = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium";

    switch (estado) {
      case "Creada":
        return <span className={`${base} bg-gray-200 text-gray-800`}>Creada</span>;

      case "Validada":
        return <span className={`${base} bg-sky-200 text-sky-800`}>Validada</span>;

      case "Recepcionada":
        return <span className={`${base} bg-green-200 text-green-800`}>Recepcionada</span>;

      case "Parcialmente recepcionada":
        return <span className={`${base} bg-amber-200 text-amber-800`}>Recep. Parcial</span>;

      case "Rechazada":
        return <span className={`${base} bg-rose-200 text-rose-800`}>Rechazada</span>;

      case "Pagada":
        return <span className={`${base} bg-lime-200 text-lime-800`}>Pagada</span>;

      default:
        return <span className={`${base} bg-gray-100 text-gray-700`}>{estado}</span>;
    }
  };

  const columns = [
    ...(isCompactView ? [{
      header: "",
      accessor: "expand",
      Cell: ({ row }) => (
        <button
          className="text-xl font-bold"
          onClick={() => toggleRow(row.id)}
        >
          {expandedRows[row.id] ? "−" : "+"}
        </button>
      ),
    },] : []),
    { header: "N°", accessor: "id", sortable: true },
    { header: "Fecha de Emisión", accessor: "fecha", sortable: true },
    { header: "Proveedor", accessor: "id_proveedor", sortable: true },
    { header: "Insumos", accessor: "materiasPrimas", sortable: true, 
      Cell: ({ value }) => (
        <div className="max-w-[20vw] overflow-hidden text-sm break-words whitespace-normal leading-tight">
           
          {Array.isArray(value) && value.length > 0 ? (
            value.map((insumo, index) => {
              const nombre =
                insumo.proveedorMateriaPrima?.materiaPrima?.nombre ||
                insumo.materiaPrima?.nombre ||
                "Sin nombre";

              const cantidad =
                insumo.cantidad_formato ?? insumo.cantidad ?? "—";
              
              const formato =
                insumo.proveedorMateriaPrima?.formato ||
                insumo.formato ||
                "—";

              return (
                <span key={index} className="block mb-0.5">
                  • <strong>{formato}</strong> - {nombre} ({cantidad})
                </span>
              );
            })
          ) : (
            <span>—</span>
          )}
        </div>
      ),
    },
    { header: "Total Neto", accessor: "total_neto", sortable: true },
    { header: "Estado", accessor: "estado", sortable: true, Cell: ({ value }) => getEstadoChip(value) },
    ...(!isCompactView ? [
      { header: "Opciones", accessor: "opciones", Cell: ({ row }) => {
        const estado = row?.estado?.toLowerCase();
        return (
          <div className="hidden lg:flex gap-2">
            <ViewDetailButton
              onClick={() => navigate(`/Ordenes/${row.id}`)}
              tooltipText="Detalle"
            />

            {estado === "creada" && (
              <ValidarButton
                onClick={() => confirmValidarOrden(row.id)}
                tooltipText="Validar"
              />
            )}

            {estado === "validada" && (
              <ValidarButton
                onClick={() => navigate(`/Ordenes/recepcionar/${row.id}`)}
                tooltipText="Recepcionar"
              />
            )}

            {estado === "parcialmente recepcionada" && (
              <AddButton
                onClick={() => navigate(`/Ordenes/recepcionar/${row.id}`)}
                tooltipText="Completar recepción"
              />
            )}

            {estado !== "creada" && (
              <UndoButton
                onClick={() => confirmRetrocederOrden(row.id)}
                tooltipText="Retroceder estado"
              />
            )}

            <PagarButton
              onConfirm={() => (row.pagada ? revertirPagoOrden(row.id) : pagarOrden(row.id))}
              tooltipText={row.pagada ? "Revertir pago" : "Pagar orden"}
              confirmTitle={
                row.pagada
                  ? "¿Estás seguro de que quieres revertir el pago de esta orden?"
                  : "¿Estás seguro de que quieres pagar esta orden?"
              }
              confirmButtonText={row.pagada ? "Confirmar Reversión" : "Confirmar Pago"}
              confirmButtonClassName={
                row.pagada
                  ? "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded"
                  : undefined
              }
              buttonClassName={
                row.pagada
                  ? "text-green-600 hover:text-green-700"
                  : "text-gray-400 hover:text-blue-500"
              }
            />

            <button
              className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded"
              title="Eliminar orden"
              onClick={() => {
                setDeleteId(row.id);
                setShowDeleteModal(true);
              }}
            >
              <FiTrash2 />
            </button>
          </div>
        );
      },
    },] : []),

  ];

  const renderHeader = (col) => {
    if (!col.sortable) return col.header;
    const isActive = sortConfig.key === col.accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(col.accessor)}
      >
        <span>{col.header}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  const fetchOrdenes = async () => {
    try {
      const res = await api(
        `/proceso-compra/ordenes`, { method: "GET" }
      );
      const ordenesData = Array.isArray(res)
        ? res
            .map((orden) => ({
              id: orden.id,
              id_proveedor:
                orden.proveedor?.nombre_empresa || orden.id_proveedor,
              fecha: new Date(orden.fecha).toLocaleDateString(),
              total_neto: formatCLP(orden.total_neto),
              iva: formatCLP(orden.iva),
              total_pago: formatCLP(orden.total_pago),
              estado: orden.estado,
              pagada: orden.pagada,
              materiasPrimas: orden.materiasPrimas,
            }))
            .sort((a, b) => b.id - a.id)
        : [];
      setOrdenes(ordenesData);
      setFilteredOrdenes(ordenesData);
    } catch (error) {
      toast.error("Error fetching órdenes:", error);
    }
  };

  const pagarOrden = async (id) => {
    try {
      await api(
        `/proceso-compra/ordenes/${id}/pagar`, { method: "PUT" }
      );
      toast.success("Orden pagada correctamente");
      fetchOrdenes();

    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "No se pudo pagar la orden. Por favor, intente nuevamente.";
      toast.error(errorMessage);
    }
  };

  const revertirPagoOrden = async (id) => {
    try {
      await api(
        `/proceso-compra/ordenes/${id}/revertir-pago`, { method: "PUT" }
      );
      toast.success("Pago revertido correctamente");
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "No se pudo revertir el pago. Por favor, intente nuevamente.";
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api(
        `/proceso-compra/ordenes/${id}`, { method: "DELETE" }
      );
      toast.success("Orden eliminada correctamente");
      fetchOrdenes();
    } catch (error) {
      toast.error("No se pudo eliminar la orden. Intenta nuevamente.");
    }
  };

  useEffect(() => {
    fetchOrdenes();
    const handleResize = () => {
      // Si la ventana es pequeña, entra en modo compacto (aparece el "+" y se esconden la seccion de opciones)
      setIsCompactView(window.innerWidth < 1200);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSearch = (query) => {
    const lower = query.toLowerCase();
    if (!lower) {
      setFilteredOrdenes(ordenes);
      return;
    }
    const filtered = ordenes.filter((orden) =>
      Object.values(orden).some((value) =>
        value?.toString().toLowerCase().includes(lower)
      )
    );
    setFilteredOrdenes(filtered);
    setCurrentPage(1);
  };

  const handleRowsChange = (value) => setRowsPerPage(value);
  const handlePageChange = (page) => setCurrentPage(page);
  const totalPages = Math.ceil(filteredOrdenes.length / rowsPerPage);
  const paginatedOrdenes = filteredOrdenes.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const totalColumns = columns.length + 1;

  const renderExpandedRow = (row, colSpan) => {
    if (!expandedRows[row.id]) return null;
    const estado = row.estado?.toLowerCase();
    return (
      <tr className="bg-gray-50" key={`expanded-${row.id}`}>
        <td colSpan={colSpan} className="px-6 py-4">
          <div>
            <p><strong>Total Neto:</strong> {row.total_neto}</p>
            <p><strong>Estado:</strong> {row.estado}</p>
            <div className="mt-2 flex gap-2">
              <ViewDetailButton
                onClick={() => navigate(`/Ordenes/${row.id}`)}
                tooltipText="Detalle"
              />

              {estado === "creada" && (
                <ValidarButton
                  onClick={() => confirmValidarOrden(row.id)}
                  tooltipText="Validar"
                />
              )}

              {estado === "validada" && (
                <ValidarButton
                  onClick={() => navigate(`/Ordenes/recepcionar/${row.id}`)}
                  tooltipText="Recepcionar"
                />
              )}

              {estado === "parcialmente recepcionada" && (
                <AddButton
                  onClick={() => navigate(`/Ordenes/recepcionar/${row.id}`)}
                  tooltipText="Completar recepción"
                />
              )}

              {estado !== "creada" && (
                <UndoButton
                  onClick={() => confirmRetrocederOrden(row.id)}
                  tooltipText="Retroceder estado"
                />
              )}

              <PagarButton
                onConfirm={() => (row.pagada ? revertirPagoOrden(row.id) : pagarOrden(row.id))}
                tooltipText={row.pagada ? "Revertir pago" : "Pagar orden"}
                confirmTitle={
                  row.pagada
                    ? "¿Estás seguro de que quieres revertir el pago de esta orden?"
                    : "¿Estás seguro de que quieres pagar esta orden?"
                }
                confirmButtonText={row.pagada ? "Confirmar Reversión" : "Confirmar Pago"}
                confirmButtonClassName={
                  row.pagada
                    ? "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded"
                    : undefined
                }
                buttonClassName={
                  row.pagada
                    ? "text-green-600 hover:text-green-700"
                    : "text-gray-400 hover:text-blue-500"
                }
              />

              <button
                className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                title="Eliminar orden"
                onClick={() => {
                  setDeleteId(row.id);
                  setShowDeleteModal(true);
                }}
              >
                <FiTrash2 />
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await handleDelete(deleteId);
      setDeleteId(null);
      setShowDeleteModal(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteId(null);
    setShowDeleteModal(false);
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      {successMessage && (
        <div className="mb-4 px-4 py-2 bg-green-100 text-green-800 rounded border border-green-300 animate-fade-in">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 px-4 py-2 bg-red-100 text-red-800 rounded border border-red-300 animate-fade-in">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Órdenes de Compra</h1>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Ordenes/add")}
        >
          Añadir Orden
        </button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      <Table
        columns={columns.map((col) => ({
          ...col,
          header: renderHeader(col),
        }))}
        data={paginatedOrdenes}
        renderExpandedRow={(row) => renderExpandedRow(row, totalColumns)}
      />

      <div className="mt-6 flex justify-between items-center">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="Eliminar Orden de Compra"
        message="¿Estás seguro de que deseas eliminar esta orden de compra? Esta acción no se puede deshacer."
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {showValidarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              ¿Estás seguro que quieres validar esta orden?
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Al validar, la orden pasará al siguiente estado del proceso.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={() => setShowValidarModal(false)}
              >
                No
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleValidarConfirm}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {showRetrocederModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              ¿Retroceder estado de la orden?
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Si la orden está recepcionada (total o parcial), se eliminarán los bultos y lotes asociados.
            </p>

            {loadingRetrocederPreview && (
              <p className="text-sm text-gray-500 mb-3">Cargando detalle de bultos…</p>
            )}

            {!loadingRetrocederPreview && retrocederPreview?.estado &&
              (retrocederPreview.estado === "Recepcionada" || retrocederPreview.estado === "Parcialmente recepcionada") && (
                <div className="text-sm text-gray-700 mb-4">
                  <p className="mb-2">
                    Se eliminarán <strong>{retrocederPreview?.bultos?.length || 0}</strong> bultos.
                  </p>
                  {Array.isArray(retrocederPreview?.bultos) && retrocederPreview.bultos.length > 0 && (
                    <div className="max-h-40 overflow-auto border border-gray-200 rounded p-2 bg-gray-50">
                      {retrocederPreview.bultos.slice(0, 10).map((b) => {
                        const mpNombre = b?.MateriumPrima?.nombre || b?.MateriaPrima?.nombre || b?.materiaPrima?.nombre || "Materia prima";
                        const lote = b?.LoteMateriaPrima?.identificador_proveedor || b?.lote?.identificador_proveedor || "(sin lote)";
                        const unidades = b?.cantidad_unidades ?? "—";
                        return (
                          <div key={b.id} className="py-1 border-b border-gray-200 last:border-b-0">
                            <span className="font-medium">#{b.id}</span> · {mpNombre} · {unidades} · lote: {lote}
                          </div>
                        );
                      })}
                      {retrocederPreview.bultos.length > 10 && (
                        <div className="pt-2 text-xs text-gray-500">
                          Mostrando 10 de {retrocederPreview.bultos.length}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                onClick={() => setShowRetrocederModal(false)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={handleRetrocederConfirm}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
