import { useCallback, useEffect, useRef, useState } from "react";
import { autocompletarLugar, detalleLugar } from "../services/rutasService";
import { toast } from "../lib/toast.js";

const nuevaSesion = () =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * El buscador de direcciones «como la barra de Google Maps»: sugerencias mientras se escribe
 * (Places Autocomplete) y, al elegir una, el lugar con su punto y la dirección separada en partes.
 *
 * Las teclas y el detalle elegido van en una misma sesión (`sesion`), que Google cobra como una
 * búsqueda; después de elegir se abre otra. Una respuesta vieja no pisa a una nueva.
 */
export default function useAutocompletarLugar({ activo, idBodega }) {
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const sesion = useRef(nuevaSesion());
  const pedido = useRef(0);

  useEffect(() => {
    if (activo) sesion.current = nuevaSesion();
  }, [activo]);

  useEffect(() => {
    if (!activo) return undefined;
    const t = texto.trim();
    if (t.length < 3) {
      pedido.current += 1;
      setSugerencias([]);
      setBuscando(false);
      return undefined;
    }
    const id = ++pedido.current;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await autocompletarLugar(t, idBodega, sesion.current);
        if (id === pedido.current) setSugerencias(Array.isArray(r) ? r : []);
      } catch (e) {
        if (id === pedido.current) toast.error(e.message);
      } finally {
        if (id === pedido.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [texto, activo, idBodega]);

  /** El lugar de una sugerencia (con punto). Cierra la sesión y limpia la lista. */
  const elegir = useCallback(async (sugerencia) => {
    const lugar = await detalleLugar(sugerencia.id, sesion.current);
    sesion.current = nuevaSesion();
    pedido.current += 1;
    setSugerencias([]);
    return lugar;
  }, []);

  return { texto, setTexto, sugerencias, buscando, elegir };
}
