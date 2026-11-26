import { useEffect, useRef } from "react";
import { encargadosDe } from "../utils/solicitudesVista.js";

/**
 * Al elegir las bodegas de una solicitud, sus encargados (de origen Y de destino) quedan solos en
 * «Avisar a» (pedido de Cristóbal, 2026-11-26). Antes había que apretar «Agregar encargados de
 * bodega proveedora», y el de destino —que es quien recibe— había que buscarlo a mano.
 *
 * Al cambiar una bodega se sacan los encargados que se agregaron solos por la anterior; a quien se
 * agregó a mano no se le toca. `activo` en false no hace nada (Editar lo enciende recién cuando el
 * usuario cambia una bodega, para no tocar a quiénes ya se avisaba).
 */
export function useEncargadosAutomaticos({ bodegas, usuarios, origen, destino, setSeleccion, activo = true }) {
  const agregados = useRef(new Set());

  useEffect(() => {
    if (!activo || bodegas.length === 0 || usuarios.length === 0) return;
    const nuevos = encargadosDe(bodegas, [origen, destino].filter(Boolean), usuarios);
    setSeleccion((actual) => {
      const aMano = actual.filter((u) => !agregados.current.has(u.id));
      const ya = new Set(aMano.map((u) => u.id));
      const sumar = nuevos
        .filter((u) => !ya.has(u.id))
        .map((u) => ({ id: u.id, label: u.label, email: u.email }));
      agregados.current = new Set(sumar.map((u) => u.id));
      return [...aMano, ...sumar];
    });
  }, [activo, bodegas, usuarios, origen, destino, setSeleccion]);
}
