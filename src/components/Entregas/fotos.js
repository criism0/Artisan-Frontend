import { buildApiUrl } from "../../lib/api";

/** Qué muestra cada foto de las entregas y de los bultos de despacho. */
export const ETIQUETA_FOTO = {
  DOCUMENTO_FIRMADO: "Documento firmado",
  HOJA_RECEPCION: "Hoja de recepción",
  INCIDENCIA: "Incidencia",
  COMPROBANTE_EXTERNO: "Comprobante",
  PREPARACION: "Pedido preparado",
  CARGA: "Carga del camión",
  DEVOLUCION: "Dónde quedó lo devuelto",
};

/** La foto la sirve el backend: redirige a S3 firmada en producción o al archivo local en desarrollo. */
export const urlFoto = (id) => buildApiUrl(`/rutas/entregas/fotos/${id}`);
