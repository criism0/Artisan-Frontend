import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axiosInstance from "../../axiosInstance";
import { BackButton } from "../../components/Buttons/ActionButtons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../assets/logo.png";
import { toast } from "../../lib/toast";
import { useApi, API_BASE } from "../../lib/api";

export default function OrdenDetail() {
  const { ordenId } = useParams();
  const api = useApi()
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setshowHistorial] = useState(false);
  const navigate = useNavigate();

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

  const formatCLP = (valor) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(valor);

  const handleDownloadPDF = async () => {
    if (!orden) return;

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

    const fmtCLP = (n) => `$${Math.round(Number(n || 0)).toLocaleString("es-CL")}`;
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
      const nombre =
      `${mp.proveedorMateriaPrima?.formato} - ${mp.proveedorMateriaPrima?.materiaPrima?.nombre}` ||
        mp.proveedorMateriaPrima?.materiaPrima?.nombre ||
        `#${mp.id_proveedor_materia_prima}`;
      const cantidad = mp.cantidad_formato || 0;
      const precio = mp.precio_unitario || 0;
      const sub = cantidad * precio;
      return [nombre, String(cantidad), fmtCLP(precio), fmtCLP(sub)];
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
          fmtCLP(neto),
        ],
        [
          { content: "", colSpan: 2 },
          { content: "IVA", styles: { halign: "right" } },
          fmtCLP(iva),
        ],
        [
          { content: "", colSpan: 2 },
          { content: "Total", styles: { halign: "right", fontStyle: "bold" } },
          { content: fmtCLP(total), styles: { fontStyle: "bold" } },
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
      const response = await axiosInstance.post(
        "/bultos/etiquetas",
        { ids_bultos },
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
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
    setLoading(true);
    try {
      await axiosInstance.put(
        `${API_BASE}/proceso-compra/ordenes/${ordenId}/pagar`
      );
      const updatedResponse = await axiosInstance.get(
        `${API_BASE}/proceso-compra/ordenes/${ordenId}`
      );
      setOrden(updatedResponse.data?.data || updatedResponse.data);
      toast.success("Orden marcada como pagada");
    } catch (error) {
      toast.error("Error al marcar la orden como pagada:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async () => {
    if (showHistorial) {
      setshowHistorial(false);
      return;
    }
    
    try {
      const data = await api(`/proceso-compra/ordenes/${ordenId}/historial`, { method: "GET" });
      setHistorial(data?.data ?? data ?? []);
      setshowHistorial(true)

    } catch (error) {
      toast.error("Error al obtener el historial de la solicitud:", error);
      alert("No se pudo cargar el historial de la solicitud. Intente nuevamente.");
    }
  };

  if (loading && !orden)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-primary">Cargando orden...</span>
      </div>
    );

  if (!orden && !loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">
          No se encontró la orden o hubo un error al cargar.
        </div>
      </div>
    );

  if (!orden) return null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de compra: {orden.id}</h1>
      </div>

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
                    <>
                      <span className="font-semibold text-amber-600">{orden.estado}</span>

                      {/* Mostrar detalles de materias primas incompletas */}
                      {Array.isArray(orden.materiasPrimas) &&
                        orden.materiasPrimas.some(
                          (mp) => (mp.cantidad || 0) > (mp.cantidad_recepcionada || 0)
                        ) && (
                          <div className="mt-1 text-gray-700 text-xs">
                            <span className="block font-medium text-gray-800">
                              Faltan unidades de:
                            </span>
                            <ul className="list-disc list-inside">
                              {orden.materiasPrimas
                                .filter(
                                  (mp) => (mp.cantidad_formato || 0) > (mp.cantidad_recepcionada || 0)
                                )
                                .map((mp) => {
                                  const faltan =
                                    (mp.cantidad_formato || 0) - (mp.cantidad_recepcionada || 0);
                                  const nombre =
                                    mp.proveedorMateriaPrima?.materiaPrima?.nombre ||
                                    mp.proveedorMateriaPrima?.MateriaPrima?.nombre ||
                                    "Materia prima sin nombre";
                                  const formato =
                                    mp.proveedorMateriaPrima?.formato || "";
                                  return (
                                    <li key={mp.id}>
                                      {nombre}
                                      {formato && (
                                        <span className="text-gray-500">
                                          {" "}
                                          ({formato})
                                        </span>
                                      )}{" "}
                                      →{" "}
                                      <span className="font-semibold text-red-600">
                                        {faltan}
                                      </span>{" "}
                                      pendiente
                                    </li>
                                  );
                                })}
                            </ul>
                          </div>
                        )}
                    </>
                  ) : (
                    orden.estado
                  )
                ) : (
                  "—"
                )}
              </td>

            </tr>
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
              <td className="px-6 py-4 text-sm font-medium text-text align-center">
                Archivos Adjuntos
              </td>
              {orden.archivos && orden.archivos.length > 0 ? (
                <td className="px-6 py-4 text-sm text-text">
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

                        {file.signed_url ? (
                          <a
                            href={file.signed_url}
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
                </td>
              ) : (
                <td className="px-6 py-4 text-sm text-text">No hay archivos adjuntos</td> 
                )}
            </tr>

            <tr className=" divide-y divide-gray-300 divide-x">
              <td className="px-6 py-4 text-sm font-medium text-text">Insumos</td>
            
              {orden.materiasPrimas?.length > 0 && (
                <div className="p-4 rounded-lg mt-6">

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
                              {formatCLP(mp.precio_unitario)}
                            </td>
                            <td className="px-6 py-4 text-sm">{formatCLP(mp.precio_unitario*mp.cantidad_formato)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    
                  
                  <tr className="border-b border-border">
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 text-sm font-medium text-text">Neto</td>
                    <td className="px-6 py-4 text-sm text-text">
                      {formatCLP(orden.total_neto)}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 text-sm font-medium text-text">IVA</td>
                    <td className="px-6 py-4 text-sm text-text">
                      {formatCLP(orden.iva)}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 text-sm font-medium text-text bg-purple-300">Total</td>
                    <td className="px-6 py-4 text-sm text-text bg-purple-300">
                      {formatCLP(orden.total_pago)}
                    </td>
                  </tr>
                  </table>
                </div>
              )}
            </tr>
            </tbody>
        </table>
      </div>

      {orden.bultos?.length > 0 && (
        <div className="bg-gray-200 p-4 rounded-lg mt-6">
          <h2 className="text-xl font-semibold text-text mb-2">Bultos</h2>
          <table className="w-full bg-white rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-100 text-sm text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left">Bulto</th>
                <th className="px-6 py-3 text-left">Item</th>
                <th className="px-6 py-3 text-left">Cantidad</th>
                <th className="px-6 py-3 text-left">Disponible</th>
                <th className="px-6 py-3 text-left">Lote proveedor</th>
                <th className="px-6 py-3 text-left">Pallet</th>
                <th className="px-6 py-3 text-left">Costo</th>
              </tr>
            </thead>
            <tbody>
              {orden.bultos.map((bulto, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium">{bulto.identificador || `#${bulto.id}`}</div>
                    <div className="text-xs text-gray-500">ID: {bulto.id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {bulto.materiaPrima?.nombre || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium">{bulto.cantidad_unidades ?? "—"} un.</div>
                    {bulto.peso_unitario ? (
                      <div className="text-xs text-gray-500">
                        {(Number(bulto.cantidad_unidades || 0) * Number(bulto.peso_unitario || 0)).toFixed(2)} {bulto.materiaPrima?.unidad_medida || ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium">{bulto.unidades_disponibles ?? "—"} un.</div>
                    {bulto.peso_unitario ? (
                      <div className="text-xs text-gray-500">
                        {(Number(bulto.unidades_disponibles || 0) * Number(bulto.peso_unitario || 0)).toFixed(2)} {bulto.materiaPrima?.unidad_medida || ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {bulto.lote?.identificador_proveedor || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {bulto.pallet?.identificador || (bulto.id_pallet ?? "—")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>
                      Unit: {bulto.costo_unitario ? formatCLP(bulto.costo_unitario) : "—"}
                    </div>
                    <div className="font-medium">
                      Total: {bulto.costo_unitario ? formatCLP(Number(bulto.costo_unitario) * Number(bulto.cantidad_unidades || 0)) : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex gap-2 flex-wrap">
        {!orden.pagada && (
          <button
            className={`px-4 py-2 text-white rounded ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
            onClick={handlePagar}
            disabled={loading}
          >
            {loading ? "Procesando..." : "Pagar"}
          </button>
        )}
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={handleDownloadPDF}
        >
          Descargar PDF Orden
        </button>
        {orden.bultos?.length > 0 && (
          <button
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={handleDownloadEtiquetas}
          >
            Descargar Etiquetas Bultos
          </button>
        )}
        {orden.estado === "Creada" && (
          <button
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            onClick={() => navigate(`/Ordenes/edit/${orden.id}`)}
          >
            Editar
          </button>
        )}
         <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-400"
          onClick={handleVerDetalle}
        >
          Ver Detalle
        </button>
      </div>
     
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

      {showHistorial && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 text-center">
            Historial de Estados
          </h2>

          {historial.length > 0 ? (
            <table className="min-w-full border border-gray-300 border-collapse divide-y divide-gray-300 divide-x text-sm bg-white rounded-lg shadow-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 border">Fecha de Cambio</th>
                  <th className="p-2 border">ID Cambio</th>
                  <th className="p-2 border">Acción</th>
                  <th className="p-2 border">Qué cambió</th>
                  <th className="p-2 border">Antes</th>
                  <th className="p-2 border">Después</th>
                  <th className="p-2 border">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {historial.flatMap((h, idx) => {
                  const cambios = h?.cambios || {};
                  const omitidos = new Set(["created_by", "updated_by", "archivos"]);
                  const entries = Object.entries(cambios).filter(
                    ([campo]) => !omitidos.has(campo)
                  );
                  const rows = entries.length > 0 ? entries : [["—", { before: "—", after: "—" }]];

                  return rows.map(([campo, valores], cambioIdx) => {
                    const before = valores?.before ?? "—";
                    const after = valores?.after ?? "—";
                    return (
                      <tr
                        key={`${idx}-${campo}-${cambioIdx}`}
                        className={`border-b ${ (idx + cambioIdx) % 2 === 0 ? "bg-white" : "bg-gray-50" }`}
                      >
                        <td className="p-2 border text-center text-gray-800">
                          {formatFechaCambio(h)}
                        </td>
                        <td className="p-2 border text-center text-gray-800">
                          {h.id ?? "—"}
                        </td>
                        <td className="p-2 border text-center text-gray-700">
                          {h.accion || "—"}
                        </td>
                        <td className="p-2 border text-center text-gray-700">
                          {campo}
                        </td>
                        <td className="p-2 border text-center text-gray-700">
                          {before}
                        </td>
                        <td className="p-2 border text-center text-gray-700">
                          {after}
                        </td>
                        <td className="p-2 border text-center text-gray-700">
                          {h.usuario?.nombre ?? h.usuario ?? "—"}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-600 text-center italic mt-2">
              No hay historial disponible para esta solicitud.
            </p>
          )}
        </div>
      )}


    </div>
  );
}
