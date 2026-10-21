import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Building2 } from "lucide-react";
import Modal from "../UI/Modal";
import { api } from "../../lib/api";
import { buscarLugar } from "../../services/rutasService";
import { toast } from "../../lib/toast.js";

/**
 * Definir a dónde va un pedido (o dónde queda la bodega) buscando como en Google Maps: se escribe
 * una dirección o el nombre de un lugar («CD Cencosud San Pablo», «Moneda 1901») y se elige una
 * sugerencia, que ya trae su punto exacto.
 *
 * Si hay `idCliente`, arriba aparecen sus direcciones de despacho ya registradas: elegir una es
 * lo más común y no gasta una búsqueda.
 *
 * - `onElegirLugar(lugar, { guardarEnCliente })`: guarda un lugar del buscador. Al elegirlo se
 *   pregunta si queda en las direcciones del cliente o sólo para este pedido (decisión de
 *   Cristóbal, 2026-09-30).
 * - `onElegirDireccion(id)`: guarda una dirección del cliente (opcional).
 * - `iguales`: cuántos otros pedidos del cliente van a la misma dirección. Si hay, se ofrece
 *   aplicarles también la nueva (marcado por defecto) y los callbacks reciben `aplicarAIguales`.
 */
export default function ModalBuscarDireccion({
  abierto,
  onCerrar,
  titulo,
  contexto,
  idCliente,
  idBodega,
  onElegirLugar,
  onElegirDireccion,
  iguales = 0,
}) {
  const [aplicarAIguales, setAplicarAIguales] = useState(true);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [direcciones, setDirecciones] = useState([]);
  const [elegido, setElegido] = useState(null); // lugar del buscador esperando «dónde se guarda»
  const pedido = useRef(0);

  useEffect(() => {
    if (!abierto) return;
    setTexto("");
    setResultados([]);
    setDirecciones([]);
    setElegido(null);
    setAplicarAIguales(true);
    if (idCliente && onElegirDireccion) {
      api(`/direcciones/cliente/${idCliente}`)
        .then((ds) => setDirecciones((Array.isArray(ds) ? ds : []).filter((d) => d.tipo_direccion === "Despacho")))
        .catch(() => setDirecciones([]));
    }
  }, [abierto, idCliente, onElegirDireccion]);

  // Busca 400 ms después de dejar de escribir; una respuesta vieja no pisa a una nueva.
  useEffect(() => {
    const t = texto.trim();
    if (t.length < 3) {
      setResultados([]);
      return undefined;
    }
    const id = ++pedido.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarLugar(t, idBodega);
        if (id === pedido.current) setResultados(Array.isArray(r) ? r : []);
      } catch (e) {
        if (id === pedido.current) toast.error(e.message);
      } finally {
        if (id === pedido.current) setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [texto, idBodega]);

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

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="max-w-xl">
      <div className="flex flex-col gap-4">
        {contexto && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 whitespace-pre-line">{contexto}</div>
        )}
        {iguales > 0 && (
          <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <input type="checkbox" className="mt-1" checked={aplicarAIguales} onChange={(e) => setAplicarAIguales(e.target.checked)} />
            <span>
              Aplicar también a {iguales === 1 ? "el otro pedido" : `los otros ${iguales} pedidos`} de este cliente que van a la misma
              dirección <span className="text-gray-500">(no a los que ya están en una ruta, ni si se guarda «sólo para este pedido»)</span>
            </span>
          </label>
        )}

        {direcciones.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Direcciones de despacho del cliente</span>
            {direcciones.map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={guardando}
                onClick={() => elegir(() => onElegirDireccion(d.id, { aplicarAIguales: iguales > 0 && aplicarAIguales }))}
                className="flex items-start gap-2 text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <Building2 className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                <span className="text-sm">
                  <span className="font-medium text-gray-800">{d.nombre_sucursal || "Despacho"}</span>
                  <span className="text-gray-600"> — {[[d.calle, d.numero].filter(Boolean).join(" "), d.comuna].filter(Boolean).join(", ")}</span>
                  {d.lat == null && <span className="block text-xs text-amber-700">Sin ubicar en el mapa: mejor búscala abajo</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Buscar en el mapa</span>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Dirección o lugar: «Moneda 1901, Santiago», «CD Cencosud San Pablo»…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {buscando && <span className="text-xs text-gray-400">Buscando…</span>}
          {!buscando && texto.trim().length >= 3 && resultados.length === 0 && (
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
                  disabled={guardando}
                  onClick={() => elegir(() => onElegirLugar(elegido, { guardarEnCliente: true, aplicarAIguales: iguales > 0 && aplicarAIguales }))}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                  title="Queda como dirección de despacho del cliente, para usarla en otros pedidos"
                >
                  En las direcciones del cliente
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => elegir(() => onElegirLugar(elegido, { guardarEnCliente: false }))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                  title="La casa de un comprador de la tienda web, un despacho puntual: la ficha del cliente no se toca"
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
            {resultados.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={guardando}
                onClick={() => (idCliente ? setElegido(l) : elegir(() => onElegirLugar(l, { guardarEnCliente: false })))}
                className="flex items-start gap-2 text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span className="text-sm">
                  {l.nombre && <span className="block font-medium text-gray-800">{l.nombre}</span>}
                  <span className="text-gray-600">{l.direccion_formateada}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
