import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackButton, ModifyButton, DeleteButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
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
  const [loading, setLoading] = useState(false);
  const [progresoData, setProgresoData] = useState(null);
  const [loadingProgreso, setLoadingProgreso] = useState(false);
  const [sending, setSending] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const fetchOrden = async () => {
    const ordenData = await api(`/ordenes-venta/${id}/info`);
    return ordenData?.data || ordenData;
  };

  const fetchProgreso = async () => {
    const progreso = await api(`/ordenes-venta/${id}/progreso`);
    return progreso?.data || progreso;
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const o = await fetchOrden();
        setOrden(o);
      } catch (err) {
        console.error("OrdenVentaDetail fetch error:", err);
        toast.error("Error al cargar los datos de la orden");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, api]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoadingProgreso(true);
        const p = await fetchProgreso();
        setProgresoData(p);
      } catch (err) {
        console.error("OrdenVentaDetail progreso error:", err);
        setProgresoData(null);
      } finally {
        setLoadingProgreso(false);
      }
    })();
  }, [id, api]);

  const direccion = orden?.direccion || {};
  const cliente = direccion?.cliente || {};
  const bodega = orden?.bodega || {};

  const orderItems = useMemo(
    () => (Array.isArray(orden?.productos) ? orden.productos : []),
    [orden]
  );

  const progresoRows = useMemo(() => {
    const items = Array.isArray(progresoData?.progreso) ? progresoData.progreso : [];
    return items.map((p) => {
      const requerido = Number(p?.requerido_unidades ?? 0);
      const asignado = Number(p?.asignado_unidades ?? 0);
      const faltante = Number(p?.faltante_unidades ?? Math.max(0, requerido - asignado));
      const exceso = Number(p?.exceso_unidades ?? Math.max(0, asignado - requerido));
      const bultosAsignados = Array.isArray(p?.bultos_asignados) ? p.bultos_asignados : [];
      return {
        id: p?.id_producto,
        id_producto: p?.id_producto,
        producto_nombre: p?.ProductoBase?.nombre || `Producto #${p?.id_producto ?? "—"}`,
        requerido_unidades: requerido,
        asignado_unidades: asignado,
        faltante_unidades: faltante,
        exceso_unidades: exceso,
        bultos_asignados: bultosAsignados,
      };
    });
  }, [progresoData]);

  const filasExtraccion = useMemo(() => {
    const rows = [];
    for (const p of progresoRows) {
      const bultos = Array.isArray(p?.bultos_asignados) ? p.bultos_asignados : [];
      bultos.forEach((b, idx) => {
        rows.push({
          key: `${p?.id_producto ?? "p"}-${b?.id_pick ?? b?.id_bulto ?? b?.identificador ?? idx}`,
          producto: p?.producto_nombre || "—",
          bulto: b?.identificador || b?.id_bulto || "—",
          pallet: b?.pallet_identificador || "—",
          unidades_pickeadas: Number(b?.unidades_pickeadas ?? 0),
        });
      });
    }
    return rows;
  }, [progresoRows]);

  const canSend = orden?.estado === "Listo-para-despacho";
  const canDeliver = orden?.estado === "Listo-para-despacho" || orden?.estado === "Enviado";

  const handleEnviar = async () => {
    if (!id) return;
    if (!window.confirm("¿Enviar esta orden de venta?")) return;
    try {
      setSending(true);
      const res = await api(`/ordenes-venta/${id}/enviar-orden`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Enviado" } : prev));
      toast.success(res?.data?.message || "Orden enviada correctamente");
    } catch (err) {
      toast.error("No se pudo enviar la orden");
    } finally {
      setSending(false);
    }
  };

  const handleEntregar = async () => {
    if (!id) return;
    if (!window.confirm("¿Confirmar la entrega exitosa de esta orden de venta?")) return;
    try {
      setDelivering(true);
      const res = await api(`/ordenes-venta/${id}/entregar-orden`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Entregado" } : prev));
      toast.success(res?.data?.message || "Orden entregada correctamente");
    } catch (err) {
      toast.error("No se pudo entregar la orden");
    } finally {
      setDelivering(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-CL");
  };

  const fmtInt = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("es-CL").format(Math.trunc(n));
  };

  const getEstadoBadge = (estado) => {
    if (!estado) return <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">—</span>;
    const normalized = String(estado).toLowerCase();
    const base = "px-3 py-1 rounded-full text-sm font-medium";
    if (normalized.includes("pend")) return <span className={`${base} bg-amber-100 text-amber-800`}>Pendiente</span>;
    if (normalized.includes("list")) return <span className={`${base} bg-blue-100 text-blue-700`}>Lista</span>;
    if (normalized.includes("envi")) return <span className={`${base} bg-violet-100 text-violet-700`}>Enviada</span>;
    if (normalized.includes("entreg")) return <span className={`${base} bg-green-100 text-green-700`}>Entregada</span>;
    if (normalized.includes("cancel")) return <span className={`${base} bg-red-100 text-red-700`}>Cancelada</span>;
    return <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>;
  };

  const totalProductos = useMemo(
    () =>
      orderItems.reduce(
        (sum, it) =>
          sum +
          Number(it?.cantidad || 0) *
            Number(it?.precio_venta || 0) *
            (1 - (Number(it?.porcentaje_descuento || 0) || 0) / 100),
        0
      ),
    [orderItems]
  );

  const costoEnvio = Number(orden?.costo_envio || 0);
  const totalNeto = totalProductos + costoEnvio;
  const iva = Math.round(totalNeto * 0.19);
  const total = totalNeto + iva;

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );

  if (!orden)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center text-gray-500">
        No se encontró la orden de venta
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/ventas/ordenes" />
      </div>
      <div className="flex justify-between items-center my-4">
        <h1 className="text-2xl font-bold text-text">Orden de Venta: {orden.id}</h1>
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
                ["Fecha de Emisión", formatDate(orden.fecha_orden)],
                ["Cliente", cliente?.nombre_empresa || "—"],
                ["Rut", cliente?.rut || "—"],
                [
                  "Dirección",
                  direccion?.calle && direccion?.numero
                    ? `${direccion.calle} ${direccion.numero}, ${direccion.comuna || ""}`
                    : direccion?.nombre_sucursal || "—",
                ],
                ["Estado", orden.estado || "—"],
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
                const productoNombre = it?.ProductoBase?.nombre || `Producto #${it?.id_producto ?? "—"}`;
                const subtotal =
                  Number(it?.cantidad || 0) *
                  Number(it?.precio_venta || 0) *
                  (1 - (Number(it?.porcentaje_descuento || 0) || 0) / 100);
                return [
                  productoNombre,
                  Number(it?.cantidad || 0),
                  formatCLP(Number(it?.precio_venta || 0), 0),
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

      {/* Panel rápido (estilo OM/Solicitud) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
          <div className="text-xs text-gray-500 font-medium">CLIENTE</div>
          <div className="font-bold text-text mt-1">
            {cliente?.nombre_empresa || "—"}
          </div>
          <div className="text-xs text-gray-600 mt-2">RUT: {cliente?.rut || "—"}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 font-medium">ESTADO</div>
          <div className="mt-2">{getEstadoBadge(orden?.estado)}</div>
          <div className="text-xs text-gray-600 mt-2">OC: {orden?.numero_oc || "—"}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 font-medium">TOTALES</div>
          <div className="text-lg font-bold text-text mt-1">{formatCLP(total, 0)}</div>
          <div className="text-xs text-gray-600 mt-2">Neto: {formatCLP(totalNeto, 0)} · IVA: {formatCLP(iva, 0)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 font-medium">BODEGA</div>
          <div className="font-bold text-text mt-1">{bodega?.nombre || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">Despacho: {formatDate(orden?.fecha_envio)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Información</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg border border-border p-3">
            <div className="text-xs text-gray-500 font-medium">Dirección</div>
            <div className="font-medium text-text mt-1">
              {direccion?.tipo_direccion || ""} {direccion?.nombre_sucursal || ""}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {direccion?.calle || ""} {direccion?.numero || ""}{direccion?.comuna ? `, ${direccion.comuna}` : ""}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg border border-border p-3">
            <div className="text-xs text-gray-500 font-medium">Fechas</div>
            <div className="text-xs text-gray-600 mt-1">Emisión: {formatDate(orden?.fecha_orden)}</div>
            <div className="text-xs text-gray-600">Despacho: {formatDate(orden?.fecha_envio)}</div>
            <div className="text-xs text-gray-600">Facturación: {formatDate(orden?.fecha_facturacion)}</div>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-700">
          <span className="font-medium">Costo envío:</span> {formatCLP(costoEnvio, 0)} ·
          <span className="font-medium"> Neto:</span> {formatCLP(totalNeto, 0)} ·
          <span className="font-medium"> IVA:</span> {formatCLP(iva, 0)} ·
          <span className="font-medium text-primary"> Total:</span> {formatCLP(total, 0)}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Resumen de asignación</h2>
        {loadingProgreso ? (
          <div className="text-sm text-gray-500">Cargando asignación...</div>
        ) : progresoRows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Producto</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Requerido (u)</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Asignado (u)</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Faltante (u)</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Exceso (u)</th>
                  </tr>
                </thead>
                <tbody>
                  {progresoRows.map((r) => (
                    <tr key={r.id_producto ?? r.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 whitespace-normal break-words">{r.producto_nombre}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{fmtInt(r.requerido_unidades)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{fmtInt(r.asignado_unidades)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{fmtInt(r.faltante_unidades)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{fmtInt(r.exceso_unidades)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-text mb-2">Detalle de extracción por bulto</h3>
              {filasExtraccion.length === 0 ? (
                <div className="text-sm text-gray-500">No hay bultos asignados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left">Producto</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Bulto</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Pallet</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Unidades pickeadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasExtraccion.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 whitespace-normal break-words">{row.producto}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.bulto}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.pallet}</td>
                          <td className="border border-gray-300 px-4 py-2 text-right">{fmtInt(row.unidades_pickeadas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">Sin asignación registrada.</div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-base font-semibold text-text mb-3">Productos</h2>
        <Table
          columns={[
            {
              header: "Producto",
              accessor: "producto_nombre",
              cellClassName: "whitespace-normal break-words",
            },
            { header: "Cantidad", accessor: "cantidad" },
            {
              header: "Precio Unit.",
              accessor: "precio_venta",
              Cell: ({ value }) => formatCLP(Number(value || 0), 0),
            },
            {
              header: "Desc. (%)",
              accessor: "porcentaje_descuento",
              Cell: ({ value }) => `${Number(value || 0)}%`,
            },
            {
              header: "Subtotal",
              accessor: "subtotal",
              Cell: ({ value }) => formatCLP(Number(value || 0), 0),
            },
          ]}
          data={orderItems.map((it) => {
            const subtotal =
              Number(it?.cantidad || 0) *
              Number(it?.precio_venta || 0) *
              (1 - (Number(it?.porcentaje_descuento || 0) || 0) / 100);
            return {
              id: it?.id,
              producto_nombre: it?.ProductoBase?.nombre || `Producto #${it?.id_producto ?? "—"}`,
              cantidad: Number(it?.cantidad || 0),
              precio_venta: Number(it?.precio_venta || 0),
              porcentaje_descuento: Number(it?.porcentaje_descuento || 0),
              subtotal,
            };
          })}
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={handleEnviar}
          disabled={!canSend || sending || delivering}
          className={`px-4 py-2 rounded-md text-white ${
            !canSend || sending || delivering
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={canSend ? "Enviar" : "Disponible solo cuando esté Listo-para-despacho"}
        >
          {sending ? "Enviando..." : "Enviar"}
        </button>

        <button
          onClick={handleEntregar}
          disabled={!canDeliver || delivering || sending}
          className={`px-4 py-2 rounded-md text-white ${
            !canDeliver || delivering || sending
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
          title={canDeliver ? "Entregar" : "Disponible solo cuando esté Enviado o Listo-para-despacho"}
        >
          {delivering ? "Entregando..." : "Entregar"}
        </button>
      </div>
    </div>
  );
}
