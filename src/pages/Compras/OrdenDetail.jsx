import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import HistorialCambiosModal from "../../components/Compras/HistorialCambiosModal.jsx";
// jsPDF y su plugin de tablas pesan ~460 KB juntos y sólo hacen falta al apretar
// "Descargar PDF". Importados arriba viajaban con la vista entera; acá bajan cuando se piden.
import logo from "../../assets/logo.png";
import { toast } from "../../lib/toast";
import { useApi, apiBlob } from "../../lib/api";
import { uploadToS3 } from "../../lib/uploadToS3";
import { formatValorCambio } from "../../utils/formatValorCambio";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import DTERecibidoPanel from "../../components/DTE/DTERecibidoPanel.jsx";
import { formatCLP } from "../../services/formatHelpers";
import DataTable from "../../components/Tables/DataTable";
import AvanceItems from "../../components/AvanceItems";

export default function OrdenDetail() {
  const { ordenId } = useParams();
  const api = useApi()
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setshowHistorial] = useState(false);
  const [nuevosArchivos, setNuevosArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [mostrarModalArchivos, setMostrarModalArchivos] = useState(false);
  const [tab, setTab] = useState("datos");
  const navigate = useNavigate();

  const canWritePurchaseOrder = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);

  const formatFechaCambio = (registro) => {
    const fecha = registro?.creado_en ?? registro?.fecha_cambio;
    return fecha
      ? new Date(fecha).toLocaleString("es-CL", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  };

  useEffect(() => {
    const fetchOrden = async () => {
    try {
      const data = await api(`/proceso-compra/ordenes/${ordenId}`, { method: "GET" });
      setOrden(data);
    } catch (error) {
      toast.error("Error al obtener detalles de la orden: " + error);
    }
  };
    if (ordenId) {
      fetchOrden();
    }
  }, [ordenId]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setNuevosArchivos((prev) => [
      ...prev,
      ...files.filter(
        (nuevo) => !prev.some((existente) => existente.name === nuevo.name)
      ),
    ]);
    // Resetear el input para permitir seleccionar el mismo archivo nuevamente
    e.target.value = "";
  };

  const handleRemoveNewFile = (indexToRemove) => {
    setNuevosArchivos((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleAdjuntarArchivos = async () => {
    if (nuevosArchivos.length === 0) {
      toast.error("Selecciona al menos un archivo para adjuntar");
      return;
    }

    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      setSubiendoArchivos(false);
      return;
    }

    setSubiendoArchivos(true);
    try {
      // Subir archivos a S3
      const s3Refs = await Promise.all(
        nuevosArchivos.map(async (file) => {
          try {
            const ref = await uploadToS3(file);
            return ref;
          } catch (err) {
            toast.error(`Error subiendo ${file.name}: ${err}`);
            return null;
          }
        })
      );

      const archivosValidos = s3Refs.filter(Boolean);

      if (archivosValidos.length === 0) {
        toast.error("No se pudo subir ningún archivo");
        setSubiendoArchivos(false);
        return;
      }

      // Enviar las referencias al backend para adjuntar a la orden
      const response = await api(
        `/proceso-compra/ordenes/${ordenId}/adjuntar-archivos`,
        {
          method: "PUT",
          body: { archivos: archivosValidos },
        }
      );

      toast.success("Archivos adjuntados correctamente");
      setNuevosArchivos([]);

      // Recargar la orden para mostrar los nuevos archivos
      const dataActualizada = await api(`/proceso-compra/ordenes/${ordenId}`, { method: "GET" });
      setOrden(dataActualizada);
      setMostrarModalArchivos(false);
    } catch (error) {
      toast.error("Error al adjuntar archivos: " + error);
    } finally {
      setSubiendoArchivos(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!orden) return;

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF("p", "mm", "a4");
    const x = 18;
    const pageW = 210;
    let y = 18;

    try {
      const img = new Image();
      img.src = logo;
      await img.decode();
      doc.addImage(img, "PNG", x, y - 6, 18, 18);
    } catch {}

    const COMPANY = {
      nombre: "ELABORADORA DE ALIMENTOS GOURMET LTDA.",
      rut: "76.059.975-1",
      direccion: "Presidente Eduardo Frei Montalva 9950 Local 4",
      comuna: "Quilicura",
      contacto: "Administracion@quesosartisan.cl / +569 7648 4626",
      giro: "Elaboración y Comercialización De Productos Lacteos",
    };

    doc.setFontSize(11).setFont(undefined, "bold");
    doc.text(`RAZÓN SOCIAL: ${COMPANY.nombre}`, x + 24, y);
    doc.setFont(undefined, "normal");
    doc.text(`RUT: ${COMPANY.rut}`, x + 24, y + 6);
    doc.text(`DIRECCIÓN: ${COMPANY.direccion}`, x + 24, y + 12);
    doc.text(`COMUNA: ${COMPANY.comuna}`, x + 24, y + 18);
    doc.text(`CONTACTO: ${COMPANY.contacto}`, x + 24, y + 24);
    doc.text(`GIRO: ${COMPANY.giro}`, x + 24, y + 30);

    y += 38;
    doc.setLineWidth(0.6);
    doc.line(x - 3, y, pageW - x + 3, y);

    y += 10;
    doc.setFont(undefined, "bold").setFontSize(14);
    doc.text(`Orden de Compra N° ${orden.id}`, x, y);
    doc.setFont(undefined, "normal");

    const fmtDateEN = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })
        : "—";

    const proveedor = orden.proveedor?.nombre_empresa || "—";
    const estado = orden.estado || "—";
    const condiciones = orden.condiciones || "—";

    autoTable(doc, {
      startY: y + 6,
      theme: "grid",
      styles: { fontSize: 11, lineWidth: 0.4, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 120 } },
      body: [
        ["Fecha de Emisión:", fmtDateEN(orden.fecha)],
        ["Proveedor:", proveedor],
        ["Estado:", estado],
        ["Condiciones:", condiciones],
      ],
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 0)
          d.cell.styles.fontStyle = "bold";
      },
      margin: { left: x, right: x },
    });

    const afterInfoY = doc.lastAutoTable.finalY + 8;

    const bodyRows = (orden.materiasPrimas || []).map((mp) => {
      // Usar unidad de medida - nombre insumo (cantidad total) para la descripción del PDF
      let unidadMedida = mp.proveedorMateriaPrima?.unidad_medida || 'Unidad';
      if (unidadMedida.toLowerCase() === 'kilogramos') {
        unidadMedida = 'Kilogramos';
      } else if (unidadMedida.toLowerCase() === 'litros') {
        unidadMedida = 'Litros';
      } else if (unidadMedida.toLowerCase() === 'unidades') {
        unidadMedida = 'Unidades';
      }
      const nombreInsumo = mp.proveedorMateriaPrima?.materiaPrima?.nombre || 'Insumo desconocido';
      const cantidadTotal = mp.cantidad || 0;
       const nombre = `${unidadMedida} - ${nombreInsumo}`;
      
      const cantidad = mp.cantidad_formato || 0;
      const precio = mp.precio_unitario || 0;
      const sub = cantidad * precio;
       return [nombre, String(cantidadTotal), formatCLP(Number(cantidadTotal ? (sub / cantidadTotal) : precio) || 0, 0), formatCLP(Number(sub) || 0, 0)];
    });

    const neto = orden.total_neto || 0;
    const iva = orden.iva || Math.round(neto * 0.19);
    const total = orden.total_pago || neto + iva;

    autoTable(doc, {
      startY: afterInfoY,
      head: [["Insumo", "Cantidad", "Precio", "Valor Neto"]],
      body: bodyRows,
      foot: [
        [
          { content: "", colSpan: 2 },
          { content: "Neto", styles: { halign: "right" } },
          formatCLP(Number(neto) || 0, 0),
        ],
        [
          { content: "", colSpan: 2 },
          { content: "IVA", styles: { halign: "right" } },
          formatCLP(Number(iva) || 0, 0),
        ],
        [
          { content: "", colSpan: 2 },
          { content: "Total", styles: { halign: "right", fontStyle: "bold" } },
          { content: formatCLP(Number(total) || 0, 0), styles: { fontStyle: "bold" } },
        ],
      ],
      theme: "grid",
      styles: { fontSize: 11, lineWidth: 0.4, cellPadding: 3 },
      headStyles: { fillColor: [245, 245, 245], textColor: 50, fontStyle: "bold" },
      footStyles: { fillColor: [255, 255, 255], textColor: 20 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      margin: { left: x, right: x },
    });

    doc.setFontSize(11).setFont(undefined, "bold");
    doc.text(
      "Por favor adjuntar esta orden de compra con la factura. De lo contrario será rechazada.",
      x,
      doc.lastAutoTable.finalY + 10
    );

    const lineY = 270;
    const lineWidth = 50;
    const lineCenterX = pageW - 35;
    const lineStartX = lineCenterX - lineWidth / 2;
    const lineEndX = lineCenterX + lineWidth / 2;
    doc.setLineWidth(0.4);
    doc.line(lineStartX, lineY, lineEndX, lineY);
    const textWidth = doc.getTextWidth("Firma");
    doc.text("Firma", lineCenterX - textWidth / 2, lineY + 6);

    doc.text("Página 1 de 1", pageW - 45, 285);
    doc.save(`Artisan-OC-#${orden.id}-${proveedor}.pdf`);
    toast.success("PDF descargado correctamente");
  };

  const handleDownloadEtiquetas = async () => {
    try {
      const bultos = Array.isArray(orden?.bultos) ? orden.bultos : [];
      if (bultos.length === 0) {
        toast.error("No hay bultos asociados a esta orden.");
        return;
      }

      const ids_bultos = bultos.map((b) => b.id).filter(Boolean);
      const blob = await apiBlob("/bultos/etiquetas", { method: "POST", body: { ids_bultos } });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiquetas_OC_${orden.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Etiquetas descargadas correctamente");
    } catch (error) {
      toast.error("Error al descargar las etiquetas: " + (error?.message || error));
    }
  };

  const handlePagar = async () => {
    if (loading) return;
    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await api(`/proceso-compra/ordenes/${ordenId}/pagar`, { method: "PUT" });
      const updatedData = await api(`/proceso-compra/ordenes/${ordenId}`);
      setOrden(updatedData);
      toast.success("Orden marcada como pagada");
    } catch (error) {
      toast.error(`Error al marcar la orden como pagada: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerHistorial = async () => {
    try {
      const data = await api(`/proceso-compra/ordenes/${ordenId}/historial`, { method: "GET" });
      setHistorial(data ?? []);
      setshowHistorial(true)

    } catch (error) {
      toast.error(`Error al obtener el historial de la solicitud: ${error.message}`);
    }
  };

  // Las acciones que mueven el estado vivían sólo en la lista (`Ordenes.jsx`), dentro de la
  // fila de la tabla: para validar o recepcionar había que salir del detalle y volver atrás.
  const ejecutarTransicion = async (ruta, exito) => {
    setLoading(true);
    try {
      await api(`/proceso-compra/ordenes/${ordenId}/${ruta}`, { method: "PUT" });
      setOrden(await api(`/proceso-compra/ordenes/${ordenId}`));
      toast.success(exito);
    } catch (error) {
      toast.error(error?.message || "No se pudo completar la acción");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !orden) return <PageLoader message="Cargando orden" />;

  if (!orden && !loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">
          No se encontró la orden o hubo un error al cargar.
        </div>
      </div>
    );

  if (!orden) return null;

  const bultosList = Array.isArray(orden?.bultos)
    ? orden.bultos
    : (Array.isArray(orden?.Bultos) ? orden.Bultos : []);
  const totalNetoFacturado = bultosList.reduce((acc, b) => {
    const costoUnitario = Number(b?.costo_unitario) || 0;
    const unidades = Number(b?.cantidad_unidades) || 0;
    return acc + (costoUnitario * unidades);
  }, 0);

  // ── Acciones de la orden ────────────────────────────────────────────────────────────────
  //
  // El flujo real de una OC es Creada → Validada → Recepcionada, con una parada intermedia
  // en «Parcialmente recepcionada» cuando llega sólo una parte. `retroceder` deshace un paso.
  //
  // ⚠️ El pago es un EJE APARTE, no una etapa: `pagada` es un booleano que se mueve en
  // cualquier momento. En producción hay órdenes Validadas ya pagadas y Creadas ya pagadas,
  // así que Pagar no puede colgar del estado. (El ENUM declara además 'Pagada', 'Rechazada'
  // y 'En tránsito', que en producción no tiene ninguna orden.)
  const enFlujo = {
    Creada: {
      label: "Validar orden",
      onClick: () => ejecutarTransicion("validar", "Orden validada"),
      confirmar: {
        titulo: "¿Validar esta orden de compra?",
        mensaje: "Queda lista para recepcionar y se le avisa al proveedor.",
        textoBoton: "Validar",
      },
    },
    Validada: {
      label: "Recepcionar",
      onClick: () => navigate(`/Ordenes/recepcionar/${orden.id}`),
    },
    "Parcialmente recepcionada": {
      label: "Recepcionar lo que falta",
      onClick: () => navigate(`/Ordenes/recepcionar/${orden.id}`),
    },
  };
  const accionPrincipal = canWritePurchaseOrder ? enFlujo[orden.estado] ?? null : null;

  const accionesSecundarias = [
    canWritePurchaseOrder && {
      label: orden.pagada ? "Revertir pago" : "Marcar como pagada",
      onClick: orden.pagada
        ? () => ejecutarTransicion("revertir-pago", "Pago revertido")
        : handlePagar,
      disabled: loading,
      confirmar: orden.pagada
        ? { titulo: "¿Revertir el pago?", textoBoton: "Revertir" }
        : null,
    },
    orden.estado === "Creada" &&
      canWritePurchaseOrder && {
        label: "Editar",
        onClick: () => navigate(`/Ordenes/edit/${orden.id}`),
      },
    { label: "Descargar PDF", onClick: handleDownloadPDF },
    orden.bultos?.length > 0 && {
      label: "Descargar etiquetas",
      onClick: handleDownloadEtiquetas,
    },
    {
      // Antes decía «Ver Detalle» estando ya en el detalle, y desplegaba una tabla al final
      // de la página sin avisar que algo había aparecido. Ahora abre un modal.
      label: "Historial de cambios",
      onClick: handleVerHistorial,
    },
    { label: "Adjuntar archivos", onClick: () => setMostrarModalArchivos(true) },
  ].filter(Boolean);

  const accionesDestructivas = [
    orden.estado !== "Creada" &&
      canWritePurchaseOrder && {
        label: "Retroceder estado",
        onClick: () => ejecutarTransicion("retroceder", "Orden retrocedida"),
        confirmar: {
          titulo: "¿Retroceder la orden un paso?",
          mensaje:
            orden.estado === "Validada"
              ? "Vuelve a «Creada» y se podrá editar de nuevo."
              : "Vuelve a «Validada» y se eliminan los bultos que generó la recepción.",
          textoBoton: "Retroceder",
        },
      },
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>

      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de compra: {orden.id}</h1>
        <PanelAcciones
          principal={accionPrincipal}
          secundarias={accionesSecundarias}
          destructivas={accionesDestructivas}
        />
      </div>


      {/* La vista era una sola columna: información, insumos anidados dentro de una fila
          de esa tabla, bultos y documentos, uno tras otro. Con muchos bultos el scroll se
          volvía enorme y no se podía saltar a lo que uno viene a mirar. */}
      <Tabs
        activa={tab}
        onCambiar={setTab}
        pestanas={[
          { id: "datos", label: "Datos de la orden" },
          { id: "insumos", label: "Insumos", cantidad: (orden.materiasPrimas || []).length, deshabilitadaSiVacia: true },
          { id: "bultos", label: "Bultos", cantidad: bultosList.length, deshabilitadaSiVacia: true },
          { id: "documentos", label: "Documentos" },
        ]}
      />

      {tab === "datos" && (
      <div className="bg-gray-200 p-4 rounded-lg">
        <table className="w-full bg-white rounded-lg shadow overflow-hidden">
          
          <thead className="bg-gray-100 text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 text-xl font-semibold text-left mb-2">INFORMACIÓN</th>
                <th className="px-6 py-3 text-xl font-semibold text-left mb-2">DATO</th>
              </tr>
            </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">
                N° Orden de Compra
              </td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.id || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">
                Fecha de Emisión
              </td>
              <td className="px-6 py-4 text-sm text-text">
                {new Date(orden.fecha).toLocaleDateString() || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Solicita</td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.BodegaSolicitante?.nombre || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Pagado</td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.pagada ? "Sí" : "No" || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Estado</td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.estado ? (
                  orden.estado === "Rechazada" ? (
                    <>
                      <span>{orden.estado}</span>
                      {orden.motivo_rechazo && (
                        <span className="block text-red-600 text-sm mt-1">
                          Motivo: {orden.motivo_rechazo}
                        </span>
                      )}
                    </>
                  ) : orden.estado === "Parcialmente recepcionada" ? (
                    <span className="font-semibold text-amber-600">{orden.estado}</span>
                  ) : (
                    orden.estado
                  )
                ) : (
                  "—"
                )}
              </td>

            </tr>
            {["Parcialmente recepcionada", "Recepcionada"].includes(orden.estado) &&
              Array.isArray(orden.materiasPrimas) &&
              orden.materiasPrimas.length > 0 && (
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text align-top">
                    Avance de recepción
                  </td>
                  <td className="px-6 py-4">
                    <AvanceItems
                      items={orden.materiasPrimas.map((mp) => ({
                        id: mp.id,
                        nombre:
                          mp.proveedorMateriaPrima?.materiaPrima?.nombre ||
                          mp.proveedorMateriaPrima?.MateriaPrima?.nombre ||
                          `Materia prima #${mp.id_proveedor_materia_prima}`,
                        unidad: mp.proveedorMateriaPrima?.formato || "",
                        solicitado: Number(mp.cantidad_formato) || 0,
                        completado: Number(mp.cantidad_recepcionada) || 0,
                      }))}
                      labels={{
                        solicitado: "Pedido",
                        completado: "Recepcionado",
                        pendiente: "Falta por recepcionar",
                        itemNoun: "insumos",
                      }}
                    />
                  </td>
                </tr>
              )}
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Número Factura(s)</td>
              <td className="px-6 py-4 text-sm text-text">
                {Array.isArray(orden.numero_factura)
                  ? orden.numero_factura.join(" - ")
                  : orden.numero_factura || "—"}
              </td>

            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Proveedor</td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.proveedor?.nombre_empresa || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Condiciones Comerciales y Especificaciones Técnicas</td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.condiciones || "—"}
              </td>
            </tr>

            {/* Archivos adjuntos */}
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text align-top">
                Archivos Adjuntos
              </td>
              <td className="px-6 py-4 text-sm text-text">
                {orden.archivos && orden.archivos.length > 0 ? (
                  <ul className="space-y-2">
                    {orden.archivos.map((file, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 p-2 rounded-md shadow-sm border border-gray-200 hover:bg-gray-100 transition"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800">{file.original_name}</span>
                          <span className="text-xs text-gray-500">
                            {file.mime_type || "Archivo"} · {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        {file.signed_url || file.url ? (
                          <a
                            href={file.signed_url || file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                          >
                            Descargar
                          </a>
                        ) : (
                          <span className="ml-4 text-xs text-red-500 italic">
                            No disponible
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No hay archivos adjuntos</p>
                )}
              </td>
            </tr>

            </tbody>
        </table>
      </div>
      )}

      {tab === "insumos" && (
        <div className="bg-gray-200 p-4 rounded-lg">
                {orden.materiasPrimas?.length > 0 && (
                  <div className="p-4 rounded-lg">

                  <table className="w-full bg-white  shadow overflow-hidden">
                    <thead className="bg-gray-100 text-sm text-gray-600">
                      <tr>
                        <th className="px-6 py-3 text-left">Nombre</th>
                        <th className="px-6 py-3 text-left">Cantidad</th>
                        <th className="px-6 py-3 text-left">Precio Unitario</th>
                        <th className="px-6 py-3 text-left">Valor Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orden.materiasPrimas.map((mp, idx) => {
                        const formato = mp.proveedorMateriaPrima?.formato || mp.formato || "—";
                        const nombre =
                          mp.proveedorMateriaPrima?.materiaPrima?.nombre ||
                          mp.proveedorMateriaPrima?.MateriaPrima?.nombre ||
                          `#${mp.id_proveedor_materia_prima}`;

                        const cantidad_formato = mp.cantidad_formato ?? 0;
                        
                        return (
                          <tr key={idx} className="border-t border-border">
                            <td className="px-6 py-4 text-sm">
                              <strong>{formato}</strong> - {nombre} ({cantidad_formato})
                            </td>
                            <td className="px-6 py-4 text-sm">{cantidad_formato}</td>
                            <td className="px-6 py-4 text-sm">
                              {formatCLP(mp.precio_unitario, 0)}
                            </td>
                            <td className="px-6 py-4 text-sm">{formatCLP(mp.precio_unitario*mp.cantidad_formato, 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr className="border-t border-gray-300">
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-sm font-medium text-text">Neto</td>
                        <td className="px-6 py-3 text-sm text-text">
                          {formatCLP(orden.total_neto, 0)}
                        </td>
                      </tr>
                      <tr className="border-t border-gray-200">
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-sm font-medium text-text">IVA</td>
                        <td className="px-6 py-3 text-sm text-text">
                          {formatCLP(orden.iva, 0)}
                        </td>
                      </tr>
                      <tr className="border-t border-gray-200">
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-sm font-semibold text-text bg-purple-200">Total</td>
                        <td className="px-6 py-3 text-sm font-semibold text-text bg-purple-200">
                          {formatCLP(orden.total_pago, 0)}
                        </td>
                      </tr>
                      <tr className="border-t border-gray-300">
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3" />
                        <td className="px-6 py-3 text-sm font-medium text-text">Total Neto Facturado</td>
                        <td className="px-6 py-3 text-sm text-text">
                          {formatCLP(totalNetoFacturado, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                )}
        </div>
      )}

      {tab === "bultos" && (
        <DataTable
          title="Bultos recepcionados"
          data={bultosList}
          defaultRowsPerPage={25}
          emptyMessage="Esta orden todavía no generó bultos."
          getSearchText={(b) =>
            [b?.identificador, b?.id, b?.materiaPrima?.nombre, b?.lote?.identificador_proveedor,
             b?.pallet?.identificador].filter(Boolean).join(" ")
          }
          initialSort={{ key: "identificador", direction: "asc" }}
          columns={[
            {
              header: "Bulto",
              accessor: "identificador",
              sortable: true,
              Cell: ({ row: b }) => (
                <>
                  <div className="font-medium">{b.identificador || `#${b.id}`}</div>
                  <div className="text-xs text-gray-500">ID: {b.id}</div>
                </>
              ),
            },
            {
              header: "Item",
              accessor: "item",
              sortable: true,
              sortValue: (b) => b?.materiaPrima?.nombre ?? "",
              Cell: ({ row: b }) => b.materiaPrima?.nombre || "—",
            },
            {
              header: "Cantidad",
              accessor: "cantidad_unidades",
              sortable: true,
              Cell: ({ row: b }) => (
                <>
                  <div className="font-medium">{b.cantidad_unidades ?? "—"} un.</div>
                  {b.peso_unitario ? (
                    <div className="text-xs text-gray-500">
                      {(Number(b.cantidad_unidades || 0) * Number(b.peso_unitario || 0)).toFixed(2)}{" "}
                      {b.materiaPrima?.unidad_medida || ""}
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              header: "Disponible",
              accessor: "unidades_disponibles",
              sortable: true,
              Cell: ({ row: b }) => (
                <>
                  <div className="font-medium">{b.unidades_disponibles ?? "—"} un.</div>
                  {b.peso_unitario ? (
                    <div className="text-xs text-gray-500">
                      {(Number(b.unidades_disponibles || 0) * Number(b.peso_unitario || 0)).toFixed(2)}{" "}
                      {b.materiaPrima?.unidad_medida || ""}
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              header: "Lote proveedor",
              accessor: "lote",
              sortValue: (b) => b?.lote?.identificador_proveedor ?? "",
              sortable: true,
              Cell: ({ row: b }) => b.lote?.identificador_proveedor || "—",
            },
            {
              header: "Pallet",
              accessor: "pallet",
              sortValue: (b) => b?.pallet?.identificador ?? b?.id_pallet ?? "",
              sortable: true,
              Cell: ({ row: b }) => b.pallet?.identificador || (b.id_pallet ?? "—"),
            },
            {
              header: "Costo",
              accessor: "costo_unitario",
              sortable: true,
              Cell: ({ row: b }) => (
                <>
                  <div>Unit: {b.costo_unitario ? formatCLP(b.costo_unitario, 0) : "—"}</div>
                  <div className="font-medium">
                    Total:{" "}
                    {b.costo_unitario
                      ? formatCLP(Number(b.costo_unitario) * Number(b.cantidad_unidades || 0), 0)
                      : "—"}
                  </div>
                </>
              ),
            },
          ]}
        />
      )}

      {tab === "documentos" && (
        <div className="space-y-6">
      <DTERecibidoPanel ordenId={ordenId} orden={orden} />
        </div>
      )}


      {/* Las acciones de la orden viven en el PanelAcciones de la cabecera. Estaban acá
          abajo, después de la tabla de bultos y del panel de DTE: para pagar una orden
          había que bajar 900 líneas de página. */}

      {/* Modal para adjuntar archivos */}
      {mostrarModalArchivos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Adjuntar Archivos a la Orden</h3>
              <button
                onClick={() => {
                  setMostrarModalArchivos(false);
                  setNuevosArchivos([]);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Orden de Compra #{ordenId} - {orden.proveedor?.nombre_empresa || "Sin proveedor"}
              </p>
              {orden.archivos && orden.archivos.length > 0 && (
                <p className="text-sm text-gray-500">
                  Actualmente hay {orden.archivos.length} archivo(s) adjunto(s)
                </p>
              )}
            </div>

            {/* Archivos seleccionados para subir */}
            {nuevosArchivos.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Archivos seleccionados:</p>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {nuevosArchivos.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <span className="text-blue-600 text-xl">📎</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate font-medium">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB · {file.type || "Archivo"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewFile(index)}
                        className="ml-2 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 flex-shrink-0"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <input
                  type="file"
                  id="modal-archivos"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="modal-archivos"
                  className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
                >
                  Seleccionar Archivos
                </label>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalArchivos(false);
                    setNuevosArchivos([]);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancelar
                </button>
                {nuevosArchivos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAdjuntarArchivos}
                    disabled={subiendoArchivos || !canWritePurchaseOrder}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {subiendoArchivos ? "Subiendo..." : `Adjuntar ${nuevosArchivos.length} archivo(s)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
     
     
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Pago Exitoso
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              La orden ha sido marcada como pagada correctamente.
            </p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() => setShowConfirmation(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <HistorialCambiosModal
        abierto={showHistorial}
        onCerrar={() => setshowHistorial(false)}
        historial={historial}
        formatFecha={formatFechaCambio}
      />


    </div>
  );
}
