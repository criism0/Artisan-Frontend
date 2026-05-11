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
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";
import Selector from "../../components/Selector";

// ── Clases de botones reutilizables ──────────────────────────────────────────
const btn = {
  base: "px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  primary:  "bg-primary text-white hover:bg-hover",
  blue:     "bg-blue-600 text-white hover:bg-blue-700",
  indigo:   "bg-indigo-600 text-white hover:bg-indigo-700",
  yellow:   "bg-yellow-500 text-white hover:bg-yellow-600",
  green:    "bg-green-600 text-white hover:bg-green-700",
  ghost:    "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};
const btnCls = (...keys) => [btn.base, ...keys.map((k) => btn[k])].join(" ");

// ── Estilos de inputs consistentes ───────────────────────────────────────────
const inputCls = "border border-gray-300 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary w-full";

// ── Datos de la empresa emisora ───────────────────────────────────────────────
const COMPANY = {
  nombre: "ELABORADORA DE ALIMENTOS GOURMET LTDA.",
  rut: "76.059.975-1",
  cuenta_corriente: "490370201",
  banco: "BANCO DE CHILE",
  contacto: "oc@quesosartisan.cl",
};

// ── Subformulario: Facturar ───────────────────────────────────────────────────
function FacturarForm({
  direccionesCliente,
  idLocalDespacho,
  setIdLocalDespacho,
  loadingDirecciones,
  fechaFacturacion,
  setFechaFacturacion,
  transitioning,
  onConfirm,
  onCancel,
  requiereDir = false,
}) {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">
          Dirección de entrega {requiereDir && <span className="text-red-500">*</span>}
        </span>
        {loadingDirecciones ? (
          <span className="text-sm text-gray-400 py-2">Cargando direcciones...</span>
        ) : (
          <Selector
            options={direccionesCliente.map((d) => ({
              value: String(d.id),
              label: [d.tipo_direccion, d.nombre_sucursal, [d.calle, d.numero].filter(Boolean).join(" "), d.comuna]
                .filter(Boolean)
                .join(" — "),
              searchText: [d.tipo_direccion, d.nombre_sucursal, d.calle, d.numero, d.comuna, d.region]
                .filter(Boolean)
                .join(" "),
            }))}
            selectedValue={idLocalDespacho}
            onSelect={setIdLocalDespacho}
            useFuzzy
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        )}
        <span className="text-xs text-gray-400 italic">
          {requiereDir
            ? "Debes seleccionar la dirección de entrega para poder facturar"
            : "Confirma o ajusta la dirección antes de facturar"}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Fecha de facturación *</span>
        <input
          type="date"
          value={fechaFacturacion}
          onChange={(e) => setFechaFacturacion(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={transitioning} className={btnCls("yellow")}>
          {transitioning ? "Facturando..." : "Confirmar factura"}
        </button>
        <button onClick={onCancel} className={btnCls("ghost")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Subformulario: Entregar ───────────────────────────────────────────────────
function EntregarForm({ costoEnvio, setCostoEnvio, fechaEnvio, setFechaEnvio, delivering, onConfirm, onCancel }) {
  return (
    <div className="flex flex-col gap-4 max-w-xs">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Costo de envío * <span className="text-xs text-gray-400 font-normal">(puede ser 0)</span></span>
        <input
          type="number"
          value={costoEnvio}
          onChange={(e) => setCostoEnvio(e.target.value)}
          placeholder="Ej: 5000"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Fecha de entrega *</span>
        <input
          type="date"
          value={fechaEnvio}
          onChange={(e) => setFechaEnvio(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={delivering} className={btnCls("green")}>
          {delivering ? "Entregando..." : "Confirmar entrega"}
        </button>
        <button onClick={onCancel} className={btnCls("ghost")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrdenVentaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progresoData, setProgresoData] = useState(null);
  const [loadingProgreso, setLoadingProgreso] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showFacturarForm, setShowFacturarForm] = useState(false);
  const [showEntregarForm, setShowEntregarForm] = useState(false);
  const [fechaFacturacion, setFechaFacturacion] = useState("");
  const [costoEnvio, setCostoEnvio] = useState("");
  const [fechaEnvio, setFechaEnvio] = useState("");
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [idLocalDespacho, setIdLocalDespacho] = useState("");
  const [loadingDirecciones, setLoadingDirecciones] = useState(false);

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

  const direccion = orden?.direccion || null;
  const cliente = orden?.cliente || {};
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
      return {
        id: p?.id_producto,
        id_producto: p?.id_producto,
        producto_nombre: p?.ProductoBase?.nombre || `Producto #${p?.id_producto ?? "—"}`,
        requerido_unidades: requerido,
        asignado_unidades: asignado,
        faltante_unidades: faltante,
        exceso_unidades: exceso,
        bultos_asignados: Array.isArray(p?.bultos_asignados) ? p.bultos_asignados : [],
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

  const canValidar = checkScope(ModelType.VALIDAR_ORDEN_VENTA, ScopeType.WRITE);

  // ── Handlers de transición ──────────────────────────────────────────────────
  const handleValidar = async () => {
    if (!id) return;
    if (!window.confirm("¿Validar esta orden de venta?")) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/validar`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Validada" } : prev));
      toast.success(res?.data?.message || "Orden validada correctamente");
    } catch (err) {
      toast.error(err?.response?.data?.error || "No se pudo validar la orden");
    } finally {
      setTransitioning(false);
    }
  };

  const handleCompletarPicking = async () => {
    if (!id) return;
    if (!window.confirm("¿Completar el picking? Se verificará que todos los productos estén asignados.")) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/completar-picking`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Lista para despacho" } : prev));
      toast.success(res?.data?.message || "Picking completado correctamente");
    } catch (err) {
      toast.error(err?.response?.data?.error || "No se pudo completar el picking");
    } finally {
      setTransitioning(false);
    }
  };

  const loadDireccionesCliente = async (clienteId) => {
    if (!clienteId) return;
    setLoadingDirecciones(true);
    try {
      const res = await api(`/clientes/${clienteId}`);
      const data = res?.data || res;
      setDireccionesCliente(Array.isArray(data?.direcciones) ? data.direcciones : []);
    } catch {
      toast.error("No se pudieron cargar las direcciones del cliente");
    } finally {
      setLoadingDirecciones(false);
    }
  };

  const handleFacturar = async () => {
    if (!fechaFacturacion) {
      toast.error("Ingresa la fecha de facturación");
      return;
    }
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/facturar`, {
        method: "PUT",
        body: JSON.stringify({
          fecha_facturacion: fechaFacturacion,
          ...(idLocalDespacho && { id_local: Number(idLocalDespacho) }),
        }),
      });
      const o = await fetchOrden();
      setOrden(o);
      toast.success(res?.data?.message || res?.message || "Orden facturada correctamente");
      setShowFacturarForm(false);
      setFechaFacturacion("");
      setIdLocalDespacho("");
      setDireccionesCliente([]);
    } catch (err) {
      toast.error(err?.response?.data?.error || "No se pudo facturar la orden");
    } finally {
      setTransitioning(false);
    }
  };

  const handleEntregar = async () => {
    if (costoEnvio === "" || costoEnvio === null) {
      toast.error("Ingresa el costo de envío (puede ser 0)");
      return;
    }
    if (!fechaEnvio) {
      toast.error("Ingresa la fecha de entrega");
      return;
    }
    try {
      setDelivering(true);
      const res = await api(`/ordenes-venta/${id}/entregar`, {
        method: "PUT",
        body: JSON.stringify({ costo_envio: Number(costoEnvio), fecha_envio: fechaEnvio }),
      });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Entregada" } : prev));
      toast.success(res?.data?.message || "Orden entregada correctamente");
      setShowEntregarForm(false);
      setCostoEnvio("");
      setFechaEnvio("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "No se pudo entregar la orden");
    } finally {
      setDelivering(false);
    }
  };

  const handleDescargarPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Orden de Venta N° ${orden.id}`, 15, 55);
    doc.setLineWidth(0.5);
    doc.line(15, 57, pageWidth - 15, 57);

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

    const tableBody = orderItems.map((it) => {
      const productoNombre = it?.ProductoBase?.nombre || `Producto #${it?.id_producto ?? "—"}`;
      const subtotal =
        Number(it?.cantidad || 0) *
        Number(it?.precio_venta || 0) *
        (1 - (Number(it?.porcentaje_descuento || 0) || 0) / 100);
      return [productoNombre, Number(it?.cantidad || 0), formatCLP(Number(it?.precio_venta || 0), 0), formatCLP(subtotal, 0)];
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Producto", "Cantidad", "Precio", "Valor Neto"]],
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: "center" },
    });

    const totales = [
      ["Neto", formatCLP(totalNeto, 0)],
      ["IVA", formatCLP(iva, 0)],
      ["Total", formatCLP(total, 0)],
    ];
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 5,
      body: totales,
      theme: "grid",
      styles: { fontSize: 10, halign: "right", cellPadding: 2 },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.2,
    });

    doc.setFontSize(10);
    doc.text("Nota de venta válida por 7 días.", 15, doc.lastAutoTable.finalY + 10);
    doc.save(`Nota de venta #${orden.id}.pdf`);
  };

  // ── Helpers de presentación ─────────────────────────────────────────────────
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
    const base = "px-3 py-1 rounded-full text-sm font-medium";
    const map = {
      "Creada":             `${base} bg-gray-200 text-gray-700`,
      "Validada":           `${base} bg-blue-100 text-blue-700`,
      "En picking":         `${base} bg-indigo-100 text-indigo-700`,
      "Lista para despacho":`${base} bg-cyan-100 text-cyan-700`,
      "Facturada":          `${base} bg-yellow-100 text-yellow-700`,
      "Entregada":          `${base} bg-green-100 text-green-700`,
    };
    return <span className={map[estado] || `${base} bg-gray-100 text-gray-600`}>{estado}</span>;
  };

  const STEPS_NORMAL = ["Creada", "Validada", "En picking", "Lista para despacho", "Facturada", "Entregada"];
  const STEPS_REF    = ["Creada", "Validada", "Facturada", "Entregada"];
  const steps = orden?.es_referencial ? STEPS_REF : STEPS_NORMAL;
  const currentStepIdx = steps.indexOf(orden?.estado ?? "");

  const StepBar = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const done = idx < currentStepIdx;
          const active = idx === currentStepIdx;
          return (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${done ? "bg-primary text-white" : active ? "bg-primary text-white ring-2 ring-primary ring-offset-2" : "bg-gray-200 text-gray-500"}`}
                >
                  {done ? "✓" : idx + 1}
                </div>
                <span className={`mt-1 text-xs text-center leading-tight ${active ? "font-semibold text-primary" : done ? "text-gray-600" : "text-gray-400"}`}>
                  {step}
                </span>
                {step === "Creada" && orden?.es_referencial && (
                  <span className="mt-0.5 text-xs text-amber-500 font-medium">Referencial</span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${idx < currentStepIdx ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

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

  const costoEnvioActual = Number(orden?.costo_envio || 0);
  const totalNeto = totalProductos + costoEnvioActual;
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

  // ── Acción disponible según estado ─────────────────────────────────────────
  const renderAccion = () => {
    const estado = orden?.estado;

    if (estado === "Creada") {
      return canValidar ? (
        <button onClick={handleValidar} disabled={transitioning} className={btnCls("blue")}>
          {transitioning ? "Validando..." : "✔ Validar orden"}
        </button>
      ) : (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Sin permisos para validar esta orden. Contacta a un administrador.
        </p>
      );
    }

    if (estado === "Validada" && !orden?.es_referencial) {
      return (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          La orden pasará a <strong>En picking</strong> automáticamente al registrar el primer bulto en la asignación.
        </p>
      );
    }

    if (estado === "Validada" && orden?.es_referencial) {
      return showFacturarForm ? (
        <FacturarForm
          direccionesCliente={direccionesCliente}
          idLocalDespacho={idLocalDespacho}
          setIdLocalDespacho={setIdLocalDespacho}
          loadingDirecciones={loadingDirecciones}
          fechaFacturacion={fechaFacturacion}
          setFechaFacturacion={setFechaFacturacion}
          transitioning={transitioning}
          onConfirm={handleFacturar}
          onCancel={() => { setShowFacturarForm(false); setIdLocalDespacho(""); setDireccionesCliente([]); }}
          requiereDir={!orden?.id_local}
        />
      ) : (
        <button
          onClick={() => { setShowFacturarForm(true); setIdLocalDespacho(String(orden?.id_local || "")); loadDireccionesCliente(cliente?.id); }}
          className={btnCls("yellow")}
        >
          Facturar orden
        </button>
      );
    }

    if (estado === "En picking") {
      return (
        <button onClick={handleCompletarPicking} disabled={transitioning} className={btnCls("indigo")}>
          {transitioning ? "Completando..." : "✔ Completar picking"}
        </button>
      );
    }

    if (estado === "Lista para despacho") {
      return showFacturarForm ? (
        <FacturarForm
          direccionesCliente={direccionesCliente}
          idLocalDespacho={idLocalDespacho}
          setIdLocalDespacho={setIdLocalDespacho}
          loadingDirecciones={loadingDirecciones}
          fechaFacturacion={fechaFacturacion}
          setFechaFacturacion={setFechaFacturacion}
          transitioning={transitioning}
          onConfirm={handleFacturar}
          onCancel={() => { setShowFacturarForm(false); setIdLocalDespacho(""); setDireccionesCliente([]); }}
          requiereDir={!orden?.id_local}
        />
      ) : (
        <button
          onClick={() => { setShowFacturarForm(true); setIdLocalDespacho(String(orden?.id_local || "")); loadDireccionesCliente(cliente?.id); }}
          className={btnCls("yellow")}
        >
          Facturar orden
        </button>
      );
    }

    if (estado === "Facturada") {
      return showEntregarForm ? (
        <EntregarForm
          costoEnvio={costoEnvio}
          setCostoEnvio={setCostoEnvio}
          fechaEnvio={fechaEnvio}
          setFechaEnvio={setFechaEnvio}
          delivering={delivering}
          onConfirm={handleEntregar}
          onCancel={() => setShowEntregarForm(false)}
        />
      ) : (
        <button onClick={() => setShowEntregarForm(true)} className={btnCls("green")}>
          Registrar entrega
        </button>
      );
    }

    if (estado === "Entregada") {
      return (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          ✔ Orden completada y entregada.
        </p>
      );
    }

    return null;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/ventas/ordenes" />
      </div>

      <div className="flex justify-between items-center my-4">
        <h1 className="text-2xl font-bold text-text">Orden de Venta #{orden.id}</h1>
        <div className="flex gap-2 items-center">
          <button onClick={handleDescargarPDF} className={btnCls("ghost")}>
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

      <StepBar />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cliente</div>
          <div className="font-bold text-text mt-1">{cliente?.nombre_empresa || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">RUT: {cliente?.rut || "—"}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Estado</div>
          <div className="mt-2">{getEstadoBadge(orden?.estado)}</div>
          <div className="text-xs text-gray-600 mt-2">OC: {orden?.numero_oc || "—"}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</div>
          <div className="text-lg font-bold text-text mt-1">{formatCLP(total, 0)}</div>
          <div className="text-xs text-gray-600 mt-2">Neto: {formatCLP(totalNeto, 0)} · IVA: {formatCLP(iva, 0)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bodega</div>
          <div className="font-bold text-text mt-1">{bodega?.nombre || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">Despacho: {formatDate(orden?.fecha_envio)}</div>
        </div>
      </div>

      {/* Información general */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Información</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg border border-border p-3">
            <div className="text-xs text-gray-500 font-medium">Dirección de entrega</div>
            {direccion ? (
              <>
                <div className="font-medium text-text mt-1">
                  {[direccion.tipo_direccion, direccion.nombre_sucursal].filter(Boolean).join(" — ") || "—"}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {direccion.calle || ""} {direccion.numero || ""}{direccion.comuna ? `, ${direccion.comuna}` : ""}
                </div>
              </>
            ) : (
              <div className="mt-1">
                <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  Por asignar — se confirma al facturar
                </span>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg border border-border p-3">
            <div className="text-xs text-gray-500 font-medium">Fechas</div>
            <div className="text-xs text-gray-600 mt-1">Emisión: {formatDate(orden?.fecha_orden)}</div>
            <div className="text-xs text-gray-600">Despacho: {formatDate(orden?.fecha_envio)}</div>
            <div className="text-xs text-gray-600">Facturación: {formatDate(orden?.fecha_facturacion)}</div>
          </div>
        </div>

        <div className="mt-3 text-sm text-gray-700">
          <span className="font-medium">Costo envío:</span> {formatCLP(costoEnvioActual, 0)} ·{" "}
          <span className="font-medium">Neto:</span> {formatCLP(totalNeto, 0)} ·{" "}
          <span className="font-medium">IVA:</span> {formatCLP(iva, 0)} ·{" "}
          <span className="font-medium text-primary">Total:</span> {formatCLP(total, 0)}
        </div>
      </div>

      {/* Resumen de asignación */}
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

      {/* Tabla de productos */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-base font-semibold text-text mb-3">Productos</h2>
        <Table
          columns={[
            { header: "Producto", accessor: "producto_nombre", cellClassName: "whitespace-normal break-words" },
            { header: "Cantidad", accessor: "cantidad" },
            { header: "Precio Unit.", accessor: "precio_venta", Cell: ({ value }) => formatCLP(Number(value || 0), 0) },
            { header: "Desc. (%)", accessor: "porcentaje_descuento", Cell: ({ value }) => `${Number(value || 0)}%` },
            { header: "Subtotal", accessor: "subtotal", Cell: ({ value }) => formatCLP(Number(value || 0), 0) },
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

      {/* Acciones según estado */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-base font-semibold text-text mb-3">Acciones</h2>
        {renderAccion()}
      </div>
    </div>
  );
}
