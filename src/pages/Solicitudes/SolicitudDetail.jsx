import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "../../lib/toast.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Plus, Loader2, Download, Pencil, Send, PackageCheck, XCircle, CheckCircle2 } from "lucide-react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Tables/Table";
import logo from "../../assets/logo.png";
import { apiBlob, useApi } from "../../lib/api";
import { uploadToS3 } from "../../lib/uploadToS3";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import PageHeader from "../../components/UI/PageHeader.jsx";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { dteService } from "../../services/dteService.js";
import { formatCLP } from "../../services/formatHelpers.js";
import { construirLineasSolicitud } from "../../utils/lineasSolicitud.js";

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

function normalizeEstadoSolicitud(estado) {
  if (!estado) return estado;
  switch (estado) {
    case "Recepcionada Completa":
      return "Recepción Completa";
    case "Recepcionada Parcial Falta Stock":
      return "Recepción Parcial";
    case "Recepcionada Parcial Perdida":
      return "Recepción Parcial con Pérdida";
    default:
      return estado;
  }
}

function getEstadoBadgeClasses(estado) {
  switch (normalizeEstadoSolicitud(estado)) {
    case "Creada":
      return "border-gray-200 bg-gray-50 text-gray-800";
    case "Validada":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "En preparación":
    case "Lista para despacho":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "En tránsito":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "Recepción Completa":
      return "border-green-200 bg-green-50 text-green-800";
    case "Recepción Parcial":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    case "Recepción Parcial con Pérdida":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "Cancelada":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

function safeNumber(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

function formatCantidad(value) {
  const n = safeNumber(value);
  if (n == null) return value == null || value === "" ? "—" : String(value);
  return n.toLocaleString("es-CL", { maximumFractionDigits: 3 });
}

export default function SolicitudDetail() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [solicitud, setSolicitud] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const [expandedPalletIds, setExpandedPalletIds] = useState(() => new Set());
  const [gds,              setGds]              = useState([]);   // GDs de la solicitud
  const [gdLoading,        setGdLoading]        = useState(false);
  const [showEmitirGDModal, setShowEmitirGDModal] = useState(false);
  // Formulario del modal de emisión GD
  const [gdTransportista,  setGdTransportista]  = useState('');
  const [gdFechaEnvio,     setGdFechaEnvio]     = useState(() => new Date().toISOString().slice(0, 10));
  const [guiaDespacho, setGuiaDespacho] = useState("");
  const [medioTransporte, setMedioTransporte] = useState("");
  const [mostrarFormularioEnvio, setMostrarFormularioEnvio] = useState(false);
  const [archivosGuia, setArchivosGuia] = useState([]);

  const canWriteMerchRequest = checkScope(ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE);
  const canWritePallet = checkScope(ModelType.PALLET, ScopeType.WRITE);

  const fetchSolicitud = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const res = await api(`/solicitudes-mercaderia/${solicitudId}`);
      setSolicitud(res);
      setGuiaDespacho(res?.numero_guia_despacho ?? "");
      setMedioTransporte(res?.medio_transporte ?? "");
    } catch (err) {
      console.error("Error fetching solicitud:", err);
      setLoadFailed(true);
      toast.error("Error cargando la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const cargarGDs = async () => {
    if (!solicitudId) return;
    try {
      const docs = await dteService.listarPorSolicitud(solicitudId);
      setGds(docs ?? []);
    } catch (err) {
      console.error("Error cargando GDs:", err);
    }
  };

  useEffect(() => {
    if (!solicitudId) return;
    fetchSolicitud();
    cargarGDs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  const detalles = useMemo(
    () => (Array.isArray(solicitud?.detalles) ? solicitud.detalles : []),
    [solicitud]
  );
  const pallets = useMemo(
    () => (Array.isArray(solicitud?.pallets) ? solicitud.pallets : []),
    [solicitud]
  );

  const solicitanteNombre =
    solicitud?.usuarioSolicitante?.nombre ??
    solicitud?.usuarioSolicitante?.email ??
    solicitud?.usuarioSolicitante?.username ??
    "—";

  const puedeCancelar =
    solicitud?.estado &&
    ["Creada", "Validada", "En preparación", "Lista para despacho"].includes(
      solicitud.estado
    );

  // Insumos y productos terminados van separados: se piden distinto (unidad de medida vs.
  // cajas) y solo el insumo tiene costo. La lógica está en utils/lineasSolicitud.js, con tests.
  const { lineas, insumos, productosTerminados, totales } = useMemo(
    () => construirLineasSolicitud(detalles),
    [detalles]
  );

  const celdaCantidad = ({ value }) =>
    value == null ? <span className="text-gray-400">—</span> : formatCantidad(value);

  // No todos los PT se piden en cajas. Decir "0 cajas · 12 unidades" hace pensar que falta
  // información; cuando no hay cajas simplemente no se nombran.
  const resumenPT = () => {
    const unidades = `${formatCantidad(totales.unidadesPT)} unidades`;
    return totales.cajas > 0 ? `${formatCantidad(totales.cajas)} cajas · ${unidades}` : unidades;
  };

  const celdaComentario = {
    header: "Comentario",
    accessor: "comentario",
    cellClassName: "whitespace-pre-wrap break-words max-w-[36rem]",
    Cell: ({ value }) => (value ? value : <span className="text-gray-400">—</span>),
  };

  const insumosColumns = useMemo(
    () => [
      { header: "Insumo", accessor: "nombre" },
      { header: "Solicitada", accessor: "cantidad_solicitada", Cell: celdaCantidad },
      { header: "Despachada", accessor: "cantidad_despachada", Cell: celdaCantidad },
      { header: "Recepcionada", accessor: "cantidad_recepcionada", Cell: celdaCantidad },
      { header: "UM", accessor: "unidad_medida" },
      {
        header: "Costo Unitario",
        accessor: "costo_unitario",
        Cell: ({ value }) =>
          value ? formatCLP(value, 0) : <span className="text-gray-400">—</span>,
      },
      {
        header: "Costo Despachado",
        accessor: "costo_despachado",
        Cell: ({ value }) =>
          value ? (
            <span className="font-medium">{formatCLP(value, 0)}</span>
          ) : (
            <span className="text-gray-400">—</span>
          ),
      },
      celdaComentario,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // El PT se pide por nombre de facturación y casi siempre en cajas: esa es la columna que
  // le importa a bodega, y hasta ahora vivía apretada como subtítulo dentro del nombre.
  const productosTerminadosColumns = useMemo(
    () => [
      {
        header: "Producto",
        accessor: "nombre",
        Cell: ({ value, row }) => (
          <div>
            {value}
            {row?.legacy && (
              <div className="text-xs text-amber-600">Sin nombre de facturación</div>
            )}
          </div>
        ),
      },
      {
        header: "Cajas",
        accessor: "cajas",
        Cell: ({ value, row }) =>
          value == null ? (
            <span className="text-gray-400">Por unidad</span>
          ) : (
            <span>
              <span className="font-medium">{formatCantidad(value)}</span>
              <span className="text-xs text-gray-500"> × {row.unidadesPorCaja} un.</span>
            </span>
          ),
      },
      { header: "Unidades", accessor: "cantidad_solicitada", Cell: celdaCantidad },
      { header: "Despachadas", accessor: "cantidad_despachada", Cell: celdaCantidad },
      { header: "Recepcionadas", accessor: "cantidad_recepcionada", Cell: celdaCantidad },
      celdaComentario,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const palletsData = useMemo(
    () =>
      pallets.map((p) => ({
        id: p?.id,
        identificador: p?.identificador ?? `Pallet #${p?.id ?? "—"}`,
        estado: p?.estado ?? "—",
        bultos: Array.isArray(p?.Bultos) ? p.Bultos : Array.isArray(p?.bultos) ? p.bultos : [],
      })),
    [pallets]
  );

  const palletsColumns = useMemo(
    () => [
      { header: "ID",          accessor: "id"           },
      { header: "Identificador", accessor: "identificador" },
      { header: "Estado",      accessor: "estado"       },
    ],
    []
  );

  const bultosColumns = useMemo(
    () => [
      { header: "ID", accessor: "id" },
      { header: "Identificador", accessor: "identificador" },
      { header: "Materia Prima", accessor: "materia_prima" },
      { header: "Unidades Disp.", accessor: "unidades_disponibles" },
      { header: "Cantidad Un.", accessor: "cantidad_un" },
    ],
    []
  );

  const handleEmitirGDSolicitud = async () => {
    if (!solicitudId) return;
    setGdLoading(true);
    try {
      await api('/facturacion/emitir-guia-despacho', {
        method: 'POST',
        body: {
          id_solicitud_mercaderia: Number(solicitudId),
          costo_total:            totales.costoInsumos,
          transportista:          gdTransportista.trim() || null,
          fecha_envio_override:   gdFechaEnvio || null,
        },
      });
      toast.success('Guía de Despacho emitida correctamente');
      setShowEmitirGDModal(false);
      setGdTransportista('');
      setGdFechaEnvio(new Date().toISOString().slice(0, 10));
      await cargarGDs();
    } catch (err) {
      toast.error('Error al emitir GD: ' + (err?.message ?? err));
    } finally {
      setGdLoading(false);
    }
  };

  const handleConfirmarLlegadaGD = async (gdId) => {
    try {
      await dteService.confirmarLlegada(gdId);
      toast.success('Llegada confirmada ✓');
      await cargarGDs();
    } catch (err) {
      toast.error('Error al confirmar llegada: ' + (err?.message ?? err));
    }
  };

  const toggleExpandedPallet = (palletId) => {
    setExpandedPalletIds((prev) => {
      const next = new Set(prev);
      if (next.has(palletId)) next.delete(palletId);
      else next.add(palletId);
      return next;
    });
  };

  const handleValidarSolicitud = async () => {
    if (!canWriteMerchRequest || !canWritePallet) {
      toast.permissionError(
        [ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE],
        [ModelType.PALLET, ScopeType.WRITE]
      );
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await api(`/solicitudes-mercaderia/${solicitudId}/validar`, { method: "PUT" });
      toast.success("Solicitud validada");
      await fetchSolicitud();
    } catch (err) {
      console.error("validarSolicitud error:", err);
      toast.error(err?.message || "Error validando la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarSolicitud = async () => {
    if (!canWriteMerchRequest) {
      toast.permissionError([ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      await api(`/solicitudes-mercaderia/${solicitudId}/cancelar`, { method: "PUT" });
      toast.success("Solicitud cancelada");
      await fetchSolicitud();
    } catch (err) {
      console.error("cancelarSolicitud error:", err);
      toast.error(err?.message || "Error cancelando la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarSolicitud = async () => {
    if (!guiaDespacho?.trim() || !medioTransporte?.trim()) {
      toast.error("Debes ingresar N° de guía y medio de transporte");
      return;
    }

    if (!canWriteMerchRequest) {
      toast.permissionError([ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let archivosRefs = [];
      if (archivosGuia.length > 0) {
        archivosRefs = await Promise.all(
          archivosGuia.map(async (file) => {
            try {
              return await uploadToS3(file);
            } catch (e) {
              console.error("upload guia error:", e);
              toast.error(`Error subiendo ${file.name}`);
              return null;
            }
          })
        );
        archivosRefs = archivosRefs.filter(Boolean);
      }

      await api(`/solicitudes-mercaderia/${solicitudId}/enviar`, {
        method: "PUT",
        body: {
          numero_guia_despacho: guiaDespacho.trim(),
          medio_transporte: medioTransporte.trim(),
          archivos_guia_despacho: archivosRefs,
        },
      });

      toast.success("Solicitud enviada");
      setMostrarFormularioEnvio(false);
      setArchivosGuia([]);
      await fetchSolicitud();
    } catch (err) {
      console.error("enviarSolicitud error:", err);
      toast.error(err?.message || "Error enviando la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSolicitudInsumosPDF = () => {
    if (!solicitud) return;

    try {
      // Cambiar a orientación landscape para máximo espacio horizontal
      const doc = new jsPDF("l", "mm", "a4");
      const marginX = 12;
      const marginY = 8;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const titulo = `Solicitud de Mercadería #${solicitud.id}`;
      const estado = normalizeEstadoSolicitud(solicitud.estado) ?? "—";
      const bodegaProveedora = solicitud.bodegaProveedora?.nombre ?? "—";
      const bodegaSolicitante = solicitud.bodegaSolicitante?.nombre ?? "—";
      const creada = (() => {
        const value = solicitud.createdAt;
        if (!value) return "—";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("es-CL");
      })();

      // Header con fondo gris
      doc.setFillColor(243, 244, 246);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(titulo, marginX, 10);
      doc.setFontSize(8);
      doc.text(`Proveedora: ${bodegaProveedora} · Solicita: ${bodegaSolicitante}`, marginX, 16);
      doc.text(`Estado: ${estado} · Creada: ${creada}`, marginX, 21);

      try {
        doc.addImage(logo, "PNG", pageWidth - marginX - 15, 6, 15, 15);
      } catch {
        // ignore
      }

      // El PDF lleva las dos clases de línea; la columna "Tipo" dice cuál es cada una, que
      // antes se adivinaba por un "(PT)" pegado al nombre.
      const startInsumosY = 32;
      autoTable(doc, {
        startY: startInsumosY,
        head: [["#", "Tipo", "Ítem", "Cant. Sol.", "Cant. Desp.", "Cant. Rec.", "UM", "Comentario"]],
        body: lineas.map((row, idx) => [
          String(idx + 1),
          row.tipo === "PT" ? "PT" : "Insumo",
          String(row.nombre ?? "—"),
          String(
            row.enCajas
              ? `${formatCantidad(row.cajas)} cajas (${formatCantidad(row.cantidad_solicitada)} un.)`
              : formatCantidad(row.cantidad_solicitada)
          ),
          String(row.cantidad_despachada == null ? "—" : formatCantidad(row.cantidad_despachada)),
          String(row.cantidad_recepcionada == null ? "—" : formatCantidad(row.cantidad_recepcionada)),
          String(row.unidad_medida ?? "—"),
          String(row.comentario ?? ""),
        ]),
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          overflow: "linebreak",
          valign: "top",
          halign: "left",
          minCellHeight: 8,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
          valign: "middle",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 9, halign: "center", minCellHeight: 8 },
          1: { cellWidth: 14, halign: "center", minCellHeight: 8 },
          2: { cellWidth: 62, minCellHeight: 8 },
          3: { cellWidth: 30, halign: "right", minCellHeight: 8 },
          4: { cellWidth: 22, halign: "right", minCellHeight: 8 },
          5: { cellWidth: 22, halign: "right", minCellHeight: 8 },
          6: { cellWidth: 15, halign: "center", minCellHeight: 8 },
          7: { cellWidth: 43, valign: "top", minCellHeight: 8 },
        },
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        margin: { left: marginX, right: marginX, top: marginY, bottom: 14 },
        didParseCell: (data) => {
          // Aumentar altura de fila basado en contenido
          const content = data.cell.text;
          if (Array.isArray(content) && content.length > 0) {
            const text = content[0];
            const lines = String(text).split("\n").length;
            const estimatedHeight = Math.max(8, lines * 3.5 + 5);
            data.cell.height = Math.max(data.cell.height || 8, estimatedHeight);
          }
        },
        didDrawPage: (data) => {
          const pageNumber = doc.internal.getNumberOfPages();
          const totalPages = data.pageCount || "?";
          
          // Pie de página
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(
            `${titulo} · ${estado} · De: ${bodegaProveedora} → ${bodegaSolicitante}`,
            marginX,
            pageHeight - 5
          );
          doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - marginX, pageHeight - 5, {
            align: "right",
          });
          doc.setTextColor(15, 23, 42);
        },
      });

      doc.save(`solicitud-${solicitud.id}-insumos.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Error generando PDF");
    }
  };

  const handleDescargarEtiquetasPallets = async () => {
    if (!canWriteMerchRequest) {
      toast.permissionError([ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const blob = await apiBlob(
        `/solicitudes-mercaderia/${solicitudId}/obtener_etiquetas`,
        { method: "PUT", body: {} }
      );

      const contentType = blob?.type || "";
      const extension = contentType.includes("zip") ? "zip" : "pdf";
      downloadBlob(blob, `pallets-solicitud-${solicitudId}.${extension}`);
      toast.success("Etiquetas descargadas");
    } catch (err) {
      console.error("etiquetas pallets error:", err);
      toast.error(err?.message || "Error descargando etiquetas");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !solicitud) return <PageLoader message="Cargando solicitud" />;

  if (loadFailed) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <BackButton to="/Solicitudes" />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-red-600 font-medium">No se pudo cargar la solicitud.</div>
          <button
            onClick={fetchSolicitud}
            className="mt-3 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <BackButton to="/Solicitudes" />
        </div>
        <div className="text-sm text-gray-500">No se encontró la solicitud.</div>
      </div>
    );
  }

  // ── Acciones ────────────────────────────────────────────────────────────────
  // Una sola acción principal, la que corresponde al estado; todo lo demás secundario, y
  // Cancelar detrás del menú «⋯». Antes esto vivía en cuatro lugares distintos de la vista:
  // la cabecera, el panel de envío, la sección de guías y el pie de la tabla de insumos.
  const accionPrincipal = (() => {
    if (solicitud.estado === "Creada")
      return { label: "Validar", icon: <CheckCircle2 className="w-4 h-4" />, onClick: handleValidarSolicitud, disabled: loading };
    if (solicitud.estado === "Lista para despacho")
      return {
        label: mostrarFormularioEnvio ? "Cerrar envío" : "Enviar",
        icon: <Send className="w-4 h-4" />,
        onClick: () => setMostrarFormularioEnvio((v) => !v),
        disabled: loading,
      };
    if (solicitud.estado === "En tránsito")
      return {
        label: "Recepcionar",
        icon: <PackageCheck className="w-4 h-4" />,
        onClick: () => navigate(`/Solicitudes/${solicitudId}/recepcionar-solicitud`),
        disabled: loading,
      };
    return null;
  })();

  const accionesSecundarias = [
    solicitud.estado === "Creada" && {
      label: "Editar",
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => navigate(`/Solicitudes/${solicitudId}/edit`),
      disabled: loading,
    },
    {
      label: "Descargar PDF",
      icon: <Download className="w-4 h-4" />,
      onClick: handleDownloadSolicitudInsumosPDF,
      disabled: loading || lineas.length === 0,
    },
    gds.length === 0 && {
      label: "Emitir Guía de Despacho",
      icon: <FileText className="w-4 h-4" />,
      onClick: () => setShowEmitirGDModal(true),
      disabled: gdLoading || lineas.length === 0,
      title: lineas.length === 0 ? "La solicitud no tiene ítems" : undefined,
    },
  ].filter(Boolean);

  const accionesDestructivas = puedeCancelar
    ? [
        {
          label: "Cancelar solicitud",
          icon: <XCircle className="w-4 h-4" />,
          onClick: handleCancelarSolicitud,
          disabled: loading,
          confirmar: {
            titulo: "¿Cancelar esta solicitud?",
            mensaje:
              "La solicitud queda cancelada y no se puede reabrir. Los ítems que ya estén en un pallet vuelven a quedar disponibles.",
            textoBoton: "Sí, cancelar",
          },
        },
      ]
    : [];

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          volverA="/Solicitudes"
          titulo={`Solicitud #${solicitud.id}`}
          estado={
            <span
              className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(solicitud.estado)}`}
            >
              {normalizeEstadoSolicitud(solicitud.estado) ?? "—"}
            </span>
          }
          acciones={
            <PanelAcciones
              principal={accionPrincipal}
              secundarias={accionesSecundarias}
              destructivas={accionesDestructivas}
            />
          }
        />

        {solicitud.estado === "Lista para despacho" && mostrarFormularioEnvio && (
          <div className="bg-white p-6 rounded-lg shadow space-y-3 mb-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-text">Datos de envío</h2>
              <button
                onClick={handleEnviarSolicitud}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                Confirmar envío
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Número de Guía de Despacho"
                value={guiaDespacho}
                onChange={(e) => setGuiaDespacho(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Medio de Transporte"
                value={medioTransporte}
                onChange={(e) => setMedioTransporte(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-gray-700">
                Adjuntar archivos guía de despacho (opcional)
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setArchivosGuia(files);
                }}
                className="w-full"
              />
              {archivosGuia.length > 0 && (
                <div className="text-xs text-gray-600">
                  {archivosGuia.length} archivo(s) seleccionado(s)
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
            <div className="text-xs text-gray-500 font-medium">ESTADO</div>
            <div className="mt-1">
              <span
                className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(solicitud.estado)}`}
              >
                {normalizeEstadoSolicitud(solicitud.estado) ?? "—"}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-2">Creada: {formatDateTime(solicitud.createdAt)}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium">BODEGAS</div>
            <div className="font-bold text-text mt-1">{solicitud.bodegaProveedora?.nombre ?? "—"}</div>
            <div className="text-xs text-gray-600 mt-2">Destino: {solicitud.bodegaSolicitante?.nombre ?? "—"}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 font-medium">CONTENIDO</div>
            <div className="font-bold text-text mt-1">
              {totales.insumos} insumo{totales.insumos === 1 ? "" : "s"}
              {" · "}
              {totales.productosTerminados} PT
            </div>
            <div className="text-xs text-gray-600 mt-2">Solicita: {solicitanteNombre}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-xs text-gray-500 font-medium">LOGÍSTICA</div>
            <div className="font-bold text-text mt-1">Pallets: {palletsData.length}</div>
            <div className="text-xs text-gray-600 mt-2">Guía: {solicitud.numero_guia_despacho ?? "—"}</div>
          </div>
        </div>

        {/* Resumen: dos bloques con identidad propia en vez de una lista plana de pares
            clave/valor. Cada uno se muestra solo si la solicitud lleva ese tipo de ítem. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-l-blue-500">
              <p className="text-xs uppercase tracking-wide text-gray-500">Insumos</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{totales.insumos}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totales.costoInsumos > 0
                  ? `${formatCLP(totales.costoInsumos, 0)} despachados`
                  : "Sin costo registrado"}
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-l-green-500">
              <p className="text-xs uppercase tracking-wide text-gray-500">Productos terminados</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{totales.productosTerminados}</p>
              <p className="text-xs text-gray-500 mt-1">
                {totales.productosTerminados === 0 ? "Esta solicitud no lleva PT" : resumenPT()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow space-y-2 text-sm">
            <h2 className="text-base font-semibold text-text">Trazabilidad</h2>
            {[
              ["Creación", formatDateTime(solicitud.createdAt)],
              ["Envío", solicitud.fecha_envio ? formatDateTime(solicitud.fecha_envio) : "Pendiente"],
              ["Recepción", solicitud.fecha_recepcion ? formatDateTime(solicitud.fecha_recepcion) : "Pendiente"],
              ["Transporte", solicitud.medio_transporte ?? "—"],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex items-start justify-between gap-4">
                <span className="text-gray-500">{etiqueta}</span>
                <span className="text-text font-medium text-right">{valor}</span>
              </div>
            ))}
          </div>
        </div>

        {insumos.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text">Insumos</h2>
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Costo despachado:</span>{" "}
                <span className="font-semibold text-gray-900">
                  {totales.costoInsumos > 0 ? formatCLP(totales.costoInsumos, 0) : "—"}
                </span>
              </div>
            </div>
            <Table data={insumos} columns={insumosColumns} />
          </div>
        )}

        {productosTerminados.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text">Productos terminados</h2>
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Total:</span>{" "}
                <span className="font-semibold text-gray-900">{resumenPT()}</span>
              </div>
            </div>
            <Table data={productosTerminados} columns={productosTerminadosColumns} />
          </div>
        )}

        {lineas.length === 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <p className="text-gray-500 text-sm">Esta solicitud no tiene ítems registrados.</p>
          </div>
        )}

        {/* ── Sección Guías de Despacho ─────────────────────────────────
            "Emitir Guía de Despacho" ya no vive acá: subió al panel de acciones de la
            cabecera, como el resto. Esta sección solo muestra las guías emitidas. */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-text">Guías de Despacho</h2>

          {gds.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-500">
              No hay guías de despacho emitidas para esta solicitud.
            </div>
          ) : (
            <div className="space-y-2">
              {gds.map((gd) => {
                const meta = gd.metadata ?? {};
                const fechaLlegada = meta.fecha_llegada;
                return (
                  <div key={gd.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800">GD N° {gd.folio ?? '—'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          gd.estadoSii === 'aceptado' ? 'bg-green-100 text-green-800' :
                          gd.estadoSii === 'rechazado' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {gd.estadoSii?.toUpperCase() ?? 'PENDIENTE'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-0.5">
                        {meta.bodega_origen && <span>De: <strong>{meta.bodega_origen}</strong></span>}
                        {meta.bodega_destino && <span>→ <strong>{meta.bodega_destino}</strong></span>}
                        {meta.transportista && <span>· Transportista: {meta.transportista}</span>}
                        {gd.fechaEmision && <span>· Emitida: {new Date(gd.fechaEmision).toLocaleDateString('es-CL')}</span>}
                        {fechaLlegada
                          ? <span className="text-green-700 font-medium">· Llegada confirmada el {new Date(fechaLlegada).toLocaleString('es-CL')}</span>
                          : <span className="text-amber-600">· En tránsito</span>
                        }
                      </div>
                      {gd.montoTotal > 0 && (
                        <span className="text-xs text-gray-500">Total: {formatCLP(gd.montoTotal, 0)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!fechaLlegada && (
                        <button
                          onClick={() => handleConfirmarLlegadaGD(gd.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-green-300 text-green-700 hover:bg-green-50"
                        >
                          Confirmar llegada
                        </button>
                      )}
                      <button
                        onClick={() => dteService.verPDF(gd).catch(console.error)}
                        className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        title="Ver PDF"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => dteService.descargarPDF(gd, { id: solicitudId, materiasPrimas: [] }).catch(console.error)}
                        className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        title="Descargar PDF"
                      >
                        Descargar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal emitir GD */}
        {showEmitirGDModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900">Emitir Guía de Despacho</h2>
                <button onClick={() => setShowEmitirGDModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Bodegas (informativas, vienen de la solicitud) */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span className="text-gray-500">Bodega origen</span>
                    <span className="font-medium">{solicitud?.bodegaProveedora?.nombre ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="text-gray-500">Bodega destino</span>
                    <span className="font-medium">{solicitud?.bodegaSolicitante?.nombre ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="text-gray-500">Total a despachar</span>
                    <span className="font-semibold text-gray-900">{formatCLP(totales.costoInsumos, 0)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de envío
                  </label>
                  <input
                    type="date"
                    value={gdFechaEnvio}
                    onChange={(e) => setGdFechaEnvio(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transportista
                  </label>
                  <input
                    type="text"
                    value={gdTransportista}
                    onChange={(e) => setGdTransportista(e.target.value)}
                    placeholder="Nombre del transportista o empresa de transporte"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowEmitirGDModal(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEmitirGDSolicitud}
                    disabled={gdLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    {gdLoading ? <><Loader2 size={14} className="animate-spin" /> Emitiendo…</> : 'Emitir GD'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {palletsData.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-text">Pallets</h2>
            <Table
              data={palletsData}
              columns={palletsColumns}
              renderActions={(row) => (
                <button
                  onClick={() => toggleExpandedPallet(row.id)}
                  className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
                >
                  {expandedPalletIds.has(row.id) ? "Ocultar bultos" : "Ver bultos"}
                </button>
              )}
              renderExpandedRow={(row) => {
                if (!expandedPalletIds.has(row.id)) return null;

                const palletBultos = Array.isArray(row?.bultos) ? row.bultos : [];
                const bultosData = palletBultos.map((b) => {
                  const unidad =
                    b?.MateriaPrima?.unidad_medida ??
                    b?.materiaPrima?.unidad_medida ??
                    "";

                  const cantidadUn = (() => {
                    if (b?.peso_unitario == null || b?.peso_unitario === "") return "—";
                    if (!unidad) return String(b.peso_unitario);
                    return `${b.peso_unitario} ${String(unidad).toUpperCase()}`;
                  })();

                  return {
                    id: b?.id,
                    identificador: b?.identificador ?? "—",
                    materia_prima:
                      b?.MateriaPrima?.nombre ??
                      b?.materiaPrima?.nombre ??
                      (b?.loteProductoFinal?.productoBase
                        ? `${b.loteProductoFinal.productoBase.nombre} (PT)`
                        : "—"),
                    unidades_disponibles: b?.unidades_disponibles ?? "—",
                    cantidad_un: cantidadUn,
                  };
                });

                return (
                  <tr>
                    <td colSpan={palletsColumns.length + 1} className="px-6 py-4">
                      {bultosData.length > 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4 max-w-full">
                          <div className="text-sm font-medium text-text mb-3">
                            Bultos del pallet {row.identificador}
                          </div>
                          <div className="w-full max-w-full overflow-x-auto">
                            <table className="min-w-full w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  {bultosColumns.map((col) => (
                                    <th
                                      key={col.accessor}
                                      className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider whitespace-nowrap"
                                    >
                                      {col.header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {bultosData.map((b) => (
                                  <tr key={b.id ?? b.identificador} className="border-t">
                                    {bultosColumns.map((col) => (
                                      <td
                                        key={`${b.id ?? b.identificador}-${col.accessor}`}
                                        className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap"
                                      >
                                        {b[col.accessor]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Sin bultos asociados.</div>
                      )}
                    </td>
                  </tr>
                );
              }}
            />

            <div className="flex justify-end">
              <button
                onClick={handleDescargarEtiquetasPallets}
                disabled={loading}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                Etiquetas Pallets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
