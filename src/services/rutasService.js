/** Logística → Entregas: llamadas a `/rutas` (planificación de rutas). */
import { api } from "../lib/api";

export const listarPendientes = () => api("/rutas/pendientes");
export const listarRutas = (fecha) => api(`/rutas?fecha=${encodeURIComponent(fecha)}`);
export const listarTransportistas = () => api("/rutas/transportistas");
export const leerParametros = () => api("/rutas/parametros");
export const guardarCostoKm = (costo_km) => api("/rutas/parametros", { method: "PUT", body: { costo_km } });

export const buscarLugar = (texto, idBodega) =>
  api(`/rutas/buscar-lugar?texto=${encodeURIComponent(texto)}${idBodega ? `&id_bodega=${idBodega}` : ""}`);

/** { fecha, id_bodega, ordenes? } → ruta recomendada (no se guarda). */
export const sugerirRuta = (datos) => api("/rutas/sugerir", { method: "POST", body: datos });

export const crearRuta = (datos) => api("/rutas", { method: "POST", body: datos });
export const actualizarRuta = (id, datos) => api(`/rutas/${id}`, { method: "PUT", body: datos });
export const cancelarRuta = (id, motivo) => api(`/rutas/${id}/cancelar`, { method: "PUT", body: { motivo } });

/** { id_direccion } | { lugar } */
export const definirPuntoEntrega = (idOrden, datos) =>
  api(`/rutas/ordenes/${idOrden}/punto-entrega`, { method: "PUT", body: datos });

export const ubicarBodega = (idBodega, lugar) =>
  api(`/rutas/bodegas/${idBodega}/ubicacion`, { method: "PUT", body: { lugar } });
