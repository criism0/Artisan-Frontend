// PDF de una orden de compra para mandar al proveedor. Vivía dentro del detalle y la lista no
// podía ofrecerlo; ahora lo usan los dos. jsPDF y su plugin de tablas pesan ~460 KB juntos, así
// que se importan recién al pedir el PDF.
import logo from "../assets/logo.png";
import { toast } from "../lib/toast";
import { formatCLP } from "../services/formatHelpers";

export async function descargarPdfOrdenCompra(orden) {
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
  } catch {
    // Sin logo el PDF sale igual.
  }

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
}
