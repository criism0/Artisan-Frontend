import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  Download,
  PackageCheck,
  Pencil,
  Receipt,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import PageHeader from "../../components/UI/PageHeader.jsx";
import PanelAcciones from "../../components/UI/PanelAcciones.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import Modal from "../../components/UI/Modal.jsx";
import Aviso from "../../components/UI/Aviso.jsx";
import Ayuda from "../../components/UI/Ayuda.jsx";
import EstadoOVBadge from "../../components/Ventas/EstadoOVBadge.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP } from "../../services/formatHelpers";
// jspdf y jspdf-autotable se cargan bajo demanda DENTRO de generarNotaVentaPDF, no acá.
import { generarNotaVentaPDF } from "../../services/notaVentaPdf.js";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import CentroDocumentos from "../../components/DTE/CentroDocumentos.jsx";
import EntregasDeOrden from "../../components/Entregas/EntregasDeOrden";
import DespachoOrden from "../../components/Entregas/DespachoOrden";
import DTEPreview from "../../components/DTE/DTEPreview.jsx";
import EstadoPosteriorBadge from "../../components/Ventas/EstadoPosteriorBadge.jsx";
import DetalleTipoFactura from "../../components/Ventas/DetalleTipoFactura.jsx";
import InformacionOrdenCliente from "../../components/Ventas/InformacionOrdenCliente.jsx";
import Selector from "../../components/Forms/Selector";
import AvanceItems from "../../components/AvanceItems";
import { useConfirm } from "../../components/Modals/ConfirmProvider.jsx";
import { mensajeError } from "../../utils/mensajeError.js";
import { derivarFolioOC, esVentaAPlazo, origenVencimiento } from "../../utils/referenciaOC.js";
import { resumenFacturable } from "../../utils/cantidadFacturable.js";
import { puedeEditarLineasOV } from "../../utils/ordenVentaEditable.js";
import { puedeCancelarOV, puedeReabrirCancelacion } from "../../utils/ordenVentaCancelable.js";
import { resumenSaldo, puedeCerrarSaldo, ESTADO_FACTURADA_PARCIAL } from "../../utils/saldoFacturacion.js";
import { copiarComoDespacho } from "../../services/ubicacionService";
import { formatFecha, getTodayDate } from "../../lib/dateUtils";

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

// Cómo avanza una orden. Antes cada estado lo explicaba en un recuadro azul bajo el título;
// ahora vive en el «(?)» y en pantalla quedan sólo los avisos que piden hacer algo.
const AYUDA_FLUJO_OV = (
  <ul className="list-disc ml-4 space-y-1">
    <li><strong>Creada → Validada</strong> con «Validar orden».</li>
    <li>
      <strong>Validada → En picking</strong> al registrar el primer bulto. Si la orden es
      referencial, cuando bodega empieza a declarar cantidades en la app (sin escanear bultos).
    </li>
    <li><strong>En picking → Lista para facturación</strong> con «Completar picking».</li>
    <li><strong>Lista para facturación → Facturada</strong> con «Facturar orden», que emite la factura electrónica.</li>
    <li>
      <strong>Facturada → Entregada</strong> cuando el chofer registra la entrega en su ruta
      (Logística → Entregas).
    </li>
    <li>Si se factura menos que lo pedido queda <strong>Facturada parcial</strong> hasta despachar o cerrar el saldo.</li>
  </ul>
);

/**
 * Barra de progreso de la orden.
 *
 * Estaba definida DENTRO de OrdenVentaDetail (`const StepBar = () => …`). React ve una
 * función nueva en cada render, así que la trataba como un componente distinto y desmontaba
 * y volvía a montar toda la barra cada vez que cambiaba cualquier estado de la vista.
 */
function StepBar({ estadoActual }) {
  // Una orden facturada a medias ya pasó por la facturación: en la barra se ve en ese paso. Lo
  // que falta lo dice el aviso de estado, no un paso más.
  const paso = estadoActual === ESTADO_FACTURADA_PARCIAL ? "Facturada" : estadoActual;
  const actual = PASOS_OV.indexOf(paso ?? "");

  // Sin tarjeta propia: es parte de la cabecera (dónde va la orden), no una sección más.
  return (
    <div className="mb-6 -mt-2">
      {/* Arriba y no centrado: «Lista para facturación» ocupa dos líneas y, centrado, su punto
          quedaba más alto que los demás. */}
      <div className="flex items-start justify-between">
        {PASOS_OV.map((paso, idx) => {
          const hecho = idx < actual;
          const activo = idx === actual;
          return (
            <div key={paso} className="flex items-start flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${hecho ? "bg-primary text-white" : activo ? "bg-primary text-white ring-2 ring-primary/30 ring-offset-1" : "bg-gray-200 text-gray-500"}`}
                >
                  {hecho ? "✓" : idx + 1}
                </div>
                <span
                  className={`mt-1 text-[11px] text-center leading-tight ${activo ? "font-semibold text-primary" : hecho ? "text-gray-500" : "text-gray-400"}`}
                >
                  {paso}
                </span>
              </div>
              {idx < PASOS_OV.length - 1 && (
                <div className={`h-px flex-1 mx-1 mt-2.5 ${idx < actual ? "bg-primary" : "bg-gray-200"}`} />
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
  saldo = null,
  dejarSaldoPendiente = true,
  setDejarSaldoPendiente = () => {},
  motivoCierreSaldo = "",
  setMotivoCierreSaldo = () => {},
  tieneDireccionFacturacion = false,
  onCopiarComoDespacho = null,
  copiandoDespacho = false,
}) {
  // 🔴 Este selector escribe `id_local`, que es la dirección de DESPACHO (a dónde va el
  // camión). Se llamaba «Dirección de facturación» y ofrecía todas las direcciones del cliente,
  // así que se elegía —con razón— la de facturación: medido el 2026-09-30, 148 de 240 OV de 30
  // días quedaron despachadas «a» una dirección de Facturación, y en 104 el cliente sí tenía
  // una de Despacho. El receptor de la factura sale de `id_local_facturacion` (que la orden ya
  // trae desde que se crea) y sólo si falta, de ésta. Rutas de entrega, Fase 0.
  const direccionesDespacho = direccionesCliente.filter((d) => d.tipo_direccion === "Despacho");
  const direccionesACopiar = direccionesCliente.filter((d) => d.tipo_direccion === "Facturación");

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
      {/* Facturación parcial (2026-09-16): si la orden ya tiene factura, ésta lleva SÓLO lo
          pickeado desde entonces. Se dice antes que nada, porque el total de la orden no es el
          de este documento. */}
      {saldo?.hayFacturaPrevia && (
        <Aviso tono="neutro" tamano="xs">
          Ya se facturaron {formatCLP(saldo.netoFacturado, 0)} neto. Esta factura lleva lo pickeado
          desde entonces: <strong>{formatCLP(saldo.netoPorFacturar, 0)} neto</strong>.
        </Aviso>
      )}

      {saldo?.quedaSaldoTras && (
        <Aviso
          tamano="xs"
          ayuda="Con el saldo pendiente la orden queda en Facturada parcial y bodega pickea lo que falta desde la app; después se emite otra factura. Si no se deja pendiente, la orden queda Facturada y lo no despachado sigue visible con su motivo."
          tituloAyuda="Saldo de la orden"
        >
          <div className="flex flex-col gap-1.5">
            <span>
              <strong>Esta factura no cubre todo el pedido.</strong> Falta:{" "}
              {saldo.lineasConSaldo
                .map((l) => `${l.nombre} (${l.saldo_tras.toLocaleString("es-CL")} de ${l.pedida.toLocaleString("es-CL")})`)
                .join(" · ")}
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dejarSaldoPendiente}
                onChange={(e) => setDejarSaldoPendiente(e.target.checked)}
              />
              <span>Dejar el saldo pendiente para una próxima factura</span>
            </label>
            {!dejarSaldoPendiente && (
              <input
                type="text"
                value={motivoCierreSaldo}
                onChange={(e) => setMotivoCierreSaldo(e.target.value)}
                placeholder="¿Por qué no se despacha el resto? Ej.: quiebre de stock"
                aria-label="Motivo para no despachar el resto"
                className="px-2 py-1 border border-amber-300 rounded-md bg-white text-gray-800"
              />
            )}
          </div>
        </Aviso>
      )}

      {resumenPicking?.difieren && !saldo?.hayFacturaPrevia && (
        <Aviso
          tamano="xs"
          ayuda="La factura declara lo que bodega pickeó, que es lo que viaja. Si la diferencia no corresponde, corrige el picking antes de emitir: una factura emitida sólo se corrige con nota de crédito."
          tituloAyuda="Se factura lo pickeado"
        >
          <strong>Se factura lo pickeado:</strong>{" "}
          {resumenPicking.diferencias
            .map((d) => `${d.nombre} (pidió ${d.pedida.toLocaleString("es-CL")}, se pickeó ${d.pickeada.toLocaleString("es-CL")})`)
            .join(" · ")}
          . Neto {formatCLP(resumenPicking.pedido, 0)} → <strong>{formatCLP(resumenPicking.facturable, 0)}</strong>.
        </Aviso>
      )}

      {/* Lo que va a decir el documento, con la MISMA vista que la pestaña Documentos.
          Antes este modal pedía dirección y fecha sin mostrar nada de lo que se iba a emitir:
          se confirmaba a ciegas un documento que después sólo se corrige con nota de crédito. */}
      {/* La dirección y las fechas elegidas acá todavía no están en la orden: se guardan recién
          al emitir. Hay que pasárselas al preview o arma el documento sin ellas. */}
      {/* El receptor del preview tiene que ser el mismo que el de la emisión: la dirección de
          facturación de la orden si la tiene, y sólo si no, la de despacho elegida acá. Antes se
          pasaba siempre la elegida, así que el preview podía mostrar un receptor distinto del
          que salía emitido. */}
      <DTEPreview
        ordenId={ordenId}
        tipo="factura"
        idLocal={tieneDireccionFacturacion ? null : idLocalDespacho || null}
        fecha={fechaFacturacion || null}
        vencimiento={fechaVencimiento || null}
      />

      {/* 🔴 La orden de compra. Sin ella el retail rechaza la factura porque no puede casarla
          con su pedido. Va de sólo lectura: sale del `numero_oc` de la orden. */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          Orden de compra del cliente
          <Ayuda titulo="Orden de compra">
            Sale impresa en la factura como «Orden de compra N° …»: sin ella el retail rechaza la
            factura porque no la puede casar con su pedido. Es el N° OC de la orden; si está mal,
            se corrige en la orden.
          </Ayuda>
        </span>
        {folioOC ? (
          <>
            <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-800 font-medium">
              {folioOC}
            </div>
            {recortado && (
              <Aviso tamano="xs">
                En el documento sólo cabe el número (la orden dice «{numeroOc}»). Si{" "}
                <strong>{folioOC}</strong> no es el que usa el cliente, corrígelo en la orden.
              </Aviso>
            )}
          </>
        ) : (
          <Aviso tamano="xs">
            {motivoOC} <strong>La factura saldrá sin orden de compra</strong> y el retail suele
            rechazarla.
          </Aviso>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          Dirección de despacho {requiereDir && <span className="text-red-500">*</span>}
          <Ayuda titulo="Dirección de despacho">
            A dónde llega el pedido: es la que usa la ruta de entrega. La factura sale a nombre de
            la dirección de facturación de la orden, y sólo si la orden no tiene una, de ésta.
          </Ayuda>
        </span>
        {loadingDirecciones ? (
          <span className="text-sm text-gray-400 py-2">Cargando direcciones...</span>
        ) : direccionesDespacho.length === 0 ? (
          <Aviso tamano="xs">
            <div className="flex flex-col gap-1.5">
              <span>
                El cliente no tiene dirección de <strong>despacho</strong>: sin ella la entrega no se
                puede rutear. Si recibe en otro lugar, agrégalo en la ficha del cliente.
              </span>
              {onCopiarComoDespacho && direccionesACopiar.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onCopiarComoDespacho(d.id)}
                  disabled={copiandoDespacho}
                  className="self-start px-2 py-1 rounded-md border border-amber-400 bg-white hover:bg-amber-100 disabled:opacity-50"
                >
                  Recibe en su dirección de facturación ({[d.calle, d.numero, d.comuna].filter(Boolean).join(" ")}): usarla como despacho
                </button>
              ))}
            </div>
          </Aviso>
        ) : (
          <Selector
            options={direccionesDespacho.map((d) => ({
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
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          Fecha de pago
          <Ayuda titulo="Fecha de pago">
            Sale en la factura como vencimiento y pago programado. Se propone desde lo guardado en
            la orden, después la condición del documento del cliente y al final su ficha. Sin fecha,
            la factura sale al contado.
          </Ayuda>
        </span>
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
            {origenFecha === "orden" && "Guardada en esta orden."}
            {origenFecha === "condicion_orden" &&
              `Desde el documento del cliente${condicionPago ? ` (${condicionPago})` : ""}.`}
            {origenFecha === "condicion_cliente" &&
              `Desde la ficha del cliente${condicionCliente ? ` (${condicionCliente})` : ""}.`}
            {origenFecha === "manual" && "Escrita a mano."}
          </span>
        ) : esAPlazo ? (
          // Vacío no siempre significa contado: si es a plazo, la factura sin vencimiento es un
          // dato que falta, no una decisión. No bloquea, pero tiene que verse antes de emitir.
          <Aviso tamano="xs">
            Es una venta <strong>a plazo</strong>
            {glosaFecha ? ` (${glosaFecha})` : ""} sin fecha de pago: la factura saldrá sin
            vencimiento.
          </Aviso>
        ) : null}
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
  const [transitioning, setTransitioning] = useState(false);
  const [showFacturarForm, setShowFacturarForm] = useState(false);
  // Facturación parcial: qué hacer con lo que la factura no cubre, y el cierre posterior.
  const [dejarSaldoPendiente, setDejarSaldoPendiente] = useState(true);
  const [motivoCierreSaldo, setMotivoCierreSaldo] = useState("");
  const [showCerrarSaldo, setShowCerrarSaldo] = useState(false);
  const [motivoCerrarSaldo, setMotivoCerrarSaldo] = useState("");
  const [tab, setTab] = useState("detalle");
  const [fechaFacturacion, setFechaFacturacion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [origenFecha, setOrigenFecha] = useState("contado");
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
  // Dirección de FACTURACIÓN — separada de la de despacho de arriba (pedido de Cristóbal,
  // 2026-08-19). Reutiliza `direccionesCliente`: es la misma lista del cliente, filtrada por
  // tipo dentro de DetalleTipoFactura.
  const [editandoFechaEntrega, setEditandoFechaEntrega] = useState(false);
  const [guardandoFechaEntrega, setGuardandoFechaEntrega] = useState(false);
  const [editandoDireccionFacturacion, setEditandoDireccionFacturacion] = useState(false);
  const [guardandoDireccionFacturacion, setGuardandoDireccionFacturacion] = useState(false);

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
  const direccionFacturacion = orden?.direccionFacturacion || null;
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

  // Reabrir vs anular (tarea #121, pedido de Cristóbal 2026-08-20): la primera sólo cambia el
  // estado y CONSERVA lo pickeado, para seguir agregando bultos desde el móvil o la web; la
  // segunda desmonta todo — libera los bultos asignados y borra las cantidades declaradas.
  const handleReabrirPicking = async () => {
    if (!id) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/volver-a-pendiente`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      // Vuelve a En picking, no a Validada — reabrir es seguir pickeando, no volver al
      // principio (corregido 2026-08-21, pedido de Cristóbal).
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "En picking" } : prev));
      toast.success(res?.data?.message || "Orden reabierta: vuelve a En picking");
    } catch (err) {
      toast.error(apiErrorMsg(err, "reabrir la orden"));
    } finally {
      setTransitioning(false);
    }
  };

  const handleAnularPicking = async () => {
    if (!id) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/anular-picking`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Validada" } : prev));
      toast.success(res?.data?.message || "Picking anulado: la orden vuelve a Validada");
    } catch (err) {
      toast.error(apiErrorMsg(err, "anular el picking"));
    } finally {
      setTransitioning(false);
    }
  };

  // Cancelar/reabrir (pedido de Hernán por correo, reenviado por Cristóbal 2026-09-09): sólo
  // se ofrece mientras nada está comprometido con bodega — misma frontera que
  // `puedeEditarLineasOV` — y es reversible mientras nadie haya vuelto a tocar la orden.
  const handleCancelar = async () => {
    if (!id) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/cancelar`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      else setOrden((prev) => (prev ? { ...prev, estado: "Cancelada" } : prev));
      toast.success(res?.data?.message || "Pedido cancelado");
    } catch (err) {
      toast.error(apiErrorMsg(err, "cancelar este pedido"));
    } finally {
      setTransitioning(false);
    }
  };

  const handleCerrarSaldo = async () => {
    if (!id) return;
    if (motivoCerrarSaldo.trim().length < 3) {
      toast.error("Indica por qué se cierra el saldo");
      return;
    }
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/cerrar-saldo`, {
        method: "PUT",
        body: JSON.stringify({ motivo: motivoCerrarSaldo.trim() }),
      });
      setOrden(await fetchOrden());
      toast.success(res?.data?.message || res?.message || "Saldo cerrado");
      setShowCerrarSaldo(false);
      setMotivoCerrarSaldo("");
    } catch (err) {
      toast.error(apiErrorMsg(err, "cerrar el saldo"));
    } finally {
      setTransitioning(false);
    }
  };

  const handleReabrirCancelacion = async () => {
    if (!id) return;
    try {
      setTransitioning(true);
      const res = await api(`/ordenes-venta/${id}/reabrir-cancelacion`, { method: "PUT" });
      const updated = res?.data?.orden || res?.orden;
      if (updated) setOrden((prev) => ({ ...(prev || {}), ...updated }));
      toast.success(res?.data?.message || "Pedido reabierto");
    } catch (err) {
      toast.error(apiErrorMsg(err, "reabrir este pedido"));
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
      // Sólo direcciones de DESPACHO: una de facturación precargada acá es justo el error que
      // dejó 148 de 240 OV despachadas a la dirección equivocada.
      setIdLocalDespacho((actual) => {
        const despacho = direcciones.filter((d) => d.tipo_direccion === "Despacho");
        if (actual && despacho.some((d) => String(d.id) === String(actual))) return actual;
        const principal = despacho.find((d) => d.es_principal) ?? despacho[0];
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

  // El cliente recibe donde factura: se copia esa dirección como de Despacho y queda elegida.
  const [copiandoDespacho, setCopiandoDespacho] = useState(false);
  const copiarDireccionComoDespacho = async (idDireccion) => {
    setCopiandoDespacho(true);
    try {
      const nueva = await copiarComoDespacho(idDireccion);
      setDireccionesCliente((prev) => (prev.some((d) => d.id === nueva.id) ? prev : [...prev, nueva]));
      setIdLocalDespacho(String(nueva.id));
      toast.success("Dirección copiada como de despacho");
    } catch (err) {
      toast.error(apiErrorMsg(err));
    } finally {
      setCopiandoDespacho(false);
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

  // Mismo campo que edita el formulario de la orden, editable también desde acá porque es el
  // dato que más se corrige después de creada la orden. `null` es explícito: significa «no hay
  // entrega comprometida», que es distinto de no haber mandado el campo.
  const guardarFechaEntrega = async (valor) => {
    setGuardandoFechaEntrega(true);
    try {
      await api(`/ordenes-venta/${id}`, {
        method: "PUT",
        body: JSON.stringify({ fecha_entrega: valor || null }),
      });
      const o = await fetchOrden();
      setOrden(o);
      setEditandoFechaEntrega(false);
      toast.success(valor ? "Fecha de entrega actualizada" : "Fecha de entrega quitada");
    } catch (err) {
      toast.error(apiErrorMsg(err));
    } finally {
      setGuardandoFechaEntrega(false);
    }
  };

  // Mismo patrón que la de despacho, pero con `id_local_facturacion`. Reutiliza la carga de
  // `direccionesCliente` — es la misma lista del cliente.
  const abrirEdicionDireccionFacturacion = async () => {
    setEditandoDireccionFacturacion(true);
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

  const guardarDireccionFacturacion = async (idNuevo) => {
    setGuardandoDireccionFacturacion(true);
    try {
      await api(`/ordenes-venta/${id}`, {
        method: "PUT",
        body: JSON.stringify({ id_local_facturacion: idNuevo ? Number(idNuevo) : null }),
      });
      const o = await fetchOrden();
      setOrden(o);
      setEditandoDireccionFacturacion(false);
      toast.success(idNuevo ? "Dirección de facturación actualizada" : "Dirección de facturación quitada — se usará la de despacho");
    } catch (err) {
      toast.error(apiErrorMsg(err));
    } finally {
      setGuardandoDireccionFacturacion(false);
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
          dejar_saldo_pendiente: dejarSaldoPendiente,
          ...(!dejarSaldoPendiente && motivoCierreSaldo.trim() && { motivo_cierre_saldo: motivoCierreSaldo.trim() }),
        }),
      });
      const o = await fetchOrden();
      setOrden(o);
      toast.success(res?.data?.message || res?.message || "Orden facturada correctamente");
      setShowFacturarForm(false);
      setDejarSaldoPendiente(true);
      setMotivoCierreSaldo("");
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
      // Ya está todo cargado en memoria (orden + progresoData): se pasa directo, sin volver a
      // consultar. La lista de OV, que no lo tiene cargado, usa el mismo generador pasando `api`.
      await generarNotaVentaPDF({ orden, progresoData });
    } catch (err) {
      console.error("PDF error:", err);
      toast.error("Error generando la Nota de Venta");
    }
  };

  // ── Helpers de presentación ─────────────────────────────────────────────────
  const formatDate = (value) => formatFecha(value);

  const fmtInt = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return "0";
    return new Intl.NumberFormat("es-CL").format(Math.trunc(n));
  };

  // Facturación parcial: qué cubren las facturas vigentes y qué va en la próxima.
  const saldo = useMemo(() => resumenSaldo(orderItems), [orderItems]);

  // 🔴 Los totales se calculan sobre lo PICKEADO, que es lo que va a salir en la factura.
  // Antes se calculaban sobre lo pedido y por eso «no actualizaba el valor en el front»: la
  // pantalla mostraba el total del pedido y el documento salía con otro número.
  const resumen = useMemo(() => resumenFacturable(orderItems), [orderItems]);

  // `costo_envio` es un costo INTERNO (lo que costó llevarla, repartido de sus rutas cerradas):
  // no se le cobra al cliente, así que no suma al neto (plan de rutas §7.5).
  const costoEnvioActual = Number(orden?.costo_envio || 0);
  const totalNeto = resumen.facturable;
  const netoPedidoConEnvio = resumen.pedido;
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
          // Hoy en Chile: `toISOString()` da el día UTC, que después de las 21:00 ya es mañana.
          const hoy = getTodayDate();
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

    return null;
  })();

  // Lo que el estado obliga a saber AHORA. Lo que sólo explica cómo avanza la orden («pasa a
  // En picking al registrar el primer bulto», «pasa a Entregada cuando el chofer…») ya no va en
  // un recuadro: está en el «(?)» del título (`AYUDA_FLUJO_OV`).
  const avisoDeEstado = (() => {
    const estado = orden?.estado;

    if (estado === "Creada" && !canValidar)
      return { tono: "neutro", texto: "No tienes permiso para validar esta orden." };

    if (estado === ESTADO_FACTURADA_PARCIAL) {
      const n = orden?.saldo_facturacion?.facturas_vigentes ?? 0;
      const facturas = `${n} factura${n === 1 ? "" : "s"}`;
      return orden?.saldo_facturacion?.hay_por_facturar
        ? {
            tono: "atencion",
            texto: `Facturada en parte (${facturas}) y con saldo pickeado sin facturar.`,
            ayuda: "Desde la app, marca la orden lista para facturación para emitir la siguiente factura.",
          }
        : {
            tono: "atencion",
            texto: `Facturada en parte (${facturas}): queda saldo por despachar.`,
            ayuda: "Bodega pickea el saldo desde la app y la orden vuelve a Lista para facturación. Si el cliente ya no lo quiere, usa «Cerrar saldo».",
          };
    }

    if (estado === "Facturada" && orden?.saldo_cerrado_en) {
      return {
        tono: "neutro",
        texto:
          `Saldo cerrado el ${formatDate(orden.saldo_cerrado_en)}${orden?.saldoCerradoPor?.nombre ? ` por ${orden.saldoCerradoPor.nombre}` : ""}.` +
          (orden?.motivo_cierre_saldo ? ` Motivo: ${orden.motivo_cierre_saldo}` : ""),
      };
    }

    if (estado === "Cancelada") {
      const cuando = orden?.cancelado_en ? formatDate(orden.cancelado_en) : null;
      const quien = orden?.canceladoPor?.nombre;
      return {
        tono: "neutro",
        texto:
          `Cancelada${cuando ? ` el ${cuando}` : ""}${quien ? ` por ${quien}` : ""}.` +
          (orden?.motivo_cancelacion ? ` Motivo: ${orden.motivo_cancelacion}` : ""),
        ayuda: `«Reabrir pedido» la devuelve a ${orden?.estado_previo_cancelacion || "su estado anterior"}, tal como estaba.`,
      };
    }

    return null;
  })();

  // Reabrir/anular picking (tarea #121): sólo tienen sentido en Lista para facturación — antes
  // de eso no hay picking que deshacer, y después (Facturada) ya generó el documento tributario.
  // Es el fallback web del mismo par de botones del móvil, con el mismo texto de confirmación.
  const accionesSecundarias = [
    {
      label: "Descargar Nota de Venta",
      icon: <Download className="w-4 h-4" />,
      onClick: handleDescargarPDF,
    },
    // Sólo mientras el contenido de la orden todavía se puede tocar (hasta que empieza el
    // picking, pedido de Hernán 2026-09-07) — ofrecerlo después llevaría a un formulario que el
    // backend rechaza con 409 al guardar. Ver utils/ordenVentaEditable.js.
    puedeEditarLineasOV(orden?.estado) && {
      label: "Editar",
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => navigate(`/ventas/ordenes/${id}/edit`),
      // El botón anterior (ModifyButton) no miraba el permiso: dejaba entrar a la vista de
      // edición para que el guardado fallara con un 403 después de rellenar el formulario.
      disabled: !canWriteSaleOrder,
      title: canWriteSaleOrder ? undefined : "Sin permiso para editar órdenes de venta",
    },
    orden?.estado === "Lista para facturación" && {
      label: "Reabrir picking",
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: handleReabrirPicking,
      disabled: transitioning,
      confirmar: {
        titulo: "¿Reabrir el picking de esta orden?",
        mensaje:
          "La orden vuelve a En picking para seguir agregando bultos. Lo ya pickeado NO se toca — se conserva tal cual.",
        textoBoton: "Reabrir",
      },
    },
    puedeCerrarSaldo(orden) && {
      label: "Cerrar saldo",
      icon: <Ban className="w-4 h-4" />,
      onClick: () => setShowCerrarSaldo(true),
      disabled: transitioning || !canWriteSaleOrder,
      title: canWriteSaleOrder ? undefined : "Sin permiso para editar órdenes de venta",
    },
    puedeReabrirCancelacion(orden?.estado) && {
      label: "Reabrir pedido",
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: handleReabrirCancelacion,
      disabled: transitioning || !canWriteSaleOrder,
      title: canWriteSaleOrder ? undefined : "Sin permiso para editar órdenes de venta",
      confirmar: {
        titulo: "¿Reabrir este pedido?",
        mensaje: `Vuelve a ${orden?.estado_previo_cancelacion || "su estado anterior"}, tal como estaba antes de cancelarse.`,
        textoBoton: "Reabrir",
      },
    },
  ];

  const accionesDestructivas = [
    // Ampliado 2026-09-11 a "En picking": antes sólo se ofrecía desde Lista para facturación y
    // no había forma de abortar un picking a MITAD de camino (completar-picking exige tener
    // todo asignado). El backend ahora acepta anular desde cualquiera de los dos.
    ["En picking", "Lista para facturación"].includes(orden?.estado) && {
      label: "Anular picking",
      icon: <Undo2 className="w-4 h-4" />,
      onClick: handleAnularPicking,
      disabled: transitioning,
      confirmar: {
        titulo: "¿Anular TODO el picking de esta orden?",
        mensaje:
          "Se desmonta todo: los bultos ya asignados vuelven a estar disponibles y las cantidades declaradas se borran. La orden queda como si nunca se hubiera pickeado. Esta acción no se puede deshacer.",
        textoBoton: "Sí, anular todo",
      },
    },
    puedeCancelarOV(orden?.estado) && {
      label: "Cancelar pedido",
      icon: <Ban className="w-4 h-4" />,
      onClick: handleCancelar,
      disabled: transitioning || !canWriteSaleOrder,
      title: canWriteSaleOrder ? undefined : "Sin permiso para editar órdenes de venta",
      confirmar: {
        titulo: `¿Cancelar el pedido #${orden?.id}?`,
        mensaje:
          "El pedido queda marcado como Cancelado y sale del flujo normal (no se puede seguir editando, validando ni pickeando). Se puede reabrir después con «Reabrir pedido», mientras nadie haya vuelto a tocarlo.",
        textoBoton: "Sí, cancelar",
      },
    },
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
        } catch (err) {
          // 🔴 EL `catch` NO LLEVABA PARÁMETRO Y SE COMÍA EL MOTIVO.
          //
          // El 2026-08-27 un usuario con rol Administrador no podía eliminar una OV: el backend
          // respondía 403 «Acceso denegado: faltan permisos de Delete en OrdenVenta» y la
          // pantalla decía sólo «No se pudo eliminar la orden». Reintentó cuatro veces sobre la
          // misma orden —está en el access.log— y hubo que ir a la base para saber que era un
          // permiso. El servidor sabe POR QUÉ falló; esconderlo convierte un permiso que falta
          // en un misterio.
          //
          // ⚠️ La guarda de arriba (`canDeleteSaleOrder`) no alcanza: mira los scopes que trae
          // la sesión, y el 403 vino igual. Cuando las dos discrepan, el que manda es el backend.
          const motivo = err?.message || err?.data?.error || "";
          toast.error(
            motivo ? `No se pudo eliminar la orden: ${motivo}` : "No se pudo eliminar la orden",
          );
        }
      },
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  // El total va en la cabecera, junto al cliente: es lo que se mira de un vistazo. Antes era una
  // tarjeta suelta a la derecha con media pantalla vacía al lado, y el desglose se repetía abajo.
  const nombreCliente = cliente?.razon_social || cliente?.nombre_empresa;

  return (
    <div>
      <PageHeader
        volverA="/ventas/ordenes"
        titulo={`Orden de Venta #${orden.id}`}
        ayuda={AYUDA_FLUJO_OV}
        tituloAyuda="Cómo avanza una orden"
        subtitulo={
          <>
            {nombreCliente && <span className="text-gray-700">{nombreCliente}</span>}
            {nombreCliente && " · "}
            <span className="font-semibold text-text">{formatCLP(total, 0)}</span> con IVA
          </>
        }
        estado={
          <>
            <EstadoOVBadge estado={orden?.estado} size="md" />
            {orden?.es_referencial && (
              <span
                className="px-2 py-0.5 rounded-full text-xs border border-gray-300 text-gray-600"
                title="Se pickea declarando cantidades en la app, sin escanear bultos"
              >
                Referencial
              </span>
            )}
            <EstadoPosteriorBadge info={orden?.estado_dte_posterior} size="md" />
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
        <Aviso
          tono={avisoDeEstado.tono}
          ayuda={avisoDeEstado.ayuda}
          className={avisoDeEstado.tono === "neutro" ? "mb-4 -mt-3" : "mb-6"}
        >
          {avisoDeEstado.texto}
        </Aviso>
      )}

      {/* Un pedido cancelado salió del flujo — pintar la barra de pasos ahí sugeriría que sigue
          avanzando por alguno de ellos. El aviso de arriba ya dice todo lo que hace falta. */}
      {orden?.estado !== "Cancelada" && <StepBar estadoActual={orden?.estado} />}

      <InformacionOrdenCliente
        orden={orden}
        cliente={cliente}
        bodega={bodega}
        formatDate={formatDate}
        direccion={direccion}
        direccionesDespacho={direccionesCliente}
        editandoDireccion={editandoDireccion}
        loadingDirecciones={loadingDirecciones}
        guardandoDireccion={guardandoDireccion}
        puedeEditarDireccion={orden?.estado !== "Entregada"}
        onEmpezarEdicionDireccion={abrirEdicionDireccion}
        onCancelarEdicionDireccion={() => setEditandoDireccion(false)}
        onGuardarDireccion={guardarDireccionDespacho}
        direccionFacturacion={direccionFacturacion}
        direccionesFacturacion={direccionesCliente}
        editandoDireccionFacturacion={editandoDireccionFacturacion}
        guardandoDireccionFacturacion={guardandoDireccionFacturacion}
        puedeEditarDireccionFacturacion={orden?.estado !== "Entregada"}
        onEmpezarEdicionDireccionFacturacion={abrirEdicionDireccionFacturacion}
        onCancelarEdicionDireccionFacturacion={() => setEditandoDireccionFacturacion(false)}
        onGuardarDireccionFacturacion={guardarDireccionFacturacion}
        comentarioCliente={orden?.comentario_cliente}
        editandoFechaEntrega={editandoFechaEntrega}
        guardandoFechaEntrega={guardandoFechaEntrega}
        puedeEditarFechaEntrega={orden?.estado !== "Entregada"}
        onEmpezarEdicionFechaEntrega={() => setEditandoFechaEntrega(true)}
        onCancelarEdicionFechaEntrega={() => setEditandoFechaEntrega(false)}
        onGuardarFechaEntrega={guardarFechaEntrega}
        puedeEditarEntrega={canWriteSaleOrder && !["Entregada", "Cancelada"].includes(orden?.estado)}
        puedeUbicarDireccion={checkScope(ModelType.DIRECCION, ScopeType.WRITE)}
        onOrdenActualizada={async () => setOrden(await fetchOrden())}
      />

      {/* 🔴 TODO LO DOCUMENTAL, FUERA DE LAS PESTAÑAS Y EN UN SOLO LUGAR.
          Antes esto estaba partido en dos: el panel de facturación acá (emisión y estado del
          SII) y una pestaña «Documentos» a dos clics (origen, vincular y archivos adjuntos),
          las dos mostrando la MISMA lista de documentos con la mitad de las acciones cada una.
          `CentroDocumentos` las reemplaza, y por eso la pestaña ya no existe. */}
      <div className="mb-6">
        <CentroDocumentos orden={orden} onCambio={fetchOrden} />
      </div>

      {/* Cómo se entregó (rutas de entrega, Fase 2): las visitas con sus respuestas y fotos. */}
      <DespachoOrden idOrden={orden.id} />
      <EntregasDeOrden idOrden={orden.id} costoEnvio={orden.costo_envio} />

      {/* Las pestañas quedan para lo que se pidió y lo que se pickeó — decisión de Cristóbal,
          2026-08-25. Todo lo documental vive arriba, siempre visible. */}
      <Tabs
        activa={tab}
        onCambiar={setTab}
        pestanas={[
          { id: "detalle", label: "Productos", cantidad: orderItems.length },
          { id: "asignacion", label: "Asignación", cantidad: progresoRows.length },
        ]}
      />

      {/* Líneas y totales, en forma de documento. Cliente/direcciones/fechas ya se mostraron
          arriba en `InformacionOrdenCliente` — acá no se repiten. */}
      <div className={tab === "detalle" ? "mb-6" : "hidden"}>
        <DetalleTipoFactura
          orden={orden}
          lineas={orderItems}
          totalNeto={totalNeto}
          iva={iva}
          total={total}
          costoEnvio={costoEnvioActual}
          netoPedido={netoPedidoConEnvio}
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
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-2 text-left font-medium">Producto</th>
                        <th className="px-4 py-2 text-left font-medium">Producto físico</th>
                        <th className="px-4 py-2 text-left font-medium">Bulto</th>
                        <th className="px-4 py-2 text-left font-medium">Pallet</th>
                        <th className="px-4 py-2 text-right font-medium">Unidades pickeadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filasExtraccion.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-normal break-words">{row.producto}</td>
                          <td className="px-4 py-2 whitespace-normal break-words text-gray-600">{row.producto_fisico}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.bulto}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.pallet}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{fmtInt(row.unidades_pickeadas)}</td>
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
        descripcion="Revisa el documento antes de emitirlo: al confirmar se envía al SII y sólo se corrige con nota de crédito."
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
          saldo={saldo}
          dejarSaldoPendiente={dejarSaldoPendiente}
          setDejarSaldoPendiente={setDejarSaldoPendiente}
          motivoCierreSaldo={motivoCierreSaldo}
          setMotivoCierreSaldo={setMotivoCierreSaldo}
          tieneDireccionFacturacion={Boolean(orden?.id_local_facturacion)}
          onCopiarComoDespacho={copiarDireccionComoDespacho}
          copiandoDespacho={copiandoDespacho}
        />
      </Modal>

      <Modal
        abierto={showCerrarSaldo}
        onCerrar={() => setShowCerrarSaldo(false)}
        titulo="Cerrar saldo"
        descripcion="El cliente ya no recibirá lo que falta. La orden queda Facturada y lo no despachado sigue visible."
        pie={
          <>
            <button onClick={() => setShowCerrarSaldo(false)} className={btnCls("ghost")}>
              Cancelar
            </button>
            <button onClick={handleCerrarSaldo} disabled={transitioning} className={btnCls("primary")}>
              {transitioning ? "Cerrando…" : "Cerrar saldo"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {saldo.lineasConSaldo.length > 0 && (
            <div className="text-sm text-gray-700">
              Queda sin despachar:
              <ul className="mt-1 ml-4 list-disc">
                {saldo.lineasConSaldo.map((l) => (
                  <li key={l.nombre}>
                    {l.nombre}: {l.saldo_tras.toLocaleString("es-CL")} de {l.pedida.toLocaleString("es-CL")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Motivo (queda registrado)</span>
            <input
              type="text"
              value={motivoCerrarSaldo}
              onChange={(e) => setMotivoCerrarSaldo(e.target.value)}
              placeholder="Ej.: el cliente no lo quiere, quiebre de stock"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </label>
        </div>
      </Modal>

    </div>
  );
}
