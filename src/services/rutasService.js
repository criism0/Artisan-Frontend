/** Logística → Entregas: llamadas a `/rutas` (planificación de rutas). */
import { api, apiBlob } from "../lib/api";

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

/** Sugerencias mientras se escribe (Google Places Autocomplete): [{ id, principal, secundario }]. */
export const autocompletarLugar = (texto, idBodega, sesion) =>
  api(`/rutas/autocompletar-lugar?texto=${encodeURIComponent(texto)}${idBodega ? `&id_bodega=${idBodega}` : ""}${sesion ? `&sesion=${sesion}` : ""}`);

/** El lugar de una sugerencia, con su punto y la dirección en partes. */
export const detalleLugar = (id, sesion) => api(`/rutas/lugares/${encodeURIComponent(id)}${sesion ? `?sesion=${sesion}` : ""}`);

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

// ── Entregas (Fase 2): lo que ve y corrige Logística ─────────────────────────

/** Ruta con sus paradas, órdenes y lo que falta entregar línea por línea (la misma vista que la app). */
export const obtenerRutaParaRegistrar = (id) => api(`/rutas/${id}/app`);

/** estado: "Pendiente" (por defecto), "Resuelta" o "todas". */
export const listarRevisiones = (estado = "Pendiente") => api(`/rutas/revisiones?estado=${encodeURIComponent(estado)}`);
export const resolverRevision = (idEntrega, datos) => api(`/rutas/entregas/${idEntrega}/resolver`, { method: "PUT", body: datos });
export const anularEntrega = (idEntrega, motivo) => api(`/rutas/entregas/${idEntrega}/anular`, { method: "PUT", body: { motivo } });
export const cerrarAnticipadamente = (idRuta, motivo) => api(`/rutas/${idRuta}/cerrar-anticipadamente`, { method: "PUT", body: { motivo } });

/** Registrar una parada desde la web (respaldo): el mismo multipart que manda la app. */
export const registrarEntregaParada = (idParada, form) => api(`/rutas/paradas/${idParada}/entrega`, { method: "POST", body: form });

// ── Bultos de despacho (plan §17): preparar, etiquetas, devoluciones ─────────

/** Lo que falta preparar de una OV, las cajas que pueden salir cerradas y sus preparaciones. */
export const despachoDeOrden = (idOrden) => api(`/rutas/ordenes/${idOrden}/despacho`);
/** Preparar desde la web (respaldo de la app de bodega): multipart con `datos` y fotos `preparacion`. */
export const prepararDespacho = (idOrden, form) => api(`/rutas/ordenes/${idOrden}/preparar`, { method: "POST", body: form });
export const anularPreparacion = (idPrep) => api(`/rutas/preparaciones/${idPrep}/anular`, { method: "PUT" });
/** Las etiquetas de las cajas armadas de una OV ({ id_orden_venta }) o de una ruta ({ id_ruta }), en una pestaña nueva. */
export async function abrirEtiquetasDespacho(filtro) {
  const blob = await apiBlob("/rutas/despacho/etiquetas", { method: "POST", body: filtro });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const listarDevoluciones = () => api("/rutas/devoluciones");
export const buscarDevolucion = (codigo) => api(`/rutas/devoluciones/buscar?codigo=${encodeURIComponent(codigo)}`);
/** accion: "Reintegrar" | "Merma" | "Re-despachar" */
export const resolverDevolucion = (idBulto, datos) => api(`/rutas/bultos-despacho/${idBulto}/resolver`, { method: "PUT", body: datos });
