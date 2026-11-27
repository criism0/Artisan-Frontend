import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import PageHeader from "../../components/UI/PageHeader.jsx";
import Modal from "../../components/UI/Modal.jsx";
import { BarraEtapas } from "../../components/Produccion/Elaboracion.jsx";
import InsumosResumen from "../../components/Produccion/InsumosResumen.jsx";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";
import { formatFecha } from "../../lib/dateUtils";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { nombreProducto } from "../../utils/elaboracionVista.js";
import { abreviarUnidad, cambiarPeso, resumenParaConsumir } from "../../utils/elaboracionInsumos.js";

// Insumos de una elaboración (Fase 5, 2026-11-26). Los bultos se anotan —escaneados, escritos o
// sugeridos por vencimiento— sin tocar el stock; «Consumir insumos» los descuenta todos juntos.
// Antes cada ingrediente descontaba al asignarle un bulto, uno por uno.
export default function PrepararInsumos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [om, setOm] = useState(null);
  const [vista, setVista] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [leido, setLeido] = useState(null); // previsualización del bulto escrito
  const [cantidad, setCantidad] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const entrada = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const [o, v] = await Promise.all([api(`/ordenes_manufactura/${id}`), api(`/ordenes_manufactura/${id}/insumos`)]);
      setOm(o);
      setVista(v?.data ?? null);
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo cargar la elaboración");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const conVista = async (promesa, exito) => {
    setOcupado(true);
    try {
      const r = await promesa;
      setVista(r?.data ?? null);
      if (exito) toast.success(typeof exito === "function" ? exito(r?.data) : exito);
      return r?.data;
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo guardar");
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const leer = async (e) => {
    e?.preventDefault();
    const c = codigo.trim();
    if (!c) return;
    setOcupado(true);
    try {
      const r = await api(`/ordenes_manufactura/${id}/insumos/bulto/${encodeURIComponent(c)}`);
      setLeido(r?.data ?? null);
      setCantidad(String(r?.data?.peso_sugerido ?? ""));
    } catch (err) {
      setLeido(null);
      toast.error(mensajeDelBackend(err) || `No se pudo leer el bulto ${c}`);
    } finally {
      setOcupado(false);
    }
  };

  const anotar = async () => {
    const ok = await conVista(
      api(`/ordenes_manufactura/${id}/insumos/anotar`, {
        method: "POST",
        body: { id_bulto: leido.bulto.id, id_registro: leido.id_registro, peso: Number(cantidad) },
      })
    );
    if (ok) {
      setLeido(null);
      setCodigo("");
      entrada.current?.focus();
    }
  };

  const guardarPeso = (idRegistro, idBulto, peso) =>
    conVista(api(`/ordenes_manufactura/${id}/insumos/borrador`, { method: "PUT", body: { items: cambiarPeso(vista, idRegistro, idBulto, peso) } }));

  const sugerir = () =>
    conVista(api(`/ordenes_manufactura/${id}/insumos/sugerir`, { method: "POST" }), (d) =>
      d?.sin_stock?.length ? `Sin stock suficiente: ${d.sin_stock.join(", ")}` : "Bultos sugeridos por vencimiento"
    );

  const consumir = async () => {
    setConfirmando(false);
    const d = await conVista(api(`/ordenes_manufactura/${id}/insumos/consumir`, { method: "POST" }), "Insumos consumidos");
    if (!d) return;
    // Sigue directo a lo que toca: los pasos si la receta tiene, o registrar la producción.
    navigate(`/produccion/elaboraciones/${id}/${d.estado === "Insumos Asignados" && om?.registrosPasoProduccion?.length ? "pasos" : "produccion-final"}`);
  };

  if (cargando) return <PageLoader />;
  if (!om || !vista) return <div className="py-16 text-center text-gray-500">No se encontró la elaboración.</div>;

  const listos = vista.ingredientes.filter((i) => i.cubierto).length;
  const resumen = resumenParaConsumir(vista);
  const titulo = `Insumos · Elaboración #${om.id} · ${nombreProducto(om)}`;

  if (!vista.editable) {
    return (
      <div>
        <PageHeader volverA={`/produccion/elaboraciones/${id}`} titulo={titulo} subtitulo="Los insumos ya se consumieron." />
        <InsumosResumen omId={id} />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        volverA={`/produccion/elaboraciones/${id}`}
        titulo={titulo}
        subtitulo={`${listos} de ${vista.ingredientes.length} insumos listos · todavía no se descuenta nada del stock`}
        tituloAyuda="Cómo se preparan los insumos"
        ayuda={
          <ul className="ml-4 list-disc space-y-1">
            <li>Escanea o escribe el código de un bulto: se propone el insumo y la cantidad que falta.</li>
            <li>«Sugerir» completa lo que falta con los bultos de {vista.bodega?.nombre ?? "la bodega"} que vencen primero.</li>
            <li>Anotar no toca el stock. «Consumir insumos» descuenta todo junto, cuando cada insumo está cubierto.</li>
          </ul>
        }
      />

      <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <BarraEtapas om={om} />
      </div>

      <div className="mb-4 flex flex-wrap items-start gap-2">
        <form onSubmit={leer} className="flex min-w-0 flex-1 gap-2">
          <input
            ref={entrada}
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Escanea o escribe el bulto (BULTO-…)"
            aria-label="Código del bulto"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="btn btn-secundario" disabled={ocupado || !codigo.trim()}>Leer</button>
        </form>
        <button type="button" className="btn btn-secundario inline-flex items-center gap-1.5" onClick={sugerir} disabled={ocupado}>
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Sugerir
        </button>
      </div>

      {leido && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-primary/40 bg-primary-light/40 p-4 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-text">{leido.ingrediente}</div>
            <div className="text-gray-600">
              {leido.bulto.identificador}
              {leido.bulto.lote && ` · lote ${leido.bulto.lote}`}
              {leido.bulto.vencimiento && ` · vence ${formatFecha(leido.bulto.vencimiento)}`}
              {` · disponible ${formatNumberCL(leido.bulto.disponible, 3)} ${abreviarUnidad(leido.unidad)}`}
            </div>
          </div>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Cuánto usas ({abreviarUnidad(leido.unidad)})</span>
            <input type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-1.5" />
          </label>
          <button className="btn btn-primario" onClick={anotar} disabled={ocupado || !(Number(cantidad) > 0)}>Anotar</button>
          <button className="btn btn-texto" onClick={() => setLeido(null)}>Descartar</button>
        </div>
      )}

      <div className="space-y-3">
        {vista.ingredientes.map((i) => {
          const u = abreviarUnidad(i.materia_prima.unidad_medida);
          return (
            <section key={i.id_registro} className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h2 className="text-sm font-semibold text-text">{i.materia_prima.nombre}</h2>
                <span className="text-sm tabular-nums">
                  {i.cubierto ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">✓ {formatNumberCL(i.necesario, 3)} {u}</span>
                  ) : i.anotado + i.consumido > 0 ? (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">faltan {formatNumberCL(i.faltante, 3)} {u}</span>
                  ) : (
                    <span className="text-gray-500">0 de {formatNumberCL(i.necesario, 3)} {u}</span>
                  )}
                </span>
              </header>
              {(i.consumidos.length > 0 || i.anotados.length > 0) && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100 text-sm">
                  {i.consumidos.map((b) => (
                    <li key={`c${b.id_bulto}`} className="flex items-center gap-3 px-4 py-2 text-gray-500">
                      <span className="flex-1">{b.identificador}</span>
                      <span className="tabular-nums">{formatNumberCL(b.peso, 3)} {u}</span>
                      <span className="text-xs">consumido</span>
                    </li>
                  ))}
                  {i.anotados.map((b) => (
                    <FilaAnotada key={b.id_bulto} b={b} u={u} ocupado={ocupado}
                      onGuardar={(peso) => guardarPeso(i.id_registro, b.id_bulto, peso)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {vista.costo_anotado > 0 && <span className="text-sm text-gray-600">Costo {formatCLP(vista.costo_anotado, 0)}</span>}
          <button className="btn btn-primario" disabled={ocupado || !resumen.listo} onClick={() => setConfirmando(true)}>
            {resumen.texto}
          </button>
        </div>
      </div>

      <Modal
        abierto={confirmando}
        onCerrar={() => setConfirmando(false)}
        titulo="¿Consumir los insumos?"
        descripcion="Aquí baja el stock. Si después hay que anularla, los insumos vuelven a sus bultos."
        pie={
          <>
            <button className="btn btn-secundario" onClick={() => setConfirmando(false)}>Volver</button>
            <button className="btn btn-primario" onClick={consumir}>Consumir y seguir</button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">Insumos</dt><dd className="text-right font-medium">{listos} de {vista.ingredientes.length} ✓</dd>
          <dt className="text-gray-500">Bultos que se descuentan</dt>
          <dd className="text-right font-medium">{new Set(vista.ingredientes.flatMap((x) => x.anotados.map((a) => a.id_bulto))).size}</dd>
          <dt className="text-gray-500">Bodega</dt><dd className="text-right font-medium">{vista.bodega?.nombre ?? "—"}</dd>
          <dt className="text-gray-500">Costo</dt><dd className="text-right font-medium">{formatCLP(vista.costo_anotado, 0)}</dd>
        </dl>
      </Modal>
    </div>
  );
}

/** Un bulto anotado: la cantidad se guarda al salir del campo; la ✕ lo quita. */
function FilaAnotada({ b, u, ocupado, onGuardar }) {
  const [valor, setValor] = useState(String(b.peso));
  useEffect(() => setValor(String(b.peso)), [b.peso]);
  const guardar = () => {
    if (Number(valor) !== Number(b.peso)) onGuardar(valor);
  };
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1">
        {b.identificador}
        <span className="block text-xs text-gray-500">
          {[b.lote && `lote ${b.lote}`, b.vencimiento && `vence ${formatFecha(b.vencimiento)}`, `disponible ${formatNumberCL(b.disponible, 3)} ${u}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <label className="flex items-center gap-1.5">
        <input type="number" min="0" step="any" value={valor} onChange={(e) => setValor(e.target.value)} onBlur={guardar}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} disabled={ocupado} aria-label={`Cantidad de ${b.identificador}`}
          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-right tabular-nums" />
        <span className="text-xs text-gray-500">{u}</span>
      </label>
      <button type="button" onClick={() => onGuardar(0)} disabled={ocupado} aria-label={`Quitar ${b.identificador}`}
        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
