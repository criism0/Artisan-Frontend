import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../../components/UI/PageHeader";
import Ayuda from "../../components/UI/Ayuda.jsx";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import SeccionAdjuntos from "../../components/DTE/SeccionAdjuntos.jsx";
import { ModalConfirmacion } from "../../components/UI/PanelAcciones.jsx";
import { useApi, apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP, formatNumberCL } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formularioDesdeRecepcion, cuerpoDesdeFormulario, problemasParaConfirmar, repartir, cuadreDeLinea, lotesDesde } from "../../utils/recepcionOC.js";

/**
 * Recepción de una orden de compra en borrador (Cristóbal, 2026-11-26).
 *
 * Al entrar se abre el borrador de la orden (o se retoma el que ya había, aunque lo haya empezado
 * otra persona en otro equipo). Cada cambio se guarda solo en el servidor; si se cae la conexión,
 * se reintenta al volver. Nada toca el inventario hasta «Confirmar recepción», que crea los
 * bultos. Reemplaza a `RecepcionarOrden`, que guardaba todo en el navegador y creaba los bultos
 * en el mismo clic.
 */
const ESPERA_GUARDADO_MS = 800;
const REINTENTO_MS = 5000;
const hora = (d) => new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
const sinRueda = (e) => e.currentTarget.blur();

export default function RecepcionOC() {
  const { ordenId } = useParams();
  const api = useApi();
  const navigate = useNavigate();
  const volver = `/adquisiciones/ordenes-compra/${ordenId}`;

  const [vista, setVista] = useState(null);
  const [form, setForm] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState({ estado: "ok", hora: null });
  const [confirmando, setConfirmando] = useState(false);
  const [verResumen, setVerResumen] = useState(false);
  const [etiquetas, setEtiquetas] = useState(true);
  const [porDescartar, setPorDescartar] = useState(null);
  const pendiente = useRef(false);
  const temporizador = useRef(null);
  const ultimo = useRef(null); // el formulario más reciente, para guardar sin esperar al render

  const puedeConfirmar = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE) && checkScope(ModelType.BULTO, ScopeType.WRITE);

  useEffect(() => {
    (async () => {
      try {
        const [v, b] = await Promise.all([api(`/proceso-compra/ordenes/${ordenId}/recepciones`, { method: "POST" }), api(`/bodegas`)]);
        setVista(v);
        ultimo.current = formularioDesdeRecepcion(v.recepcion);
        setForm(ultimo.current);
        setGuardado({ estado: "ok", hora: v.recepcion.updatedAt });
        setBodegas((Array.isArray(b) ? b : b?.bodegas || []).filter((x) => x?.nombre?.toLowerCase?.().trim() !== "en tránsito"));
      } catch (e) {
        setError(mensajeDelBackend(e) || "No se pudo abrir la recepción");
      }
    })();
  }, [api, ordenId]);

  const idRecepcion = vista?.recepcion?.id;

  const guardar = useCallback(
    async (datos) => {
      if (!idRecepcion) return true;
      setGuardado((g) => ({ ...g, estado: "guardando" }));
      try {
        const r = await api(`/proceso-compra/recepciones/${idRecepcion}`, { method: "PUT", body: cuerpoDesdeFormulario(datos) });
        pendiente.current = false;
        setGuardado({ estado: "ok", hora: r?.updatedAt ?? new Date() });
        return true;
      } catch (e) {
        // Sin respuesta del servidor (fetch lanza TypeError): se reintenta solo.
        const sinRed = e instanceof TypeError || !navigator.onLine;
        setGuardado((g) => ({ ...g, estado: sinRed ? "sin-conexion" : "error", mensaje: mensajeDelBackend(e) }));
        return false;
      }
    },
    [api, idRecepcion]
  );

  // Autoguardado: cada cambio espera un momento y se manda entero.
  const cambiar = (actualizar) => {
    const nuevo = actualizar(ultimo.current);
    ultimo.current = nuevo;
    setForm(nuevo);
    pendiente.current = true;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => guardar(nuevo), ESPERA_GUARDADO_MS);
  };

  // Sin conexión: se reintenta cada 5 s y apenas el navegador dice que volvió.
  useEffect(() => {
    if (guardado.estado !== "sin-conexion") return undefined;
    const reintentar = () => pendiente.current && guardar(ultimo.current);
    const id = setInterval(reintentar, REINTENTO_MS);
    window.addEventListener("online", reintentar);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", reintentar);
    };
  }, [guardado.estado, guardar]);

  // Si se cierra la pestaña con un cambio sin guardar, el navegador pregunta.
  useEffect(() => {
    const aviso = (e) => {
      if (!pendiente.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  const guardarYa = async () => {
    clearTimeout(temporizador.current);
    return pendiente.current ? guardar(ultimo.current) : true;
  };

  const lineasOC = vista?.lineas_oc ?? [];
  const problemas = useMemo(() => (form ? problemasParaConfirmar(form, lineasOC) : []), [form, lineasOC]);
  const conCantidad = lineasOC.filter((l) => Number(form?.lineas[l.id_linea]?.cantidad) > 0);
  const neto = conCantidad.reduce((s, l) => s + Number(form.lineas[l.id_linea].cantidad) * Number(form.lineas[l.id_linea].precio || 0), 0);
  const totalBultos = conCantidad.reduce((s, l) => s + (form.lineas[l.id_linea].bultos?.length || 0), 0);
  const quedaParcial = lineasOC.some((l) => l.recibido + (Number(form?.lineas[l.id_linea]?.cantidad) || 0) < l.pedido - 0.0005);

  const confirmar = async () => {
    setConfirmando(true);
    try {
      if (!(await guardarYa())) throw new Error("No se pudo guardar el borrador antes de confirmar.");
      const r = await api(`/proceso-compra/recepciones/${idRecepcion}/confirmar`, { method: "POST" });
      pendiente.current = false;
      toast.success(`Recepción ${vista.recepcion.numero} confirmada: ${r.ids_bultos_creados.length} bultos`);
      if (etiquetas && r.ids_bultos_creados.length) {
        try {
          const blob = await apiBlob("/bultos/etiquetas", { method: "POST", body: { ids_bultos: r.ids_bultos_creados } });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Etiquetas_OC_${ordenId}_recepcion_${vista.recepcion.numero}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          toast.error("La recepción quedó confirmada, pero no se pudieron bajar las etiquetas: " + (e?.message || e));
        }
      }
      navigate(`${volver}?tab=recepciones`);
    } catch (e) {
      toast.error(mensajeDelBackend(e) || e.message || "No se pudo confirmar la recepción");
      setVerResumen(false);
    } finally {
      setConfirmando(false);
    }
  };

  const descartar = async () => {
    try {
      clearTimeout(temporizador.current);
      pendiente.current = false;
      await api(`/proceso-compra/recepciones/${idRecepcion}`, { method: "DELETE" });
      toast.success("Borrador descartado");
      navigate(volver);
    } catch (e) {
      toast.error(mensajeDelBackend(e) || "No se pudo descartar el borrador");
    }
  };

  if (error)
    return (
      <div>
        <PageHeader volverA={volver} titulo="Recepción" />
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{error}</p>
      </div>
    );
  if (!vista || !form) return <PageLoader message="Abriendo la recepción" />;

  const { recepcion, orden } = vista;
  const campo = (nombre, valor) => cambiar((f) => ({ ...f, [nombre]: valor }));
  const linea = (id, cambios) => cambiar((f) => ({ ...f, lineas: { ...f.lineas, [id]: { ...f.lineas[id], ...cambios } } }));
  const lbl = "block text-xs font-medium text-gray-600 mb-1";
  const inp = "w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white";

  const indicador = {
    ok: <span className="text-xs text-emerald-700">✓ Guardado {guardado.hora ? hora(guardado.hora) : ""}</span>,
    guardando: <span className="text-xs text-gray-500">Guardando…</span>,
    "sin-conexion": <span className="text-xs font-medium text-amber-700">⚠ Sin conexión: se guarda al volver</span>,
    error: <span className="text-xs font-medium text-red-700" title={guardado.mensaje}>⚠ No se pudo guardar</span>,
  }[guardado.estado];

  return (
    <div className="pb-24">
      <PageHeader
        volverA={volver}
        titulo={`Recepción ${recepcion.numero} · OC #${orden.id} · ${orden.proveedor ?? ""}`}
        estado={
          <span className="inline-flex items-center gap-2">
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">✎ Borrador</span>
            {indicador}
          </span>
        }
        subtitulo={[
          orden.bodega,
          `emitida ${new Date(orden.fecha).toLocaleDateString("es-CL")}`,
          `${lineasOC.filter((l) => l.falta <= 0.0005).length} de ${lineasOC.length} líneas completas`,
          recepcion.creador?.nombre && `iniciada por ${recepcion.creador.nombre}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className={lbl} htmlFor="rec-bodega">Bodega</label>
            <select id="rec-bodega" value={form.id_bodega} onChange={(e) => campo("id_bodega", e.target.value)} className={inp}>
              <option value="">Elegir…</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl} htmlFor="rec-fecha">Fecha de recepción</label>
            <input id="rec-fecha" type="date" value={form.fecha_recepcion} onChange={(e) => campo("fecha_recepcion", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="rec-factura">
              N° factura <Ayuda titulo="Varias facturas">Si llegaron varias, sepáralas con coma: 1234, 1235.</Ayuda>
            </label>
            <input id="rec-factura" value={form.numero_factura} onChange={(e) => campo("numero_factura", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="rec-fdoc">Fecha factura o guía</label>
            <input id="rec-fdoc" type="date" value={form.fecha_documento} onChange={(e) => campo("fecha_documento", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl} htmlFor="rec-guia">Guía de despacho</label>
            <input id="rec-guia" value={form.guia_despacho} onChange={(e) => campo("guia_despacho", e.target.value)} className={inp} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Insumo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Pedido</th>
                <th className="px-3 py-2.5 text-right font-semibold">Ya recibido</th>
                <th className="px-3 py-2.5 text-right font-semibold">Falta</th>
                <th className="px-3 py-2.5 text-left font-semibold">Llega ahora</th>
                <th className="px-3 py-2.5 text-left font-semibold">Precio factura</th>
                <th className="px-3 py-2.5 text-right font-semibold">Neto</th>
              </tr>
            </thead>
            <tbody>
              {lineasOC.map((l) => {
                const f = form.lineas[l.id_linea] ?? { cantidad: "", precio: l.precio_oc, bultos: [] };
                const completa = l.falta <= 0.0005 && !(Number(f.cantidad) > 0);
                const n = Number(f.cantidad) * Number(f.precio || 0);
                return (
                  <tr key={l.id_linea} className={`border-t border-gray-100 ${completa ? "text-gray-400" : ""}`}>
                    <td className="px-3 py-2">
                      <span className={completa ? "" : "font-medium text-gray-900"}>{l.nombre}</span>
                      <span className="text-xs text-gray-500"> · {l.formato}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumberCL(l.pedido, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumberCL(l.recibido, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {completa ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">✓</span> : formatNumberCL(l.falta, 2)}
                    </td>
                    {completa ? (
                      <td colSpan={3} className="px-3 py-2 text-xs">completo</td>
                    ) : (
                      <>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            aria-label={`Llega ahora de ${l.nombre}`}
                            value={f.cantidad}
                            onWheel={sinRueda}
                            onChange={(e) => {
                              const cantidad = e.target.value;
                              const bultos = f.bultos?.length ? repartir(Number(cantidad) * l.ratio, f.bultos.length, f.bultos[0]?.lote ?? "") : [];
                              linea(l.id_linea, { cantidad, bultos, precio: f.precio ?? l.precio_oc });
                            }}
                            className="w-24 border border-gray-300 rounded-md px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Precio de ${l.nombre}`}
                            value={f.precio}
                            onWheel={sinRueda}
                            onChange={(e) => linea(l.id_linea, { precio: e.target.value })}
                            className="w-28 border border-gray-300 rounded-md px-2 py-1"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{n > 0 ? formatCLP(n, 0) : <span className="text-gray-400">—</span>}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {conCantidad.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              Bultos
              <Ayuda titulo="Bultos">
                En cuántos bultos llegó cada insumo, cuánto trae cada uno y el lote del proveedor. Se crean recién al confirmar; la suma
                tiene que dar lo que llegó.
              </Ayuda>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {conCantidad.map((l) => {
                const f = form.lineas[l.id_linea];
                const cuadre = cuadreDeLinea(f, l);
                return (
                  <div key={l.id_linea} className="bg-white rounded-xl shadow-sm p-3 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-gray-900">
                        {l.nombre} · {formatNumberCL(Number(f.cantidad), 2)} {l.formato}
                        {l.ratio !== 1 && <span className="font-normal text-gray-500"> = {formatNumberCL(cuadre.esperado, 2)} {l.unidad_base}</span>}
                      </b>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                          cuadre.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {cuadre.texto}
                      </span>
                    </div>
                    <label className="flex items-center gap-2">
                      en
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        aria-label={`Bultos de ${l.nombre}`}
                        value={f.bultos?.length || ""}
                        onWheel={sinRueda}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(500, Math.trunc(Number(e.target.value) || 0)));
                          linea(l.id_linea, { bultos: repartir(cuadre.esperado, n, f.bultos?.[0]?.lote ?? "") });
                        }}
                        className="w-20 border border-gray-300 rounded-md px-2 py-1"
                      />
                      bultos
                    </label>
                    {f.bultos?.length > 0 && (
                      <div className="grid grid-cols-[1.5rem_1fr_1.4fr] gap-x-2 gap-y-1 items-center text-xs text-gray-500">
                        <span />
                        <span>{l.unidad_base}</span>
                        <span>Lote proveedor</span>
                        {f.bultos.map((b, i) => (
                          <div key={i} className="contents">
                            <span className="text-right">{i + 1}</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`Cantidad del bulto ${i + 1} de ${l.nombre}`}
                              value={b.unidades}
                              onWheel={sinRueda}
                              onChange={(e) => linea(l.id_linea, { bultos: f.bultos.map((x, j) => (j === i ? { ...x, unidades: e.target.value } : x)) })}
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                            />
                            <input
                              aria-label={`Lote del bulto ${i + 1} de ${l.nombre}`}
                              value={b.lote}
                              onChange={(e) =>
                                // Lo escrito en un lote pasa a ese bulto y a todos los de abajo (Cristóbal, 2026-11-26):
                                // casi siempre llegan del mismo lote, y si uno cambia, cambian los que siguen.
                                linea(l.id_linea, { bultos: lotesDesde(f.bultos, i, e.target.value) })
                              }
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4">
          <SeccionAdjuntos idOrdenCompra={orden.id} idRecepcionOC={recepcion.id} compacto />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-gray-600">
            Neto del documento <b className="text-gray-900 tabular-nums">{formatCLP(neto, 0)}</b>
          </span>
          <button type="button" className="btn btn-secundario text-red-700" onClick={() => setPorDescartar({ label: "Descartar", destructiva: true, onClick: descartar, confirmar: { titulo: `¿Descartar la recepción ${recepcion.numero}?`, mensaje: "Se borra lo anotado. No había creado bultos.", textoBoton: "Descartar" } })}>
            Descartar borrador
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={async () => {
              if (await guardarYa()) navigate(volver);
              else toast.error("No se pudo guardar. Revisa la conexión antes de salir.");
            }}
          >
            Salir · queda guardado
          </button>
          <button
            type="button"
            className="btn btn-primario disabled:opacity-50"
            disabled={problemas.length > 0 || !puedeConfirmar}
            title={problemas[0] || (!puedeConfirmar ? "No tienes permiso para crear bultos" : undefined)}
            onClick={() => setVerResumen(true)}
          >
            Confirmar recepción
          </button>
        </div>
      </div>

      {verResumen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">¿Confirmar la recepción {recepcion.numero}?</h2>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <dt>Bultos nuevos en {bodegas.find((b) => String(b.id) === String(form.id_bodega))?.nombre ?? "la bodega"}</dt>
                <dd className="font-semibold">{totalBultos}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Neto del documento</dt>
                <dd className="font-semibold tabular-nums">{formatCLP(neto, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>La orden queda</dt>
                <dd className={quedaParcial ? "text-amber-700 font-medium" : "text-emerald-700 font-medium"}>{quedaParcial ? "Recep. parcial" : "Recepcionada"}</dd>
              </div>
            </dl>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={etiquetas} onChange={(e) => setEtiquetas(e.target.checked)} /> Descargar las etiquetas
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secundario" onClick={() => setVerResumen(false)} disabled={confirmando}>
                Volver
              </button>
              <button type="button" className="btn btn-primario" onClick={confirmar} disabled={confirmando}>
                {confirmando ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalConfirmacion accion={porDescartar} onCerrar={() => setPorDescartar(null)} />
    </div>
  );
}
