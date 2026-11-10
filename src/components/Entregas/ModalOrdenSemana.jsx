import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../UI/Modal";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";

const MOTIVOS = ["Faltante", "Devolución", "Sobrante"];
const EPS = 1e-6;
const cantidad = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });
const nombreLinea = (p) => p?.NombreFacturacion?.nombre || p?.ProductoBase?.nombre || "Producto";
const numero = (t) => Number(String(t).replace(",", "."));

/**
 * Una OV del planificador semanal: lo que pidió el cliente y dos atajos —marcarla como entregada
 * fuera del flujo (ya se entregó por otro lado) o quitarla del planificador—. También permite
 * moverla de día. Una OV que ya va en una ruta sólo se mira.
 *
 * Al marcarla entregada se dice si llegó completa o no; si no, qué líneas no llegaron como venían
 * (el mismo registro que en la app: la diferencia queda en revisión de Logística).
 */
export default function ModalOrdenSemana({ orden, dias, puedeEscribir, iniciarEntrega = false, onCerrar, onMover, onCambio }) {
  const navigate = useNavigate();
  const [productos, setProductos] = useState(null);
  const [confirmando, setConfirmando] = useState(iniciarEntrega);
  const [tipo, setTipo] = useState("Completa");
  const [motivo, setMotivo] = useState("");
  const [recibido, setRecibido] = useState({});
  const [documentos, setDocumentos] = useState(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api(`/ordenes-venta/${orden.id}/info`)
      .then((o) => vivo && setProductos(Array.isArray(o?.productos) ? o.productos : []))
      .catch((e) => { if (vivo) { setProductos([]); toast.error(e.message); } });
    return () => { vivo = false; };
  }, [orden.id]);

  // Lo que falta entregar, documento por documento, sólo si se va a registrar una entrega parcial.
  useEffect(() => {
    if (!(confirmando && tipo === "Parcial") || documentos) return;
    api(`/rutas/por-entregar?ordenes=${orden.id}`)
      .then((r) => setDocumentos((r?.[0]?.documentos ?? []).filter((d) => d.lineas?.length)))
      .catch((e) => { setDocumentos([]); toast.error(e.message); });
  }, [confirmando, tipo, documentos, orden.id]);

  const correcciones = useMemo(() => {
    const out = [];
    for (const d of documentos ?? []) {
      for (const l of d.lineas) {
        const txt = recibido[`${d.id}:${l.linea}`];
        if (txt === undefined || txt === "") continue;
        const n = numero(txt);
        if (Number.isFinite(n) && Math.abs(n - l.pendiente) > EPS) out.push({ id_documento_tributario: d.id, linea: l.linea, cantidad_recibida: n, nombre: l.nombre, pendiente: l.pendiente });
      }
    }
    return out;
  }, [recibido, documentos]);

  const falta = (() => {
    if (tipo !== "Parcial") return null;
    if (!motivo) return "Elige el motivo";
    if (!correcciones.length) return "Indica qué línea no llegó como venía";
    const mal = correcciones.find((c) => (motivo === "Sobrante") !== (c.cantidad_recibida > c.pendiente));
    if (mal) return motivo === "Sobrante" ? `«${mal.nombre}»: con Sobrante se recibe MÁS` : `«${mal.nombre}»: se recibió más; el motivo sería Sobrante`;
    return null;
  })();

  const ejecutar = async (accion, mensaje) => {
    setEnviando(true);
    try {
      await accion();
      toast.success(mensaje);
      await onCambio?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = () =>
    ejecutar(
      () =>
        rutasApi.marcarEntregadaFueraDeFlujo(orden.id, {
          nota: nota.trim() || null,
          estado: tipo,
          motivo: tipo === "Parcial" ? motivo : null,
          lineas: tipo === "Parcial" ? correcciones.map(({ id_documento_tributario, linea, cantidad_recibida }) => ({ id_documento_tributario, linea, cantidad_recibida })) : [],
        }),
      tipo === "Parcial" ? "Entrega parcial registrada: queda en revisión" : "Marcada como entregada",
    );

  const libre = puedeEscribir && !orden.ruta;
  const total = (productos ?? []).reduce((s, p) => s + Number(p.cantidad || 0), 0);
  const Chip = ({ activo, texto, onClick }) => (
    <button type="button" onClick={onClick} className={`px-3 py-1 rounded-full border text-xs ${activo ? "bg-primary text-white border-primary" : "border-gray-300 hover:bg-gray-50"}`}>{texto}</button>
  );

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`OV #${orden.id} · ${orden.cliente.nombre}`}
      descripcion={[orden.comuna, orden.ruta ? `Ruta #${orden.ruta.id}` : null].filter(Boolean).join(" · ") || undefined}
      ancho="max-w-xl"
      pie={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <button type="button" onClick={() => navigate(`/ventas/ordenes/${orden.id}`)} className="text-sm text-primary hover:underline">
            Abrir la OV
          </button>
          {libre && !confirmando && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() => ejecutar(() => rutasApi.quitarDelPlanificador(orden.id), "Quitada del planificador")}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Quitar del planificador
              </button>
              <button type="button" onClick={() => setConfirmando(true)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                Marcar como entregada
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-60 overflow-y-auto">
          {productos === null && <p className="p-3 text-sm text-gray-500">Cargando…</p>}
          {productos?.length === 0 && <p className="p-3 text-sm text-gray-500">Sin productos.</p>}
          {(productos ?? []).map((p, i) => (
            <div key={p.id ?? i} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
              <span className="text-gray-800 min-w-0">{nombreLinea(p)}</span>
              <span className="tabular-nums text-gray-700 shrink-0">{cantidad(p.cantidad)}</span>
            </div>
          ))}
        </div>
        {productos?.length > 0 && <p className="text-xs text-gray-500 text-right">{productos.length} líneas · {cantidad(total)} unidades pedidas</p>}

        {libre && confirmando && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-green-900">¿Cómo llegó?</span>
              <Chip activo={tipo === "Completa"} texto="Completa" onClick={() => setTipo("Completa")} />
              <Chip activo={tipo === "Parcial"} texto="Parcial" onClick={() => setTipo("Parcial")} />
            </div>

            {tipo === "Parcial" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-600">Motivo</span>
                  {MOTIVOS.map((m) => <Chip key={m} activo={motivo === m} texto={m} onClick={() => setMotivo(m)} />)}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {documentos === null && <p className="p-2 text-xs text-gray-500">Cargando lo que se llevaba…</p>}
                  {documentos?.length === 0 && <p className="p-2 text-xs text-gray-500">No hay líneas por entregar.</p>}
                  {(documentos ?? []).flatMap((d) =>
                    d.lineas.map((l) => {
                      const k = `${d.id}:${l.linea}`;
                      const difiere = correcciones.some((c) => c.id_documento_tributario === d.id && c.linea === l.linea);
                      return (
                        <div key={k} className={`flex items-center gap-2 px-2 py-1.5 text-sm ${difiere ? "bg-amber-50" : ""}`}>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate">{l.nombre}</span>
                            <span className="block text-xs text-gray-500">Se llevaba {cantidad(l.pendiente)}</span>
                          </span>
                          <input
                            value={recibido[k] ?? ""}
                            onChange={(e) => setRecibido({ ...recibido, [k]: e.target.value })}
                            placeholder={cantidad(l.pendiente)}
                            inputMode="decimal"
                            aria-label={`Recibido de ${l.nombre}`}
                            className="w-20 h-8 px-2 border border-gray-300 rounded-md text-right text-sm"
                          />
                        </div>
                      );
                    }),
                  )}
                </div>
                <p className="text-xs text-gray-600">Escribe sólo lo que no llegó como venía. La diferencia queda en revisión de Logística, que decide qué pasa con lo pickeado.</p>
              </>
            )}

            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): cómo o quién la entregó" className="h-9 px-3 border border-gray-300 rounded-lg bg-white text-sm" />
            <div className="flex items-center justify-end gap-2">
              {falta && <span className="text-xs text-amber-700 mr-auto">{falta}</span>}
              <button type="button" onClick={() => (iniciarEntrega ? onCerrar() : setConfirmando(false))} className="px-3 py-1.5 text-sm text-gray-600 hover:underline">Cancelar</button>
              <button
                type="button"
                disabled={enviando || !!falta}
                onClick={confirmar}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar entrega
              </button>
            </div>
          </div>
        )}

        {libre && !confirmando && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Mover a</span>
            {dias.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => { onMover(orden, d.iso); onCerrar(); }}
                disabled={orden.dia === d.iso}
                className="px-2 py-1 rounded-md border border-gray-300 text-xs hover:bg-gray-50 disabled:bg-primary/10 disabled:text-primary disabled:border-primary/30"
              >
                {d.nombre}
              </button>
            ))}
          </div>
        )}
        {orden.ruta && <p className="text-xs text-gray-500">Va en la ruta #{orden.ruta.id}: sale ese día. Para cambiarla, hazlo desde la ruta.</p>}
      </div>
    </Modal>
  );
}
