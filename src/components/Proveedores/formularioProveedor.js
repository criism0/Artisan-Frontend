import { esEmailValido } from "../../services/formatHelpers";

/**
 * La lógica del formulario de proveedor: qué es obligatorio, cómo se arma lo que se manda y qué pasa
 * al cambiar el medio de pago. Vive aparte de `CamposProveedor.jsx` para que éste sólo exporte el
 * componente (si no, la recarga en caliente de React se rompe).
 *
 * Obligatorios: razón social, RUT y el medio de pago con sus datos —cuenta, tipo de cuenta y correo,
 * o, si se compra por la web (Webpay), el sitio—. Todo lo demás es opcional.
 */

const REGEX_RUT = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;

export const FORM_PROVEEDOR_VACIO = {
  nombre_empresa: "",
  rut_empresa: "",
  giro: "",
  tipo_proveedor: "",
  region: "",
  comuna: "",
  direccion: "",
  banco: "",
  cuenta_corriente: "",
  cuenta: "",
  email_transferencia: "",
  sitio_web: "",
  usuario_web: "",
  nombre_contacto: "",
  telefono: "",
};

/** «Webpay» es una compra por la web: no tiene cuenta ni correo de destino. */
export const esWebpay = (banco) => banco === "Webpay";

/**
 * Cambiar el medio de pago. Para Webpay los datos de cuenta quedan en «-» (así se guardaron
 * siempre los proveedores de compra web) y al volver a un banco se limpian. El sitio y el usuario
 * se conservan en el formulario por si se cambia de idea; el backend los borra si no es Webpay.
 */
export function aplicarMedioDePago(prev, banco) {
  const web = esWebpay(banco);
  const sinGuion = (v) => (v === "-" ? "" : v);
  return {
    ...prev,
    banco,
    cuenta_corriente: web ? "-" : sinGuion(prev.cuenta_corriente),
    cuenta: web ? "-" : sinGuion(prev.cuenta),
    email_transferencia: web ? "-" : sinGuion(prev.email_transferencia),
  };
}

/**
 * Lo que se manda al backend. Webpay manda «-» en la cuenta. Un tipo de proveedor vacío NO se manda:
 * el backend lo rechaza si llega como texto vacío, y sin él queda como «Empresa».
 */
export function payloadProveedor(form) {
  const { tipo_proveedor, ...resto } = form;
  const base = tipo_proveedor.trim() ? { ...resto, tipo_proveedor: tipo_proveedor.trim() } : resto;
  if (!esWebpay(form.banco)) return base;
  return { ...base, cuenta_corriente: "-", cuenta: "-", email_transferencia: "-" };
}

/** Devuelve `{campo: mensaje}`; vacío si todo está bien. */
export function validarProveedor(form, { rutEstricto = false } = {}) {
  const e = {};
  if (!form.nombre_empresa.trim()) e.nombre_empresa = "Ingresa la razón social";

  if (!form.rut_empresa.trim()) e.rut_empresa = "Ingresa el RUT";
  else if (rutEstricto && !REGEX_RUT.test(form.rut_empresa)) e.rut_empresa = "Formato inválido (Ej: 76.123.456-7)";

  if (!form.banco) e.banco = "Selecciona el medio de pago";
  else if (esWebpay(form.banco)) {
    if (!form.sitio_web.trim()) e.sitio_web = "Indica en qué página web se compra";
  } else {
    if (!form.cuenta_corriente) e.cuenta_corriente = "Ingresa el número de cuenta";
    if (!form.cuenta) e.cuenta = "Selecciona el tipo de cuenta";
    if (!form.email_transferencia) e.email_transferencia = "Ingresa el email para transferencias";
    else if (!esEmailValido(form.email_transferencia)) e.email_transferencia = "Formato de email no válido";
  }

  if (form.telefono && form.telefono.length < 9) e.telefono = "El teléfono debe tener al menos 9 dígitos";
  return e;
}
