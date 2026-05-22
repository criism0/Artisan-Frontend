import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Selector from "../../components/Selector";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import { FiMail, FiUser, FiPackage, FiCalendar, FiHash, FiAlertTriangle } from "react-icons/fi";

// ── Confianza badge ─────────────────────────────────────────────────────────
function ConfianzaBadge({ valor }) {
  const pct = Math.round((valor ?? 0) * 100);
  if (pct >= 85)
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        ✓ {pct}% confianza
      </span>
    );
  if (pct >= 70)
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        ⚠ {pct}% confianza
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      ✕ {pct}% confianza
    </span>
  );
}

// ── Tarjeta de una OV IA ─────────────────────────────────────────────────────
function OVIACard({ ov, bodegas, onValidar, onRechazar, procesando }) {
  const [bodegaId, setBodegaId] = useState("");
  const log = ov.ai_log;

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

  const bodegaOptions = bodegas.map((b) => ({
    value: String(b.id),
    label: b.nombre_bodega ?? b.nombre ?? `Bodega ${b.id}`,
  }));

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

      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
        {log?.email_remitente && (
          <div className="flex items-center gap-2">
            <FiMail className="text-gray-400 shrink-0" />
            <span className="truncate">{log.email_remitente}</span>
          </div>
        )}
        {log?.email_asunto && (
          <div className="flex items-center gap-2">
            <FiHash className="text-gray-400 shrink-0" />
            <span className="truncate">{log.email_asunto}</span>
          </div>
        )}
        {ov.numero_oc && (
          <div className="flex items-center gap-2">
            <FiUser className="text-gray-400 shrink-0" />
            <span>OC {ov.numero_oc}</span>
          </div>
        )}
        {ov.fecha_orden && (
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400 shrink-0" />
            <span>{fmtDate(ov.fecha_orden)}</span>
          </div>
        )}
      </div>

      {/* Productos */}
      {ov.productos?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
            <FiPackage /> Productos ({ov.productos.length})
          </p>
          <ul className="divide-y divide-gray-100 text-sm">
            {ov.productos.map((p, i) => (
              <li key={i} className="py-1.5 flex justify-between gap-2">
                <span className="text-gray-700">
                  {p.ProductoBase?.nombre ?? (
                    <span className="italic text-gray-400">Sin match en catálogo</span>
                  )}
                </span>
                <span className="text-gray-500 shrink-0">× {p.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flags / advertencias */}
      {log?.error_detalle && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <span>{log.error_detalle}</span>
        </div>
      )}

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
          onClick={() => onValidar(ov.id, bodegaId)}
          disabled={!bodegaId || procesando}
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
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ColaIAPage() {
  const api = useApi();
  const [ordenes, setOrdenes] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Estado para modal de rechazo
  const [rechazarId, setRechazarId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [colaRes, bodegasRes] = await Promise.all([
        api("/ordenes-venta/cola-ia"),
        api("/bodegas"),
      ]);
      setOrdenes(Array.isArray(colaRes) ? colaRes : colaRes.data ?? []);
      const lista = Array.isArray(bodegasRes?.bodegas)
        ? bodegasRes.bodegas
        : Array.isArray(bodegasRes)
        ? bodegasRes
        : [];
      setBodegas(lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
    } catch {
      toast.error("Error al cargar la cola IA");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleValidar = async (id, bodegaId) => {
    if (!bodegaId) {
      toast.warning("Debes seleccionar una bodega antes de validar");
      return;
    }
    setProcesando(true);
    try {
      await api(`/ordenes-venta/${id}/validar`, {
        method: "PUT",
        body: { bodega_id: Number(bodegaId) },
      });
      toast.success(`OV #${id} validada correctamente`);
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      toast.error(`Error al validar OV #${id}: ${err?.message ?? "Error desconocido"}`);
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = (id) => {
    setRechazarId(id);
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
      {/* Encabezado */}
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
          Órdenes de venta detectadas automáticamente vía correo. Revisa los datos, asigna una
          bodega y valida o rechaza cada orden.
        </p>
      </div>

      {/* Contenido */}
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
              onValidar={handleValidar}
              onRechazar={handleRechazar}
              procesando={procesando}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación de rechazo */}
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
