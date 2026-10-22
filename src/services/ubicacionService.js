/**
 * Llamadas de ubicación en el mapa (rutas de entrega, Fase 0). Normalizan la respuesta a la
 * forma que usa `ModalUbicar`: { lat, lng, precision, formateada }.
 */
import { api } from "../lib/api";

export const ubicacionDeDireccion = (d) => ({
  lat: d?.lat ?? null,
  lng: d?.lng ?? null,
  precision: d?.geo_precision ?? null,
  formateada: d?.geo_direccion_formateada ?? null,
});

export const ubicacionDeEntrega = (o) => ({
  lat: o?.entrega_lat ?? null,
  lng: o?.entrega_lng ?? null,
  precision: o?.entrega_geo_precision ?? null,
  formateada: o?.entrega_geo_direccion_formateada ?? null,
});

/** Acciones de `ModalUbicar` para una dirección del cliente. */
export const accionesUbicarDireccion = (idDireccion) => ({
  onBuscar: async () => {
    const r = await api(`/direcciones/${idDireccion}/geocodificar`, { method: "POST", body: { forzar: true } });
    return { ok: r.ok, motivo: r.motivo, actual: ubicacionDeDireccion(r.direccion), direccion: r.direccion };
  },
  onGuardarPin: async (lat, lng) =>
    ubicacionDeDireccion(await api(`/direcciones/${idDireccion}/ubicacion`, { method: "PUT", body: { lat, lng } })),
});

/** Acciones de `ModalUbicar` para la dirección de entrega propia de una orden. */
export const accionesUbicarEntrega = (idOrden) => ({
  onBuscar: async () => {
    const r = await api(`/ordenes-venta/${idOrden}/geocodificar-entrega`, { method: "POST", body: { forzar: true } });
    return { ok: r.ok, motivo: r.motivo, actual: ubicacionDeEntrega(r.orden), orden: r.orden };
  },
  onGuardarPin: async (lat, lng) =>
    ubicacionDeEntrega(await api(`/ordenes-venta/${idOrden}/ubicacion-entrega`, { method: "PUT", body: { lat, lng } })),
});

/** Guarda (o quita, con todo vacío) la dirección de entrega propia de una orden. */
export const guardarDireccionEntrega = (idOrden, datos) =>
  api(`/ordenes-venta/${idOrden}/direccion-entrega`, { method: "PUT", body: datos });

/** Copia una dirección (normalmente de Facturación) como dirección de Despacho del cliente. */
export const copiarComoDespacho = (idDireccion) =>
  api(`/direcciones/${idDireccion}/copiar-como-despacho`, { method: "POST" });

export const CAMPOS_ENTREGA = [
  "entrega_direccion",
  "entrega_comuna",
  "entrega_region",
  "entrega_referencia",
  "entrega_destinatario",
  "entrega_telefono",
];

export const entregaVacia = () => Object.fromEntries(CAMPOS_ENTREGA.map((c) => [c, ""]));

export const entregaDeOrden = (o) => Object.fromEntries(CAMPOS_ENTREGA.map((c) => [c, o?.[c] ?? ""]));
