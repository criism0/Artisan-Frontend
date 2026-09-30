import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, MapPin, Route as IconoRuta, Search, Sparkles, Truck, X, AlertTriangle, Pencil } from "lucide-react";
import PageHeader from "../../components/UI/PageHeader";
import CargandoVista from "../../components/UI/CargandoVista";
import Modal from "../../components/UI/Modal";
import Selector from "../../components/Forms/Selector";
import MapaRuta from "../../components/Entregas/MapaRuta";
import ModalBuscarDireccion from "../../components/Entregas/ModalBuscarDireccion";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import * as rutasApi from "../../services/rutasService";
import {
  FILTROS_PENDIENTES,
  contarPorFiltro,
  etiquetaFecha,
  filtrarPendientes,
  formatearKm,
  formatearMinutos,
  ordenarPendientes,
  paradasDeRutaGuardada,
} from "../../utils/rutas";

/**
 * Logística → Entregas: planificar las rutas del día (pedido de Cristóbal, 2026-09-30).
 *
 * Una sola vista, sin más complejidad que lo necesario:
 * - todas las OV pendientes de entrega, primero las del día elegido, con qué tienen dirección y
 *   qué no, y la búsqueda «como en Google Maps» para definir la que falta;
 * - «Recomendar ruta»: con los pedidos marcados, o sola con los comprometidos hasta ese día;
 * - el encargado (rol Transportista) y guardar; las rutas del día quedan abajo.
 */

const PASO_LISTA = 40;
const TONOS_FECHA = {
  dia: "bg-primary/10 text-primary border-primary/20",
  atrasada: "bg-red-50 text-red-700 border-red-200",
  gris: "bg-gray-50 text-gray-600 border-gray-200",
};
const CLP = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-CL")}`);

export default function Entregas() {
  const hoy = new Date().toLocaleDateString("en-CA");
  const [fecha, setFecha] = useState(hoy);
  const [bodegas, setBodegas] = useState([]);
  const [idBodega, setIdBodega] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [corte, setCorte] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [costoKm, setCostoKm] = useState(null);
  const [editandoCosto, setEditandoCosto] = useState(false);
  const [costoBorrador, setCostoBorrador] = useState("");
  const [cargando, setCargando] = useState(true);

  const [filtro, setFiltro] = useState("todas");
  const [texto, setTexto] = useState("");
  const [visibles, setVisibles] = useState(PASO_LISTA);
  const [seleccion, setSeleccion] = useState(() => new Set());

  // La ruta que se está armando: recomendada, o una guardada que se está editando (idRuta).
  const [propuesta, setPropuesta] = useState(null);
  const [idTransportista, setIdTransportista] = useState("");
  const [recomendando, setRecomendando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [buscando, setBuscando] = useState(null); // { orden } | { bodega }
  const [cancelando, setCancelando] = useState(null);
  const [motivo, setMotivo] = useState("");

  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const bodega = bodegas.find((b) => String(b.id) === String(idBodega)) ?? null;

  const cargarPendientes = useCallback(async () => {
    const r = await rutasApi.listarPendientes();
    setPendientes(r.ordenes ?? []);
    setCorte(r.corte ?? null);
  }, []);

  const cargarRutas = useCallback(async (f) => setRutas(await rutasApi.listarRutas(f)), []);

  useEffect(() => {
    (async () => {
      try {
        const [bs, ts, params] = await Promise.all([api("/bodegas"), rutasApi.listarTransportistas(), rutasApi.leerParametros()]);
        const lista = (Array.isArray(bs) ? bs : bs?.bodegas ?? []).filter((b) => b.nombre !== "En tránsito");
        setBodegas(lista);
        setIdBodega(String((lista.find((b) => b.nombre === "Santiago") ?? lista[0])?.id ?? ""));
        setTransportistas(Array.isArray(ts) ? ts : []);
        setCostoKm(params?.costo_km ?? null);
        await cargarPendientes();
      } catch (e) {
        toast.error(e.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [cargarPendientes]);

  useEffect(() => {
    cargarRutas(fecha).catch((e) => toast.error(e.message));
  }, [fecha, cargarRutas]);

  const ordenadas = useMemo(() => ordenarPendientes(pendientes, fecha), [pendientes, fecha]);
  const filtradas = useMemo(() => filtrarPendientes(ordenadas, { filtro, texto }), [ordenadas, filtro, texto]);
  const conteos = useMemo(() => contarPorFiltro(pendientes), [pendientes]);
  const porId = useMemo(() => new Map(pendientes.map((o) => [o.id, o])), [pendientes]);

  const enLaPropuesta = useMemo(
    () => new Set((propuesta?.paradas ?? []).flatMap((p) => p.ordenes.map((o) => o.id))),
    [propuesta],
  );

  /** Se puede marcar si tiene dirección y no está en otra ruta (la que se edita no cuenta). */
  const marcable = (o) => o.estado_direccion !== "falta" && (!o.ruta || o.ruta.id === propuesta?.idRuta);

  const alternar = (o) => {
    if (!marcable(o)) return;
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(o.id)) s.delete(o.id);
      else s.add(o.id);
      return s;
    });
  };

  const sueltos = [...seleccion]
    .filter((id) => !enLaPropuesta.has(id))
    .map((id) => porId.get(id))
    .filter((o) => o?.punto?.lat != null)
    .map((o) => ({ lat: o.punto.lat, lng: o.punto.lng, etiqueta: `OV #${o.id} · ${o.cliente.nombre}` }));

  const errorBodega = (e) => {
    if (e?.data?.code === "BODEGA_SIN_UBICAR") {
      toast.error(e.message);
      setBuscando({ bodega });
      return true;
    }
    return false;
  };

  const recomendar = async () => {
    setRecomendando(true);
    try {
      const r = await rutasApi.sugerirRuta({
        fecha,
        id_bodega: Number(idBodega),
        ordenes: seleccion.size ? [...seleccion] : undefined,
        id_ruta: propuesta?.idRuta ?? undefined,
      });
      if (r.vacia) {
        toast.info(`No hay pedidos comprometidos hasta el ${fecha.split("-").reverse().join("-")} con dirección. Marca pedidos de la lista.`);
        return;
      }
      setPropuesta({ ...r, editada: false, idRuta: propuesta?.idRuta ?? null });
      setSeleccion(new Set(r.paradas.flatMap((p) => p.ordenes.map((o) => o.id))));
      r.avisos?.forEach((a) => toast.warning(a));
    } catch (e) {
      if (!errorBodega(e)) toast.error(e.message);
    } finally {
      setRecomendando(false);
    }
  };

  const mover = (i, delta) =>
    setPropuesta((p) => {
      const paradas = [...p.paradas];
      const j = i + delta;
      if (j < 0 || j >= paradas.length) return p;
      [paradas[i], paradas[j]] = [paradas[j], paradas[i]];
      return { ...p, paradas, editada: true };
    });

  const quitarParada = (i) =>
    setPropuesta((p) => {
      const quitada = p.paradas[i];
      setSeleccion((s) => {
        const n = new Set(s);
        quitada.ordenes.forEach((o) => n.delete(o.id));
        return n;
      });
      return { ...p, paradas: p.paradas.filter((_, k) => k !== i), editada: true };
    });

  const descartar = () => {
    setPropuesta(null);
    setSeleccion(new Set());
    setIdTransportista("");
  };

  const guardar = async () => {
    if (!idTransportista) {
      toast.error("Elige quién va a hacer la ruta.");
      return;
    }
    setGuardando(true);
    try {
      const paradas = propuesta.paradas.map((p) => ({ ordenes: p.ordenes.map((o) => o.id) }));
      if (propuesta.idRuta) {
        await rutasApi.actualizarRuta(propuesta.idRuta, { paradas, id_transportista: Number(idTransportista) });
        toast.success("Ruta actualizada");
      } else {
        await rutasApi.crearRuta({ fecha, id_bodega: Number(idBodega), id_transportista: Number(idTransportista), paradas });
        toast.success("Ruta guardada");
      }
      descartar();
      await Promise.all([cargarPendientes(), cargarRutas(fecha)]);
    } catch (e) {
      if (!errorBodega(e)) toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const editarRuta = (r) => {
    const paradas = paradasDeRutaGuardada(r);
    setPropuesta({
      paradas,
      km: r.km_planificados,
      minutos: r.minutos_planificados,
      polilinea: r.polilinea,
      costo_estimado: r.costo_estimado,
      avisos: [],
      editada: false,
      idRuta: r.id,
    });
    setIdTransportista(r.id_transportista ? String(r.id_transportista) : "");
    setSeleccion(new Set(paradas.flatMap((p) => p.ordenes.map((o) => o.id))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmarCancelacion = async () => {
    try {
      await rutasApi.cancelarRuta(cancelando.id, motivo);
      toast.success("Ruta cancelada: sus pedidos quedaron libres");
      if (propuesta?.idRuta === cancelando.id) descartar();
      setCancelando(null);
      setMotivo("");
      await Promise.all([cargarPendientes(), cargarRutas(fecha)]);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const guardarCosto = async () => {
    try {
      const r = await rutasApi.guardarCostoKm(Number(String(costoBorrador).replace(",", ".")));
      setCostoKm(r.costo_km);
      setEditandoCosto(false);
      toast.success("Costo por km guardado");
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (cargando) return <CargandoVista />;

  return (
    <div className="p-6 bg-background min-h-screen">
      <PageHeader
        titulo="Entregas"
        subtitulo="Planifica las rutas del día: elige pedidos (o deja que el sistema los elija), revisa la ruta recomendada y asígnala."
      />

      {/* ── Barra de planificación ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Día de la ruta
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              descartar();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 min-w-[180px]">
          Sale desde
          <Selector
            options={bodegas.map((b) => ({ value: String(b.id), label: b.nombre }))}
            selectedValue={idBodega}
            onSelect={(v) => {
              setIdBodega(v);
              descartar();
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm text-gray-700">
          Costo por km
          {editandoCosto ? (
            <div className="flex gap-1">
              <input
                autoFocus
                inputMode="decimal"
                value={costoBorrador}
                onChange={(e) => setCostoBorrador(e.target.value)}
                className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button type="button" onClick={guardarCosto} className="px-3 py-2 text-sm rounded-lg bg-primary text-white">Guardar</button>
              <button type="button" onClick={() => setEditandoCosto(false)} className="px-2 py-2 text-sm text-gray-500">Cancelar</button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!puedeEscribir}
              onClick={() => {
                setCostoBorrador(costoKm ?? "");
                setEditandoCosto(true);
              }}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${costoKm ? "border-gray-300 text-gray-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}
            >
              {costoKm ? `${CLP(costoKm)} / km` : "Definir"} {puedeEscribir && <Pencil className="w-3 h-3" />}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {seleccion.size > 0 && (
            <button type="button" onClick={() => setSeleccion(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
              Quitar selección ({seleccion.size})
            </button>
          )}
          <button
            type="button"
            onClick={recomendar}
            disabled={!puedeEscribir || recomendando || !idBodega}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            title={seleccion.size ? "Ordena los pedidos marcados por el recorrido más corto" : "Toma los pedidos comprometidos hasta este día y los ordena"}
          >
            <Sparkles className="w-4 h-4" />
            {recomendando ? "Calculando…" : seleccion.size ? `Recomendar ruta con ${seleccion.size}` : "Recomendar ruta del día"}
          </button>
        </div>
      </div>

      {bodega && bodega.lat == null && (
        <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <span>La bodega <strong>{bodega.nombre}</strong> no está en el mapa: las rutas salen desde ahí.</span>
          {puedeEscribir && (
            <button type="button" onClick={() => setBuscando({ bodega })} className="px-3 py-1.5 rounded-md border border-amber-400 bg-white hover:bg-amber-100">
              Ubicarla
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* ── Pedidos por entregar ──────────────────────────────────────────── */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-gray-900">Pedidos por entregar</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
              <input
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  setVisibles(PASO_LISTA);
                }}
                placeholder="OV, OC, cliente o dirección"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg w-60"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {FILTROS_PENDIENTES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFiltro(f.id);
                  setVisibles(PASO_LISTA);
                }}
                className={`px-3 py-1 rounded-full text-sm border ${filtro === f.id ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
              >
                {f.label} <span className="opacity-70">({conteos[f.id]})</span>
              </button>
            ))}
          </div>
          {corte && (
            <p className="text-xs text-gray-500 mb-2">Se muestran los pedidos desde el {corte.split("-").reverse().join("-")} (antes se entregaban por AppSheet).</p>
          )}

          <ul className="divide-y divide-gray-100">
            {filtradas.slice(0, visibles).map((o) => {
              const f = etiquetaFecha(o.fecha_entrega, fecha);
              const puede = marcable(o);
              const marcada = seleccion.has(o.id);
              return (
                <li key={o.id} className={`py-2.5 flex items-start gap-3 ${marcada ? "bg-primary/5 -mx-2 px-2 rounded-lg" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={marcada}
                    disabled={!puede || !puedeEscribir}
                    onChange={() => alternar(o)}
                    title={puede ? "Agregar a la ruta" : o.ruta ? "Ya está en una ruta" : "Falta la dirección"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/ventas/ordenes/${o.id}`} className="font-medium text-gray-900 hover:text-primary">OV #{o.id}</Link>
                      <span className="text-sm text-gray-700 truncate">{o.cliente.nombre}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-xs ${TONOS_FECHA[f.tono]}`}>{f.texto}</span>
                      <span className="text-xs text-gray-400">{o.estado}</span>
                      {o.ruta && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                          <Truck className="w-3 h-3" /> Ruta {o.ruta.fecha.split("-").reverse().join("-")}{o.ruta.transportista ? ` · ${o.ruta.transportista}` : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                      {o.estado_direccion === "falta" ? (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <MapPin className="w-3.5 h-3.5" /> {o.motivo_direccion}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-600 min-w-0">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                          <span className="truncate">{o.punto.texto}</span>
                          {o.estado_direccion === "revisar" && (
                            <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                              <AlertTriangle className="w-3 h-3" /> {o.motivo_direccion}
                            </span>
                          )}
                        </span>
                      )}
                      {puedeEscribir && !o.ruta && (
                        <button
                          type="button"
                          onClick={() => setBuscando({ orden: o })}
                          className={`text-xs px-2 py-0.5 rounded-md border ${o.estado_direccion === "falta" ? "border-red-300 text-red-700 hover:bg-red-50" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                        >
                          {o.estado_direccion === "falta" ? "Definir dirección" : "Cambiar"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {filtradas.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Nada por acá.</p>}
          {filtradas.length > visibles && (
            <button type="button" onClick={() => setVisibles((v) => v + PASO_LISTA)} className="mt-3 w-full py-2 text-sm text-primary hover:bg-primary/5 rounded-lg">
              Ver más ({filtradas.length - visibles} restantes)
            </button>
          )}
        </div>

        {/* ── Mapa y ruta ───────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <MapaRuta bodega={bodega} paradas={propuesta?.paradas ?? []} sueltos={sueltos} polilinea={propuesta?.editada ? null : propuesta?.polilinea} />

          {propuesta ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <IconoRuta className="w-4 h-4 text-primary" />
                  {propuesta.idRuta ? `Editando ruta #${propuesta.idRuta}` : "Ruta recomendada"}
                </h2>
                <button type="button" onClick={descartar} className="text-sm text-gray-500 hover:text-gray-700">Descartar</button>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <Dato titulo="Recorrido" valor={formatearKm(propuesta.km)} />
                <Dato titulo="Tiempo manejando" valor={formatearMinutos(propuesta.minutos)} />
                <Dato titulo="Costo" valor={CLP(propuesta.costo_estimado)} />
              </div>
              {propuesta.editada && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-2">
                  Cambiaste el orden o las paradas: el recorrido y el costo se recalculan al guardar.
                </p>
              )}
              <ol className="flex flex-col gap-1 mb-3">
                <li className="text-xs text-gray-500 flex items-center gap-2"><span className="w-5 h-5 rounded bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">B</span>Sale de {bodega?.nombre}</li>
                {propuesta.paradas.map((p, i) => (
                  <li key={p.clave} className="flex items-start gap-2 py-1">
                    <span className="w-5 h-5 mt-0.5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium text-gray-800 truncate">{p.cliente}</div>
                      <div className="text-xs text-gray-500 truncate">{p.etiqueta}</div>
                      <div className="text-xs text-gray-400">{p.ordenes.map((o) => `OV #${o.id}`).join(" · ")}</div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Subir"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === propuesta.paradas.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Bajar"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => quitarParada(i)} className="p-1 text-gray-400 hover:text-red-600" title="Quitar de la ruta"><X className="w-4 h-4" /></button>
                    </div>
                  </li>
                ))}
                <li className="text-xs text-gray-500 flex items-center gap-2"><span className="w-5 h-5 rounded bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">B</span>Vuelve a {bodega?.nombre}</li>
              </ol>
              <label className="flex flex-col gap-1 text-sm text-gray-700 mb-3">
                Encargado de la ruta
                {transportistas.length ? (
                  <Selector
                    options={transportistas.map((t) => ({ value: String(t.id), label: t.nombre }))}
                    selectedValue={idTransportista}
                    onSelect={setIdTransportista}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                    No hay usuarios con el rol Transportista. Asígnalo en Administración → Usuarios.
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !propuesta.paradas.length || !idTransportista}
                className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {guardando ? "Guardando…" : propuesta.idRuta ? "Guardar cambios" : "Guardar ruta"}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Marca pedidos en la lista y aprieta <strong>Recomendar ruta</strong>, o apriétalo sin marcar nada para que el
              sistema tome los comprometidos hasta este día.
            </div>
          )}

          {/* ── Rutas del día ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Rutas del {fecha.split("-").reverse().join("-")}</h2>
            {rutas.length === 0 && <p className="text-sm text-gray-500">Todavía no hay rutas para este día.</p>}
            <ul className="flex flex-col gap-2">
              {rutas.map((r) => (
                <li key={r.id} className={`border rounded-lg p-3 ${r.estado === "Cancelada" ? "border-gray-200 opacity-60" : "border-gray-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <span className="font-medium text-gray-900">{r.transportista?.nombre ?? "Sin encargado"}</span>
                      <span className="text-xs text-gray-500">{r.estado}</span>
                    </div>
                    {r.estado === "Planificada" && puedeEscribir && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => editarRuta(r)} className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50">Editar</button>
                        <button type="button" onClick={() => setCancelando(r)} className="text-xs px-2 py-1 rounded-md text-red-700 hover:bg-red-50">Cancelar</button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {r.paradas.length} paradas · {formatearKm(r.km_planificados)} · {formatearMinutos(r.minutos_planificados)} · {CLP(r.costo_estimado)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {r.paradas.map((p, i) => `${i + 1}. ${p.cliente?.nombre_empresa || p.cliente?.razon_social}`).join(" → ")}
                  </div>
                  {r.estado === "Cancelada" && r.motivo_cancelacion && <div className="text-xs text-gray-500 mt-0.5">Cancelada: {r.motivo_cancelacion}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {buscando?.orden && (
        <ModalBuscarDireccion
          abierto
          onCerrar={() => setBuscando(null)}
          titulo={`¿A dónde va la OV #${buscando.orden.id}?`}
          contexto={[
            `${buscando.orden.cliente.nombre}${buscando.orden.cliente.entrega_por_pedido ? " · cada pedido trae su propia dirección" : ""}`,
            buscando.orden.comentario_cliente ? `Comentario del cliente: ${buscando.orden.comentario_cliente}` : null,
          ].filter(Boolean).join("\n")}
          idCliente={buscando.orden.cliente.entrega_por_pedido ? null : buscando.orden.cliente.id}
          idBodega={idBodega}
          onElegirLugar={async (lugar) => {
            await rutasApi.definirPuntoEntrega(buscando.orden.id, { lugar });
            toast.success(`Dirección de la OV #${buscando.orden.id} definida`);
            await cargarPendientes();
          }}
          onElegirDireccion={async (id) => {
            await rutasApi.definirPuntoEntrega(buscando.orden.id, { id_direccion: id });
            toast.success(`Dirección de la OV #${buscando.orden.id} definida`);
            await cargarPendientes();
          }}
        />
      )}
      {buscando?.bodega && (
        <ModalBuscarDireccion
          abierto
          onCerrar={() => setBuscando(null)}
          titulo={`¿Dónde queda la bodega ${buscando.bodega.nombre}?`}
          contexto={[buscando.bodega.direccion, buscando.bodega.comuna].filter(Boolean).join(", ")}
          onElegirLugar={async (lugar) => {
            const b = await rutasApi.ubicarBodega(buscando.bodega.id, lugar);
            setBodegas((prev) => prev.map((x) => (x.id === b.id ? { ...x, lat: b.lat, lng: b.lng } : x)));
            toast.success(`Bodega ${buscando.bodega.nombre} ubicada`);
          }}
        />
      )}

      <Modal
        abierto={Boolean(cancelando)}
        onCerrar={() => setCancelando(null)}
        titulo="Cancelar la ruta"
        descripcion="Sus pedidos quedan libres para otra ruta."
        pie={
          <>
            <button type="button" onClick={() => setCancelando(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
            <button
              type="button"
              onClick={confirmarCancelacion}
              disabled={motivo.trim().length < 3}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50"
            >
              Cancelar ruta
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          ¿Por qué se cancela?
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="px-3 py-2 border border-gray-300 rounded-lg" />
        </label>
      </Modal>
    </div>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div className="bg-gray-50 rounded-lg py-2">
      <div className="text-[11px] text-gray-500">{titulo}</div>
      <div className="text-sm font-semibold text-gray-900">{valor}</div>
    </div>
  );
}
