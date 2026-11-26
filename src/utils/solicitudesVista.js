// Lógica de la lista y el detalle de solicitudes de mercadería, aparte para poder probarla.

/** Días en tránsito desde los que la fecha se marca en ámbar: lo normal es llegar en 1 o 2. */
export const DIAS_TRANSITO_LARGO = 15;

const DIA = 24 * 3600 * 1000;

/**
 * La fecha que importa según dónde va la solicitud: recibida, enviada o creada. Antes la lista
 * tenía tres columnas de fecha y las dos últimas quedaban fuera de la pantalla.
 */
export function fechaDelPaso(s, ahora = Date.now()) {
  const leer = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  let fecha = null;
  let etiqueta = "creada";
  if (s?.estado === "Recepcionada" && leer(s.fecha_recepcion)) {
    fecha = leer(s.fecha_recepcion);
    etiqueta = "recibida";
  } else if (["En tránsito", "Recepcionada"].includes(s?.estado) && leer(s.fecha_envio)) {
    fecha = leer(s.fecha_envio);
    etiqueta = "enviada";
  } else {
    fecha = leer(s?.createdAt);
  }
  const dias = fecha ? Math.floor((ahora - fecha.getTime()) / DIA) : null;
  return { fecha, etiqueta, dias };
}

/**
 * Diferencia de una línea, con la misma tolerancia que el backend (`resultado.ts`): negativa si
 * faltó, positiva si sobró y 0 si calza o si todavía no hay cantidad que comparar.
 */
export function diferencia(real, referencia) {
  if (real == null || real === "" || referencia == null || referencia === "") return 0;
  const d = Number(real) - Number(referencia);
  if (!Number.isFinite(d) || Math.abs(d) <= 0.0005) return 0;
  return d;
}

/** Usuarios encargados de las bodegas elegidas, sin repetir y en el orden de las bodegas. */
export function encargadosDe(bodegas, ids, usuarios) {
  const vistos = new Set();
  const salida = [];
  for (const id of ids) {
    const bodega = bodegas.find((b) => String(b.value) === String(id));
    for (const enc of bodega?.encargados ?? []) {
      const idUsuario = Number(enc?.id_usuario);
      if (!Number.isFinite(idUsuario) || vistos.has(idUsuario)) continue;
      const usuario = usuarios.find((u) => Number(u.id) === idUsuario);
      if (!usuario) continue;
      vistos.add(idUsuario);
      salida.push({ ...usuario, bodega: bodega.label });
    }
  }
  return salida;
}
