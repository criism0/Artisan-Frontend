import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/Tables/DataTable";
import {
  ViewDetailButton,
  UndoButton,
  ValidarButton,
  PagarButton,
  AddButton
} from "../../components/Buttons/ActionButtons";
import { Trash2, AlertTriangle } from "lucide-react";
import ConfirmModal from "../../components/Modals/ConfirmModal";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";

export default function Ordenes() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRetrocederModal, setShowRetrocederModal] = useState(false);
  const [selectedOrdenId, setSelectedOrdenId] = useState(null);
  const [retrocederPreview, setRetrocederPreview] = useState(null);
  const [loadingRetrocederPreview, setLoadingRetrocederPreview] = useState(false);
  const [showValidarModal, setShowValidarModal] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);

  const canWritePurchaseOrder = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const canDeletePurchaseOrder = checkScope(ModelType.ORDEN_COMPRA, ScopeType.DELETE);
  const canDeleteBulk = checkScope(ModelType.BULTO, ScopeType.DELETE);

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const emailSender = async (selectedOrdenId) => {
    try {
      const ordenData = await api(
        `/proceso-compra/ordenes/${selectedOrdenId}`
      );
      const { items, totalNeto, iva, totalPago } = buildOcEmailItemsFromOrden(ordenData);

      // Obtener usuarios con rol Super Admin
      const superAdmins = await api(`/usuarios?role=Super Admin`);
      const adminsArray = Array.isArray(superAdmins) ? superAdmins : [];

      // Obtener encargados de la bodega
      const bodegaId = ordenData.BodegaSolicitante?.id;
      let encargados = [];
      if (bodegaId) {
        const bodegaData = await api(`/bodegas/${bodegaId}`);
        encargados = Array.isArray(bodegaData?.Encargados) ? bodegaData.Encargados : [];
      }

      // Combinar ambos grupos de destinatarios
      const adminEmails = adminsArray.map((admin) => admin?.email).filter(Boolean);
      const encargadoEmails = encargados.map((e) => e?.usuario?.email).filter(Boolean);
      const allEmails = [...new Set([...adminEmails, ...encargadoEmails])];

      const to = allEmails.map((email) => ({ email }));

      const adminsNames = adminsArray.map((admin) => admin?.nombre).filter(Boolean).join(", ");
      const encargadosNames = encargados.map((e) => e?.usuario?.nombre).filter(Boolean).join(", ");
      const allNames = [adminsNames, encargadosNames].filter(Boolean).join(", ") || "Sin destinatarios";

      // Enviar correo de notificación
      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: selectedOrdenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: ordenData.estado || "Estado desconocido",
        bodega: ordenData.BodegaSolicitante?.nombre || "No especificada",
        proveedor: ordenData.Proveedor?.nombre_empresa || ordenData.proveedor?.nombre_empresa || "No especificado",
        clientNames: allNames,
        items,
        totalNeto,
        iva,
        totalPago,
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
    if (!canWritePurchaseOrder || !canDeleteBulk) {
      toast.permissionError(
        [ModelType.ORDEN_COMPRA, ScopeType.WRITE],
        [ModelType.BULTO, ScopeType.DELETE]
      );
      setShowRetrocederModal(false);
      setSelectedOrdenId(null);
      setRetrocederPreview(null);
      return;
    }
    try {
      await api(
        `/proceso-compra/ordenes/${selectedOrdenId}/retroceder`, { method: "PUT" }
      );
      try {
        await emailSender(selectedOrdenId)
      } catch (emailErr) {
        toast.error(`Error enviando email tras retroceder orden: ${emailErr.message}`);
      }
      toast.success("Orden retrocedida correctamente");
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        mensajeDelBackend(err) ||
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
    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      setShowValidarModal(false);
      setSelectedOrdenId(null);
      return;
    }
    try {
      await api(
        `/proceso-compra/ordenes/${selectedOrdenId}/validar`, { method: "PUT" }
      );
      toast.success("Orden validada correctamente");
      try {
        await emailSender(selectedOrdenId)
      } catch (emailErr) {
        toast.error(`Error enviando email tras validar orden: ${emailErr.message}`);
      }
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        mensajeDelBackend(err) ||
        "No se pudo validar la orden. Intente nuevamente.";
      toast.error(errorMessage);
    } finally {
      setShowValidarModal(false);
      setSelectedOrdenId(null);
    }
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

  const renderAcciones = (row) => {
    const estado = row?.estado?.toLowerCase();
    return (
      <>
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
          <Trash2 />
        </button>
      </>
    );
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
    {
      header: "Fecha de Emisión",
      accessor: "fecha",
      sortable: true,
      sortValue: (row) => row.fecha_raw || "",
    },
    { header: "Proveedor", accessor: "id_proveedor", sortable: true },
    { header: "Insumos", accessor: "materiasPrimas",
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
    {
      header: "Total Neto",
      accessor: "total_neto",
      sortable: true,
      sortValue: (row) => row.total_neto_raw ?? 0,
    },
    { header: "Estado", accessor: "estado", sortable: true, Cell: ({ value }) => getEstadoChip(value) },
    ...(!isCompactView ? [
      { header: "Opciones", accessor: "opciones", Cell: ({ row }) => (
        <div className="hidden lg:flex gap-2">
          {renderAcciones(row)}
          {(row.hayDescuadre || (row.descuadre != null && Math.abs(Number(row.descuadre)) > 0)) && (
            <AlertTriangle
              size={22}
              className="text-amber-500 flex-shrink-0"
              title="Esta orden tiene un descuadre registrado en la factura recibida"
            />
          )}
        </div>
      ),
    },] : []),

  ];

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
              fecha_raw: orden.fecha,
              total_neto: formatCLP(orden.total_neto, 0),
              total_neto_raw: Number(orden.total_neto) || 0,
              iva: formatCLP(orden.iva, 0),
              total_pago: formatCLP(orden.total_pago, 0),
              estado: orden.estado,
              pagada: orden.pagada,
              materiasPrimas: orden.materiasPrimas,
              hayDescuadre: orden.hayDescuadre,
              descuadre: orden.descuadre,
            }))
            .sort((a, b) => b.id - a.id)
        : [];
      setOrdenes(ordenesData);
    } catch (error) {
      toast.error(`Error fetching órdenes: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pagarOrden = async (id) => {
    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      return;
    }
    try {
      await api(
        `/proceso-compra/ordenes/${id}/pagar`, { method: "PUT" }
      );
      toast.success("Orden pagada correctamente");
      fetchOrdenes();

    } catch (err) {
      const errorMessage =
        mensajeDelBackend(err) ||
        "No se pudo pagar la orden. Por favor, intente nuevamente.";
      toast.error(errorMessage);
    }
  };

  const revertirPagoOrden = async (id) => {
    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      return;
    }
    try {
      await api(
        `/proceso-compra/ordenes/${id}/revertir-pago`, { method: "PUT" }
      );
      toast.success("Pago revertido correctamente");
      fetchOrdenes();
    } catch (err) {
      const errorMessage =
        mensajeDelBackend(err) ||
        "No se pudo revertir el pago. Por favor, intente nuevamente.";
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!canDeletePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.DELETE]);
      return;
    }
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

  const renderExpandedRow = (row) => {
    if (!expandedRows[row.id]) return null;
    return (
      <tr className="bg-gray-50" key={`expanded-${row.id}`}>
        <td colSpan={columns.length + 1} className="px-6 py-4">
          <div>
            <p><strong>Total Neto:</strong> {row.total_neto}</p>
            <p><strong>Estado:</strong> {row.estado}</p>
            <div className="mt-2 flex gap-2">
              {renderAcciones(row)}
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

  const getSearchText = (row) =>
    [row?.id, row?.fecha, row?.id_proveedor, row?.total_neto, row?.estado]
      .filter((v) => v != null)
      .join(" ");

  return (
    <>
      <DataTable
        title="Órdenes de Compra"
        data={ordenes}
        columns={columns}
        getSearchText={getSearchText}
        loading={isLoading}
        loadingMessage="Cargando órdenes de compra"
        emptyMessage="No hay órdenes de compra registradas."
        renderExpandedRow={isCompactView ? renderExpandedRow : undefined}
        headerActions={
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={() => navigate("/Ordenes/add")}
          >
            Añadir Orden
          </button>
        }
      />

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
                disabled={!canWritePurchaseOrder}
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
              <div className="flex justify-center mb-3"><Spinner size="sm" /></div>
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
                disabled={!canWritePurchaseOrder || !canDeleteBulk}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
