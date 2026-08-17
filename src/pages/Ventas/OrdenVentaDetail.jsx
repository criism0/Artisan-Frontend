import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  PackageCheck,
  Pencil,
  Receipt,
  Trash2,
  Truck,
} from "lucide-react";
import Table from "../../components/Tables/Table";
import PageHeader from "../../components/UI/PageHeader.jsx";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import Modal from "../../components/UI/Modal.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
// jspdf y jspdf-autotable NO se importan acá: se cargan bajo demanda dentro de
// `handleDescargarPDF`, que es el único sitio que los usa.
import logo from "../../assets/logo.png";
import { formatCLP } from "../../services/formatHelpers";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import PanelFacturacion from "../../components/DTE/PanelFacturacion.jsx";
import DTEPreview from "../../components/DTE/DTEPreview.jsx";
import DetalleTipoFactura from "../../components/Ventas/DetalleTipoFactura.jsx";
import Selector from "../../components/Forms/Selector";
import AvanceItems from "../../components/AvanceItems";
import { useConfirm } from "../../components/Modals/ConfirmProvider.jsx";
import { mensajeError } from "../../utils/mensajeError.js";
import { derivarFolioOC, esVentaAPlazo, origenVencimiento } from "../../utils/referenciaOC.js";
import { cantidadFacturable, resumenFacturable } from "../../utils/cantidadFacturable.js";
import { esFormatoCajas, lineaEnCajas, unidadesPorCajaDeLinea } from "../../utils/formatoCantidad.js";

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

// ── Mensaje de error legible ──────────────────────────────────────────────────
// 🔴 Esta función leía `err.response.data.error` —la forma de axios, que no es dependencia de
// este proyecto— así que NUNCA mostraba lo que decía el backend: caía siempre en el genérico
// "Verifica tu conexión". Al facturar, eso escondía el mensaje que dice exactamente qué falta
// ("al cliente X le falta razón social, giro"). La lógica correcta vive en utils/mensajeError.
const apiErrorMsg = mensajeError;

// ── Datos de la empresa emisora ───────────────────────────────────────────────
const COMPANY = {
  nombre: "ELABORADORA DE ALIMENTOS GOURMET LTDA.",
  rut: "76.059.975-1",
  cuenta_corriente: "490370201",
  banco: "BANCO DE CHILE",
  contacto: "oc@quesosartisan.cl",
};

// Los estados por los que pasa una OV, en orden. Fuera del componente: no dependen de nada
// suyo y así el arreglo no se reconstruye en cada render.
const PASOS_OV = [
  "Creada",
  "Validada",
  "En picking",
  "Lista para facturación",
  "Facturada",
  "Entregada",
];

/**
 * Barra de progreso de la orden.
 *
 * Estaba definida DENTRO de OrdenVentaDetail (`const StepBar = () => …`). React ve una
 * función nueva en cada render, así que la trataba como un componente distinto y desmontaba
 * y volvía a montar toda la barra cada vez que cambiaba cualquier estado de la vista.
 */
function StepBar({ estadoActual }) {
  const actual = PASOS_OV.indexOf(estadoActual ?? "");

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        {PASOS_OV.map((paso, idx) => {
          const hecho = idx < actual;
          const activo = idx === actual;
          return (
            <div key={paso} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${hecho ? "bg-primary text-white" : activo ? "bg-primary text-white ring-2 ring-primary ring-offset-2" : "bg-gray-200 text-gray-500"}`}
                >
                  {hecho ? "✓" : idx + 1}
                </div>
                <span
                  className={`mt-1 text-xs text-center leading-tight ${activo ? "font-semibold text-primary" : hecho ? "text-gray-600" : "text-gray-400"}`}
                >
                  {paso}
                </span>
              </div>
              {idx < PASOS_OV.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${idx < actual ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Subformulario: Facturar ───────────────────────────────────────────────────
function FacturarForm({
  ordenId,
  numeroOc,
  condicionPago,
  condicionCliente,
  direccionesCliente,
  idLocalDespacho,
  setIdLocalDespacho,
  loadingDirecciones,
  fechaFacturacion,
  setFechaFacturacion,
  fechaVencimiento,
  setFechaVencimiento,
  origenFecha,
  setOrigenFecha,
  requiereDir = false,
  resumenPicking = null,
}) {
  // Lo que va a salir impreso como referencia. Se muestra, no se edita: es el `numero_oc` de la
  // orden, y si está mal se corrige en la orden — no al emitir el documento tributario.
  const { folio: folioOC, recortado, motivo: motivoOC } = derivarFolioOC(numeroOc);

  // ¿La venta es a plazo? Se mira la condición de la ORDEN —que el pedido EDI del retail trae
  // declarada— y, si no la hay, la de la ficha del cliente. Sirve para distinguir «no lleva
  // vencimiento porque es al contado» de «falta ponerle la fecha».
  const esAPlazo = esVentaAPlazo(condicionPago) || esVentaAPlazo(condicionCliente);
  const glosaFecha = condicionPago || condicionCliente || null;

  return (
    <div className="flex flex-col gap-4">
      {/* 🔴 EL AVISO DE PICKING VA PRIMERO, antes del documento. Facturar de más se deshace sólo
          con una nota de crédito, y ya pasó: la OV 794 se facturó por 3.600 unidades habiendo
          pickeado 2.376 y hubo que anularla el mismo día. */}
      {resumenPicking?.difieren && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
          <strong>La factura sale por lo pickeado, no por lo pedido.</strong>{" "}
          {resumenPicking.diferencias.length === 1 ? "Una línea salió" : `${resumenPicking.diferencias.length} líneas salieron`}{" "}
          distinta de lo que pidió el cliente:
          <ul className="mt-1 ml-4 list-disc">
            {resumenPicking.diferencias.map((d) => (
              <li key={d.nombre}>
                {d.nombre}: pidió {d.pedida.toLocaleString("es-CL")}, se pickeó{" "}
                <strong>{d.pickeada.toLocaleString("es-CL")}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-1">
            Neto pedido {formatCLP(resumenPicking.pedido, 0)} → a facturar{" "}
            <strong>{formatCLP(resumenPicking.facturable, 0)}</strong>. Si la diferencia no es
            correcta, corrige el picking antes de emitir.
          </div>
        </div>
      )}

      {/* Lo que va a decir el documento, con la MISMA vista que la pestaña Documentos.
          Antes este modal pedía dirección y fecha sin mostrar nada de lo que se iba a emitir:
          se confirmaba a ciegas un documento que después sólo se corrige con nota de crédito. */}
      {/* La dirección y las fechas elegidas acá todavía no están en la orden: se guardan recién
          al emitir. Hay que pasárselas al preview o arma el documento sin ellas. */}
      <DTEPreview
        ordenId={ordenId}
        tipo="factura"
        idLocal={idLocalDespacho || null}
        fecha={fechaFacturacion || null}
        vencimiento={fechaVencimiento || null}
      />

      {/* 🔴 La orden de compra. Sin ella el retail rechaza la factura porque no puede casarla
          con su pedido. Va de sólo lectura: sale del `numero_oc` de la orden. */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Orden de compra del cliente</span>
        {folioOC ? (
          <>
            <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-800 font-medium">
              {folioOC}
            </div>
            <span className="text-xs text-gray-400 italic">
              Sale en la factura como «Orden de compra N° {folioOC}».
            </span>
            {recortado && (
              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                El número de OC de la orden trae texto adicional («{numeroOc}») y en el documento
                sólo cabe el número. Si <strong>{folioOC}</strong> no es el que usa el cliente,
                corrígelo en la orden antes de facturar.
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {motivoOC} <strong>La factura saldrá sin referencia a la orden de compra</strong>, y
            el retail suele rechazarla por eso.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">
          Dirección de facturación {requiereDir && <span className="text-red-500">*</span>}
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
            ? "Debes seleccionar la dirección de facturación para poder facturar"
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

      {/* La fecha de pago SÍ es editable acá, pero su lugar natural es la ORDEN: es un término
          de la venta, no de la facturación. Los pedidos EDI del retail la traen declarada y el
          formulario de la OV la deja editar; esto es la última confirmación antes de emitir. */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Fecha de pago</span>
        <input
          type="date"
          value={fechaVencimiento}
          onChange={(e) => {
            setFechaVencimiento(e.target.value);
            // Escrita a mano deja de ser «la que propuso el sistema». Decirlo evita que alguien
            // lea una fecha tecleada como si viniera de la condición del cliente.
            setOrigenFecha("manual");
          }}
          className={inputCls}
        />
        {/* 🔴 DE DÓNDE SALIÓ LA FECHA. El número solo no dice si alguien la decidió para esta
            orden o si el sistema la dedujo de la ficha del cliente, y eso es justo lo que hay
            que saber al confirmarla antes de emitir. Mismo criterio que `OrigenPrecio`. */}
        {fechaVencimiento ? (
          <span className="text-xs text-gray-500">
            {origenFecha === "orden" && "Guardada en esta orden. "}
            {origenFecha === "condicion_orden" && (
              <>Calculada desde la condición del <strong>documento del cliente</strong>
                {condicionPago ? ` (${condicionPago})` : ""}. </>
            )}
            {origenFecha === "condicion_cliente" && (
              <>Calculada desde la condición de la <strong>ficha del cliente</strong>
                {condicionCliente ? ` (${condicionCliente})` : ""}. </>
            )}
            {origenFecha === "manual" && "Escrita a mano. "}
            <span className="text-gray-400 italic">
              Sale en la factura como vencimiento y como pago programado.
            </span>
          </span>
        ) : esAPlazo ? (
          // Vacío no siempre significa contado: si es a plazo, la factura sin vencimiento es un
          // dato que falta, no una decisión. No bloquea, pero tiene que verse antes de emitir.
          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            Esta venta es <strong>a plazo</strong>
            {glosaFecha ? ` (${glosaFecha})` : ""} y no tiene fecha de pago. La factura saldrá
            <strong> sin vencimiento</strong>, que es lo que el cliente usa para pagar.
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">
            Sin fecha, la factura sale como venta al contado y sin vencimiento.
          </span>
        )}
      </div>

      {/* B5: facturar = emitir el documento tributario (sin documento no hay factura) */}
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Al confirmar se <strong>emite la Factura Electrónica (SII vía LibreDTE)</strong>.
        El cliente debe tener RUT, razón social y giro registrados.
      </div>
    </div>
  );
}

// ── Subformulario: Entregar ───────────────────────────────────────────────────
function EntregarForm({ costoEnvio, setCostoEnvio, fechaEnvio, setFechaEnvio }) {
  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function OrdenVentaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const confirm = useConfirm();

  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progresoData, setProgresoData] = useState(null);
  const [loadingProgreso, setLoadingProgreso] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showFacturarForm, setShowFacturarForm] = useState(false);
  const [showEntregarForm, setShowEntregarForm] = useState(false);
  const [tab, setTab] = useState("detalle");
  const [fechaFacturacion, setFechaFacturacion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [origenFecha, setOrigenFecha] = useState("contado");
  const [costoEnvio, setCostoEnvio] = useState("");
  const [fechaEnvio, setFechaEnvio] = useState("");
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [idLocalDespacho, setIdLocalDespacho] = useState("");
  const [loadingDirecciones, setLoadingDirecciones] = useState(false);
  // 🔴 La dirección de despacho se podía elegir SÓLO al facturar (`id_local` es editable en
  // cualquier momento en el backend, pero la única UI que lo ofrecía era el modal de Facturar).
  // Reporte de Hernán, 2026-08-17: un cliente con 3 sucursales bajo el mismo RUT —cada pedido
  // va a una— y logística no tenía dónde asignar cuál, así que todo salía a la dirección por
  // defecto. Medido en producción: 0 de 36 OV vivas tenían id_local seteado antes de facturar.
  const [editandoDireccion, setEditandoDireccion] = useState(false);
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);

  const canWriteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE);
  const canDeleteSaleOrder = checkScope(ModelType.ORDEN_VENTA, ScopeType.DELETE);

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

  // El progreso viene agrupado por nombre de facturación (el desglose por
  // producto físico va en cada bulto asignado como producto_nombre)
  const progresoRows = useMemo(() => {
    const items = Array.isArray(progresoData?.progreso) ? progresoData.progreso : [];
    return items.map((p) => {
      const requerido = Number(p?.requerido_unidades ?? 0);
      const asignado = Number(p?.asignado_unidades ?? 0);
      const faltante = Number(p?.faltante_unidades ?? Math.max(0, requerido - asignado));
      const exceso = Number(p?.exceso_unidades ?? Math.max(0, asignado - requerido));
      return {
        id: p?.id_nombre_facturacion ?? p?.id_producto,
        id_nombre_facturacion: p?.id_nombre_facturacion,
        producto_nombre:
          p?.nombre || p?.ProductoBase?.nombre || `Línea #${p?.id_nombre_facturacion ?? "—"}`,
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
          key: `${p?.id ?? "p"}-${b?.id_pick ?? b?.id_bulto ?? b?.identificador ?? idx}`,
          producto: p?.producto_nombre || "—",
          producto_fisico: b?.producto_nombre || "—",
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
    if (!(await confirm({ title: "¿Validar orden de venta?", confirmText: "Validar" }))) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/validar`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Validada" } : prev));
      toast.success(res?.data?.message || "Orden validada correctamente");
    } catch (err) {
      toast.error(apiErrorMsg(err, "validar esta orden"));
    } finally {
      setTransitioning(false);
    }
  };

  const handleCompletarPicking = async () => {
    if (!id) return;
    if (!(await confirm({ title: "¿Completar el picking?", message: "Se verificará que todos los productos estén asignados.", confirmText: "Completar" }))) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/completar-picking`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Lista para facturación" } : prev));
      toast.success(res?.data?.message || "Picking completado correctamente");
    } catch (err) {
      toast.error(apiErrorMsg(err, "completar el picking"));
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
      const direcciones = Array.isArray(data?.direcciones) ? data.direcciones : [];
      setDireccionesCliente(direcciones);

      // Precargar: la dirección principal del cliente y la fecha de hoy. Las dos siguen siendo
      // editables — es el punto de partida, no una decisión tomada.
      //
      // Sin esto el formulario abría en blanco y la previsualización no tenía con qué armar el
      // documento: mirar antes de emitir exigía elegir a mano dos datos que casi siempre son
      // los mismos.
      setIdLocalDespacho((actual) => {
        if (actual) return actual;
        const principal = direcciones.find((d) => d.es_principal) ?? direcciones[0];
        return principal ? String(principal.id) : "";
      });
      setFechaFacturacion((actual) => actual || new Date().toLocaleDateString("en-CA"));
    } catch {
      toast.error("No se pudieron cargar las direcciones del cliente");
    } finally {
      setLoadingDirecciones(false);
    }
  };

  // Editor de la dirección de despacho, independiente del modal de Facturar: se abre desde el
  // detalle, en cualquier estado anterior a Entregada. Sólo carga las direcciones —no toca
  // `fechaFacturacion` ni el resto del estado del modal— porque abrir esto para MIRAR no
  // debería precargar en silencio un formulario de facturación que el operario no pidió.
  const abrirEdicionDireccion = async () => {
    setEditandoDireccion(true);
    if (direccionesCliente.length > 0) return;
    setLoadingDirecciones(true);
    try {
      const res = await api(`/clientes/${cliente?.id}`);
      const data = res?.data || res;
      setDireccionesCliente(Array.isArray(data?.direcciones) ? data.direcciones : []);
    } catch {
      toast.error("No se pudieron cargar las direcciones del cliente");
    } finally {
      setLoadingDirecciones(false);
    }
  };

  const guardarDireccionDespacho = async (idNuevo) => {
    setGuardandoDireccion(true);
    try {
      await api(`/ordenes-venta/${id}`, {
        method: "PUT",
        body: JSON.stringify({ id_local: idNuevo ? Number(idNuevo) : null }),
      });
      const o = await fetchOrden();
      setOrden(o);
      setEditandoDireccion(false);
      toast.success(idNuevo ? "Dirección de despacho actualizada" : "Dirección de despacho quitada");
    } catch (err) {
      toast.error(apiErrorMsg(err));
    } finally {
      setGuardandoDireccion(false);
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
          // Siempre se manda, también vacía: vacía significa «al contado, sin vencimiento», y
          // omitirla dejaría la que tuviera guardada la orden de un intento anterior.
          fecha_vencimiento_pago: fechaVencimiento || null,
          ...(idLocalDespacho && { id_local: Number(idLocalDespacho) }),
        }),
      });
      const o = await fetchOrden();
      setOrden(o);
      toast.success(res?.data?.message || res?.message || "Orden facturada correctamente");
      setShowFacturarForm(false);
      setFechaFacturacion("");
      setFechaVencimiento("");
      setIdLocalDespacho("");
      setDireccionesCliente([]);
    } catch (err) {
      toast.error(apiErrorMsg(err, "facturar esta orden"));
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
      toast.error(apiErrorMsg(err, "entregar esta orden"));
    } finally {
      setDelivering(false);
    }
  };

  // 🔴 REHECHO COMPLETO (Cristóbal, 2026-08-17): antes era un resumen genérico de "Orden de
  // Venta"; ahora reproduce, con los datos que YA vive en el sistema, el layout de la Nota de
  // Venta que Artisan usaba antes de este ERP (imagen de referencia adjunta al pedido) —
  // fecha/cliente/dirección a la izquierda, totales y datos bancarios a la derecha, comentario
  // destacado, línea de picking y la tabla con las TRES cantidades (OC/Pickeado/Unidades).
  //
  // ⚠️ "Fecha entrega" usa `fecha_envio` (la fecha real de despacho) como mejor aproximación
  // disponible hoy — la orden todavía no tiene una fecha de entrega PROMETIDA propia (tarea
  // #106, bloqueada en una decisión de negocio pendiente: lead time en días vs día fijo por
  // cliente). Cuando esa tarea aterrice, este campo debe pasar a usarla.
  const handleDescargarPDF = async () => {
    try {
    // jsPDF y su plugin de tablas se cargan al APRETAR el botón, no al abrir la vista.
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

    // Un rótulo de sección + su tabla de pares label/valor, igual en las dos columnas —
    // "ordenar por secciones" en vez de una sola lista larga de 13 filas mezclando pedido,
    // cliente, despacho y contacto sin ningún corte visual.
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

    // ── Columna izquierda: pedido → cliente → despacho, cada una su sección ──
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

    // ── Columna derecha: totales con forma de factura, luego datos de pago ──
    // Mismo criterio que el resumen en pantalla (DetalleTipoFactura.jsx): Neto/IVA alineados
    // a la derecha, una regla, y el Total destacado — no un par label/valor más en la lista.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("TOTALES", colR, 42);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Neto", colR, 50);
    doc.text(formatCLP(totalNeto, 0), pageWidth - marginL, 50, { align: "right" });
    doc.text("IVA (19%)", colR, 56);
    doc.text(formatCLP(iva, 0), pageWidth - marginL, 56, { align: "right" });
    doc.setLineWidth(0.3);
    doc.line(colR, 60, pageWidth - marginL, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total", colR, 67);
    doc.text(formatCLP(total, 0), pageWidth - marginL, 67, { align: "right" });
    doc.setFont("helvetica", "normal");

    const yR = addSection("Datos para pago", [
      ["RUT", COMPANY.rut],
      ["Razón Social", COMPANY.nombre],
      ["Cuenta Corriente", COMPANY.cuenta_corriente],
      ["Banco", COMPANY.banco],
      ["Enviar comprobante", COMPANY.contacto],
    ], colR, widthR, 75);
    const finRight = yR;

    let cursorY = Math.max(finLeft, finRight) + 2;

    // ── Comentario del cliente — destacado, igual que en la referencia ──
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

    // ── Quién pickeó y bultos — lo que la Nota de Venta antigua imprime al pie ──
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

    // ── Tabla de líneas: las TRES cantidades (OC pedida, pickeada, unidades reales) ──
    const tableBody = orderItems.map((it) => {
      const productoNombre =
        it?.NombreFacturacion?.nombre || it?.ProductoBase?.nombre || `Producto #${it?.id_producto ?? "—"}`;
      const cantidadPedida = Number(it?.cantidad || 0);
      const cantidadPickeada = cantidadFacturable(it);
      const precio = Number(it?.precio_venta || 0);
      const descuento = Number(it?.porcentaje_descuento || 0);
      const monto = cantidadPickeada * precio * (1 - descuento / 100);

      // En cajas: "Cant. OC"/"Cant. Pick." se muestran en cajas y "Cant Uni" es el real en
      // unidades — mismo criterio que la tabla del detalle (DetalleTipoFactura.jsx).
      const cajaOC = enCajasPdf ? lineaEnCajas(cantidadPedida, precio, unidadesPorCajaDeLinea(it)) : null;
      const cajaPick = enCajasPdf ? lineaEnCajas(cantidadPickeada, precio, unidadesPorCajaDeLinea(it)) : null;
      const cantOcTexto = cajaOC?.cajas != null ? cajaOC.cajas.toLocaleString("es-CL") : cantidadPedida.toLocaleString("es-CL");
      const cantPickTexto = cajaPick?.cajas != null ? cajaPick.cajas.toLocaleString("es-CL") : cantidadPickeada.toLocaleString("es-CL");

      return [
        productoNombre,
        cantOcTexto,
        cantPickTexto,
        cantidadPedida.toLocaleString("es-CL"),
        descuento > 0 ? `${descuento}%` : "—",
        formatCLP(precio, 0),
        formatCLP(monto, 0),
      ];
    });

    autoTable(doc, {
      startY: cursorY + 2,
      head: [["Producto", "Cant. OC", "Cant. Pick.", "Cant Uni", "% Desc", "P. Neto", "Monto Neto"]],
      body: tableBody,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, halign: "center" },
      columnStyles: {
        1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
      },
    });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Documento generado automáticamente — Artisan",
      pageWidth / 2,
      doc.lastAutoTable.finalY + 8,
      { align: "center" },
    );
    doc.save(`Nota de venta #${orden.id}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Error generando la Nota de Venta");
    }
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
      "Lista para facturación":`${base} bg-cyan-100 text-cyan-700`,
      "Facturada":          `${base} bg-yellow-100 text-yellow-700`,
      "Entregada":          `${base} bg-green-100 text-green-700`,
    };
    return <span className={map[estado] || `${base} bg-gray-100 text-gray-600`}>{estado}</span>;
  };

  // 🔴 Los totales se calculan sobre lo PICKEADO, que es lo que va a salir en la factura.
  // Antes se calculaban sobre lo pedido y por eso «no actualizaba el valor en el front»: la
  // pantalla mostraba el total del pedido y el documento salía con otro número.
  const resumen = useMemo(() => resumenFacturable(orderItems), [orderItems]);

  const costoEnvioActual = Number(orden?.costo_envio || 0);
  const totalNeto = resumen.facturable + costoEnvioActual;
  const netoPedidoConEnvio = resumen.pedido + costoEnvioActual;
  const iva = Math.round(totalNeto * 0.19);
  const total = totalNeto + iva;

  if (loading) return <PageLoader message="Cargando orden" />;

  if (!orden)
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        No se encontró la orden de venta
      </div>
    );

  // ── Acciones ────────────────────────────────────────────────────────────────
  // Una sola acción principal, la que corresponde al estado. Antes estaban repartidas en
  // tres lugares: la cabecera, el interior del panel de facturación (al fondo de la página)
  // y una tarjeta "Acciones" al final del todo.
  const accionPrincipal = (() => {
    const estado = orden?.estado;

    if (estado === "Creada" && canValidar)
      return {
        label: "Validar orden",
        icon: <CheckCircle2 className="w-4 h-4" />,
        onClick: handleValidar,
        disabled: transitioning,
      };

    if (estado === "En picking")
      return {
        label: "Completar picking",
        icon: <PackageCheck className="w-4 h-4" />,
        onClick: handleCompletarPicking,
        disabled: transitioning,
      };

    if (estado === "Lista para facturación")
      return {
        label: "Facturar orden",
        icon: <Receipt className="w-4 h-4" />,
        onClick: () => {
          setIdLocalDespacho(String(orden?.id_local || ""));
          loadDireccionesCliente(cliente?.id);
          // La fecha de pago se propone desde la condición del cliente, y sólo cuando se puede
          // leer con certeza. Lo que ya tenga la orden manda: alguien la escribió a propósito.
          const hoy = new Date().toISOString().slice(0, 10);
          // La precedencia es la MISMA que aplica el backend al emitir: lo guardado en la orden
          // manda, después la condición del documento del cliente, y al final su ficha. Si la
          // pantalla propusiera una y el documento saliera con otra, nadie se entera.
          const { fecha, origen } = origenVencimiento({
            guardadoEnOrden: orden?.fecha_vencimiento_pago,
            condicionOrden: orden?.condiciones,
            condicionCliente: cliente?.condicion_pago,
            fechaEmision: fechaFacturacion || hoy,
          });
          setFechaVencimiento(fecha);
          setOrigenFecha(origen);
          setShowFacturarForm(true);
        },
        disabled: transitioning,
      };

    if (estado === "Facturada")
      return {
        label: "Registrar entrega",
        icon: <Truck className="w-4 h-4" />,
        onClick: () => setShowEntregarForm(true),
        disabled: delivering,
      };

    return null;
  })();

  // Lo que el estado explica pero no permite hacer. Antes ocupaba una tarjeta entera al pie
  // de la página; es información, no una acción, así que va bajo la cabecera.
  const avisoDeEstado = (() => {
    const estado = orden?.estado;

    if (estado === "Creada" && !canValidar)
      return {
        tono: "amber",
        texto: "Sin permisos para validar esta orden. Contacta a un administrador.",
      };

    if (estado === "Validada")
      return {
        tono: "blue",
        texto: orden?.es_referencial
          ? "La orden referencial pasará a En picking cuando el operario inicie la declaración de cantidades desde la app móvil."
          : "La orden pasará a En picking automáticamente al registrar el primer bulto en la asignación.",
      };

    if (estado === "Entregada")
      return { tono: "green", texto: "Orden completada y entregada." };

    return null;
  })();

  const accionesSecundarias = [
    {
      label: "Descargar Nota de Venta",
      icon: <Download className="w-4 h-4" />,
      onClick: handleDescargarPDF,
    },
    {
      label: "Editar",
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => navigate(`/ventas/ordenes/${id}/edit`),
      // El botón anterior (ModifyButton) no miraba el permiso: dejaba entrar a la vista de
      // edición para que el guardado fallara con un 403 después de rellenar el formulario.
      disabled: !canWriteSaleOrder,
      title: canWriteSaleOrder ? undefined : "Sin permiso para editar órdenes de venta",
    },
  ];

  const accionesDestructivas = [
    {
      label: "Eliminar orden",
      icon: <Trash2 className="w-4 h-4" />,
      confirmar: {
        titulo: `¿Eliminar la orden de venta #${orden?.id}?`,
        mensaje:
          "Se elimina la orden y sus líneas. Si ya tiene documentos tributarios emitidos, esos no se anulan.",
        textoBoton: "Sí, eliminar",
      },
      onClick: async () => {
        if (!canDeleteSaleOrder) {
          toast.permissionError([ModelType.ORDEN_VENTA, ScopeType.DELETE]);
          return;
        }
        try {
          await api(`/ordenes-venta/${id}`, { method: "DELETE" });
          toast.success("Orden eliminada");
          navigate("/ventas/ordenes");
        } catch {
          toast.error("No se pudo eliminar la orden");
        }
      },
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  const TONOS_AVISO = {
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    green: "text-green-700 bg-green-50 border-green-200",
  };

  return (
    <div>
      <PageHeader
        volverA="/ventas/ordenes"
        titulo={`Orden de Venta #${orden.id}`}
        estado={
          <>
            {getEstadoBadge(orden?.estado)}
            {orden?.es_referencial && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Referencial
              </span>
            )}
          </>
        }
        acciones={
          <PanelAcciones
            principal={accionPrincipal}
            secundarias={accionesSecundarias}
            destructivas={accionesDestructivas}
          />
        }
      />

      {avisoDeEstado && (
        <p
          className={`text-sm border rounded-md px-3 py-2 mb-6 ${TONOS_AVISO[avisoDeEstado.tono]}`}
        >
          {avisoDeEstado.texto}
        </p>
      )}

      <StepBar estadoActual={orden?.estado} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cliente</div>
          <div className="font-bold text-text mt-1">{cliente?.nombre_empresa || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">RUT: {cliente?.rut || "—"}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Orden de compra
          </div>
          <div className="font-bold text-text mt-1">{orden?.numero_oc || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">
            Emitida: {formatDate(orden?.fecha_orden)}
          </div>
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

      {/* 🔴 FACTURACIÓN FUERA DE LAS PESTAÑAS. Era la 4ª pestaña: dos clics para lo que más se
          consulta y para las dos acciones que definen esta pantalla —«ver cómo saldrá» y
          «facturar»—. Acá está siempre a la vista, y el detalle de la orden queda a un clic
          igual que antes. */}
      <div className="mb-6">
        <PanelFacturacion orden={orden} />
      </div>

      <Tabs
        activa={tab}
        onCambiar={setTab}
        pestanas={[
          // «Resumen» y «Productos» eran dos pestañas que había que cruzar para cuadrar un
          // monto, con los totales repetidos en ambas. Ahora son un solo documento.
          //
          // «Documentos» salió de las pestañas: es lo que más se consulta y vive fijo arriba.
          { id: "detalle", label: "Detalle", cantidad: orderItems.length },
          { id: "asignacion", label: "Asignación", cantidad: progresoRows.length },
        ]}
      />

      {/* Información general */}
      {/* El detalle con forma de documento: receptor, líneas y totales UNA sola vez. */}
      <div className={tab === "detalle" ? "mb-6" : "hidden"}>
        <DetalleTipoFactura
          orden={orden}
          lineas={orderItems}
          direccion={direccion}
          totalNeto={totalNeto}
          iva={iva}
          total={total}
          costoEnvio={costoEnvioActual}
          formatDate={formatDate}
          netoPedido={netoPedidoConEnvio}
          direccionesDespacho={direccionesCliente}
          editandoDireccion={editandoDireccion}
          loadingDirecciones={loadingDirecciones}
          guardandoDireccion={guardandoDireccion}
          puedeEditarDireccion={orden?.estado !== "Entregada"}
          onEmpezarEdicionDireccion={abrirEdicionDireccion}
          onCancelarEdicionDireccion={() => setEditandoDireccion(false)}
          onGuardarDireccion={guardarDireccionDespacho}
          comentarioCliente={orden?.comentario_cliente}
        />
      </div>

      {/* Resumen de asignación */}
      <div className={tab === "asignacion" ? "bg-white rounded-lg shadow p-4 mb-6" : "hidden"}>
        <h2 className="text-base font-semibold text-text mb-3">Resumen de asignación</h2>
        {loadingProgreso ? (
          <div className="text-sm text-gray-500">Cargando asignación...</div>
        ) : progresoRows.length ? (
          <>
            <AvanceItems
              items={progresoRows.map((r) => ({
                id: r.id_producto ?? r.id,
                nombre: r.producto_nombre,
                unidad: "u",
                solicitado: Number(r.requerido_unidades) || 0,
                completado: Number(r.asignado_unidades) || 0,
              }))}
              labels={{
                solicitado: "Solicitado",
                completado: "Pickeado",
                pendiente: "Falta por pickear",
                itemNoun: "productos",
              }}
            />

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
                        <th className="border border-gray-300 px-4 py-2 text-left">Producto físico</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Bulto</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Pallet</th>
                        <th className="border border-gray-300 px-4 py-2 text-right">Unidades pickeadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasExtraccion.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2 whitespace-normal break-words">{row.producto}</td>
                          <td className="border border-gray-300 px-4 py-2 whitespace-normal break-words text-gray-600">{row.producto_fisico}</td>
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


      <Modal
        abierto={showFacturarForm}
        onCerrar={() => {
          setShowFacturarForm(false);
          setIdLocalDespacho("");
          setDireccionesCliente([]);
        }}
        // Ancho: el modal muestra el documento completo —receptor, líneas y totales— y en la
        // caja estrecha por defecto cada línea se partía en varios renglones, así que el
        // detalle salía larguísimo y costaba dimensionar lo que se iba a emitir.
        ancho="max-w-4xl"
        titulo="Facturar orden"
        descripcion="Confirma la dirección y la fecha antes de emitir el documento."
        pie={
          <>
            <button
              onClick={() => {
                setShowFacturarForm(false);
                setIdLocalDespacho("");
                setFechaVencimiento("");
                setDireccionesCliente([]);
              }}
              className={btnCls("ghost")}
            >
              Cancelar
            </button>
            <button onClick={handleFacturar} disabled={transitioning} className={btnCls("primary")}>
              {transitioning ? "Emitiendo factura…" : "Emitir Factura Electrónica"}
            </button>
          </>
        }
      >
        <FacturarForm
          ordenId={orden?.id}
          numeroOc={orden?.numero_oc}
          condicionPago={orden?.condiciones}
          condicionCliente={cliente?.condicion_pago}
          direccionesCliente={direccionesCliente}
          idLocalDespacho={idLocalDespacho}
          setIdLocalDespacho={setIdLocalDespacho}
          loadingDirecciones={loadingDirecciones}
          fechaFacturacion={fechaFacturacion}
          setFechaFacturacion={setFechaFacturacion}
          fechaVencimiento={fechaVencimiento}
          setFechaVencimiento={setFechaVencimiento}
          origenFecha={origenFecha}
          setOrigenFecha={setOrigenFecha}
          requiereDir={!orden?.id_local}
          resumenPicking={resumen}
        />
      </Modal>

      <Modal
        abierto={showEntregarForm}
        onCerrar={() => setShowEntregarForm(false)}
        titulo="Registrar entrega"
        descripcion="Con esto la orden queda cerrada."
        pie={
          <>
            <button onClick={() => setShowEntregarForm(false)} className={btnCls("ghost")}>
              Cancelar
            </button>
            <button onClick={handleEntregar} disabled={delivering} className={btnCls("primary")}>
              {delivering ? "Registrando…" : "Confirmar entrega"}
            </button>
          </>
        }
      >
        <EntregarForm
          costoEnvio={costoEnvio}
          setCostoEnvio={setCostoEnvio}
          fechaEnvio={fechaEnvio}
          setFechaEnvio={setFechaEnvio}
        />
      </Modal>
    </div>
  );
}
