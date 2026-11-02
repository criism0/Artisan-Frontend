/**
 * Dos clientes no pueden tener el mismo RUT (pedido de Hernán, 2026-10-30): el backend
 * responde 409 `RUT_DUPLICADO` con el cliente que ya lo tiene.
 *
 * El error va en el campo RUT, no en un toast: es ahí donde hay que corregir, y el nombre del
 * cliente existente dice a quién buscar en vez de crear otro.
 *
 * @returns true si era ese error y quedó marcado en el formulario.
 */
export function marcarRutDuplicado(err, setErrors) {
  if (err?.status !== 409 || err?.data?.code !== "RUT_DUPLICADO") return false;
  const c = err.data.cliente;
  setErrors((prev) => ({ ...prev, rut: c ? `Ya es de «${c.nombre_empresa}» (#${c.id})` : err.message }));
  // Se guarda desde el pie del formulario: sin esto el error queda fuera de la vista.
  const campo = document.querySelector('input[placeholder*="12.345.678"]');
  campo?.scrollIntoView({ behavior: "smooth", block: "center" });
  campo?.focus({ preventScroll: true });
  return true;
}
