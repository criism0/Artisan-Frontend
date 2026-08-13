import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Selector from "../../components/Forms/Selector";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import Pagination from "../../components/UI/Pagination";
import Tabs from "../../components/UI/Tabs";
import PanelApartados from "../../components/DTE/PanelApartados";
import { compararFormato } from "../../utils/formatoProducto";

const PRODUCTOS_VISIBLES = 4;
const PAGE_SIZE = 6;

// ── Flags IA: mapeo a etiquetas legibles ────────────────────────────────────
const FLAG_LABELS = {
  producto_sin_match:    "Hay productos sin asociar en el catálogo",
  precio_no_disponible:  "Algunos precios no estaban disponibles en el correo",
  precio_desde_lista:    "Precios tomados de la lista de precios del cliente",
  cliente_no_encontrado: null, // se muestra vía el selector de cliente, no aquí
};

function parseFlagsVisibles(errorDetalle) {
  if (!errorDetalle) return [];
  return errorDetalle
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f && !f.startsWith("modificacion_oc:") && FLAG_LABELS[f] !== null)
    .map((f) => FLAG_LABELS[f] ?? f.replace(/_/g, " "));
}

// ── Confianza badge con tooltip de escala ────────────────────────────────────
const CONFIANZA_TOOLTIP = (
  <div className="absolute top-full right-0 mt-2 w-60 bg-gray-900 text-white rounded-xl px-3.5 py-3 shadow-xl z-20 pointer-events-none">
    <p className="text-xs font-semibold text-gray-300 mb-2">Nivel de confianza IA</p>
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span><span className="font-semibold text-green-300">≥ 85%</span> — datos bien identificados, listo para revisar</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
        <span><span className="font-semibold text-yellow-300">70–84%</span> — algunos campos pueden necesitar corrección</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <span><span className="font-semibold text-red-300">&lt; 70%</span> — revisar todos los campos con cuidado</span>
      </div>
    </div>
    <div className="absolute -top-1.5 right-5 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
  </div>
);

function ConfianzaBadge({ valor }) {
  const pct = Math.round((valor ?? 0) * 100);

  const badgeClass =
    pct >= 85
      ? "bg-green-100 text-green-700"
      : pct >= 70
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  const icon = pct >= 85 ? "✓" : pct >= 70 ? "⚠" : "✕";

  return (
    <div className="relative group inline-flex cursor-help">
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
        {icon} {pct}% confianza
      </span>
      <div className="hidden group-hover:block">
        {CONFIANZA_TOOLTIP}
      </div>
    </div>
  );
}

// ── Fila de producto editable ────────────────────────────────────────────────
function ProductoRow({ prod, catalogoOpts, ovId, onUpdated, onDeleted }) {
  const api = useApi();
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  // Pre-fill con la sugerencia fuzzy si no hay match directo
  const [prodIdSel, setProdIdSel]   = useState(
    String(prod.id_producto ?? prod.producto_id_sugerido ?? "")
  );
  const [cantidad, setCantidad]     = useState(String(prod.cantidad ?? ""));
  const [precio, setPrecio]         = useState(String(prod.precio_venta ?? ""));
  const [confirmDel, setConfirmDel] = useState(false);

  const sinMatch    = !prod.id_producto;
  const nombre      = prod.ProductoBase?.nombre ?? null;
  const nombreFact  = prod.NombreFacturacion?.nombre ?? null;
  const sugerido    = prod.ProductoSugerido ?? null;
  const simPct      = sugerido && prod.similitud_sugerencia != null
    ? Math.round(prod.similitud_sugerencia * 100)
    : null;

  // 🔴 La similitud se calcula sobre el texto e IGNORA los números, así que un formato
  // distinto no le baja el puntaje: en producción hay sugerencias al 100% de "Camembert
  // 100 g" apuntando al de 150 g. Otro gramaje es otro producto, con otro precio. El puntaje
  // no se toca acá —eso es del backend— pero el desacuerdo se avisa antes de aceptar.
  const formato = sugerido ? compararFormato(prod.descripcion_original, sugerido.nombre) : null;
  const formatoDifiere = formato?.estado === "difiere";

  // Acepta la sugerencia fuzzy directamente (sin abrir el editor)
  const handleAcceptSuggestion = async () => {
    if (!prod.producto_id_sugerido) return;
    setSaving(true);
    try {
      const updated = await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, {
        method: "PATCH",
        body: { id_producto: prod.producto_id_sugerido },
      });
      toast.success(`Asociado: ${sugerido?.nombre}`);
      onUpdated(updated);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo aceptar"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, {
        method: "PATCH",
        body: {
          id_producto:  prodIdSel ? Number(prodIdSel) : null,
          cantidad:     Number(cantidad),
          precio_venta: Number(precio),
        },
      });
      toast.success("Producto actualizado");
      setEditing(false);
      onUpdated(updated);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo guardar"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, { method: "DELETE" });
      toast.success("Producto eliminado");
      onDeleted(prod.id);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo eliminar"}`);
    } finally {
      setSaving(false);
      setConfirmDel(false);
    }
  };

  if (editing) {
    return (
      <li className="py-2 flex flex-col gap-2 bg-gray-50 rounded-lg px-2 -mx-2">
        {/* Descripción original de referencia */}
        {prod.descripcion_original && (
          <p className="text-xs text-gray-500 italic">
            IA extrajo: «{prod.descripcion_original}»
          </p>
        )}
        {/* Selector de producto del catálogo */}
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Producto del catálogo</label>
          <Selector
            options={[{ value: "", label: "— Sin asociar —" }, ...catalogoOpts]}
            selectedValue={prodIdSel}
            onSelect={setProdIdSel}
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-0.5 block">Cantidad</label>
            <input
              type="number" min="1" value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
              disabled={saving}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-0.5 block">Precio unitario</label>
            <input
              type="number" min="0" value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !cantidad}
            className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      <li className="py-1.5 flex flex-col gap-1 group">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            {/* Nombre del producto o descripción original */}
            {nombreFact || nombre ? (
              <span className="text-gray-800 text-sm truncate">{nombreFact ?? nombre}</span>
            ) : (
              <span className="text-gray-700 text-sm truncate">
                Sin asociar — {prod.descripcion_original ?? "producto desconocido"}
              </span>
            )}
            {/* Si tiene match y además hay descripción original, mostrarla en gris */}
            {nombre && prod.descripcion_original && (
              <span className="text-xs text-gray-400 truncate italic">
                «{prod.descripcion_original}»
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 text-sm">× {prod.cantidad}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-[#7A5AF8] opacity-0 group-hover:opacity-100 transition"
            >
              Editar
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              className="text-xs text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
            >
              Eliminar
              </button>
          </div>
        </div>

        {/* Sugerencia fuzzy — visible solo cuando sin match y hay candidato */}
        {sinMatch && sugerido && simPct !== null && (
          <div className={`rounded-lg border px-2 py-1 text-xs ${
            formatoDifiere ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-700 truncate">
                ¿Es <strong>{sugerido.nombre}</strong>?{" "}
                <span className={
                  formatoDifiere
                    ? "text-amber-700 font-semibold"
                    : simPct >= 80
                    ? "text-green-600 font-semibold"
                    : simPct >= 65
                    ? "text-yellow-600 font-semibold"
                    : "text-gray-500"
                }>
                  ({simPct}%)
                </span>
              </span>
              <button
                onClick={handleAcceptSuggestion}
                disabled={saving}
                className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
              >
                Aceptar
              </button>
            </div>
            {formatoDifiere && (
              <p className="text-amber-800 mt-0.5">
                El formato no coincide: pidieron <strong>{formato.pedido.texto}</strong> y el
                sugerido es de <strong>{formato.sugerido.texto}</strong>.
              </p>
            )}
          </div>
        )}
      </li>

      <ConfirmActionModal
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Eliminar producto"
        description={`¿Eliminar "${prod.descripcion_original ?? nombre ?? "este producto"}" de la OV?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </>
  );
}

// ── Fila para agregar producto nuevo ─────────────────────────────────────────
function AgregarProductoRow({ ovId, catalogoOpts, onAdded, onCancel }) {
  const api = useApi();
  const [saving, setSaving]       = useState(false);
  const [prodIdSel, setProdIdSel] = useState("");
  const [cantidad, setCantidad]   = useState("1");
  const [precio, setPrecio]       = useState("0");
  const [descOrig, setDescOrig]   = useState("");

  const handleAdd = async () => {
    if (!cantidad || Number(cantidad) <= 0) {
      toast.warning("Ingresa una cantidad válida");
      return;
    }
    setSaving(true);
    try {
      const created = await api(`/ordenes-venta/${ovId}/productos`, {
        method: "POST",
        body: {
          id_producto:          prodIdSel ? Number(prodIdSel) : null,
          descripcion_original: descOrig || null,
          cantidad:             Number(cantidad),
          precio_venta:         Number(precio),
        },
      });
      toast.success("Producto agregado");
      onAdded(created);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo agregar"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-2 flex flex-col gap-2 border-t border-dashed border-[#7A5AF8]/30 mt-1 pt-2">
      <p className="text-xs font-semibold text-[#7A5AF8]">Agregar producto</p>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Producto del catálogo</label>
        <Selector
          options={[{ value: "", label: "— Sin asociar / manual —" }, ...catalogoOpts]}
          selectedValue={prodIdSel}
          onSelect={setProdIdSel}
          disabled={saving}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Descripción (opcional)</label>
        <input
          type="text" value={descOrig}
          onChange={(e) => setDescOrig(e.target.value)}
          placeholder="Texto tal como llegó en el email…"
          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
          disabled={saving}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">Cantidad</label>
          <input
            type="number" min="1" value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
            disabled={saving}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">Precio unitario</label>
          <input
            type="number" min="0" value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
            disabled={saving}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancelar
        </button>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
        >
          {saving ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </li>
  );
}

// ── Modal correo original (estilo tipo Gmail) ────────────────────────────────
function EmailModal({ log, onClose }) {
  if (!log) return null;

  const inicial = (log.email_remitente || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: cerrar */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition rounded-full p-1.5 hover:bg-gray-100"
          >
            </button>
        </div>

        {/* Asunto grande, como el título de un correo en Gmail */}
        <div className="px-6 pt-3 pb-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 leading-snug">
            {log.email_asunto || "(Sin asunto)"}
          </h2>
        </div>

        {/* Fila remitente: avatar + email + fecha, como en Gmail */}
        <div className="px-6 pb-4 flex items-start gap-3 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#7A5AF8] text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {inicial}
          </div>
          <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
            <span className="text-sm text-gray-800 font-medium break-all">
              {log.email_remitente || "Remitente desconocido"}
            </span>
            {log.procesado_en && (
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(log.procesado_en).toLocaleString("es-CL")}
              </span>
            )}
          </div>
        </div>

        {/* Cuerpo del correo */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {log.raw_email_texto ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {log.raw_email_texto}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic text-center py-10">
              Texto del correo no disponible
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de una OV IA ─────────────────────────────────────────────────────
function OVIACard({ ov: ovInicial, bodegas, catalogoOpts, clientesOpts, onValidar, onRechazar, procesando }) {
  const api = useApi();
  const navigate = useNavigate();
  const [ov, setOv]                   = useState(ovInicial);
  const [bodegaId, setBodegaId]       = useState(() => {
    const santiago = bodegas.find(
      (b) => (b.nombre_bodega ?? b.nombre ?? "").toLowerCase().includes("santiago")
    );
    return santiago ? String(santiago.id) : "";
  });
  const [clienteIdLocal, setClienteIdLocal] = useState("");
  const [cambiandoCliente, setCambiandoCliente] = useState(false);
  const [agregando, setAgregando]     = useState(false);
  const [emailOpen, setEmailOpen]     = useState(false);
  const [esReferencial, setEsReferencial] = useState(ovInicial.es_referencial ?? true);
  const [guardandoRef, setGuardandoRef]   = useState(false);
  const [productosExpandido, setProductosExpandido] = useState(false);
  const log = ov.ai_log;

  const handleToggleReferencial = async () => {
    const nuevoValor = !esReferencial;
    setEsReferencial(nuevoValor);
    setGuardandoRef(true);
    try {
      await api(`/ordenes-venta/${ov.id}`, {
        method: "PUT",
        body: { es_referencial: nuevoValor },
      });
    } catch (err) {
      setEsReferencial(!nuevoValor);
      toast.error("No se pudo actualizar el modo referencial");
    } finally {
      setGuardandoRef(false);
    }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

  const modOcMatch  = log?.error_detalle?.match(/modificacion_oc:OV#(\d+)/);
  const ovOriginalId = modOcMatch ? modOcMatch[1] : null;
  const flagsInfo   = parseFlagsVisibles(log?.error_detalle);

  // Datos de cliente que la IA extrajo del correo aunque no hayan matcheado
  // ningún cliente registrado — sirven para precargar "Crear cliente".
  const nombreExtraido = log?.raw_ai_response?.cliente_nombre_extraido || "";
  const rutExtraido    = log?.raw_ai_response?.cliente_rut_extraido || "";

  // El cliente que el operario eligió a mano, si eligió alguno. Manda sobre el de la IA.
  const clienteElegido = clienteIdLocal
    ? clientesOpts.find((c) => String(c.value) === String(clienteIdLocal))
    : null;

  const handleCrearCliente = () => {
    navigate("/clientes/add", {
      state: { prefill: { nombre_empresa: nombreExtraido, rut: rutExtraido } },
    });
  };

  const bodegaOptions = bodegas.map((b) => ({
    value: String(b.id),
    label: b.nombre_bodega ?? b.nombre ?? `Bodega ${b.id}`,
  }));

  const handleUpdatedProd = (updated) => {
    setOv((prev) => ({
      ...prev,
      productos: prev.productos.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleDeletedProd = (prodId) => {
    setOv((prev) => ({
      ...prev,
      productos: prev.productos.filter((p) => p.id !== prodId),
    }));
  };

  const handleAddedProd = (created) => {
    setOv((prev) => ({ ...prev, productos: [...prev.productos, created] }));
    setAgregando(false);
  };

  const sinMatchCount = ov.productos?.filter((p) => !p.id_producto).length ?? 0;
  const todosLosProductos = ov.productos ?? [];
  const productosMostrados = productosExpandido
    ? todosLosProductos
    : todosLosProductos.slice(0, PRODUCTOS_VISIBLES);
  const productosOcultos = todosLosProductos.length - productosMostrados.length;

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              OV #{ov.id}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
              Pendiente IA
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mt-0.5">
            {clienteElegido?.label ?? ov.cliente?.nombre_empresa ?? (
              <span className="text-gray-500 italic">Cliente no identificado</span>
            )}
          </h3>
          {/* Si hay un cambio pendiente se dice, para que nadie valide creyendo otra cosa. */}
          {clienteElegido && ov.id_cliente ? (
            <p className="text-xs text-amber-700">
              Se cambiará al validar (antes: {ov.cliente?.nombre_empresa ?? "sin cliente"})
            </p>
          ) : (
            ov.cliente?.rut && <p className="text-xs text-gray-500">RUT {ov.cliente.rut}</p>
          )}
        </div>
        <ConfianzaBadge valor={ov.confianza_ia} />
      </div>

      {/* Metadata: remitente + asunto + OC/fecha */}
      <div className="flex flex-col gap-1.5 text-sm border-t border-gray-100 pt-3 -mt-1">
        {log?.email_remitente && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 truncate flex-1">{log.email_remitente}</span>
            <button
              onClick={() => setEmailOpen(true)}
              className="shrink-0 flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium ml-2"
            >
              Ver correo
            </button>
          </div>
        )}
        {log?.email_asunto && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 text-xs leading-snug">{log.email_asunto}</span>
          </div>
        )}
        {(ov.numero_oc || ov.fecha_orden) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 mt-0.5">
            {ov.numero_oc && (
              <div className="flex items-center gap-1.5">
                <span>OC {ov.numero_oc}</span>
              </div>
            )}
            {ov.fecha_orden && (
              <div className="flex items-center gap-1.5">
                <span>{fmtDate(ov.fecha_orden)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chips informativos de flags IA */}
      {flagsInfo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flagsInfo.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* 🔴 EL CLIENTE SIEMPRE SE PUEDE CAMBIAR, LO HAYA ACERTADO LA IA O NO.
          Antes este bloque salía sólo con `!ov.id_cliente`: si la IA elegía mal, no había
          forma de corregirlo desde la app. Y elegía mal seguido — medido el 2026-08-12,
          58 órdenes habían quedado asignadas a nuestra propia empresa, porque en una orden
          de compra nuestro RUT aparece como proveedor y la IA lo leía como cliente. */}
      {(!ov.id_cliente || cambiandoCliente) ? (
        <div className={`border rounded-xl p-3 flex flex-col gap-2 ${
          ov.id_cliente ? "border-gray-200 bg-gray-50" : "border-orange-200 bg-orange-50"
        }`}>
          <p className="text-xs font-semibold text-gray-700">
            {ov.id_cliente ? "Cambiar el cliente de esta orden" : "Cliente no identificado — selecciona uno para validar"}
          </p>
          {nombreExtraido && (
            <p className="text-xs text-gray-600">
              La IA encontró en el correo: <span className="font-semibold">{nombreExtraido}</span>
              {rutExtraido && <> — RUT {rutExtraido}</>}
            </p>
          )}
          <Selector
            options={[{ value: "", label: "— Busca y selecciona un cliente —" }, ...clientesOpts]}
            selectedValue={clienteIdLocal}
            onSelect={setClienteIdLocal}
            disabled={procesando}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleCrearCliente}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-800 underline decoration-dotted"
            >
              No existe — crear cliente nuevo{nombreExtraido ? " con estos datos" : ""}
            </button>
            {ov.id_cliente && (
              <button
                type="button"
                onClick={() => { setCambiandoCliente(false); setClienteIdLocal(""); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCambiandoCliente(true)}
          className="self-start text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted"
        >
          No es este cliente — cambiar
        </button>
      )}

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
            Productos ({ov.productos?.length ?? 0})
            {sinMatchCount > 0 && (
              <span className="ml-1 text-gray-500">· {sinMatchCount} sin asociar</span>
            )}
          </p>
          {!agregando && (
            <button
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium"
            >
              Agregar
            </button>
          )}
        </div>

        <ul className="divide-y divide-gray-100 text-sm">
          {productosMostrados.map((p) => (
            <ProductoRow
              key={p.id}
              prod={p}
              catalogoOpts={catalogoOpts}
              ovId={ov.id}
              onUpdated={handleUpdatedProd}
              onDeleted={handleDeletedProd}
            />
          ))}
          {todosLosProductos.length === 0 && !agregando && (
            <li className="py-2 text-xs text-gray-400 italic text-center">
              Sin productos — agrega al menos uno para validar
            </li>
          )}
          {agregando && (
            <AgregarProductoRow
              ovId={ov.id}
              catalogoOpts={catalogoOpts}
              onAdded={handleAddedProd}
              onCancel={() => setAgregando(false)}
            />
          )}
        </ul>

        {productosOcultos > 0 && (
          <button
            onClick={() => setProductosExpandido(true)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-[#7A5AF8] hover:text-[#6648e0] py-1.5 border-t border-dashed border-gray-200"
          >
            Ver {productosOcultos} producto{productosOcultos === 1 ? "" : "s"} más
          </button>
        )}
        {productosExpandido && todosLosProductos.length > PRODUCTOS_VISIBLES && (
          <button
            onClick={() => setProductosExpandido(false)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 py-1.5 border-t border-dashed border-gray-200"
          >
            Ver menos
          </button>
        )}
      </div>

      {/* Banner: OC modificada — enlace a la OV original */}
      {ovOriginalId && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium">
          <span>
            Posible modificación de OC — la OV original ya fue validada (
            <a
              href={`/ventas/ordenes/${ovOriginalId}`}
              className="underline font-semibold hover:text-orange-900"
              target="_blank"
              rel="noreferrer"
            >
              OV #{ovOriginalId}
            </a>
            ). Revisa y edita antes de validar.
          </span>
        </div>
      )}

      {/* Toggle: orden referencial */}
      <label className={`flex items-center gap-2.5 cursor-pointer select-none w-fit ${guardandoRef ? "opacity-50" : ""}`}>
        <div className="relative shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={esReferencial}
            onChange={handleToggleReferencial}
            disabled={guardandoRef || procesando}
          />
          <div className={`w-9 h-5 rounded-full transition-colors ${esReferencial ? "bg-[#7A5AF8]" : "bg-gray-200"}`} />
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${esReferencial ? "translate-x-4" : ""}`} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">Orden referencial</span>
          <span className="text-xs text-gray-400">El picking no se realiza con QR, se declara la cantidad directamente</span>
        </div>
      </label>

      {/* Selector de bodega */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Bodega <span className="text-red-500">*</span>
        </label>
        <Selector
          options={bodegaOptions}
          selectedValue={bodegaId}
          onSelect={setBodegaId}
          disabled={procesando}
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => onValidar(ov.id, bodegaId, clienteIdLocal || null)}
          disabled={!bodegaId || (!ov.id_cliente && !clienteIdLocal) || procesando}
          className="flex-1 bg-[#7A5AF8] hover:bg-[#6648e0] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold py-2 rounded-xl transition"
        >
          {procesando ? "Procesando…" : "Validar"}
        </button>
        <button
          onClick={() => onRechazar(ov.id)}
          disabled={procesando}
          className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-semibold py-2 rounded-xl transition"
        >
          Rechazar
        </button>
      </div>

      {emailOpen && <EmailModal log={log} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ColaIAPage() {
  const api = useApi();
  const [ordenes, setOrdenes]   = useState([]);
  const [bodegas, setBodegas]   = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [rechazarId, setRechazarId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina]     = useState(1);
  const [tab, setTab]           = useState("validar");
  const [apartados, setApartados] = useState([]);
  const [errorApartados, setErrorApartados] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [colaRes, bodegasRes, catalogoRes, clientesRes] = await Promise.all([
        api("/ordenes-venta/cola-ia"),
        api("/bodegas"),
        api("/productos-base"),
        api("/clientes"),
      ]);
      setOrdenes(Array.isArray(colaRes) ? colaRes : colaRes.data ?? []);
      const lista = Array.isArray(bodegasRes?.bodegas)
        ? bodegasRes.bodegas
        : Array.isArray(bodegasRes)
        ? bodegasRes
        : [];
      setBodegas(lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      const prods = Array.isArray(catalogoRes)
        ? catalogoRes
        : Array.isArray(catalogoRes?.data)
        ? catalogoRes.data
        : catalogoRes?.productos ?? [];
      setCatalogo(prods);

      const clis = Array.isArray(clientesRes)
        ? clientesRes
        : Array.isArray(clientesRes?.data)
        ? clientesRes.data
        : clientesRes?.clientes ?? [];
      setClientes(clis);
    } catch {
      toast.error("Error al cargar la cola IA");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Los apartados se piden aparte y en su propio try: si esta consulta falla, la cola de
  // validación —que es el trabajo diario— tiene que seguir funcionando igual.
  useEffect(() => {
    let cancelado = false;
    api("/ordenes-venta/cola-ia/apartados")
      .then((res) => {
        if (cancelado) return;
        setApartados(res?.apartados ?? res?.data?.apartados ?? []);
        setErrorApartados(null);
      })
      .catch((err) => {
        if (!cancelado) setErrorApartados(err?.message ?? "error desconocido");
      });
    return () => { cancelado = true; };
  }, [api]);

  // Opciones del catálogo para Selector
  const catalogoOpts = catalogo.map((p) => ({
    value: String(p.id),
    label: p.nombre,
  }));

  const clientesOpts = clientes.map((c) => ({
    value: String(c.id),
    label: c.nombre_empresa ?? `Cliente #${c.id}`,
  }));

  // Búsqueda: cliente, RUT, N° OC, remitente o asunto del correo
  const ordenesFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return ordenes;
    return ordenes.filter((ov) => {
      const campos = [
        ov.cliente?.nombre_empresa,
        ov.cliente?.rut,
        ov.numero_oc,
        ov.ai_log?.email_remitente,
        ov.ai_log?.email_asunto,
      ];
      return campos.some((c) => c && String(c).toLowerCase().includes(term));
    });
  }, [ordenes, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / PAGE_SIZE));

  // Si la búsqueda o una validación/rechazo dejan la página actual vacía, retrocede.
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  useEffect(() => { setPagina(1); }, [busqueda]);

  const ordenesPagina = ordenesFiltradas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const handleValidar = async (id, bodegaId, clienteId) => {
    if (!bodegaId) { toast.warning("Debes seleccionar una bodega antes de validar"); return; }
    setProcesando(true);
    try {
      const body = { bodega_id: Number(bodegaId) };
      if (clienteId) body.id_cliente = Number(clienteId);
      await api(`/ordenes-venta/${id}/validar-cola-ia`, {
        method: "PUT",
        body,
      });
      toast.success(`OV #${id} validada correctamente`);
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      toast.error(`Error al validar OV #${id}: ${err?.message ?? "Error desconocido"}`);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarRechazo = async () => {
    const id = rechazarId;
    setRechazarId(null);
    setProcesando(true);
    try {
      await api(`/ordenes-venta/${id}`, { method: "DELETE" });
      toast.success(`OV #${id} rechazada y eliminada`);
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      toast.error(`Error al rechazar OV #${id}: ${err?.message ?? "Error desconocido"}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Cola IA
            {!loading && ordenes.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7A5AF8] text-white text-xs font-bold">
                {ordenes.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Órdenes detectadas automáticamente vía correo. Revisa los productos, asocia los que
            aparecen sin match, asigna bodega y valida cada orden.
          </p>
        </div>
        <Link
          to="/ConsumoGemini"
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-[#7A5AF8] hover:text-[#6648e0] border border-[#7A5AF8]/30 hover:bg-[#7A5AF8]/5 rounded-xl px-3 py-2 transition"
        >
          Consumo API Gemini
        </Link>
      </div>

      <Tabs
        pestanas={[
          { id: "validar", label: "Por validar", cantidad: ordenes.length },
          { id: "apartados", label: "Apartados", cantidad: apartados.length },
        ]}
        activa={tab}
        onCambiar={setTab}
      />

      {tab === "apartados" ? (
        <PanelApartados apartados={apartados} loading={false} error={errorApartados} />
      ) : (
      <>
      {!loading && ordenes.length > 0 && (
        <div className="relative mb-5">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, RUT, N° OC, remitente o asunto…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8] focus:border-[#7A5AF8]"
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando…</div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 font-medium">No hay órdenes pendientes de validación</p>
          <p className="text-xs text-gray-400 mt-1">
            Cuando llegue un correo con una OC, aparecerá aquí automáticamente
          </p>
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">Sin resultados para "{busqueda}"</p>
          <button
            onClick={() => setBusqueda("")}
            className="text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium mt-2"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {ordenesPagina.map((ov) => (
              <OVIACard
                key={ov.id}
                ov={ov}
                bodegas={bodegas}
                catalogoOpts={catalogoOpts}
                clientesOpts={clientesOpts}
                onValidar={handleValidar}
                onRechazar={setRechazarId}
                procesando={procesando}
              />
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagina}
                totalPages={totalPaginas}
                onPageChange={setPagina}
              />
            </div>
          )}
        </>
      )}
      </>
      )}

      <ConfirmActionModal
        isOpen={rechazarId !== null}
        onClose={() => setRechazarId(null)}
        onConfirm={confirmarRechazo}
        title="Rechazar orden"
        description={`¿Estás seguro de que deseas rechazar y eliminar la OV #${rechazarId}? Esta acción no se puede deshacer.`}
        confirmText="Rechazar"
        cancelText="Cancelar"
      />
    </div>
  );
}
