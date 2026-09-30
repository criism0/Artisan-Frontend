import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Ban, ListPlus, Pencil, X } from "lucide-react";
import PageHeader from "../../components/UI/PageHeader";
import PanelAcciones from "../../components/UI/PanelAcciones";
import CargandoVista from "../../components/UI/CargandoVista";
import Selector from "../../components/Forms/Selector";
import MapaRuta from "../../components/Entregas/MapaRuta";
import EstadoRuta from "../../components/Entregas/EstadoRuta";
import ModalCancelarRuta from "../../components/Entregas/ModalCancelarRuta";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import * as rutasApi from "../../services/rutasService";
import {
  formatearCLP,
  formatearFecha,
  formatearKm,
  formatearMinutos,
  paradasDeRutaGuardada,
  pedidosDeRuta,
} from "../../utils/rutas";

/**
 * Detalle de una ruta de entrega: el mapa, las paradas en orden con sus pedidos, y quién la
 * hace. Mientras esté Planificada se edita acá mismo (día, encargado, comentario, orden y
 * paradas); agregar pedidos nuevos se hace en el planificador, que tiene la lista de pendientes.
 */
export default function RutaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [ruta, setRuta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [transportistas, setTransportistas] = useState([]);
  const [borrador, setBorrador] = useState(null); // { fecha, idTransportista, comentario, paradas, paradasCambiadas }
  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);
  const editable = puedeEscribir && ruta?.estado === "Planificada";

  const cargar = useCallback(async () => {
    try {
      setRuta(await rutasApi.obtenerRuta(id));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!puedeEscribir) return;
    rutasApi.listarTransportistas().then((t) => setTransportistas(Array.isArray(t) ? t : [])).catch(() => {});
  }, [puedeEscribir]);

  const empezarEdicion = useCallback(() => {
    if (!ruta) return;
    setBorrador({
      fecha: ruta.fecha,
      idTransportista: ruta.id_transportista ? String(ruta.id_transportista) : "",
      comentario: ruta.comentario ?? "",
      paradas: paradasDeRutaGuardada(ruta),
      paradasCambiadas: false,
    });
  }, [ruta]);

  // Desde la lista, «Editar» abre el detalle ya en edición.
  useEffect(() => {
    if (params.get("editar") && editable && !borrador) {
      empezarEdicion();
      setParams({}, { replace: true });
    }
  }, [params, editable, borrador, empezarEdicion, setParams]);

  const paradasGuardadas = useMemo(() => paradasDeRutaGuardada(ruta), [ruta]);
  const paradas = borrador?.paradas ?? paradasGuardadas;

  const mover = (i, delta) =>
    setBorrador((b) => {
      const ps = [...b.paradas];
      const j = i + delta;
      if (j < 0 || j >= ps.length) return b;
      [ps[i], ps[j]] = [ps[j], ps[i]];
      return { ...b, paradas: ps, paradasCambiadas: true };
    });

  const quitar = (i) => setBorrador((b) => ({ ...b, paradas: b.paradas.filter((_, k) => k !== i), paradasCambiadas: true }));

  const guardar = async () => {
    if (!borrador.paradas.length) {
      toast.error("La ruta quedó sin paradas. Para dejarla sin pedidos, cancélala.");
      return;
    }
    if (!borrador.idTransportista) {
      toast.error("Elige quién va a hacer la ruta.");
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        fecha: borrador.fecha,
        id_transportista: Number(borrador.idTransportista),
        comentario: borrador.comentario,
      };
      if (borrador.paradasCambiadas) datos.paradas = borrador.paradas.map((p) => ({ ordenes: p.ordenes.map((o) => o.id) }));
      setRuta(await rutasApi.actualizarRuta(ruta.id, datos));
      setBorrador(null);
      toast.success("Ruta actualizada");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <CargandoVista />;
  if (!ruta) {
    return (
      <div className="p-6">
        <PageHeader volverA="/Logistica/entregas" titulo="Ruta no encontrada" />
      </div>
    );
  }

  const acciones = !editable ? null : borrador ? (
    <PanelAcciones
      principal={{ label: guardando ? "Guardando…" : "Guardar cambios", onClick: guardar, disabled: guardando }}
      secundarias={[{ label: "Descartar cambios", onClick: () => setBorrador(null), disabled: guardando }]}
    />
  ) : (
    <PanelAcciones
      principal={{ label: "Editar", icon: <Pencil className="w-4 h-4" />, onClick: empezarEdicion }}
      secundarias={[
        {
          label: "Agregar o quitar pedidos",
          icon: <ListPlus className="w-4 h-4" />,
          title: "Abre el planificador con esta ruta y la lista de pedidos pendientes",
          onClick: () => navigate(`/Logistica/entregas/planificar?ruta=${ruta.id}`),
        },
      ]}
      destructivas={[{ label: "Cancelar ruta", icon: <Ban className="w-4 h-4" />, onClick: () => setCancelando(true) }]}
    />
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <PageHeader
        volverA="/Logistica/entregas"
        titulo={`Ruta #${ruta.id}`}
        estado={<EstadoRuta estado={ruta.estado} />}
        subtitulo={`${formatearFecha(ruta.fecha)} · sale de ${ruta.bodega?.nombre ?? "—"}`}
        acciones={acciones}
      />

      {ruta.estado === "Cancelada" && (
        <div className="mb-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          Cancelada{ruta.cancelador?.nombre ? ` por ${ruta.cancelador.nombre}` : ""}
          {ruta.cancelada_en ? ` el ${new Date(ruta.cancelada_en).toLocaleString("es-CL")}` : ""}
          {ruta.motivo_cancelacion ? `: ${ruta.motivo_cancelacion}` : ""}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Dato titulo="Paradas" valor={paradas.length} />
        <Dato titulo="Pedidos" valor={borrador ? paradas.reduce((n, p) => n + p.ordenes.length, 0) : pedidosDeRuta(ruta)} />
        <Dato titulo="Recorrido" valor={formatearKm(ruta.km_planificados)} />
        <Dato titulo="Tiempo manejando" valor={formatearMinutos(ruta.minutos_planificados)} />
        <Dato titulo="Costo" valor={formatearCLP(ruta.costo_estimado)} detalle={ruta.costo_km ? `${formatearCLP(ruta.costo_km)} / km` : null} />
      </div>
      {borrador?.paradasCambiadas && (
        <p className="mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Cambiaste el orden o las paradas: el recorrido, el tiempo y el costo se recalculan al guardar.
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 text-sm">
            <h2 className="font-semibold text-gray-900">Datos de la ruta</h2>
            <Campo titulo="Día">
              {borrador ? (
                <input
                  type="date"
                  value={borrador.fecha}
                  onChange={(e) => setBorrador((b) => ({ ...b, fecha: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                formatearFecha(ruta.fecha)
              )}
            </Campo>
            <Campo titulo="Encargado">
              {borrador ? (
                transportistas.length ? (
                  <Selector
                    options={transportistas.map((t) => ({ value: String(t.id), label: rutasApi.etiquetaEncargado(t) }))}
                    selectedValue={borrador.idTransportista}
                    onSelect={(v) => setBorrador((b) => ({ ...b, idTransportista: v }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ) : (
                  <span className="text-xs text-amber-800">No hay usuarios que puedan hacerse cargo de una ruta.</span>
                )
              ) : (
                ruta.transportista?.nombre ?? <span className="text-gray-400">Sin encargado</span>
              )}
            </Campo>
            <Campo titulo="Sale de y vuelve a">{ruta.bodega?.nombre ?? "—"}</Campo>
            <Campo titulo="Comentario">
              {borrador ? (
                <textarea
                  value={borrador.comentario}
                  onChange={(e) => setBorrador((b) => ({ ...b, comentario: e.target.value }))}
                  rows={3}
                  placeholder="Indicaciones para el chofer"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                ruta.comentario || <span className="text-gray-400">—</span>
              )}
            </Campo>
            <Campo titulo="Creada">
              {new Date(ruta.createdAt).toLocaleString("es-CL")}
              {ruta.creador?.nombre ? ` por ${ruta.creador.nombre}` : ""}
            </Campo>
          </div>
        </div>

        <div className="xl:col-span-2 flex flex-col gap-4">
          <MapaRuta
            bodega={ruta.bodega}
            paradas={paradas}
            polilinea={borrador?.paradasCambiadas ? null : ruta.polilinea}
          />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Paradas</h2>
            <ol className="flex flex-col divide-y divide-gray-100">
              <li className="text-xs text-gray-500 flex items-center gap-2 py-2">
                <Marca>B</Marca>Sale de {ruta.bodega?.nombre}
              </li>
              {paradas.map((p, i) => (
                <li key={p.clave} className="flex items-start gap-3 py-2.5">
                  <span className="w-6 h-6 mt-0.5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium text-gray-900">{p.cliente}</div>
                    <div className="text-xs text-gray-500">{p.etiqueta}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {p.ordenes.map((o) => (
                        <span key={o.id} className="text-gray-600">
                          <Link to={`/ventas/ordenes/${o.id}`} className="font-medium text-primary hover:underline">OV #{o.id}</Link>
                          {o.numero_oc ? ` · OC ${o.numero_oc}` : ""}
                          {o.fecha_entrega ? ` · entrega ${formatearFecha(o.fecha_entrega)}` : ""}
                          {o.estado ? ` · ${o.estado}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  {borrador && (
                    <div className="flex items-center shrink-0">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Subir"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === paradas.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Bajar"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => quitar(i)} className="p-1 text-gray-400 hover:text-red-600" title="Quitar de la ruta (sus pedidos quedan libres)"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </li>
              ))}
              <li className="text-xs text-gray-500 flex items-center gap-2 py-2">
                <Marca>B</Marca>Vuelve a {ruta.bodega?.nombre}
              </li>
            </ol>
          </div>
        </div>
      </div>

      <ModalCancelarRuta ruta={cancelando ? ruta : null} onCerrar={() => setCancelando(false)} onCancelada={cargar} />
    </div>
  );
}

function Dato({ titulo, valor, detalle }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className="text-lg font-semibold text-gray-900">{valor}</div>
      {detalle && <div className="text-xs text-gray-400">{detalle}</div>}
    </div>
  );
}

function Campo({ titulo, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{titulo}</span>
      <div className="text-gray-800">{children}</div>
    </div>
  );
}

function Marca({ children }) {
  return <span className="w-5 h-5 rounded bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">{children}</span>;
}
