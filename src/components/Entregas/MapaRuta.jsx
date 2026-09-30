import { useEffect, useRef, useState } from "react";
import { cargarGoogleMaps, hayMapaInteractivo } from "../../utils/googleMaps";
import { CENTRO_SANTIAGO } from "../../utils/ubicacion";
import { decodificarPolilinea } from "../../utils/rutas";

const COLOR_RUTA = "#7A5AF8";
const COLOR_SUELTO = "#9CA3AF";

/**
 * El mapa de Logística → Entregas: la bodega, las paradas numeradas en el orden de la ruta y los
 * pedidos elegidos que todavía no están en ella (en gris).
 *
 * Con la llave de navegador de Google, un mapa real con la línea de la ruta por calles. Sin ella
 * (local, o antes de configurarla), un croquis en SVG con los mismos puntos: la vista sigue
 * sirviendo para planificar, sólo sin calles.
 */
export default function MapaRuta({ bodega, paradas = [], sueltos = [], polilinea = null, alto = 420 }) {
  const [sinMapa, setSinMapa] = useState(!hayMapaInteractivo());
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const dibujos = useRef([]);

  useEffect(() => {
    if (sinMapa) return undefined;
    let vivo = true;
    cargarGoogleMaps()
      .then((maps) => {
        if (!vivo || !contenedor.current || mapa.current) return;
        mapa.current = new maps.Map(contenedor.current, {
          center: bodega?.lat != null ? { lat: bodega.lat, lng: bodega.lng } : CENTRO_SANTIAGO,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        dibujar(maps);
      })
      .catch(() => vivo && setSinMapa(true));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinMapa]);

  useEffect(() => {
    if (mapa.current && window.google?.maps) dibujar(window.google.maps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodega, paradas, sueltos, polilinea]);

  function dibujar(maps) {
    dibujos.current.forEach((d) => d.setMap(null));
    dibujos.current = [];
    const limites = new maps.LatLngBounds();
    const agregar = (d) => dibujos.current.push(d);

    if (bodega?.lat != null) {
      const p = { lat: bodega.lat, lng: bodega.lng };
      agregar(new maps.Marker({ map: mapa.current, position: p, title: `Bodega ${bodega.nombre}`, label: { text: "B", color: "#fff", fontWeight: "700" } }));
      limites.extend(p);
    }
    paradas.forEach((p, i) => {
      agregar(new maps.Marker({
        map: mapa.current,
        position: { lat: p.lat, lng: p.lng },
        title: `${i + 1}. ${p.cliente} — ${p.etiqueta}`,
        label: { text: String(i + 1), color: "#fff", fontWeight: "700" },
      }));
      limites.extend({ lat: p.lat, lng: p.lng });
    });
    sueltos.forEach((p) => {
      agregar(new maps.Marker({
        map: mapa.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.etiqueta,
        icon: { path: maps.SymbolPath.CIRCLE, scale: 6, fillColor: COLOR_SUELTO, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      }));
      limites.extend({ lat: p.lat, lng: p.lng });
    });
    const camino = polilinea
      ? decodificarPolilinea(polilinea)
      : bodega?.lat != null && paradas.length
        ? [{ lat: bodega.lat, lng: bodega.lng }, ...paradas.map((p) => ({ lat: p.lat, lng: p.lng })), { lat: bodega.lat, lng: bodega.lng }]
        : [];
    if (camino.length) {
      agregar(new maps.Polyline({ map: mapa.current, path: camino, strokeColor: COLOR_RUTA, strokeOpacity: 0.8, strokeWeight: 4 }));
    }
    if (!limites.isEmpty()) mapa.current.fitBounds(limites, 48);
  }

  if (sinMapa) return <Croquis bodega={bodega} paradas={paradas} sueltos={sueltos} alto={alto} />;
  return <div ref={contenedor} style={{ height: alto }} className="w-full rounded-xl border border-gray-200 bg-gray-100" />;
}

/** Croquis sin calles: proyección lineal de los puntos a la caja. Suficiente para ver el orden. */
function Croquis({ bodega, paradas, sueltos, alto }) {
  const puntos = [
    ...(bodega?.lat != null ? [{ lat: bodega.lat, lng: bodega.lng }] : []),
    ...paradas,
    ...sueltos,
  ];
  const ancho = 600;
  if (puntos.length === 0) {
    return (
      <div style={{ height: alto }} className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500 p-6 text-center">
        Elige pedidos o recomienda la ruta del día para verla acá.
      </div>
    );
  }
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  const margen = 28;
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const escala = Math.min((ancho - 2 * margen) / Math.max(maxLng - minLng, 1e-4), (alto - 2 * margen) / Math.max(maxLat - minLat, 1e-4));
  const xy = (p) => [margen + (p.lng - minLng) * escala, alto - margen - (p.lat - minLat) * escala];
  const camino = bodega?.lat != null && paradas.length ? [bodega, ...paradas, bodega].map(xy) : [];

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 relative">
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ height: alto }} className="w-full" role="img" aria-label="Croquis de la ruta">
        {camino.length > 0 && (
          <polyline points={camino.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={COLOR_RUTA} strokeWidth="3" strokeOpacity="0.6" strokeDasharray="6 4" />
        )}
        {sueltos.map((p, i) => {
          const [x, y] = xy(p);
          return <circle key={`s${i}`} cx={x} cy={y} r="6" fill={COLOR_SUELTO} stroke="#fff" strokeWidth="2"><title>{p.etiqueta}</title></circle>;
        })}
        {paradas.map((p, i) => {
          const [x, y] = xy(p);
          return (
            <g key={`p${i}`}>
              <circle cx={x} cy={y} r="11" fill={COLOR_RUTA} stroke="#fff" strokeWidth="2" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{i + 1}</text>
              <title>{`${i + 1}. ${p.cliente} — ${p.etiqueta}`}</title>
            </g>
          );
        })}
        {bodega?.lat != null && (() => {
          const [x, y] = xy(bodega);
          return (
            <g>
              <rect x={x - 11} y={y - 11} width="22" height="22" rx="4" fill="#111827" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">B</text>
              <title>{`Bodega ${bodega.nombre}`}</title>
            </g>
          );
        })()}
      </svg>
      <span className="absolute bottom-2 right-3 text-[11px] text-gray-400">Croquis sin calles — el mapa real aparece al configurar Google Maps</span>
    </div>
  );
}
