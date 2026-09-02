import { useEffect, useState } from "react";

/**
 * Memoria de una lista: búsqueda, orden, filas por página, panel de filtros y columnas
 * visibles, más los filtros propios de cada página.
 *
 * 🔴 POR QUÉ. Pedido de Hernán (2026-08-28): *«que los filtros se mantengan al volver del
 * detalle»*. Hasta ahora eso sólo lo hacía Inventario de Bultos, con código propio, porque esa
 * vista no usa `DataTable`. Acá vive la parte compartida para que cualquier lista lo herede con
 * una prop.
 *
 * ⚠️ Va en su propio archivo y no dentro de `DataTable.jsx` a propósito: un archivo que exporta
 * un componente Y otra cosa rompe el Fast Refresh de Vite (`react-refresh/only-export-components`).
 * Es la misma razón por la que `POSTERIOR_LABEL` salió de `EstadoPosteriorBadge.jsx`.
 *
 * Todo lo de una lista va bajo UNA sola clave. Si cada pieza tuviera la suya, limpiar la memoria
 * de una lista dejaría la mitad puesta y el usuario vería una tabla filtrada por algo que el
 * panel dice que está apagado.
 */

const claveDe = (persistKey) => `dt:${persistKey}`;

export function leerGuardado(persistKey) {
  if (!persistKey) return null;
  try {
    const raw = localStorage.getItem(claveDe(persistKey));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // Storage corrupto, deshabilitado o navegación privada: la lista funciona igual, sin
    // memoria. No poder recordar nunca puede romper la vista.
    return null;
  }
}

export function escribirGuardado(persistKey, parche) {
  if (!persistKey) return;
  try {
    localStorage.setItem(
      claveDe(persistKey),
      JSON.stringify({ ...(leerGuardado(persistKey) ?? {}), ...parche }),
    );
  } catch {
    // Ídem.
  }
}

/**
 * Estado de página que se guarda junto al de su `DataTable`, bajo la misma clave.
 *
 * Para los filtros propios de cada lista, que los persiste la página porque es la que sabe qué
 * significan.
 */
export function usePersistedState(persistKey, campo, valorInicial) {
  const [valor, setValor] = useState(() => {
    const guardado = leerGuardado(persistKey);
    return guardado && campo in guardado ? guardado[campo] : valorInicial;
  });

  useEffect(() => {
    escribirGuardado(persistKey, { [campo]: valor });
  }, [persistKey, campo, valor]);

  return [valor, setValor];
}
