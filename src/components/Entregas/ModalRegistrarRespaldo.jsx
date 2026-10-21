import { useEffect, useMemo, useState } from "react";
import Modal from "../UI/Modal";
import { obtenerRutaParaRegistrar, registrarEntregaParada } from "../../services/rutasService";
import { toast } from "../../lib/toast.js";

/**
 * Registrar una parada desde la web, como respaldo de la app (el chofer se quedó sin batería, lo
 * contó por teléfono). Es el mismo formulario y la misma evidencia que la app: el documento firmado
 * es obligatorio si se entregó algo, y las fotos se suben desde un archivo.
 */
const MOTIVOS_PARCIAL = ["Faltante", "Devolución", "Sobrante"];
const MOTIVOS_NO_ENTREGA = ["Local cerrado", "Cliente rechaza", "Sin tiempo", "Dirección incorrecta", "Otro"];
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

export default function ModalRegistrarRespaldo({ idRuta, idParada, onCerrar, onRegistrada }) {
  const [parada, setParada] = useState(null);
  const [estado, setEstado] = useState("Completa");
  const [motivo, setMotivo] = useState("");
  const [motivoNo, setMotivoNo] = useState("");
  const [acuerdo, setAcuerdo] = useState("");
  const [comentario, setComentario] = useState("");
  const [fechaHora, setFechaHora] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [recibido, setRecibido] = useState({});
  const [fotos, setFotos] = useState({ documento_firmado: [], hoja_recepcion: [], incidencia: [] });
  const [guardando, setGuardando] = useState(false);
  const [uuid] = useState(nuevoUuid);

  useEffect(() => {
    obtenerRutaParaRegistrar(idRuta)
      .then((r) => setParada(r.paradas.find((p) => p.id === idParada) ?? null))
      .catch((e) => toast.error(e.message));
  }, [idRuta, idParada]);

  const documentos = useMemo(() => (parada?.ordenes ?? []).flatMap((o) => o.documentos), [parada]);
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

  const faltante = (() => {
    if (estado === "No entregada") return motivoNo ? null : "Elige por qué no se entregó";
    if (!fotos.documento_firmado.length) return "Falta la foto del documento firmado";
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
        estado,
        motivo: estado === "Parcial" ? motivo : null,
        motivo_no_entrega: estado === "No entregada" ? motivoNo : null,
        acuerdo: estado === "Parcial" ? acuerdo || null : null,
        comentario: comentario.trim() || null,
        fecha_hora: new Date(fechaHora).toISOString(),
        lineas: estado === "Parcial" ? correcciones : [],
      }));
      for (const [campo, archivos] of Object.entries(fotos)) {
        if (estado === "No entregada" && campo !== "incidencia") continue;
        for (const f of archivos) form.append(campo, f, f.name);
      }
      await registrarEntregaParada(idParada, form);
      toast.success("Entrega registrada");
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

  const CampoFoto = ({ campo, etiqueta, obligatoria }) => (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      <span>{etiqueta}{obligatoria ? " *" : ""}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        onChange={(e) => setFotos((f) => ({ ...f, [campo]: Array.from(e.target.files ?? []) }))}
        className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary"
      />
      {fotos[campo].length > 0 && <span className="text-xs text-gray-500">{fotos[campo].map((f) => f.name).join(", ")}</span>}
    </label>
  );

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      titulo={parada ? `Registrar como respaldo · ${parada.cliente.nombre}` : "Registrar como respaldo"}
      descripcion="Lo mismo que registra el chofer en la app, para cuando no pudo hacerlo."
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !!faltante || !parada}
            title={faltante ?? ""}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {guardando ? "Guardando…" : faltante ?? "Registrar"}
          </button>
        </>
      }
    >
      {!parada ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-gray-500">{parada.direccion} · {documentos.map((d) => d.descripcion).join(" · ")}</div>

          <div className="flex flex-wrap gap-2">
            <Chip activo={estado === "Completa"} texto="Entregado completo" onClick={() => setEstado("Completa")} />
            <Chip activo={estado === "Parcial"} texto="Parcial" onClick={() => setEstado("Parcial")} />
            <Chip activo={estado === "No entregada"} texto="No se entregó" onClick={() => setEstado("No entregada")} />
          </div>

          {estado === "No entregada" && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-700">¿Por qué?</span>
              <div className="flex flex-wrap gap-2">{MOTIVOS_NO_ENTREGA.map((m) => <Chip key={m} activo={motivoNo === m} texto={m} onClick={() => setMotivoNo(m)} />)}</div>
            </div>
          )}

          {estado === "Parcial" && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Motivo</span>
                <div className="flex flex-wrap gap-2">{MOTIVOS_PARCIAL.map((m) => <Chip key={m} activo={motivo === m} texto={m} onClick={() => setMotivo(m)} />)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-700">Acuerdo con el cliente</span>
                <div className="flex flex-wrap gap-2">{ACUERDOS.map((a) => <Chip key={a} activo={acuerdo === a} texto={a} onClick={() => setAcuerdo(acuerdo === a ? "" : a)} />)}</div>
              </div>
              <div>
                <span className="text-sm text-gray-700">Lo que se recibió</span>
                <span className="block text-xs text-gray-500">Cambia sólo lo que no llegó como venía; lo demás queda como recibido.</span>
                <table className="mt-1 w-full text-sm">
                  <tbody>
                    {documentos.flatMap((d) => d.lineas.map((l) => (
                      <tr key={`${d.id}:${l.linea}`} className="border-t border-gray-100">
                        <td className="py-1 pr-2">{l.nombre}<span className="block text-xs text-gray-500">se llevaba {cantidad(l.pendiente)}</span></td>
                        <td className="py-1 w-28">
                          <input
                            inputMode="decimal"
                            value={recibido[`${d.id}:${l.linea}`] ?? ""}
                            placeholder={cantidad(l.pendiente)}
                            onChange={(e) => setRecibido((r) => ({ ...r, [`${d.id}:${l.linea}`]: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-right"
                          />
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700 sm:col-span-2">
              Comentario
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha y hora de la entrega
              <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {estado !== "No entregada" && <CampoFoto campo="documento_firmado" etiqueta="Documento firmado" obligatoria />}
            {estado !== "No entregada" && <CampoFoto campo="hoja_recepcion" etiqueta="Hoja de recepción" />}
            <CampoFoto campo="incidencia" etiqueta="Incidencia" />
          </div>
        </div>
      )}
    </Modal>
  );
}
