/**
 * Qué archivos puede mostrar el navegador por su cuenta.
 *
 * Vive aparte del visor para que preguntarlo no obligue a importar el componente —lo consulta la
 * lista de adjuntos para decidir si el botón dice «Ver» o «Descargar»— y porque un módulo que
 * exporta un componente Y una función suelta rompe el fast refresh de React.
 */

/**
 * 🔴 `image/heic` y `image/heif` quedan FUERA a propósito aunque el backend los acepte: son el
 * formato por defecto de las fotos de iPhone y Chrome/Firefox **no los muestran**. Incluirlos
 * daría un recuadro vacío justo con las fotos que más se van a adjuntar desde un celular.
 *
 * Tampoco están las planillas ni los documentos de Word: no hay forma de renderizarlos sin un
 * servicio externo, y prometer una vista previa que sale en blanco es peor que ofrecer la
 * descarga de entrada.
 */
const PREVISUALIZABLES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'text/plain',
]);

export function sePuedePrevisualizar(mime) {
  return PREVISUALIZABLES.has(String(mime ?? '').toLowerCase());
}

export function esImagen(mime) {
  return String(mime ?? '').startsWith('image/');
}
