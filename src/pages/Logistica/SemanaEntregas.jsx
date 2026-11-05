import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Settings2, Route as IconoRuta } from "lucide-react";
import PageHeader from "../../components/UI/PageHeader";
import CargandoVista from "../../components/UI/CargandoVista";
import Selector from "../../components/Forms/Selector";
import ModalSectores from "../../components/Entregas/ModalSectores";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import * as rutasApi from "../../services/rutasService";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const SIN_SECTOR = "#9CA3AF";
const PASO_POOL = 30;

/** Fechas de calendario en texto AAAA-MM-DD, sin pasar por la zona horaria. */
const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hoyIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const lunesDe = (iso) => {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
};
const diaDelMes = (iso) => Number(iso.slice(8, 10));
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corto = (iso) => `${diaDelMes(iso)} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/**
 * Logística → Entregas → Semana (Fase B del planificador semanal, 2026-10-30). Los pedidos de la
 * semana por día, con el sector de su comuna. Arrastrar un pedido a otro día mueve su fecha de
 * entrega (queda registrado, sin avisos); «Armar ruta» abre el planificador del día con esos
 * pedidos marcados. Lo sin fecha o atrasado espera en «Por planificar».
 */
export default function SemanaEntregas() {
  const navigate = useNavigate();
  const [lunes, setLunes] = useState(() => lunesDe(hoyIso()));
  const [bodegas, setBodegas] = useState([]);
  const [idBodega, setIdBodega] = useState("");
  const [datos, setDatos] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [elegido, setElegido] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [editandoSectores, setEditandoSectores] = useState(false);
  const [verPool, setVerPool] = useState(PASO_POOL);
  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const dias = useMemo(() => DIAS.map((nombre, i) => ({ nombre, iso: sumarDias(lunes, i) })), [lunes]);
  const sabado = dias[5].iso;

  useEffect(() => {
    rutasApi.listarBodegas().then((bs) => {
      const lista = Array.isArray(bs) ? bs : [];
      setBodegas(lista);
      setIdBodega(String((lista.find((b) => b.nombre === "Santiago") ?? lista[0])?.id ?? ""));
    }).catch((e) => toast.error(e.message));
  }, []);

  const cargar = useCallback(async () => {
    if (!idBodega) return;
    try {
      const [s, r] = await Promise.all([rutasApi.leerSemana(idBodega), rutasApi.listarRutasRango(lunes, sabado)]);
      setDatos(s);
      setRutas((Array.isArray(r) ? r : []).filter((x) => String(x.id_bodega_origen) === String(idBodega) && x.estado !== "Cancelada"));
    } catch (e) {
      toast.error(e.message);
    }
  }, [idBodega, lunes, sabado]);
  useEffect(() => { cargar(); }, [cargar]);

  const sectores = datos?.sectores ?? [];
  const colorDe = (o) => sectores.find((s) => s.id === o.id_sector)?.color ?? SIN_SECTOR;
  const visible = (o) => filtro === "todos" || (filtro === "sin" ? o.id_sector == null : o.id_sector === filtro);
  const ordenes = datos?.ordenes ?? [];
  const hoy = hoyIso();
  // Lo más urgente primero: atrasado por fecha (las más viejas arriba) y después lo sin fecha.
  const porPlanificar = ordenes
    .filter((o) => !o.ruta && (!o.dia || o.dia < lunes))
    .sort((a, b) => (a.fecha_entrega ?? "9999").localeCompare(b.fecha_entrega ?? "9999") || b.id - a.id);
  const poolVisible = porPlanificar.filter(visible);
  const masAdelante = ordenes.filter((o) => o.dia && o.dia > sabado).length;

  const mover = async (orden, destino) => {
    setElegido(null);
    const fecha = destino === "pool" ? null : destino;
    if (orden.ruta) {
      toast.error(`La OV #${orden.id} va en la ruta #${orden.ruta.id}: sale ese día.`);
      return;
    }
    if ((orden.fecha_entrega ?? null) === fecha) return;
    const antes = datos;
    // Se ve al tiro; si el servidor lo rechaza, vuelve a como estaba.
    setDatos((d) => ({
      ...d,
      ordenes: d.ordenes.map((o) => (o.id === orden.id ? { ...o, fecha_entrega: fecha, dia: fecha, fecha_original: o.fecha_original ?? o.fecha_entrega } : o)),
    }));
    try {
      await rutasApi.moverFechaEntrega(orden.id, fecha);
    } catch (e) {
      setDatos(antes);
      toast.error(e.message);
    }
  };

  const soltar = (destino) => (e) => {
    e.preventDefault();
    setSobre(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    const o = ordenes.find((x) => x.id === id);
    if (o) mover(o, destino);
  };
  const zona = (destino) => ({
    onDragOver: (e) => { if (puedeEscribir) { e.preventDefault(); setSobre(destino); } },
    onDragLeave: () => setSobre((s) => (s === destino ? null : s)),
    onDrop: soltar(destino),
  });

  if (!datos) return <CargandoVista />;

  const tarjeta = (o) => {
    const movida = o.fecha_original && o.fecha_original !== o.fecha_entrega;
    const atrasada = !o.ruta && o.fecha_entrega && o.fecha_entrega < hoy;
    return (
      <div
        key={o.id}
        draggable={puedeEscribir && !o.ruta}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(o.id))}
        onClick={() => puedeEscribir && !o.ruta && setElegido((x) => (x === o.id ? null : o.id))}
        role="button"
        tabIndex={0}
        aria-pressed={elegido === o.id}
        className={`rounded-lg border bg-white px-2 py-1.5 text-xs flex flex-col gap-0.5 select-none ${o.ruta ? "cursor-default opacity-80" : "cursor-grab"} ${elegido === o.id ? "ring-2 ring-primary" : "border-gray-200"}`}
        style={{ borderLeft: `4px solid ${colorDe(o)}` }}
        title={o.ruta ? `Ruta #${o.ruta.id}${o.ruta.transportista ? ` · ${o.ruta.transportista}` : ""}` : undefined}
      >
        <span className="font-semibold text-gray-800 text-[13px] leading-tight truncate">{o.cliente.nombre}</span>
        <span className="text-gray-500 truncate">#{o.id}{o.comuna ? ` · ${o.comuna}` : ""}</span>
        {(movida || atrasada || o.ruta || o.estado_direccion === "falta") && (
          <span className="flex flex-wrap gap-1 mt-0.5">
            {o.ruta && <span className="px-1 rounded bg-sky-50 text-sky-700 font-semibold inline-flex items-center gap-0.5"><IconoRuta className="w-3 h-3" />#{o.ruta.id}</span>}
            {movida && <span className="px-1 rounded bg-amber-50 text-amber-700 font-semibold" title={`Comprometida para el ${corto(o.fecha_original)}`}>↺ {corto(o.fecha_original)}</span>}
            {atrasada && <span className="px-1 rounded bg-red-50 text-red-700 font-semibold">atrasada</span>}
            {o.estado_direccion === "falta" && <span className="px-1 rounded bg-red-50 text-red-700 font-semibold">sin dirección</span>}
          </span>
        )}
      </div>
    );
  };

  const elegidaOrden = ordenes.find((o) => o.id === elegido);

  return (
    <div className="p-4 sm:p-6 bg-background min-h-screen flex flex-col gap-4">
      <PageHeader
        volverA="/Logistica/entregas"
        titulo="Semana de entregas"
        tituloAyuda="Semana de entregas"
        ayuda={
          <>
            <p>Arrastra un pedido a otro día (o tócalo y elige el día) para mover su fecha de entrega. Queda registrado, sin avisos.</p>
            <p>Un pedido que ya va en una ruta sale el día de la ruta. «Armar ruta» abre el planificador del día con sus pedidos.</p>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
          <button type="button" className="p-2 hover:bg-gray-50" onClick={() => setLunes((l) => sumarDias(l, -7))} aria-label="Semana anterior"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-2 text-sm font-medium tabular-nums">{corto(lunes)} – {corto(sabado)}</span>
          <button type="button" className="p-2 hover:bg-gray-50" onClick={() => setLunes((l) => sumarDias(l, 7))} aria-label="Semana siguiente"><ChevronRight className="w-4 h-4" /></button>
        </div>
        {lunes !== lunesDe(hoy) && (
          <button type="button" onClick={() => setLunes(lunesDe(hoy))} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Hoy</button>
        )}
        <div className="w-40">
          <Selector options={bodegas.map((b) => ({ value: String(b.id), label: b.nombre }))} selectedValue={idBodega} onSelect={setIdBodega} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sector">
          {[{ id: "todos", nombre: "Todos" }, ...sectores, { id: "sin", nombre: "Sin sector", color: SIN_SECTOR }].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFiltro(s.id)}
              title={s.comunas?.length ? s.comunas.join(", ") : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm ${filtro === s.id ? "bg-primary border-primary text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              {s.color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />}
              {s.nombre}
            </button>
          ))}
          {puedeEscribir && (
            <button type="button" onClick={() => setEditandoSectores(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Editar sectores">
              <Settings2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {masAdelante > 0 && <span className="ml-auto text-xs text-gray-500">{masAdelante} más adelante</span>}
      </div>

      <div className="grid gap-2 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <div {...zona("pool")} className={`rounded-xl border border-dashed p-2 flex flex-col gap-1.5 min-h-[120px] ${sobre === "pool" ? "bg-primary/5 border-primary" : "border-gray-300"}`}>
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold text-gray-800">Por planificar</span>
            <span className="text-xs text-gray-500 tabular-nums">{poolVisible.length}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto pr-0.5">
            {poolVisible.slice(0, verPool).map(tarjeta)}
            {poolVisible.length > verPool && (
              <button type="button" onClick={() => setVerPool((n) => n + PASO_POOL)} className="text-xs text-primary py-1 hover:underline">
                Ver {Math.min(PASO_POOL, poolVisible.length - verPool)} más ({poolVisible.length - verPool})
              </button>
            )}
          </div>
          {elegidaOrden && !elegidaOrden.ruta && elegidaOrden.dia && (
            <button type="button" onClick={() => mover(elegidaOrden, "pool")} className="text-xs rounded-lg border border-gray-300 py-1 hover:bg-gray-50">Quitar fecha</button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-2 overflow-x-auto min-w-0" style={{ gridTemplateColumns: "repeat(6, minmax(130px, 1fr))" }}>
          {dias.map((d) => {
            const delDia = ordenes.filter((o) => o.dia === d.iso);
            const rutasDia = rutas.filter((r) => r.fecha === d.iso);
            const sinRuta = delDia.filter((o) => !o.ruta);
            const esHoy = d.iso === hoy;
            return (
              <div
                key={d.iso}
                {...zona(d.iso)}
                className={`rounded-xl border bg-white p-2 flex flex-col gap-1.5 min-h-[260px] ${sobre === d.iso ? "bg-primary/5 border-primary" : esHoy ? "border-primary/50" : "border-gray-200"} ${d.nombre === "Sáb" ? "opacity-80" : ""}`}
              >
                <div className="flex items-baseline justify-between px-0.5">
                  <span className={`text-sm font-semibold ${esHoy ? "text-primary" : "text-gray-800"}`}>{d.nombre} {diaDelMes(d.iso)}</span>
                  {delDia.length > 0 && <span className="text-xs text-gray-500 tabular-nums">{delDia.length}</span>}
                </div>
                {rutasDia.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(`/Logistica/entregas/${r.id}`)}
                    className="text-left text-[11px] rounded-md bg-sky-50 text-sky-800 px-1.5 py-1 hover:bg-sky-100 truncate"
                  >
                    Ruta #{r.id} · {r.paradas?.length ?? 0} paradas{r.transportista?.nombre ? ` · ${r.transportista.nombre}` : ""}
                  </button>
                ))}
                {delDia.filter(visible).map(tarjeta)}
                <div className="mt-auto pt-1">
                  {elegidaOrden && !elegidaOrden.ruta ? (
                    <button type="button" onClick={() => mover(elegidaOrden, d.iso)} className="w-full text-xs rounded-lg bg-primary text-white py-1 hover:bg-primary-dark">Mover aquí</button>
                  ) : (
                    puedeEscribir && sinRuta.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`/Logistica/entregas/planificar?fecha=${d.iso}&ordenes=${sinRuta.map((o) => o.id).join(",")}`)}
                        className="w-full text-xs rounded-lg border border-gray-300 py-1 hover:bg-gray-50"
                      >
                        Armar ruta
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editandoSectores && (
        <ModalSectores
          sectores={sectores}
          comunasConocidas={[...new Set(ordenes.map((o) => o.comuna).filter(Boolean))].sort()}
          onCerrar={() => setEditandoSectores(false)}
          onCambio={cargar}
        />
      )}
    </div>
  );
}
