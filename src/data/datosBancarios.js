/**
 * Dónde se le paga a un proveedor.
 *
 * ⚠️ No son sólo bancos: la lista incluye plataformas de pago, y no todas se comportan igual.
 * «Webpay» es una pasarela sin cuenta de destino, y por eso los formularios de proveedor la
 * tratan aparte (`isWebpay`) anulando número de cuenta, tipo y correo. **Mercado Pago NO es ese
 * caso**: tiene número de cuenta, tipo de cuenta y correo propios, así que se llena igual que un
 * banco. Agregarla acá es todo lo que hace falta.
 *
 * ⚠️ `Proveedor.banco` es texto libre en la base, así que el valor guardado puede quedar fuera de
 * esta lista. Cuando eso pasa el `<select>` sale EN BLANCO y guardar el formulario **borra el
 * banco** sin avisar. Por eso, al agregar un proveedor con un medio de pago nuevo, primero se
 * despliega la opción y después se carga el dato — nunca al revés.
 */
export const BANCOS_CL = [
  "Banco de Chile","Banco Estado","Banco Santander","Banco BCI","Scotiabank","Itaú",
  "Banco Security","Banco Falabella","Banco Ripley","Banco Consorcio",
  "Mercado Pago", "Webpay"
];
export const TIPO_CUENTA = ["Cuenta Corriente", "Cuenta Vista", "Cuenta RUT", "Cuenta de Ahorro"];