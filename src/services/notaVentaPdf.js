// Genera la Nota de Venta en PDF. Extraído de OrdenVentaDetail.jsx (handleDescargarPDF) para
// poder descargarla también desde la lista de Órdenes de Venta sin duplicar la maqueta del
// documento — un solo lugar que decide cómo se ve la Nota de Venta.
import { formatCLP } from "./formatHelpers";
import { cantidadFacturable, resumenFacturable } from "../utils/cantidadFacturable.js";
import { esFormatoCajas, lineaEnCajas, unidadesPorCajaDeLinea } from "../utils/formatoCantidad.js";
import logo from "../assets/logo.png";

const COMPANY = {
  nombre: "ELABORADORA DE ALIMENTOS GOURMET LTDA.",
  rut: "76.059.975-1",
  cuenta_corriente: "490370201",
  banco: "BANCO DE CHILE",
  contacto: "oc@quesosartisan.cl",
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL");
};

// El progreso viene agrupado por nombre de facturación; cada bulto asignado trae el producto
// físico. Misma forma que progresoRows/filasExtraccion en OrdenVentaDetail.jsx.
function construirFilasExtraccion(progresoData) {
  const items = Array.isArray(progresoData?.progreso) ? progresoData.progreso : [];
  const rows = [];
  items.forEach((p) => {
    const nombre = p?.nombre || p?.ProductoBase?.nombre || `Línea #${p?.id_nombre_facturacion ?? "—"}`;
    const bultos = Array.isArray(p?.bultos_asignados) ? p.bultos_asignados : [];
    bultos.forEach((b, idx) => {
      rows.push({
        key: `${p?.id_nombre_facturacion ?? p?.id_producto ?? "p"}-${b?.id_pick ?? b?.id_bulto ?? b?.identificador ?? idx}`,
        producto: nombre,
        bulto: b?.identificador || b?.id_bulto || "—",
      });
    });
  });
  return rows;
}

// Un nombre de archivo consistente para poder ubicar el PDF entre decenas de descargas sin
// tener que abrirlo: NV-N°OV-NombreCliente.
function nombreArchivo(orden, cliente) {
  const nombreCliente = (cliente?.nombre_empresa || "").trim();
  const slug = nombreCliente
    ? nombreCliente.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim()
    : "";
  return slug ? `NV-${orden.id}-${slug}.pdf` : `NV-${orden.id}.pdf`;
}

// Trae lo que hace falta para armar el documento cuando sólo se tiene el id de la orden (caso
// de la lista): la vista de detalle ya tiene `orden` y `progresoData` en memoria, así que ahí
// se pasan directo y se evita la doble consulta.
async function cargarDatos(api, ordenId) {
  const [ordenRes, progresoRes] = await Promise.all([
    api(`/ordenes-venta/${ordenId}/info`),
    api(`/ordenes-venta/${ordenId}/progreso`),
  ]);
  const orden = ordenRes?.data || ordenRes;
  const progresoData = progresoRes?.data || progresoRes;
  return { orden, progresoData };
}

// `api` + `ordenId`: se obtiene todo solo (uso desde la lista).
// `orden` + `progresoData`: ya cargados (uso desde el detalle, sin re-consultar).
export async function generarNotaVentaPDF({ api, ordenId, orden: ordenPrecargada, progresoData: progresoPrecargado }) {
  const { orden, progresoData } =
    ordenPrecargada != null
      ? { orden: ordenPrecargada, progresoData: progresoPrecargado }
      : await cargarDatos(api, ordenId);

  if (!orden) throw new Error("No se encontró la orden de venta");

  const cliente = orden?.cliente || {};
  const direccion = orden?.direccion || null;
  const orderItems = Array.isArray(orden?.productos) ? orden.productos : [];
  const filasExtraccion = construirFilasExtraccion(progresoData);

  const resumen = resumenFacturable(orderItems);
  const costoEnvioActual = Number(orden?.costo_envio || 0);
  const totalNeto = resumen.facturable + costoEnvioActual;
  const iva = Math.round(totalNeto * 0.19);
  const total = totalNeto + iva;

  // jsPDF y su plugin de tablas se cargan al descargar, no al importar este módulo.
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginL = 15;
  const colR = pageWidth / 2 + 5;
  const widthL = colR - marginL - 5;
  const widthR = pageWidth - marginL - colR;

  doc.addImage(logo, "PNG", marginL, 10, 22, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("NOTA DE VENTA", pageWidth / 2, 20, { align: "center" });
  doc.setLineWidth(0.5);
  doc.line(marginL, 36, pageWidth - marginL, 36);

  const addSection = (titulo, rows, x, width, startY) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(titulo.toUpperCase(), x, startY);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: startY + 2,
      body: rows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 32 }, 1: { cellWidth: width - 32 } },
      margin: { left: x },
      tableWidth: width,
    });
    return doc.lastAutoTable.finalY + 5;
  };

  const enCajasPdf = esFormatoCajas(orden?.formato_cantidad);
  const condicionPagoTexto = orden?.condiciones || cliente?.condicion_pago || "Contado";
  const direccionTexto = direccion?.calle
    ? [direccion.calle, direccion.numero, direccion.info_adicional].filter(Boolean).join(" ")
    : direccion?.nombre_sucursal || "—";

  let yL = 42;
  yL = addSection("Datos del pedido", [
    ["Nota de Venta", `N° ${orden?.id ?? "—"}`],
    ["Fecha entrega", formatDate(orden?.fecha_envio)],
    ["Orden de Compra", orden?.numero_oc || "—"],
    ["Condiciones Pago", condicionPagoTexto],
  ], marginL, widthL, yL);
  yL = addSection("Cliente", [
    ["Cliente", cliente?.nombre_empresa || "—"],
    ["Razón Social", cliente?.razon_social || "—"],
    ["RUT", cliente?.rut || "—"],
    ["Contacto", cliente?.contacto_comercial || "—"],
    ["Teléfono", cliente?.telefono_comercial || "—"],
    ["Correo", cliente?.email_comercial || "—"],
  ], marginL, widthL, yL);
  yL = addSection("Despacho", [
    ["Dirección", direccionTexto],
    ["Comuna", direccion?.comuna || "—"],
    ["Horario", direccion?.comentarios || "—"],
  ], marginL, widthL, yL);
  const finLeft = yL;

  const yR = addSection("Datos para pago", [
    ["RUT", COMPANY.rut],
    ["Razón Social", COMPANY.nombre],
    ["Cuenta Corriente", COMPANY.cuenta_corriente],
    ["Banco", COMPANY.banco],
    ["Enviar comprobante", COMPANY.contacto],
  ], colR, widthR, 42);
  const finRight = yR;

  let cursorY = Math.max(finLeft, finRight) + 2;

  if (orden?.comentario_cliente) {
    doc.setFillColor(255, 247, 205);
    doc.setDrawColor(230, 200, 80);
    const texto = doc.splitTextToSize(
      `Comentarios: ${orden.comentario_cliente}`,
      pageWidth - marginL * 2 - 6,
    );
    const boxH = texto.length * 4 + 4;
    doc.rect(marginL, cursorY, pageWidth - marginL * 2, boxH, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(texto, marginL + 3, cursorY + 5);
    cursorY += boxH + 4;
  }

  const bultosUnicos = new Set(filasExtraccion.map((r) => r.bulto)).size;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Pickeado por: ${orden?.pickeadoPor?.nombre || "—"}    ` +
      `Fecha: ${formatDate(orden?.picking_completado_en)}    ` +
      `Bultos: ${bultosUnicos}`,
    marginL,
    cursorY,
  );
  cursorY += 4;

  const tableBody = orderItems.map((it) => {
    const productoNombre =
      it?.NombreFacturacion?.nombre || it?.ProductoBase?.nombre || `Producto #${it?.id_producto ?? "—"}`;
    const cantidadPedida = Number(it?.cantidad || 0);
    const cantidadPickeada = cantidadFacturable(it);
    const precio = Number(it?.precio_venta || 0);
    const descuento = Number(it?.porcentaje_descuento || 0);
    const monto = cantidadPickeada * precio * (1 - descuento / 100);

    const cajaOC = enCajasPdf ? lineaEnCajas(cantidadPedida, precio, unidadesPorCajaDeLinea(it)) : null;
    const cajaPick = enCajasPdf ? lineaEnCajas(cantidadPickeada, precio, unidadesPorCajaDeLinea(it)) : null;
    const cantOcTexto = cajaOC?.cajas != null ? cajaOC.cajas.toLocaleString("es-CL") : cantidadPedida.toLocaleString("es-CL");
    const cantPickTexto = cajaPick?.cajas != null ? cajaPick.cajas.toLocaleString("es-CL") : cantidadPickeada.toLocaleString("es-CL");

    return [
      productoNombre,
      cantOcTexto,
      cantPickTexto,
      formatCLP(precio, 0),
      descuento > 0 ? `${descuento}%` : "—",
      formatCLP(monto, 0),
    ];
  });

  autoTable(doc, {
    startY: cursorY + 2,
    head: [["Producto", "Cant. OC", "Cant. Pickeada", "Precio Unitario", "Desc.", "Total Neto"]],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: "center" },
    columnStyles: {
      1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
      4: { halign: "right" }, 5: { halign: "right" },
    },
  });

  let yTot = doc.lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Neto", pageWidth - 60, yTot);
  doc.text(formatCLP(totalNeto, 0), pageWidth - marginL, yTot, { align: "right" });
  yTot += 6;
  doc.text("IVA (19%)", pageWidth - 60, yTot);
  doc.text(formatCLP(iva, 0), pageWidth - marginL, yTot, { align: "right" });
  yTot += 3;
  doc.setLineWidth(0.3);
  doc.line(pageWidth - 60, yTot, pageWidth - marginL, yTot);
  yTot += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", pageWidth - 60, yTot);
  doc.text(formatCLP(total, 0), pageWidth - marginL, yTot, { align: "right" });
  doc.setFont("helvetica", "normal");

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Documento generado automáticamente — Artisan",
    pageWidth / 2,
    yTot + 10,
    { align: "center" },
  );
  doc.save(nombreArchivo(orden, cliente));
}
