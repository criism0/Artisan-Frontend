import { useEffect, useState } from "react";
import { MapPin, Search, Building2, Star } from "lucide-react";
import Modal from "../UI/Modal";
import { api } from "../../lib/api";
import useAutocompletarLugar from "../../hooks/useAutocompletarLugar";
import { toast } from "../../lib/toast.js";

/**
 * Definir a dónde va un pedido buscando como en la barra de Google Maps: las sugerencias van
 * apareciendo mientras se escribe una dirección o el nombre de un lugar («Encomenderos 65», «CD
 * Cencosud San Pablo») y al elegir una se trae su punto exacto.
 *
 * Si hay `idCliente`, arriba aparecen sus direcciones de despacho ya registradas: elegir una es
 * lo más común y no gasta una búsqueda. Lo que se elige es SÓLO para este pedido; aparte se puede
 * marcar como la dirección de despacho predeterminada del cliente (decisión de Cristóbal,
 * 2026-10-21), que el planificador usa para sus pedidos sin dirección de despacho propia.
 *
 * - `onElegirLugar(lugar, { guardarEnCliente, predeterminada })`: guarda un lugar del buscador.
 *   Al elegirlo se pregunta si queda en las direcciones del cliente o sólo para este pedido.
 * - `onElegirDireccion(id, { predeterminada })`: guarda una dirección del cliente (opcional).
 */
export default function ModalBuscarDireccion({
  abierto,
  onCerrar,
  titulo,
  contexto,
  idCliente,
  nombreCliente,
  idBodega,
  onElegirLugar,
  onElegirDireccion,
}) {
  const { texto, setTexto, sugerencias, buscando, elegir: detalle } = useAutocompletarLugar({ activo: abierto, idBodega });
  const [guardando, setGuardando] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [direcciones, setDirecciones] = useState([]);
  const [elegido, setElegido] = useState(null); // lugar del buscador esperando «dónde se guarda»
  const [predeterminada, setPredeterminada] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTexto("");
    setDirecciones([]);
    setElegido(null);
    setPredeterminada(false);
    if (idCliente && onElegirDireccion) {
      api(`/direcciones/cliente/${idCliente}`)
        .then((ds) => setDirecciones((Array.isArray(ds) ? ds : []).filter((d) => d.tipo_direccion === "Despacho")))
        .catch(() => setDirecciones([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, idCliente, onElegirDireccion]);

  const elegir = async (accion) => {
    setGuardando(true);
    try {
      await accion();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const tomarSugerencia = async (s) => {
    setTrayendo(true);
    try {
      const lugar = await detalle(s);
      if (idCliente) setElegido(lugar);
      else await elegir(() => onElegirLugar(lugar, { guardarEnCliente: false, predeterminada: false }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTrayendo(false);
    }
  };

  const ocupado = guardando || trayendo;

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="max-w-xl">
      <div className="flex flex-col gap-4">
        {contexto && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 whitespace-pre-line">{contexto}</div>
        )}

        {idCliente && onElegirDireccion && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={predeterminada} onChange={(e) => setPredeterminada(e.target.checked)} />
            <span>
              Usar también como la dirección de despacho <strong>predeterminada</strong>{nombreCliente ? ` de ${nombreCliente}` : " del cliente"}
              <span className="block text-xs text-gray-500">
                Se usa en sus pedidos que no tienen dirección de despacho propia (los que apuntan a la de facturación). Este pedido
                siempre queda con la que elijas.
              </span>
            </span>
          </label>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Buscar la dirección</span>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              autoFocus
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setElegido(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sugerencias[0] && !ocupado) {
                  e.preventDefault();
                  tomarSugerencia(sugerencias[0]);
                }
              }}
              placeholder="Escribe la dirección o el lugar: «Encomenderos 65», «CD Cencosud San Pablo»…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {(buscando || trayendo) && <span className="text-xs text-gray-400">{trayendo ? "Ubicando…" : "Buscando…"}</span>}
          {!buscando && !elegido && texto.trim().length >= 3 && sugerencias.length === 0 && (
            <span className="text-xs text-gray-500">Sin resultados. Prueba con la comuna o el nombre del lugar.</span>
          )}
          {elegido && (
            <div className="mt-2 flex flex-col gap-2 border border-primary/30 bg-primary/5 rounded-lg p-3">
              <span className="text-sm text-gray-800">
                <MapPin className="w-4 h-4 inline -mt-0.5 mr-1 text-primary" />
                {elegido.nombre ? `${elegido.nombre} — ` : ""}{elegido.direccion_formateada}
              </span>
              <span className="text-xs text-gray-600">¿Dónde se guarda?</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => elegir(() => onElegirLugar(elegido, { guardarEnCliente: true, predeterminada }))}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                  title="Queda como dirección de despacho del cliente, para usarla en otros pedidos"
                >
                  En las direcciones del cliente
                </button>
                <button
                  type="button"
                  disabled={ocupado || predeterminada}
                  onClick={() => elegir(() => onElegirLugar(elegido, { guardarEnCliente: false, predeterminada: false }))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                  title={predeterminada ? "Una dirección «sólo para este pedido» no puede ser la predeterminada del cliente" : "La casa de un comprador de la tienda web, un despacho puntual: la ficha del cliente no se toca"}
                >
                  Sólo para este pedido
                </button>
                <button type="button" onClick={() => setElegido(null)} className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                  Volver
                </button>
              </div>
            </div>
          )}
          <div className={`flex flex-col gap-1 mt-1 ${elegido ? "hidden" : ""}`}>
            {sugerencias.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={ocupado}
                onClick={() => tomarSugerencia(s)}
                className="flex items-start gap-2 text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span className="text-sm">
                  <span className="block font-medium text-gray-800">{s.principal}</span>
                  {s.secundario && <span className="text-gray-500">{s.secundario}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        {direcciones.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">O una dirección de despacho guardada del cliente</span>
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
              {direcciones.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => elegir(() => onElegirDireccion(d.id, { predeterminada }))}
                  className="flex items-start gap-2 text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                >
                  <Building2 className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                  <span className="text-sm flex-1">
                    <span className="font-medium text-gray-800">{d.nombre_sucursal || "Despacho"}</span>
                    <span className="text-gray-600"> — {[[d.calle, d.numero].filter(Boolean).join(" "), d.comuna].filter(Boolean).join(", ")}</span>
                    {d.lat == null && <span className="block text-xs text-amber-700">Sin ubicar en el mapa: mejor búscala abajo</span>}
                  </span>
                  {d.es_principal && (
                    <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                      <Star className="w-3 h-3" /> Predeterminada
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
