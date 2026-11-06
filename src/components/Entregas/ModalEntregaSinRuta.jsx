import { useEffect, useMemo, useState } from "react";
import Modal from "../UI/Modal";
import Selector from "../Forms/Selector";
import { api } from "../../lib/api";
import { listarPendientes } from "../../services/rutasService";
import { toast } from "../../lib/toast.js";

/**
 * Registrar una entrega que no pasa por una ruta (plan §3 #13): el cliente la RETIRA en la bodega
 * (firma el documento como con el chofer) o sale por un DESPACHO EXTERNO a regiones (con el costo
 * del courier, que suma al costo de entrega de la OV, y su comprobante). Varias OV del mismo cliente
 * van juntas. Mismas reglas que en ruta: completa, parcial (sólo las líneas que no llegaron como
 * venían) o no entregada.
 */
const MOTIVOS_PARCIAL = ["Faltante", "Devolución", "Sobrante"];
const ACUERDOS = ["Solicita NC", "Cambio de mercadería", "Nuevo despacho", "Regresa a CD"];
const EPS = 1e-6;
const cantidad = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });
const nuevoUuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export default function ModalEntregaSinRuta({ onCerrar, onRegistrada }) {
  const [modalidad, setModalidad] = useState("Retiro en bodega");
  const [pool, setPool] = useState([]);
  const [idCliente, setIdCliente] = useState("");
  const [elegidas, setElegidas] = useState([]);
  const [porEntregar, setPorEntregar] = useState([]);
  const [estado, setEstado] = useState("Completa");
  const [motivo, setMotivo] = useState("");
  const [acuerdo, setAcuerdo] = useState("");
  const [comentario, setComentario] = useState("");
  const [costo, setCosto] = useState("");
  const [seguimiento, setSeguimiento] = useState("");
  const [fechaHora, setFechaHora] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [recibido, setRecibido] = useState({});
  const [fotos, setFotos] = useState({ documento_firmado: [], comprobante_externo: [], incidencia: [] });
  const [guardando, setGuardando] = useState(false);
  const [uuid] = useState(nuevoUuid);

  useEffect(() => {
    listarPendientes().then((r) => setPool((r.ordenes ?? []).filter((o) => !o.ruta))).catch((e) => toast.error(e.message));
  }, []);

  const clientes = useMemo(() => {
    const m = new Map();
    for (const o of pool) m.set(o.cliente.id, o.cliente.nombre);
    return [...m].map(([id, nombre]) => ({ value: String(id), label: nombre })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [pool]);
  const delCliente = pool.filter((o) => String(o.cliente.id) === idCliente);

  useEffect(() => {
    if (!elegidas.length) {
      setPorEntregar([]);
      return;
    }
    api(`/rutas/por-entregar?ordenes=${elegidas.join(",")}`).then(setPorEntregar).catch((e) => toast.error(e.message));
  }, [elegidas]);

  const documentos = porEntregar.flatMap((o) => o.documentos.map((d) => ({ ...d, id_orden: o.id })));
  const correcciones = useMemo(() => {
    const out = [];
    for (const d of documentos) {
      for (const l of d.lineas) {
        const txt = recibido[`${d.id}:${l.linea}`];
        if (txt === undefined || txt === "") continue;
        const n = Number(String(txt).replace(",", "."));
        if (Number.isFinite(n) && Math.abs(n - l.pendiente) > EPS) out.push({ id_documento_tributario: d.id, linea: l.linea, cantidad_recibida: n });
      }
    }
    return out;
  }, [recibido, documentos]);

  const externo = modalidad === "Despacho externo";
  const faltante = (() => {
    if (!elegidas.length) return "Elige los pedidos";
    if (!documentos.length) return "Esos pedidos no tienen nada por entregar";
    if (externo && (costo === "" || !(Number(costo) >= 0))) return "Indica el costo del despacho";
    if (!externo && !fotos.documento_firmado.length) return "Falta la foto del documento firmado";
    if (externo && !fotos.comprobante_externo.length) return "Falta el comprobante del courier";
    if (estado === "Parcial") {
      if (!motivo) return "Elige el motivo";
      if (!correcciones.length && !comentario.trim()) return "Indica qué línea no llegó como venía";
    }
    return null;
  })();

  const guardar = async () => {
    setGuardando(true);
    try {
      const form = new FormData();
      form.append("datos", JSON.stringify({
        uuid_cliente: uuid,
        modalidad,
        ordenes: elegidas,
        estado,
        motivo: estado === "Parcial" ? motivo : null,
        acuerdo: estado === "Parcial" ? acuerdo || null : null,
        comentario: comentario.trim() || null,
        fecha_hora: new Date(fechaHora).toISOString(),
        lineas: estado === "Parcial" ? correcciones : [],
        costo_externo: externo ? Number(costo) : null,
        seguimiento: externo ? seguimiento.trim() || null : null,
      }));
      for (const [campo, archivos] of Object.entries(fotos)) for (const f of archivos) form.append(campo, f, f.name);
      await api("/rutas/entregas-sin-ruta", { method: "POST", body: form });
      toast.success(externo ? "Despacho externo registrado" : "Retiro registrado");
      onRegistrada?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const Chip = ({ activo, texto, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border ${activo ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
    >
      {texto}
    </button>
  );

  const CampoArchivo = ({ campo, etiqueta, obligatorio, pdf }) => (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span>{etiqueta}{obligatorio ? " *" : ""}</span>
      <input
        type="file"
        accept={`image/jpeg,image/png,image/webp,image/heic${pdf ? ",application/pdf" : ""}`}
        multiple
        onChange={(e) => setFotos((f) => ({ ...f, [campo]: Array.from(e.target.files ?? []) }))}
        className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
      />
    </label>
  );

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      titulo="Entrega sin ruta"
      descripcion="Un retiro en bodega o un despacho por courier: se registra igual que una entrega en ruta."
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !!faltante}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {guardando ? "Guardando…" : faltante ?? "Registrar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip activo={!externo} texto="Retiro en bodega" onClick={() => setModalidad("Retiro en bodega")} />
          <Chip activo={externo} texto="Despacho externo (courier)" onClick={() => setModalidad("Despacho externo")} />
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Cliente
          <Selector
            options={clientes}
            selectedValue={idCliente}
            onSelect={(v) => { setIdCliente(v); setElegidas([]); setRecibido({}); }}
            useFuzzy
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </label>
        {idCliente && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-gray-700">Pedidos que se entregan</span>
            {delCliente.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={elegidas.includes(o.id)}
                  onChange={(e) => setElegidas((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                />
                OV #{o.id}{o.numero_oc ? ` · OC ${o.numero_oc}` : ""} · {o.estado}
              </label>
            ))}
          </div>
        )}

        {documentos.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip activo={estado === "Completa"} texto="Completa" onClick={() => setEstado("Completa")} />
              <Chip activo={estado === "Parcial"} texto="Parcial" onClick={() => setEstado("Parcial")} />
            </div>
            {estado === "Parcial" && (
              <>
                <div className="flex flex-wrap gap-2">{MOTIVOS_PARCIAL.map((m) => <Chip key={m} activo={motivo === m} texto={m} onClick={() => setMotivo(m)} />)}</div>
                <div className="flex flex-wrap gap-2">{ACUERDOS.map((a) => <Chip key={a} activo={acuerdo === a} texto={a} onClick={() => setAcuerdo(acuerdo === a ? "" : a)} />)}</div>
              </>
            )}
            <table className="w-full text-sm">
              <tbody>
                {documentos.flatMap((d) => d.lineas.map((l) => (
                  <tr key={`${d.id}:${l.linea}`} className="border-t border-gray-100">
                    <td className="py-1 pr-2">
                      {l.nombre}
                      <span className="block text-xs text-gray-500">{d.descripcion} · OV #{d.id_orden} · se entrega {cantidad(l.pendiente)}</span>
                    </td>
                    {estado === "Parcial" && (
                      <td className="py-1 w-28">
                        <input
                          inputMode="decimal"
                          value={recibido[`${d.id}:${l.linea}`] ?? ""}
                          placeholder={cantidad(l.pendiente)}
                          onChange={(e) => setRecibido((r) => ({ ...r, [`${d.id}:${l.linea}`]: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-right"
                        />
                      </td>
                    )}
                  </tr>
                )))}
              </tbody>
            </table>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {externo && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Costo del despacho (CLP) *
                <input inputMode="numeric" value={costo} onChange={(e) => setCosto(e.target.value.replace(/[^\d]/g, ""))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                N° de seguimiento
                <input value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 text-sm text-gray-700 sm:col-span-2">
            Comentario
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Fecha y hora
            <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {externo
            ? <CampoArchivo campo="comprobante_externo" etiqueta="Comprobante del courier" obligatorio pdf />
            : <CampoArchivo campo="documento_firmado" etiqueta="Documento firmado por quien retira" obligatorio />}
          <CampoArchivo campo="incidencia" etiqueta="Incidencia" />
        </div>
      </div>
    </Modal>
  );
}
