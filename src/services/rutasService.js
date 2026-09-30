/** Logística → Entregas: llamadas a `/rutas` (planificación de rutas). */
import { api } from "../lib/api";

export const listarPendientes = () => api("/rutas/pendientes");
/** Todas las rutas, o las de un día. */
export const listarRutas = (fecha) => api(fecha ? `/rutas?fecha=${encodeURIComponent(fecha)}` : "/rutas");
export const obtenerRuta = (id) => api(`/rutas/${id}`);
/** Quiénes pueden hacerse cargo de una ruta: { id, nombre, email, rol }, los transportistas primero. */
export const listarTransportistas = () => api("/rutas/transportistas");
/** Las bodegas de origen, ya ubicadas: las que no tenían punto se ubican con su dirección. */
export const listarBodegas = () => api("/rutas/bodegas");

/** «Juan Pérez» para un transportista, «Ana Soto (Administrador)» para cualquier otro rol. */
export const etiquetaEncargado = (u) => (u.rol && u.rol !== "Transportista" ? `${u.nombre} (${u.rol})` : u.nombre);
export const leerParametros = () => api("/rutas/parametros");
export const guardarCostoKm = (costo_km) => api("/rutas/parametros", { method: "PUT", body: { costo_km } });

export const buscarLugar = (texto, idBodega) =>
  api(`/rutas/buscar-lugar?texto=${encodeURIComponent(texto)}${idBodega ? `&id_bodega=${idBodega}` : ""}`);

/** { fecha, id_bodega, ordenes? } → ruta recomendada (no se guarda). */
export const sugerirRuta = (datos) => api("/rutas/sugerir", { method: "POST", body: datos });

export const crearRuta = (datos) => api("/rutas", { method: "POST", body: datos });
/** { fecha?, id_transportista?, paradas?, comentario? } mientras esté Planificada. */
export const actualizarRuta = (id, datos) => api(`/rutas/${id}`, { method: "PUT", body: datos });
export const cancelarRuta = (id, motivo) => api(`/rutas/${id}/cancelar`, { method: "PUT", body: { motivo } });

/** { id_direccion } | { lugar } */
export const definirPuntoEntrega = (idOrden, datos) =>
  api(`/rutas/ordenes/${idOrden}/punto-entrega`, { method: "PUT", body: datos });

/** { lugar } | { lat, lng, direccion_formateada? } */
export const ubicarBodega = (idBodega, datos) =>
  api(`/rutas/bodegas/${idBodega}/ubicacion`, { method: "PUT", body: datos });
