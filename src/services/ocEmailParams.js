function fmtCLP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("es-CL")}`;
  }
}

function normalizeEstadoOc(state) {
  const s = String(state || "").trim();
  const lower = s.toLowerCase();

  if (lower.includes("valid")) return "validado";
  if (lower.includes("recepcion")) return "recepcionado";
  if (lower.includes("cread") || lower.includes("nueva")) return "creado";

  // fallback: usar el estado entregado, pero en minúsculas
  return lower || "actualizado";
}

function buildInsumosTable({ orden, maxItems = 10 }) {
  const materiasPrimas = orden?.materiasPrimas;
  const list = Array.isArray(materiasPrimas) ? materiasPrimas : [];

  if (list.length === 0) {
    return {
      insumos_table_text: "Insumo\tCantidad\tValor Neto\n—\t—\t—",
      insumos_table_html:
        "<table style=\"border-collapse:collapse; width:100%;\">" +
        "<thead><tr>" +
        "<th style=\"text-align:left; padding:6px 8px; border-bottom:1px solid #ddd;\">Insumo</th>" +
        "<th style=\"text-align:right; padding:6px 8px; border-bottom:1px solid #ddd;\">Cantidad</th>" +
        "<th style=\"text-align:right; padding:6px 8px; border-bottom:1px solid #ddd;\">Valor Neto</th>" +
        "</tr></thead>" +
        "<tbody><tr>" +
        "<td style=\"padding:4px 8px; border-bottom:1px solid #eee;\">—</td>" +
        "<td style=\"padding:4px 8px; border-bottom:1px solid #eee; text-align:right;\">—</td>" +
        "<td style=\"padding:4px 8px; border-bottom:1px solid #eee; text-align:right;\">—</td>" +
        "</tr></tbody></table>",
    };
  }

  const normalized = list.map((mp) => {
    const nombre =
      mp?.proveedorMateriaPrima?.materiaPrima?.nombre ||
      mp?.proveedorMateriaPrima?.MateriaPrima?.nombre ||
      mp?.materiaPrima?.nombre ||
      `#${mp?.id_proveedor_materia_prima ?? "—"}`;

    const cantidad = Number(mp?.cantidad_formato ?? mp?.cantidad ?? 0) || 0;
    const precio = Number(mp?.precio_unitario ?? 0) || 0;
    const valorNeto = cantidad * precio;

    return { nombre, cantidad, valorNeto };
  });

  const shown = normalized.slice(0, maxItems);
  const moreCount = Math.max(0, normalized.length - shown.length);

  const tableTextHeader = "Insumo\tCantidad\tValor Neto";
  const tableTextRows = shown.map(
    (r) => `${r.nombre}\t${r.cantidad}\t${fmtCLP(r.valorNeto)}`
  );
  if (moreCount > 0) tableTextRows.push(`(+${moreCount} insumo(s) más)`);

  const rowsHtml = shown
    .map(
      (r) =>
        `<tr>` +
        `<td style="padding:4px 8px; border-bottom:1px solid #eee;">${String(r.nombre)}</td>` +
        `<td style="padding:4px 8px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${String(r.cantidad)}</td>` +
        `<td style="padding:4px 8px; border-bottom:1px solid #eee; text-align:right; white-space:nowrap;">${fmtCLP(r.valorNeto)}</td>` +
        `</tr>`
    )
    .join("");

  const moreHtml =
    moreCount > 0
      ? `<tr><td colspan="3" style="padding:6px 8px; color:#666;">(+${moreCount} insumo(s) más)</td></tr>`
      : "";

  const tableHtml =
    `<table style="border-collapse:collapse; width:100%;">` +
    `<thead>` +
    `<tr>` +
    `<th style="text-align:left; padding:6px 8px; border-bottom:1px solid #ddd;">Insumo</th>` +
    `<th style="text-align:right; padding:6px 8px; border-bottom:1px solid #ddd;">Cantidad</th>` +
    `<th style="text-align:right; padding:6px 8px; border-bottom:1px solid #ddd;">Valor Neto</th>` +
    `</tr>` +
    `</thead>` +
    `<tbody>` +
    rowsHtml +
    moreHtml +
    `</tbody>` +
    `</table>`;

  return {
    insumos_table_text: [tableTextHeader, ...tableTextRows].join("\n"),
    insumos_table_html: tableHtml,
  };
}

export function buildOcEmailParams({
  nn,
  state,
  operador,
  ordenId,
  orden,
  maxInsumos = 10,
}) {
  const estado_oc = normalizeEstadoOc(state);
  const emitida_por = operador || "—";
  const oc_id = ordenId;

  const table = buildInsumosTable({ orden, maxItems: maxInsumos });

  return {
    nn: nn || "NN",
    estado_oc,
    emitida_por,
    oc_id,
    insumos_table_text: table.insumos_table_text,
    insumos_table_html: table.insumos_table_html,
  };
}
