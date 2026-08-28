import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "../../lib/toast.js";
// jspdf y jspdf-autotable NO se importan acá: se cargan bajo demanda dentro de
// `handleDownloadSolicitudInsumosPDF`, que es el único sitio que los usa. Importarlos arriba
// los mete en el trozo de esta vista y los descarga todo el que la abra.
import { FileText, FileSearch, Loader2, Download, Pencil, Send, XCircle, CheckCircle2, Link2 } from "lucide-react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Tables/Table";
import logo from "../../assets/logo.png";
import { apiBlob, useApi } from "../../lib/api";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import PageHeader from "../../components/UI/PageHeader.jsx";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import CentroDocumentosSolicitud from "../../components/DTE/CentroDocumentosSolicitud.jsx";
import { adjuntosService } from "../../services/adjuntosService.js";
import Modal from "../../components/UI/Modal.jsx";
import PalletContenidoCard from "../../components/Pallets/PalletContenidoCard.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { dteService } from "../../services/dteService.js";
import { formatCLP } from "../../services/formatHelpers.js";
import { construirLineasSolicitud } from "../../utils/lineasSolicitud.js";
import { bultosSinEtiqueta } from "../../utils/contenidoPallet.js";

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

  // GDs electrónicas ya emitidas. Sólo de lectura: la emisión salió de esta vista mientras
  // dure el bloqueo del traspaso a LibreDTE, y la guía se registra a mano al enviar.
  const [gds, setGds] = useState([]);
  const [guiaDespacho, setGuiaDespacho] = useState("");
  const [medioTransporte, setMedioTransporte] = useState("");
  const [mostrarFormularioEnvio, setMostrarFormularioEnvio] = useState(false);
  const [tab, setTab] = useState("insumos");
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
    cellClassName: "whitespace-pre-wrap break-words max-w-[20rem]",
    Cell: ({ value }) => (value ? value : <span className="text-gray-400">—</span>),
  };

  // `valor_despacho` lo calcula el backend sumando el costo de los bultos que van arriba de
  // los pallets. Es el valor real de lo que sale, e incluye los PT — a diferencia del costo
  // por línea, que estima con el precio de lista del insumo y deja los PT en cero.
  //
  // ⚠️ Se muestra SIEMPRE que haya bultos cargados, también con el despacho a medias. Antes se
  // escondía hasta que todas las líneas tuvieran cantidad despachada, con el argumento de que
  // si no era "una proyección sobre cantidades que todavía pueden cambiar" — pero eso describe
  // al costo estimado por línea, no a éste, que mide los bultos que están físicamente sobre el
  // pallet. Es justo el número que hay que declarar en la guía de despacho, y un despacho
  // parcial no es una operación a medias: es un envío completo de parte del pedido, y el resto
  // viaja después con su propia guía. El desglose bulto por bulto está en el modal del pallet.
  const valorDespacho = Number(solicitud?.valor_despacho) || 0;

  // Bultos nacidos de una división que todavía no tienen su QR pegado. Si salen así, en la
  // bodega de destino nadie puede escanearlos y el problema se descubre allá.
  const sinEtiqueta = useMemo(() => bultosSinEtiqueta(pallets), [pallets]);

  const descargarEtiquetasPendientes = async () => {
    if (!sinEtiqueta.length) return;
    try {
      setLoading(true);
      const blob = await apiBlob("/bultos/etiquetas", {
        method: "POST",
        body: { ids_bultos: sinEtiqueta },
      });
      downloadBlob(blob, `qr-bultos-nuevos-solicitud-${solicitudId}.pdf`);
      toast.success("Etiquetas descargadas");
      // El backend limpia la marca al descargar, así que hay que releer para que el aviso
      // desaparezca sin obligar a recargar la página.
      await fetchSolicitud();
    } catch (err) {
      console.error("etiquetas pendientes:", err);
      toast.error(err?.message || "No se pudieron descargar las etiquetas");
    } finally {
      setLoading(false);
    }
  };

  // La unidad de medida acompaña al nombre en vez de ocupar su propia columna: es un dato
  // del insumo, no una cifra que se compare hacia abajo. Y el costo salió de la tabla —
  // para leer de un vistazo lo que importa es cuánto se pidió y cuánto llegó.
  const insumosColumns = useMemo(
    () => [
      {
        header: "Insumo",
        accessor: "nombre",
        Cell: ({ value, row }) => (
          <div className="whitespace-normal break-words">
            {value}
            {row?.unidad_medida && row.unidad_medida !== "—" && (
              <span className="text-xs text-gray-500"> · {row.unidad_medida}</span>
            )}
          </div>
        ),
      },
      { header: "Solicitada", accessor: "cantidad_solicitada", Cell: celdaCantidad },
      { header: "Despachada", accessor: "cantidad_despachada", Cell: celdaCantidad },
      { header: "Recepcionada", accessor: "cantidad_recepcionada", Cell: celdaCantidad },
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


  // 🔴 LA EMISIÓN ELECTRÓNICA VUELVE A ESTA VISTA (2026-08-12).
  //
  // Se había retirado mientras duraba el bloqueo del traspaso a LibreDTE, con la idea de que
  // la emisión saliera después de los datos ya registrados en `enviar`. Eso último nunca se
  // hizo, así que el endpoint `POST /facturacion/emitir-guia-despacho` quedó vivo y **sin un
  // solo llamador en la web ni en el móvil**: las guías de traslado se emitían fuera del ERP y
  // el folio se escribía a mano acá. Con el portal MIPYME desapareciendo, no había dónde.
  //
  // Ahora se emite desde el mismo flujo de envío y NO abre un segundo camino: usa el
  // transportista y la fecha de esta misma solicitud, y el folio que devuelve LibreDTE es el
  // que queda escrito en `numero_guia_despacho`. Un solo número, un solo documento.
  const [emitiendoGD, setEmitiendoGD] = useState(false);
  const [viendoBorradorGD, setViendoBorradorGD] = useState(false);

  // Ver la guía como saldrá, antes de gastar el folio. Una guía emitida no se edita.
  const handleVerBorradorGD = async () => {
    setViendoBorradorGD(true);
    try {
      await dteService.verPrevisualizacion('guia-solicitud', solicitudId);
    } catch (err) {
      toast.error('No se pudo generar el borrador: ' + (err?.message ?? err));
    } finally {
      setViendoBorradorGD(false);
    }
  };

  const handleEmitirGD = async () => {
    setEmitiendoGD(true);
    try {
      const gd = await dteService.emitirGuiaDespachoSolicitud(solicitudId, {
        transportista: medioTransporte.trim() || undefined,
      });
      toast.success(`Guía de despacho N° ${gd?.folio ?? ''} emitida ✓`);
      // El folio es EL número de la guía: se escribe solo para que nadie lo transcriba mal.
      if (gd?.folio) setGuiaDespacho(String(gd.folio));
      await cargarGDs();
    } catch (err) {
      toast.error('No se pudo emitir la guía: ' + (err?.message ?? err));
    } finally {
      setEmitiendoGD(false);
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

      // 🔴 LOS ARCHIVOS DE LA GUÍA VAN A LA TABLA DE ADJUNTOS, NO AL JSONB.
      //
      // Antes se subían con `uploadToS3` y se guardaban como referencias sueltas en
      // `SolicitudMercaderia.archivos_guia_despacho`. Ese campo tenía **una sola mención en todo
      // el frontend: la que lo escribía**. Nadie lo leía ni lo mostraba nunca, así que alguien
      // adjuntaba la guía firmada al despachar y no había forma de volver a verla desde la
      // aplicación.
      //
      // `adjuntosService` es el mismo camino que usa el resto del sistema: tabla propia, con
      // autor, descripción e integridad referencial con la solicitud — y se ve en el centro de
      // documentos apenas se sube. Los archivos que quedaron en el JSONB se siguen mostrando
      // ahí, marcados como heredados; lo nuevo ya no entra por esa puerta.
      if (archivosGuia.length > 0) {
        const resultados = await Promise.allSettled(
          archivosGuia.map((file) =>
            adjuntosService.subir({
              archivo: file,
              descripcion: `Guía de despacho ${guiaDespacho.trim()}`,
              idSolicitud: Number(solicitudId),
            })
          )
        );
        const fallidos = resultados
          .map((r, i) => (r.status === "rejected" ? archivosGuia[i].name : null))
          .filter(Boolean);
        // Un archivo que no sube NO cancela el envío: los pallets y el stock son lo que importa
        // acá, y el adjunto se puede volver a subir después desde el centro de documentos. Pero
        // se dice cuál falló, porque quien lo adjuntó cree que quedó guardado.
        if (fallidos.length > 0) {
          toast.error(`No se pudo adjuntar: ${fallidos.join(", ")}. La solicitud se envía igual.`);
        }
      }

      await api(`/solicitudes-mercaderia/${solicitudId}/enviar`, {
        method: "PUT",
        body: {
          numero_guia_despacho: guiaDespacho.trim(),
          medio_transporte: medioTransporte.trim(),
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

  const handleDownloadSolicitudInsumosPDF = async () => {
    if (!solicitud) return;

    try {
      // jsPDF y su plugin de tablas se cargan al APRETAR el botón, no al abrir la vista.
      //
      // ⚠️ Van DENTRO del try. Estaban afuera, así que cualquier fallo acá se escapaba del
      // handler entero: sin toast, sin mensaje, el botón simplemente no hacía nada. Un
      // `import()` que falla —trozo no descargable, red caída— tiene que verse.
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

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
    // "En tránsito" no tiene acción en la web: se recepciona escaneando en bodega. Ver el
    // aviso de abajo.
    return null;
  })();

  /**
   * Lo que el estado explica pero no se hace desde acá.
   *
   * Decisión de Cristóbal (2026-08-01): la recepción es solo del móvil. La web tenía su
   * propia vista para recepcionar —se eliminó— que permitía cerrar una recepción sin haber
   * escaneado nada: alguien podía declarar recibida mercadería que nadie miró.
   */
  const avisoDeEstado =
    solicitud.estado === "En tránsito"
      ? "La recepción se hace escaneando los bultos desde la app móvil. Acá se ve el avance."
      : null;

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
    // "Emitir Guía de Despacho" ya no es una acción aparte. La guía es una sola y se
    // registra al enviar; la emisión electrónica se enchufa a ese mismo registro cuando se
    // levante el bloqueo del traspaso a LibreDTE. Ver el aviso del modal de envío.
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

        {/* Una sola fila de indicadores. Antes había dos filas de tarjetas seguidas —las 4
            de cabecera y las 2 del resumen— que decían cosas parecidas y ocupaban una
            pantalla entera antes de llegar al contenido. */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Estado</div>
            <div className="mt-2">
              <span
                className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(solicitud.estado)}`}
              >
                {normalizeEstadoSolicitud(solicitud.estado) ?? "—"}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-2">Solicita: {solicitanteNombre}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bodegas</div>
            <div className="font-bold text-text mt-2">{solicitud.bodegaProveedora?.nombre ?? "—"}</div>
            <div className="text-xs text-gray-600 mt-1">
              → {solicitud.bodegaSolicitante?.nombre ?? "—"}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Insumos</div>
            <div className="text-3xl font-bold text-gray-800 mt-1">{totales.insumos}</div>
            <div className="text-xs text-gray-600 mt-1">
              {totales.insumos === 0 ? "Sin insumos" : `en ${palletsData.length} pallet${palletsData.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Productos terminados
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-1">
              {totales.productosTerminados}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {totales.productosTerminados === 0 ? "Esta solicitud no lleva PT" : resumenPT()}
            </div>
          </div>
        </div>

        {avisoDeEstado && (
          <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-6">
            {avisoDeEstado}
          </p>
        )}

        {/* Va en la cabecera y no dentro de la pestaña de pallets: es lo único que puede
            arruinar la recepción entera, y tiene que verse sin buscarlo. */}
        {sinEtiqueta.length > 0 && (
          <div className="flex items-center justify-between gap-4 flex-wrap text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
            <span>
              <strong>
                {sinEtiqueta.length} bulto{sinEtiqueta.length === 1 ? "" : "s"}
              </strong>{" "}
              {sinEtiqueta.length === 1 ? "nació" : "nacieron"} de una división y todavía no
              {sinEtiqueta.length === 1 ? " tiene" : " tienen"} su QR pegado. Sin él no se
              {sinEtiqueta.length === 1 ? " puede" : " pueden"} escanear al recepcionar.
            </span>
            <button
              onClick={descargarEtiquetasPendientes}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 shrink-0"
            >
              Descargar QR de bultos nuevos
            </button>
          </div>
        )}

        {/* 🔴 TODO LO DOCUMENTAL, FUERA DE LAS PESTAÑAS. Igual que en la orden de venta: las
            guías de despacho y los archivos adjuntos eran dos pestañas separadas —a dos clics, y
            sin saber desde afuera si había algo dentro—. Acá están siempre a la vista, y las
            pestañas quedan para el contenido de la solicitud. */}
        <CentroDocumentosSolicitud
          solicitudId={Number(solicitudId)}
          solicitud={solicitud}
          gds={gds}
          cargando={loading}
          emitiendo={emitiendoGD}
          viendoBorrador={viendoBorradorGD}
          onEmitirGD={handleEmitirGD}
          onVerBorradorGD={handleVerBorradorGD}
          onConfirmarLlegada={handleConfirmarLlegadaGD}
          onCambio={() => { cargarGDs(); fetchSolicitud(); }}
        />

        <Tabs
          activa={tab}
          onCambiar={setTab}
          pestanas={[
            { id: "insumos", label: "Insumos", cantidad: insumos.length, deshabilitadaSiVacia: true },
            {
              id: "pt",
              label: "Productos terminados",
              cantidad: productosTerminados.length,
              deshabilitadaSiVacia: true,
            },
            { id: "pallets", label: "Pallets", cantidad: palletsData.length, deshabilitadaSiVacia: true },
            { id: "trazabilidad", label: "Trazabilidad" },
          ]}
        />

        {tab === "insumos" && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text">Insumos</h2>
              {/*
                🔴 EL MONTO SE MUESTRA AUNQUE EL DESPACHO SEA PARCIAL.

                Antes se escondía hasta que todas las líneas tuvieran cantidad despachada, con
                el argumento de que si no era "una proyección sobre cantidades que todavía
                pueden cambiar". Eso describe al costo estimado POR LÍNEA —que multiplica lo
                pedido por el precio de lista del proveedor— pero no a `valor_despacho`, que el
                backend calcula sumando el costo real de los bultos montados en los pallets.
                No es una proyección: es la medición de lo que va arriba del camión, que es
                justo lo que hay que declarar en la guía de despacho.

                Y esconderlo dejaba a Logística sin el dato en el momento exacto en que lo
                necesita: medido el 2026-08-08, 5 de las 7 solicitudes En tránsito y las 6
                Validadas ocultaban un monto que estaba bien calculado. Un despacho parcial no
                es una operación a medias — es un envío completo de parte del pedido, y el
                resto viaja después con su propia guía.
              */}
              {valorDespacho > 0 && (
                <div className="text-sm text-gray-700">
                  <span className="text-gray-500">Valor despachado:</span>{" "}
                  <span className="font-semibold text-gray-900">
                    {formatCLP(valorDespacho, 0)}
                  </span>
                </div>
              )}
            </div>
            {insumos.length > 0 ? (
              <Table data={insumos} columns={insumosColumns} />
            ) : (
              <p className="text-sm text-gray-500">Esta solicitud no lleva insumos.</p>
            )}
          </div>
        )}

        {tab === "pt" && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text">Productos terminados</h2>
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Total:</span>{" "}
                <span className="font-semibold text-gray-900">{resumenPT()}</span>
              </div>
            </div>
            {productosTerminados.length > 0 ? (
              <Table data={productosTerminados} columns={productosTerminadosColumns} />
            ) : (
              <p className="text-sm text-gray-500">Esta solicitud no lleva productos terminados.</p>
            )}
          </div>
        )}

        {tab === "trazabilidad" && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold text-text mb-4">Trazabilidad</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Creación", formatDateTime(solicitud.createdAt)],
                ["Envío", solicitud.fecha_envio ? formatDateTime(solicitud.fecha_envio) : "Pendiente"],
                [
                  "Recepción",
                  solicitud.fecha_recepcion ? formatDateTime(solicitud.fecha_recepcion) : "Pendiente",
                ],
                ["Última actualización", formatDateTime(solicitud.updatedAt)],
                ["Medio de transporte", solicitud.medio_transporte ?? "—"],
                ["N° guía de despacho", solicitud.numero_guia_despacho ?? "—"],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">{etiqueta}</span>
                  <span className="text-text font-medium text-right">{valor}</span>
                </div>
              ))}
            </div>
          </div>
        )}


        {tab === "pallets" && (
          <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text">Pallets</h2>
              {palletsData.length > 0 && (
                <button
                  onClick={handleDescargarEtiquetasPallets}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Descargar etiquetas
                </button>
              )}
            </div>

            {palletsData.length === 0 ? (
              <p className="text-sm text-gray-500">
                Esta solicitud todavía no tiene pallets armados.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {palletsData.map((pallet) => (
                  <PalletContenidoCard key={pallet.id} pallet={pallet} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal de envío: los datos de la guía manual y el medio de transporte. Antes era
            un panel que se desplegaba en medio de la página y empujaba todo hacia abajo. */}
        <Modal
          abierto={mostrarFormularioEnvio}
          onCerrar={() => setMostrarFormularioEnvio(false)}
          titulo="Enviar solicitud"
          descripcion="Al confirmar, los pallets pasan a tránsito y el stock sale de la bodega de origen."
          pie={
            <>
              <button
                onClick={() => setMostrarFormularioEnvio(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarSolicitud}
                disabled={loading || !guiaDespacho.trim() || !medioTransporte.trim()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                Confirmar envío
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* 🔴 EMITIR LA GUÍA ES EL PASO ANTERIOR A ENVIAR, y por eso vive acá dentro.
                La guía es UNA sola: su folio es el número de la guía, así que emitirla llena
                el campo de abajo y nadie transcribe nada. */}
            {gds.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <p className="font-medium">Esta solicitud todavía no tiene guía de despacho.</p>
                <p className="mt-1 text-amber-800">
                  Emítela acá: declara lo que se despachó, con el valor de los bultos cargados,
                  y su folio queda como número de la guía.
                </p>
                <button
                  type="button"
                  onClick={handleEmitirGD}
                  disabled={emitiendoGD}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {emitiendoGD ? "Emitiendo…" : "Emitir guía de despacho"}
                </button>
                <p className="mt-2 text-xs text-amber-700">
                  Si la guía se emitió fuera del sistema, escribe su número abajo y continúa.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
                Guía de Despacho electrónica <strong>N° {gds[0]?.folio ?? "—"}</strong> emitida.
                {gds[0]?.folio && String(gds[0].folio) !== guiaDespacho.trim() && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setGuiaDespacho(String(gds[0].folio))}
                      className="underline font-medium"
                    >
                      Usar ese folio
                    </button>
                  </>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                N° de guía de despacho
              </label>
              <input
                type="text"
                value={guiaDespacho}
                onChange={(e) => setGuiaDespacho(e.target.value)}
                placeholder="Ej: 12345"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medio de transporte
              </label>
              <input
                type="text"
                value={medioTransporte}
                onChange={(e) => setMedioTransporte(e.target.value)}
                placeholder="Ej: Camión interno"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjuntar la guía <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => setArchivosGuia(Array.from(e.target.files || []))}
                className="w-full text-sm"
              />
              {archivosGuia.length > 0 && (
                <p className="text-xs text-gray-600 mt-1">
                  {archivosGuia.length} archivo(s) seleccionado(s)
                </p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
