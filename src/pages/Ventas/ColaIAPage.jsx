import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Selector from "../../components/Selector";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import {
  FiMail, FiPackage, FiCalendar, FiHash,
  FiAlertTriangle, FiEdit2, FiCheck, FiX, FiPlus, FiTrash2,
  FiEye, FiInfo, FiFileText,
} from "react-icons/fi";

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
  const sugerido    = prod.ProductoSugerido ?? null;
  const simPct      = sugerido && prod.similitud_sugerencia != null
    ? Math.round(prod.similitud_sugerencia * 100)
    : null;

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
      <li className="py-2 flex flex-col gap-2 bg-purple-50 rounded-lg px-2 -mx-2">
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
            <FiX /> Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !cantidad}
            className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
          >
            <FiCheck /> {saving ? "Guardando…" : "Guardar"}
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
            {nombre ? (
              <span className="text-gray-700 text-sm truncate">{nombre}</span>
            ) : (
              <span className="text-orange-600 text-sm italic truncate">
                ⚠ Sin match — {prod.descripcion_original ?? "producto desconocido"}
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
              className="text-gray-400 hover:text-[#7A5AF8] opacity-0 group-hover:opacity-100 transition"
              title="Editar"
            >
              <FiEdit2 size={13} />
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
              title="Eliminar"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>

        {/* Sugerencia fuzzy — visible solo cuando sin match y hay candidato */}
        {sinMatch && sugerido && simPct !== null && (
          <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs">
            <span className="text-blue-700 truncate">
              💡 ¿Es <strong>{sugerido.nombre}</strong>?{" "}
              <span className={
                simPct >= 80
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
              <FiCheck size={11} /> Aceptar
            </button>
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
          <FiX /> Cancelar
        </button>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
        >
          <FiPlus /> {saving ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </li>
  );
}

// ── Modal correo original ────────────────────────────────────────────────────
function EmailModal({ log, onClose }) {
  if (!log) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <FiMail className="text-[#7A5AF8]" size={16} />
            <h2 className="text-sm font-semibold text-gray-800">Correo original</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition rounded-lg p-1 hover:bg-gray-100"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Metadata del correo */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0 flex flex-col gap-1 text-xs">
          {log.email_remitente && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-14">De:</span>
              <span className="text-gray-700 font-medium break-all">{log.email_remitente}</span>
            </div>
          )}
          {log.email_asunto && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-14">Asunto:</span>
              <span className="text-gray-700">{log.email_asunto}</span>
            </div>
          )}
          {log.procesado_en && (
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-14">Recibido:</span>
              <span className="text-gray-500">{new Date(log.procesado_en).toLocaleString("es-CL")}</span>
            </div>
          )}
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {log.raw_email_texto ? (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {log.raw_email_texto}
            </pre>
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
  const [ov, setOv]                   = useState(ovInicial);
  const [bodegaId, setBodegaId]       = useState("");
  const [clienteIdLocal, setClienteIdLocal] = useState("");
  const [agregando, setAgregando]     = useState(false);
  const [emailOpen, setEmailOpen]     = useState(false);
  const [esReferencial, setEsReferencial] = useState(ovInicial.es_referencial ?? false);
  const [guardandoRef, setGuardandoRef]   = useState(false);
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

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            OV #{ov.id}
          </span>
          <h3 className="text-lg font-bold text-gray-800 mt-0.5">
            {ov.cliente?.nombre_empresa ?? (
              <span className="text-orange-500 italic">Cliente no identificado</span>
            )}
          </h3>
          {ov.cliente?.rut && (
            <p className="text-xs text-gray-500">RUT {ov.cliente.rut}</p>
          )}
        </div>
        <ConfianzaBadge valor={ov.confianza_ia} />
      </div>

      {/* Metadata: remitente + asunto + OC/fecha */}
      <div className="flex flex-col gap-1.5 text-sm border-t border-gray-100 pt-3 -mt-1">
        {log?.email_remitente && (
          <div className="flex items-center gap-2">
            <FiMail className="text-gray-400 shrink-0" size={13} />
            <span className="text-gray-600 truncate flex-1">{log.email_remitente}</span>
            <button
              onClick={() => setEmailOpen(true)}
              className="shrink-0 flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium ml-2"
            >
              <FiEye size={12} /> Ver correo
            </button>
          </div>
        )}
        {log?.email_asunto && (
          <div className="flex items-start gap-2">
            <FiHash className="text-gray-400 shrink-0 mt-0.5" size={13} />
            <span className="text-gray-500 text-xs leading-snug">{log.email_asunto}</span>
          </div>
        )}
        {(ov.numero_oc || ov.fecha_orden) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 mt-0.5">
            {ov.numero_oc && (
              <div className="flex items-center gap-1.5">
                <FiFileText className="text-gray-400 shrink-0" size={12} />
                <span>OC {ov.numero_oc}</span>
              </div>
            )}
            {ov.fecha_orden && (
              <div className="flex items-center gap-1.5">
                <FiCalendar className="text-gray-400 shrink-0" size={12} />
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
              <FiInfo size={10} /> {label}
            </span>
          ))}
        </div>
      )}

      {/* Selector de cliente — solo cuando la IA no pudo identificarlo */}
      {!ov.id_cliente && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
            <FiAlertTriangle size={13} /> Cliente no identificado — selecciona uno para validar
          </p>
          <Selector
            options={[{ value: "", label: "— Busca y selecciona un cliente —" }, ...clientesOpts]}
            selectedValue={clienteIdLocal}
            onSelect={setClienteIdLocal}
            disabled={procesando}
          />
        </div>
      )}

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
            <FiPackage /> Productos ({ov.productos?.length ?? 0})
            {sinMatchCount > 0 && (
              <span className="ml-1 text-orange-500">· {sinMatchCount} sin asociar</span>
            )}
          </p>
          {!agregando && (
            <button
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium"
            >
              <FiPlus size={12} /> Agregar
            </button>
          )}
        </div>

        <ul className="divide-y divide-gray-100 text-sm">
          {(ov.productos ?? []).map((p) => (
            <ProductoRow
              key={p.id}
              prod={p}
              catalogoOpts={catalogoOpts}
              ovId={ov.id}
              onUpdated={handleUpdatedProd}
              onDeleted={handleDeletedProd}
            />
          ))}
          {(ov.productos ?? []).length === 0 && !agregando && (
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
      </div>

      {/* Banner: OC modificada — enlace a la OV original */}
      {ovOriginalId && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-xs text-orange-800 font-medium">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-orange-500" />
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
        <div className="relative">
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
        <span className="text-xs text-gray-600">
          Orden referencial
          <span className="ml-1 text-gray-400">(omite picking)</span>
        </span>
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

  // Opciones del catálogo para Selector
  const catalogoOpts = catalogo.map((p) => ({
    value: String(p.id),
    label: p.nombre,
  }));

  const clientesOpts = clientes.map((c) => ({
    value: String(c.id),
    label: c.nombre_empresa ?? `Cliente #${c.id}`,
  }));

  const handleValidar = async (id, bodegaId, clienteId) => {
    if (!bodegaId) { toast.warning("Debes seleccionar una bodega antes de validar"); return; }
    setProcesando(true);
    try {
      const body = { bodega_id: Number(bodegaId) };
      if (clienteId) body.id_cliente = Number(clienteId);
      await api(`/ordenes-venta/${id}/validar`, {
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
      <div className="mb-6">
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {ordenes.map((ov) => (
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
