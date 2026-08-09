/**
 * Saca el mensaje legible de un error de la API.
 *
 * 🔴 POR QUÉ EXISTE. Media aplicación leía `err.response.data.error`, que es la forma de
 * **axios** — y axios no es una dependencia de este proyecto. El helper `api()` lanza un
 * `ApiError` con otra forma:
 *
 *     class ApiError extends Error {
 *       constructor(message, status, data) {
 *         super(message);       // el mensaje del backend vive acá
 *         this.status = status; // NO err.response.status
 *         this.data = data;     // NO err.response.data
 *       }
 *     }
 *
 * Como `err.response` nunca existe, esas lecturas daban siempre `undefined` y el usuario
 * terminaba viendo un mensaje genérico. El caso que lo destapó: al facturar una orden el
 * backend respondía *"al cliente X le falta razón social, giro. Completa sus datos en
 * Administración → Clientes"* —exactamente lo que hay que hacer— y el toast decía
 * *"Verifica tu conexión e intenta nuevamente"*.
 *
 * Se acepta también la forma de axios, por si algún día entra: no cuesta nada y evita que el
 * mismo error vuelva por la puerta de al lado.
 */

export function estadoHttp(err) {
  return err?.status ?? err?.response?.status ?? null;
}

/** El mensaje que mandó el backend, o null si no vino ninguno. */
export function mensajeDelBackend(err) {
  const data = err?.data ?? err?.response?.data;
  const delCuerpo = data?.error ?? data?.message;
  if (typeof delCuerpo === 'string' && delCuerpo.trim()) return delCuerpo.trim();

  // ⚠️ `err.message` sólo cuenta cuando el error VIENE DE UNA RESPUESTA. Un fallo de red lanza
  // un `TypeError: Failed to fetch`, y mostrarle eso al usuario es peor que el genérico: no
  // dice nada y además tapa el consejo de revisar la conexión. La presencia de un status HTTP
  // es lo que distingue "el servidor contestó" de "no hubo servidor".
  if (estadoHttp(err) == null) return null;

  // `ApiError` ya copió el mensaje del cuerpo en `message`. Se descartan los rellenos que arma
  // el propio helper cuando el cuerpo no traía nada ("500 Internal Server Error").
  const msg = err?.message;
  if (typeof msg === 'string' && msg.trim() && !/^\d{3}\s/.test(msg) && msg !== 'Error desconocido') {
    return msg.trim();
  }
  return null;
}

/**
 * Mensaje listo para un toast.
 *
 * `accion` se usa sólo cuando no hay nada mejor que decir: "Error al facturar esta orden…".
 * Cuando el backend explicó qué pasa, **manda el backend** — es quien sabe qué falta.
 */
export function mensajeError(err, accion = 'realizar esta acción') {
  const estado = estadoHttp(err);
  const msg = mensajeDelBackend(err);

  // Un 403 sin explicación es siempre lo mismo; con explicación, la del backend es mejor.
  if (estado === 403 && !msg) {
    return `Sin permiso para ${accion}. Contacta al administrador.`;
  }
  if (!msg) {
    return `Error al ${accion}. Verifica tu conexión e intenta nuevamente.`;
  }

  // Algunos endpoints mandan además la lista de ítems afectados. Se cuenta en vez de
  // enumerarlos, para no desbordar el toast.
  const detalles = (err?.data ?? err?.response?.data)?.details;
  if (Array.isArray(detalles) && detalles.length > 0) {
    return `${msg} (${detalles.length} ${detalles.length === 1 ? 'ítem' : 'ítems'})`;
  }
  return msg;
}
