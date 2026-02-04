import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackButton, ModifyButton, DeleteButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../assets/logo.png";
import { formatCLP } from "../../services/formatHelpers";

const COMPANY = {
  nombre: "ELABORADORA DE ALIMENTOS GOURMET LTDA.",
  rut: "76.059.975-1",
  cuenta_corriente: "490370201",
  banco: "BANCO DE CHILE",
  contacto: "oc@quesosartisan.cl",
};

export default function OrdenVentaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [orden, setOrden] = useState(null);
  const [direccion, setDireccion] = useState({});
  const [cliente, setCliente] = useState({});
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const ordenData = await api(`/ordenes-venta/${id}/info`);
        const o = ordenData.data || ordenData;
        setOrden(o);
        
        // Obtener clientes y buscar el que tiene esta dirección
        const clientes = await api(`/clientes`);
        const clientesList = Array.isArray(clientes) ? clientes : clientes.data || [];
        
        // Buscar el cliente que tiene la dirección
        let clienteEncontrado = null;
        let direccionEncontrada = null;
        
        for (const cli of clientesList) {
          const dirs = Array.isArray(cli.direcciones) ? cli.direcciones : [];
          const dir = dirs.find(d => d.id === o.id_local);
          if (dir) {
            clienteEncontrado = cli;
            direccionEncontrada = dir;
            break;
          }
        }
        
        if (clienteEncontrado) {
          setCliente(clienteEncontrado);
          setDireccion(direccionEncontrada || {});
        }
      } catch (err) {
        toast.error("Error al cargar los datos de la orden");
      }
    })();

    api(`/productos-base`)
      .then((res) => {
        const productsData = Array.isArray(res) ? res : res.data || [];
        setProducts(
          productsData.map((p) => ({
            value: p.id,
            label: p.nombre,
            unidades_por_caja: p.unidades_por_caja,
          }))
        );
      })
      .catch(() => toast.error("Error al cargar productos"));
  }, [id, api]);
  

  useEffect(() => {
    if (!orden) return;
    api(`/ordenes-venta/${id}/productos`)
      .then((data) => {
        const itemsData = Array.isArray(data) ? data : data.data || [];
        const its = itemsData.map((item) => ({
          id: item.id,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_venta: item.precio_venta,
          porcentaje_descuento: item.porcentaje_descuento || 0,
        }));
        setOrderItems(its);
      })
      .catch(() => toast.error("Error al cargar productos de la orden"));
  }, [orden, id, api]);

  const totalProductos = useMemo(
    () =>
      orderItems.reduce(
        (sum, it) =>
          sum +
          it.cantidad * it.precio_venta * (1 - (it.porcentaje_descuento || 0) / 100),
        0
      ),
    [orderItems]
  );

  const costoEnvio = Number(orden?.costo_envio || 0);
  const totalNeto = totalProductos + costoEnvio;
  const iva = Math.round(totalNeto * 0.19);
  const total = totalNeto + iva;

  if (!orden) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/ventas/ordenes" />
      <div className="flex justify-between items-center my-4">
        <h1 className="text-2xl font-bold">Detalle de Orden #{orden.id}</h1>
        <div className="flex gap-2">
          {/* ✅ NUEVO PDF FORMATO FACTURA */}
          <button
            onClick={() => {
              const doc = new jsPDF();
              const pageWidth = doc.internal.pageSize.getWidth();

              // Encabezado empresa
              doc.addImage(logo, "PNG", 15, 10, 30, 30);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(12);
              doc.text(COMPANY.nombre, 50, 15);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              doc.text(`RUT: ${COMPANY.rut}`, 50, 21);
              doc.text(`CUENTA CORRIENTE: ${COMPANY.cuenta_corriente}`, 50, 26);
              doc.text(`BANCO: ${COMPANY.banco}`, 50, 31);
              doc.text(`CONTACTO: ${COMPANY.contacto}`, 50, 36);

              // Título principal
              doc.setFont("helvetica", "bold");
              doc.setFontSize(14);
              doc.text(`Orden de Venta N° ${orden.id}`, 15, 55);
              doc.setLineWidth(0.5);
              doc.line(15, 57, pageWidth - 15, 57);

              // Datos cliente en tabla
              const clienteData = [
                ["Fecha de Emisión", new Date(orden.fecha_orden).toLocaleDateString("es-CL")],
                ["Cliente", cliente.nombre_empresa || ""],
                ["Rut", cliente.rut || "-"],
                ["Dirección", direccion.calle && direccion.numero 
                  ? `${direccion.calle} ${direccion.numero}, ${direccion.comuna || ""}` 
                  : direccion.nombre_sucursal || "-"],
                ["Estado", orden.estado || "-"],
              ];
              autoTable(doc, {
                startY: 62,
                body: clienteData,
                theme: "plain",
                styles: { fontSize: 10, cellPadding: 2, lineWidth: 0.1, cellWidth: "wrap" },
                tableLineColor: [0, 0, 0],
                tableLineWidth: 0.2,
              });

              // Tabla productos
              const tableBody = orderItems.map((it) => {
                const producto = products.find((p) => p.value === it.id_producto);
                const subtotal = it.cantidad * it.precio_venta * (1 - (it.porcentaje_descuento || 0) / 100);
                return [
                  producto ? producto.label : it.id_producto,
                  it.cantidad,
                  formatCLP(it.precio_venta, 0),
                  formatCLP(subtotal, 0),
                ];
              });

              autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [["Producto", "Cantidad", "Precio", "Valor Neto"]],
                body: tableBody,
                theme: "grid",
                styles: { fontSize: 10, cellPadding: 2 },
                headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: "center" },
              });

              // Totales finales
              let finalY = doc.lastAutoTable.finalY + 5;
              const totales = [
                ["Neto", formatCLP(totalNeto, 0)],
                ["IVA", formatCLP(iva, 0)],
                ["Total", formatCLP(total, 0)],
              ];
              autoTable(doc, {
                startY: finalY,
                body: totales,
                theme: "grid",
                styles: { fontSize: 10, halign: "right", cellPadding: 2 },
                columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
                tableLineColor: [0, 0, 0],
                tableLineWidth: 0.2,
              });

              // Pie de página
              doc.setFontSize(10);
              doc.text("Nota de venta válida por 7 días.", 15, doc.lastAutoTable.finalY + 10);

              // Guardar PDF
              doc.save(`Nota de venta #${orden.id}.pdf`);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Descargar PDF
          </button>

          <ModifyButton onClick={() => navigate(`/ventas/ordenes/${id}/edit`)} />
          <DeleteButton
            onConfirmDelete={async () => {
              if (!window.confirm("¿Eliminar esta orden de venta?")) return;
              try {
                await api(`/ordenes-venta/${id}`, { method: "DELETE" });
                toast.success("Orden eliminada correctamente");
                navigate("/ventas/ordenes");
              } catch (err) {
                toast.error("No se pudo eliminar la orden");
              }
            }}
            tooltipText="Eliminar Orden"
            entityName="orden de venta"
          />
        </div>
      </div>

      <div className="bg-gray-200 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Información</h2>
        <table className="w-full bg-white rounded shadow">
          <tbody>
            <tr><td className="px-6 py-2 font-medium">Número OC</td><td className="px-6 py-2">{orden.numero_oc}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Costo de Envío</td><td className="px-6 py-2">{formatCLP(orden.costo_envio || 0, 0)}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Fecha Emisión OC</td><td className="px-6 py-2">{orden.fecha_orden ? new Date(orden.fecha_orden).toLocaleDateString("es-CL") : ""}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Fecha de Entrega</td><td className="px-6 py-2">{orden.fecha_envio ? new Date(orden.fecha_envio).toLocaleDateString("es-CL") : "-"}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Fecha Facturación</td><td className="px-6 py-2">{orden.fecha_facturacion ? new Date(orden.fecha_facturacion).toLocaleDateString("es-CL") : "-"}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Estado</td><td className="px-6 py-2">{orden.estado}</td></tr>
            <tr>
              <td className="px-6 py-2 font-medium">Dirección</td>
              <td className="px-6 py-2">
                {direccion.tipo_direccion || ""} {direccion.nombre_sucursal || ""} - {direccion.calle || ""} {direccion.numero || ""}, {direccion.comuna || ""}
              </td>
            </tr>
            <tr><td className="px-6 py-2 font-medium">Cliente</td><td className="px-6 py-2">{cliente.nombre_empresa}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Total Neto</td><td className="px-6 py-2">{formatCLP(totalNeto, 0)}</td></tr>
            <tr><td className="px-6 py-2 font-medium">Condiciones</td><td className="px-6 py-2">{orden.condiciones}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gray-200 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Productos</h2>
        <table className="w-full table-auto bg-white rounded shadow">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Producto</th>
              <th className="px-4 py-2 text-left">Cantidad</th>
              <th className="px-4 py-2 text-left">Precio Unitario</th>
              <th className="px-4 py-2 text-left">Descuento (%)</th>
              <th className="px-4 py-2 text-left">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item) => {
              const producto = products.find((p) => p.value === item.id_producto);
              const subtotal = item.cantidad * item.precio_venta * (1 - (item.porcentaje_descuento || 0) / 100);
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">{producto ? producto.label : `Producto #${item.id_producto}`}</td>
                  <td className="px-4 py-2">{item.cantidad}</td>
                  <td className="px-4 py-2">{formatCLP(item.precio_venta, 0)}</td>
                  <td className="px-4 py-2">{item.porcentaje_descuento || 0}%</td>
                  <td className="px-4 py-2">{formatCLP(subtotal, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-lg font-semibold">
          Costo Envío: {formatCLP(costoEnvio, 0)} &nbsp;|&nbsp; Neto: {formatCLP(totalNeto, 0)} &nbsp;|&nbsp; IVA: {formatCLP(iva, 0)} &nbsp;|&nbsp;
          <span className="text-primary">Total: {formatCLP(total, 0)}</span>
        </div>
      </div>
    </div>
  );
}
