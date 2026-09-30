import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPinned, Store, Globe, Copy, Pencil } from "lucide-react";
import PageHeader from "../../components/UI/PageHeader";
import KpiCard from "../../components/UI/KpiCard";
import Tabs from "../../components/UI/Tabs";
import CargandoVista from "../../components/UI/CargandoVista";
import UbicacionBadge from "../../components/Mapas/UbicacionBadge";
import ModalUbicar from "../../components/Mapas/ModalUbicar";
import ModalDireccionEntrega from "../../components/Mapas/ModalDireccionEntrega";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import {
  accionesUbicarDireccion,
  accionesUbicarEntrega,
  copiarComoDespacho,
  ubicacionDeDireccion,
  ubicacionDeEntrega,
} from "../../services/ubicacionService";

/**
 * Direcciones para rutear (rutas de entrega, Fase 0 — plan `PLAN_RUTAS_ENTREGA.md` §12).
 *
 * Una ruta sólo puede pasar por lugares que están en el mapa. Esta vista junta todo lo que falta
 * para eso, con la acción para arreglarlo al lado:
 * - Clientes activos sin dirección de Despacho, con la de Facturación a un clic de copiarse.
 * - Direcciones de Despacho sin ubicar o con ubicación dudosa.
 * - Pedidos de clientes con dirección por pedido (la tienda web) sin dirección o sin ubicar.
 *
 * El criterio para dar por cerrada la Fase 0 está arriba: clientes listos contra la meta.
 */

const ESTADOS_CLIENTE = {
  sin_despacho: { texto: "Sin dirección de despacho", clase: "bg-red-50 text-red-700 border-red-200" },
  despacho_sin_ubicar: { texto: "Despacho sin ubicar", clase: "bg-red-50 text-red-700 border-red-200" },
  despacho_dudoso: { texto: "Ubicación dudosa", clase: "bg-amber-50 text-amber-800 border-amber-200" },
  listo: { texto: "Listo para rutear", clase: "bg-green-50 text-green-800 border-green-200" },
};

const ESTADOS_PEDIDO = {
  sin_direccion: { texto: "Sin dirección", clase: "bg-red-50 text-red-700 border-red-200" },
  sin_ubicar: { texto: "Sin ubicar", clase: "bg-red-50 text-red-700 border-red-200" },
  dudosa: { texto: "Ubicación dudosa", clase: "bg-amber-50 text-amber-800 border-amber-200" },
  lista: { texto: "Lista", clase: "bg-green-50 text-green-800 border-green-200" },
};

const Chip = ({ estado, mapa }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${mapa[estado].clase}`}>
    {mapa[estado].texto}
  </span>
);

const textoDireccion = (d) =>
  [[d.calle, d.numero].filter(Boolean).join(" "), d.comuna].filter(Boolean).join(", ");

const FILTROS = [
  { id: "pendientes", label: "Por corregir" },
  { id: "listo", label: "Listos" },
  { id: "todos", label: "Todos" },
];

export default function DireccionesPorCorregir() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState("clientes");
  const [filtro, setFiltro] = useState("pendientes");
  const [ubicando, setUbicando] = useState(null); // { titulo, texto, actual, acciones }
  const [editandoEntrega, setEditandoEntrega] = useState(null); // orden
  const [copiando, setCopiando] = useState(null);

  const puedeEscribirDireccion = checkScope(ModelType.DIRECCION, ScopeType.WRITE);
  const puedeEscribirOV = checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api("/direcciones/por-corregir"));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const clientes = useMemo(() => {
    const lista = datos?.clientes ?? [];
    if (filtro === "todos") return lista;
    if (filtro === "listo") return lista.filter((c) => c.estado === "listo");
    return lista.filter((c) => c.estado !== "listo");
  }, [datos, filtro]);

  const pedidos = useMemo(() => {
    const lista = datos?.pedidos ?? [];
    if (filtro === "todos") return lista;
    if (filtro === "listo") return lista.filter((p) => p.estado_ruteo === "lista");
    return lista.filter((p) => p.estado_ruteo !== "lista");
  }, [datos, filtro]);

  if (cargando) return <CargandoVista />;
  const c = datos?.criterio ?? {};
  const pendientesClientes = (datos?.clientes ?? []).filter((x) => x.estado !== "listo").length;
  const pendientesPedidos = (datos?.pedidos ?? []).filter((x) => x.estado_ruteo !== "lista").length;

  const abrirUbicarDireccion = (d, cliente) =>
    setUbicando({
      titulo: `${cliente} · ${d.nombre_sucursal || d.tipo_direccion}`,
      texto: [textoDireccion(d), d.region].filter(Boolean).join(", "),
      actual: ubicacionDeDireccion(d),
      acciones: accionesUbicarDireccion(d.id),
    });

  const abrirUbicarEntrega = (p) =>
    setUbicando({
      titulo: `OV #${p.id} · ${p.entrega_destinatario || p.cliente}`,
      texto: [p.entrega_direccion, p.entrega_comuna, p.entrega_region].filter(Boolean).join(", "),
      actual: ubicacionDeEntrega(p),
      acciones: accionesUbicarEntrega(p.id),
    });

  const copiar = async (d) => {
    setCopiando(d.id);
    try {
      await copiarComoDespacho(d.id);
      toast.success("Copiada como dirección de despacho");
      await cargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCopiando(null);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <PageHeader
        titulo="Direcciones para rutear"
        subtitulo="Una ruta sólo puede pasar por lugares que están en el mapa. Acá está todo lo que falta ubicar o corregir antes de armar rutas."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<Store className="w-5 h-5 text-gray-400" />}
          label="Clientes listos para rutear"
          value={`${c.porcentaje ?? 0} %`}
          subtitle={`${c.clientes_listos ?? 0} de ${c.clientes_activos ?? 0} clientes con pedidos en ${c.dias_cliente_activo ?? 60} días · meta ${c.meta ?? 95} %`}
          accent={(c.porcentaje ?? 0) >= (c.meta ?? 95) ? "green" : "yellow"}
        />
        <KpiCard
          icon={<Globe className="w-5 h-5 text-gray-400" />}
          label="Pedidos con dirección propia"
          value={`${c.pedidos_listos ?? 0} / ${c.pedidos_vivos ?? 0}`}
          subtitle={
            (c.clientes_por_pedido ?? []).length
              ? `Listos, de ${(c.clientes_por_pedido ?? []).map((x) => x.nombre).join(", ")} en ${c.dias_pedidos_vivos ?? 14} días`
              : "Ningún cliente marcado con «cada pedido trae su dirección»"
          }
          accent={c.pedidos_vivos && c.pedidos_listos < c.pedidos_vivos ? "yellow" : "green"}
        />
        <KpiCard
          icon={<MapPinned className="w-5 h-5 text-gray-400" />}
          label="Por corregir"
          value={pendientesClientes + pendientesPedidos}
          subtitle={`${pendientesClientes} clientes · ${pendientesPedidos} pedidos`}
          accent={pendientesClientes + pendientesPedidos ? "red" : "green"}
        />
      </div>

      <Tabs
        pestanas={[
          { id: "clientes", label: "Clientes", cantidad: pendientesClientes },
          { id: "pedidos", label: "Pedidos con dirección propia", cantidad: pendientesPedidos },
        ]}
        activa={pestana}
        onCambiar={setPestana}
      />

      <div className="flex gap-2 mb-4">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1 rounded-full text-sm border ${filtro === f.id ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pestana === "clientes" && (
        <div className="flex flex-col gap-3">
          {clientes.length === 0 && (
            <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">Nada por acá.</p>
          )}
          {clientes.map((cli) => {
            const despachos = cli.direcciones.filter((d) => d.tipo_direccion === "Despacho");
            const otras = cli.direcciones.filter((d) => d.tipo_direccion !== "Despacho");
            return (
              <div key={cli.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/clientes/${cli.id}`} className="font-semibold text-gray-900 hover:text-primary">
                      {cli.nombre}
                    </Link>
                    <Chip estado={cli.estado} mapa={ESTADOS_CLIENTE} />
                    <span className="text-xs text-gray-500">{cli.ov_30d} OV en 30 días</span>
                  </div>
                  {puedeEscribirDireccion && (
                    <Link to={`/clientes/${cli.id}/edit`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Pencil className="w-3 h-3" /> Editar direcciones del cliente
                    </Link>
                  )}
                </div>

                {cli.ov_30d_a_no_despacho > 0 && despachos.length > 0 && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-2">
                    {cli.ov_30d_a_no_despacho} de sus {cli.ov_30d} OV recientes se despacharon a una dirección que no es de
                    despacho. Las próximas se facturan eligiendo la de despacho.
                  </p>
                )}
                {cli.estado === "sin_despacho" && (
                  <p className="text-xs text-gray-600 mb-2">
                    No tiene dirección de despacho. Si recibe donde factura, cópiala; si no, agrégala en su ficha.
                  </p>
                )}

                <ul className="flex flex-col divide-y divide-gray-100">
                  {[...despachos, ...otras].map((d) => (
                    <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`text-xs font-medium mr-2 ${d.tipo_direccion === "Despacho" ? "text-primary" : "text-gray-500"}`}>
                          {d.tipo_direccion}
                        </span>
                        <span className="text-sm text-gray-800">
                          {d.nombre_sucursal ? `${d.nombre_sucursal} — ` : ""}
                          {textoDireccion(d) || "(sin calle)"}
                        </span>
                        {d.geo_direccion_formateada && !d.confiable && (
                          <div className="text-xs text-gray-500">Google: {d.geo_direccion_formateada}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.tipo_direccion === "Despacho" && (
                          <UbicacionBadge
                            lat={d.lat}
                            lng={d.lng}
                            precision={d.geo_precision}
                            onClick={puedeEscribirDireccion ? () => abrirUbicarDireccion(d, cli.nombre) : undefined}
                          />
                        )}
                        {d.tipo_direccion !== "Despacho" && cli.estado === "sin_despacho" && puedeEscribirDireccion && (
                          <button
                            type="button"
                            onClick={() => copiar(d)}
                            disabled={copiando === d.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Copy className="w-3 h-3" /> Usar como despacho
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {cli.direcciones.length === 0 && <li className="py-2 text-sm text-gray-500">Sin direcciones registradas.</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {pestana === "pedidos" && (
        <div className="flex flex-col gap-3">
          {(c.clientes_por_pedido ?? []).length === 0 && (
            <p className="text-sm text-gray-600 bg-white rounded-xl border border-gray-200 p-4">
              Ningún cliente está marcado con <strong>«Cada pedido trae su propia dirección de entrega»</strong>. Se marca en
              la ficha del cliente (por ejemplo, la tienda web).
            </p>
          )}
          {(c.clientes_por_pedido ?? []).length > 0 && pedidos.length === 0 && (
            <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">Nada por acá.</p>
          )}
          {pedidos.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/ventas/ordenes/${p.id}`} className="font-semibold text-gray-900 hover:text-primary">
                    OV #{p.id}
                  </Link>
                  <span className="text-sm text-gray-600">{p.cliente}{p.numero_oc ? ` · pedido ${p.numero_oc}` : ""}</span>
                  <span className="text-xs text-gray-500">{p.estado}</span>
                  <Chip estado={p.estado_ruteo} mapa={ESTADOS_PEDIDO} />
                </div>
                <div className="flex items-center gap-2">
                  {p.entrega_direccion && (
                    <UbicacionBadge
                      lat={p.entrega_lat}
                      lng={p.entrega_lng}
                      precision={p.entrega_geo_precision}
                      onClick={puedeEscribirOV ? () => abrirUbicarEntrega(p) : undefined}
                    />
                  )}
                  {puedeEscribirOV && (
                    <button
                      type="button"
                      onClick={() => setEditandoEntrega(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      <Pencil className="w-3 h-3" /> {p.entrega_direccion ? "Editar dirección" : "Escribir dirección"}
                    </button>
                  )}
                </div>
              </div>
              {p.entrega_direccion ? (
                <p className="text-sm text-gray-800">
                  {[p.entrega_direccion, p.entrega_referencia, p.entrega_comuna].filter(Boolean).join(", ")}
                  {p.entrega_destinatario && <span className="text-gray-500"> · {p.entrega_destinatario}</span>}
                </p>
              ) : p.comentario_cliente ? (
                <p className="text-xs text-gray-600 whitespace-pre-line bg-gray-50 rounded-md px-2 py-1">
                  <span className="font-medium">Comentario del cliente: </span>
                  {p.comentario_cliente}
                </p>
              ) : (
                <p className="text-xs text-gray-500">El pedido no trae comentario: la dirección está en el correo o en la tienda web.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {ubicando && (
        <ModalUbicar
          abierto
          onCerrar={() => setUbicando(null)}
          titulo={ubicando.titulo}
          texto={ubicando.texto}
          actual={ubicando.actual}
          onBuscar={ubicando.acciones.onBuscar}
          onGuardarPin={ubicando.acciones.onGuardarPin}
          onCambio={() => cargar()}
        />
      )}
      <ModalDireccionEntrega
        abierto={Boolean(editandoEntrega)}
        onCerrar={() => setEditandoEntrega(null)}
        orden={editandoEntrega}
        onGuardada={() => cargar()}
      />
    </div>
  );
}
