import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import Modal from "../UI/Modal";
import MapaPin from "../Mapas/MapaPin";
import { ubicarBodega } from "../../services/rutasService";
import useAutocompletarLugar from "../../hooks/useAutocompletarLugar";
import { toast } from "../../lib/toast.js";

/**
 * Dónde queda una bodega: el punto «B» del que salen y al que vuelven las rutas.
 *
 * Se busca como en Google Maps, el resultado deja el pin en el mapa y se puede ajustar
 * arrastrándolo antes de guardar. La dirección escrita de la bodega («… Local 4») no siempre es
 * la que Google entiende, así que lo que se guarda es el punto que se ve, junto con el lugar que
 * dijo Google para poder revisarlo después.
 */
export default function ModalUbicarBodega({ abierto, onCerrar, bodega, onGuardada }) {
  const { texto, setTexto, sugerencias, buscando, elegir: detalle } = useAutocompletarLugar({ activo: abierto, idBodega: bodega?.id });
  const [pin, setPin] = useState({ lat: null, lng: null });
  const [lugar, setLugar] = useState(null); // { formateada, simulado }
  const [ajustado, setAjustado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Al abrir: lo guardado, y el buscador precargado con la dirección escrita de la bodega.
  useEffect(() => {
    if (!abierto || !bodega) return;
    setTexto([bodega.direccion, bodega.comuna].filter(Boolean).join(", "));
    setPin({ lat: bodega.lat ?? null, lng: bodega.lng ?? null });
    setLugar(bodega.geo_direccion_formateada ? { formateada: bodega.geo_direccion_formateada, simulado: false } : null);
    setAjustado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, bodega?.id]);

  const elegir = async (sugerencia) => {
    try {
      const l = await detalle(sugerencia);
      setPin({ lat: l.lat, lng: l.lng });
      setLugar({ formateada: l.direccion_formateada, simulado: String(l.id).startsWith("simulado") });
      setAjustado(false);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cambio =
    pin.lat != null &&
    (bodega?.lat == null || Math.abs(pin.lat - bodega.lat) > 1e-7 || Math.abs(pin.lng - bodega.lng) > 1e-7);

  const guardar = async () => {
    setGuardando(true);
    try {
      const b = await ubicarBodega(bodega.id, { lat: pin.lat, lng: pin.lng, direccion_formateada: lugar?.formateada ?? null });
      onGuardada?.(b);
      toast.success(`Bodega ${bodega.nombre} ubicada`);
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!bodega) return null;

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`¿Dónde queda la bodega ${bodega.nombre}?`}
      descripcion="Es el punto del que salen y al que vuelven las rutas (la «B» del mapa)."
      ancho="max-w-2xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cerrar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={!cambio || guardando}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar ubicación
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Dirección o nombre del lugar"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {(buscando || sugerencias.length > 0) && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex flex-col gap-1">
              {buscando && <span className="text-xs text-gray-400 px-2 py-1">Buscando…</span>}
              {sugerencias.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => elegir(s)}
                  className="flex items-start gap-2 text-left px-3 py-2 rounded-md hover:bg-primary/5"
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-sm">
                    <span className="block font-medium text-gray-800">{s.principal}</span>
                    {s.secundario && <span className="text-gray-500">{s.secundario}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <MapaPin
          lat={pin.lat}
          lng={pin.lng}
          onMover={(la, ln) => {
            setPin({ lat: la, lng: ln });
            setAjustado(true);
          }}
        />

        <p className="text-xs text-gray-600">
          {lugar?.formateada ? (
            <>
              {ajustado ? "Ajustado a mano cerca de: " : "Google la entendió como: "}
              <span className="text-gray-800">{lugar.formateada}</span>
            </>
          ) : pin.lat != null ? (
            "Punto puesto a mano."
          ) : (
            "Busca la dirección o haz clic en el mapa donde está la bodega."
          )}
        </p>
        {lugar?.simulado && !ajustado && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            En este ambiente el buscador es simulado y el punto es aproximado: arrastra el pin hasta la bodega.
          </p>
        )}
        <p className="text-xs text-gray-500">
          Arrastra el pin (o haz clic en el mapa) hasta el <strong>acceso por donde sale el camión</strong>.
        </p>
      </div>
    </Modal>
  );
}
