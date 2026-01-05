import { API_BASE, getToken } from "../lib/api";
import { toast } from "../lib/toast";

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildItemsTableHtml(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) {
    return (
      "<p style=\"margin:0;\"><strong>Insumos:</strong> Sin insumos registrados.</p>"
    );
  }

  const rows = safeItems
    .map(
      (it) => `
        <tr>
          <td style="border-bottom:1px solid #eee; padding:6px 8px;">${escapeHtml(
            it.nombre
          )}</td>
          <td style="border-bottom:1px solid #eee; padding:6px 8px; text-align:right;">${escapeHtml(
            it.cantidad
          )}</td>
          <td style="border-bottom:1px solid #eee; padding:6px 8px; text-align:right;">${escapeHtml(
            it.valorNeto
          )}</td>
        </tr>`
    )
    .join("\n");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:8px;">
      <thead>
        <tr>
          <th align="left" style="border-bottom:2px solid #ddd; padding:6px 8px;">Insumo</th>
          <th align="right" style="border-bottom:2px solid #ddd; padding:6px 8px;">Cantidad</th>
          <th align="right" style="border-bottom:2px solid #ddd; padding:6px 8px;">Valor Neto</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function buildItemsText(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (safeItems.length === 0) return "(Sin insumos registrados)";

  const maxName = Math.min(
    42,
    Math.max(10, ...safeItems.map((it) => String(it.nombre ?? "").length))
  );
  const maxQty = Math.min(
    10,
    Math.max(7, ...safeItems.map((it) => String(it.cantidad ?? "").length))
  );
  const maxValue = Math.min(
    14,
    Math.max(9, ...safeItems.map((it) => String(it.valorNeto ?? "").length))
  );

  const header =
    "INSUMO".padEnd(maxName) +
    "  " +
    "CANT.".padStart(maxQty) +
    "  " +
    "VALOR NETO".padStart(maxValue);
  const sep =
    "-".repeat(maxName) + "  " + "-".repeat(maxQty) + "  " + "-".repeat(maxValue);

  const lines = safeItems.map((it) => {
    const nombreRaw = String(it.nombre ?? "");
    const nombre =
      nombreRaw.length > maxName
        ? `${nombreRaw.slice(0, Math.max(0, maxName - 1))}…`
        : nombreRaw;
    const cantidad = String(it.cantidad ?? "");
    const valor = String(it.valorNeto ?? "");
    return (
      nombre.padEnd(maxName) +
      "  " +
      cantidad.padStart(maxQty) +
      "  " +
      valor.padStart(maxValue)
    );
  });

  return [header, sep, ...lines].join("\n");
}

/**
 * Construye los items de email (insumos) desde la respuesta de la OC.
 * Se envían como strings para no depender de formateo en Brevo.
 */
export function buildOcEmailItemsFromOrden(ordenData) {
  const materiasPrimas = Array.isArray(ordenData?.materiasPrimas)
    ? ordenData.materiasPrimas
    : [];

  return materiasPrimas
    .map((mp) => {
      const nombre =
        mp?.proveedorMateriaPrima?.materiaPrima?.nombre ||
        (mp?.id_proveedor_materia_prima
          ? `MP #${mp.id_proveedor_materia_prima}`
          : "Insumo");

      const cantidad = Number(mp?.cantidad_formato ?? mp?.cantidad ?? 0);
      const precioUnitario = Number(mp?.precio_unitario ?? 0);
      const valorNeto = precioUnitario * cantidad;

      return {
        nombre,
        cantidad: cantidad.toLocaleString("es-CL"),
        valorNeto: clpFormatter.format(valorNeto),
      };
    })
    .filter((i) => i.nombre);
}

/**
 * Envía un correo transaccional al backend (sin hooks).
 * @param {Object} options - Configuración del correo.
 * @param {Array<{ email: string }>} options.to - Lista de destinatarios.
 * @param {string} options.subject - Asunto del correo.
 * @param {Object} options.params - Parámetros para la plantilla de email.
 */
export async function sendTransactionalEmail({ to, subject, params }) {
  try {
    const payload = {
      to,
      subject,
      params,
      templateId: 2, // Mantener fijo: plantilla Tom para OC
    };

    console.log("Enviando correo transaccional:", payload); // Debug

    const headers = new Headers({
      "Content-Type": "application/json",
    });

    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    // No cambiar, el api no funciona, tiene que ser un fetch
    const res = await fetch(`${API_BASE}/email/send-transactional`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }); 

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error en respuesta del servidor: ${errorText}`);
    }

  } catch (error) {
    toast.error("Error al enviar correo transaccional:", error);
  }
}

/**
 * Envía un correo de notificación para cambios de estado en órdenes.
 * Centraliza todos los envíos de emails (crear, validar, pagar, etc.)
 */
export async function notifyOrderChange({
  
  emails, 
  ordenId,
  operador,
  state,
  bodega,
  clientNames,
  items,
}) {
  try {
    const subject = `Orden ${ordenId} - Estado: ${state}`;
    const safeItems = Array.isArray(items) ? items : [];
    const params = {
      name: bodega,
      clientNames,
      date: new Date().toLocaleString("es-CL"),
      operador,
      state,
      oc_id: ordenId,
      items: safeItems,
      items_table: buildItemsTableHtml(safeItems),
      items_text: buildItemsText(safeItems),
    };

    await sendTransactionalEmail({
      // TODO: Por ahora se mandan a los encargados de planta y Hernan, ver que persona extra se incluye
      to: [
        ...emails.map((email) => ({ email })),
        { email: "artisan2025.1@gmail.com" },
        // { email: "hvigil@artisan.cl" }, // Este va siempre?
      ],
      subject,
      params,
    });
  } catch (error) {
    console.error("Error enviando correo de notificación:", error);
  }
}
