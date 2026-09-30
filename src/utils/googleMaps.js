/**
 * Carga la Maps JavaScript API una sola vez, a pedido (sólo las vistas con mapa la bajan).
 *
 * La llave es la de NAVEGADOR (`VITE_GOOGLE_MAPS_KEY`), restringida por referrer a nuestro
 * dominio. La de servidor, que geocodifica, nunca llega acá.
 *
 * Sin llave —local, o antes de configurarla— `hayMapaInteractivo()` es false y los componentes
 * muestran el ingreso de coordenadas a mano en vez de un mapa en blanco.
 */
const LLAVE = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

let promesa = null;
let errorDeAutenticacion = null;

export function hayMapaInteractivo() {
  return Boolean(LLAVE) && !errorDeAutenticacion;
}

export function cargarGoogleMaps() {
  if (!LLAVE) return Promise.reject(new Error("Falta configurar VITE_GOOGLE_MAPS_KEY"));
  if (errorDeAutenticacion) return Promise.reject(errorDeAutenticacion);
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (promesa) return promesa;

  promesa = new Promise((resolver, rechazar) => {
    // Google llama a esto si la llave es inválida o no está autorizada para este dominio.
    // Sin esto el mapa queda gris con una marca de agua y nadie sabe por qué.
    window.gm_authFailure = () => {
      errorDeAutenticacion = new Error("Google Maps rechazó la llave de navegador (dominio no autorizado o API sin habilitar)");
      rechazar(errorDeAutenticacion);
    };
    window.__artisanMapsListo = () => resolver(window.google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(LLAVE)}&v=weekly&language=es&region=CL&callback=__artisanMapsListo`;
    s.async = true;
    s.onerror = () => {
      promesa = null; // permite reintentar si fue un corte de red
      rechazar(new Error("No se pudo cargar Google Maps"));
    };
    document.head.appendChild(s);
  });
  return promesa;
}
