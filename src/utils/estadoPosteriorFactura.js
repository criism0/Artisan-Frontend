/**
 * Etiquetas de `estado_dte_posterior` — separadas del componente `EstadoPosteriorBadge.jsx`
 * para que ese archivo exporte sólo el componente (evita el warning de Fast Refresh) y para
 * poder reutilizar las etiquetas legibles en `getSearchText` de la lista de OV.
 */
export const POSTERIOR_LABEL = {
  NC_TOTAL: "NC Total",
  NC_PARCIAL: "NC Parcial",
  NC_TEXTO: "NC Texto",
  ND: "Nota de Débito",
};
