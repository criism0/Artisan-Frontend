import { API_BASE, getToken } from "../lib/api";
import { toast } from "../lib/toast";

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Construye los items de email (insumos) desde la respuesta de la OC.
 * Se envían como strings para no depender de formateo en Brevo.
 * @returns {{ items: Array, totalNeto: number, iva: number, totalPago: number }}
 */
export function buildOcEmailItemsFromOrden(ordenData) {
  const materiasPrimas = Array.isArray(ordenData?.materiasPrimas)
    ? ordenData.materiasPrimas
    : [];

  let totalNeto = 0;
  
  const items = materiasPrimas
    .map((mp) => {
      const formato = mp.proveedorMateriaPrima?.formato || mp.formato || "—";
      const nombre =
        mp?.proveedorMateriaPrima?.materiaPrima?.nombre ||
        mp?.proveedorMateriaPrima?.MateriaPrima?.nombre ||
        (mp?.id_proveedor_materia_prima
          ? `MP #${mp.id_proveedor_materia_prima}`
          : "Insumo");

      const cantidadFormato = Number(mp?.cantidad_formato ?? mp?.cantidad ?? 0);
      const precioUnitario = Number(mp?.precio_unitario ?? 0);
      const valorNeto = precioUnitario * cantidadFormato;
      totalNeto += valorNeto;

      return {
        nombreCompleto: `${formato} - ${nombre}`,
        cantidad: cantidadFormato.toLocaleString("es-CL"),
        precioUnitario: clpFormatter.format(precioUnitario),
        valorNeto: clpFormatter.format(valorNeto),
      };
    })
    .filter((i) => i.nombreCompleto);
  
  const iva = totalNeto * 0.19;
  const totalPago = totalNeto + iva;
  
  return { 
    items, 
    totalNeto: clpFormatter.format(totalNeto),
    iva: clpFormatter.format(iva),
    totalPago: clpFormatter.format(totalPago)
  };
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
  proveedor,
  clientNames,
  items,
  totalNeto,
  iva,
  totalPago,
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
      prov: proveedor || "No especificado",
      items: safeItems,
      totalNeto: totalNeto || "$0",
      iva: iva || "$0",
      totalPago: totalPago || "$0",
    };

    await sendTransactionalEmail({
      to: emails.map((email) => ({ email })),
      subject,
      params,
    });
  } catch (error) {
    console.error("Error enviando correo de notificación:", error);
  }
}
