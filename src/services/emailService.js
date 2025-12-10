import { API_BASE, getToken } from "../lib/api";
import { toast } from "../lib/toast";

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
}) {
  try {
    const subject = `Orden ${ordenId} - Estado: ${state}`;
    const params = {
      name: bodega,
      clientNames,
      date: new Date().toLocaleString("es-CL"),
      operador,
      state,
      oc_id: ordenId,
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
