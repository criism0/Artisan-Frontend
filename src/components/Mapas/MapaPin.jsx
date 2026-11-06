import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cargarGoogleMaps, hayMapaInteractivo } from "../../utils/googleMaps";
import { CENTRO_SANTIAGO, enlaceGoogleMaps, leerCoordenada, leerParCoordenadas } from "../../utils/ubicacion";

/**
 * Un punto en el mapa que se puede mover: arrastrando el pin o haciendo clic donde corresponde.
 *
 * Sin mapa interactivo (sin llave de Google, o si Google la rechazó) muestra dos campos de
 * latitud/longitud —que aceptan pegar «-33.44, -70.65» tal como lo copia Google Maps— y un
 * enlace para verificar el punto. Nunca un recuadro gris sin explicación.
 */
export default function MapaPin({ lat, lng, onMover, alto = 320 }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const pin = useRef(null);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;
  const [error, setError] = useState(hayMapaInteractivo() ? null : "sin-llave");

  const hayPunto = lat != null && lng != null;

  useEffect(() => {
    if (error) return undefined;
    let vivo = true;
    cargarGoogleMaps()
      .then((maps) => {
        if (!vivo || !contenedor.current) return;
        const centro = hayPunto ? { lat, lng } : CENTRO_SANTIAGO;
        mapa.current = new maps.Map(contenedor.current, {
          center: centro,
          zoom: hayPunto ? 17 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        pin.current = new maps.Marker({ map: mapa.current, position: hayPunto ? centro : null, draggable: true });
        const mover = (e) => {
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          pin.current.setPosition(p);
          onMoverRef.current?.(p.lat, p.lng);
        };
        pin.current.addListener("dragend", mover);
        mapa.current.addListener("click", mover);
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
    // El mapa se crea una vez; los cambios de punto se aplican en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Un punto que llega de afuera (p. ej. «Buscar con Google») mueve el pin y el mapa.
  useEffect(() => {
    if (!mapa.current || !pin.current || !hayPunto) return;
    const actual = pin.current.getPosition();
    if (actual && Math.abs(actual.lat() - lat) < 1e-9 && Math.abs(actual.lng() - lng) < 1e-9) return;
    pin.current.setPosition({ lat, lng });
    mapa.current.panTo({ lat, lng });
    if (mapa.current.getZoom() < 15) mapa.current.setZoom(17);
  }, [lat, lng, hayPunto]);

  if (error) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          {error === "sin-llave"
            ? "El mapa interactivo no está configurado en este ambiente. Busca el lugar en Google Maps, haz clic derecho sobre el punto y pega acá las coordenadas que copia."
            : `No se pudo mostrar el mapa (${error}). Puedes ingresar las coordenadas a mano.`}
        </p>
        <input
          type="text"
          placeholder="Pegar «-33.4428, -70.6536»"
          className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          onChange={(e) => {
            const par = leerParCoordenadas(e.target.value);
            if (par) onMover?.(par.lat, par.lng);
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Latitud
            <input
              type="text"
              inputMode="decimal"
              value={lat ?? ""}
              onChange={(e) => onMover?.(leerCoordenada(e.target.value), lng)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Longitud
            <input
              type="text"
              inputMode="decimal"
              value={lng ?? ""}
              onChange={(e) => onMover?.(lat, leerCoordenada(e.target.value))}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </label>
        </div>
        {hayPunto && (
          <a href={enlaceGoogleMaps(lat, lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Ver este punto en Google Maps <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  return <div ref={contenedor} style={{ height: alto }} className="w-full rounded-lg border border-gray-200 bg-gray-100" />;
}
