import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api";

/**
 * Con qué transportista, chofer y patente sale el documento (Res. Ex. SII N° 154, desde el
 * 1-nov-2026). Se elige de las combinaciones de Logística → Transporte; la de la bodega de origen
 * viene puesta, porque casi siempre sale el mismo camión.
 *
 * `onCambiar(id, combinacion)` recibe también si hoy se exige (`exigida`): con la resolución
 * apagada el documento se emite igual, sin el bloque, y el formulario no debe trabarse.
 */
export default function SelectorTransporte({ idBodegaOrigen, valor, onCambiar, onExigida }) {
  const api = useApi();
  const [estado, setEstado] = useState({ cargando: true, exigida: false, combinaciones: [] });

  useEffect(() => {
    let vivo = true;
    api("/combinaciones-transporte?activas=true")
      .then((r) => vivo && setEstado({ cargando: false, exigida: !!r?.resolucion_154, combinaciones: r?.combinaciones ?? [] }))
      .catch(() => vivo && setEstado({ cargando: false, exigida: false, combinaciones: [] }));
    return () => { vivo = false; };
  }, [api]);

  useEffect(() => { onExigida?.(estado.exigida); }, [estado.exigida, onExigida]);

  // La de la bodega de origen, si todavía no se eligió ninguna. Una sola vez: si después alguien
  // la quita a propósito, no se vuelve a poner sola.
  const yaPusoPorDefecto = useRef(false);
  useEffect(() => {
    if (estado.cargando || yaPusoPorDefecto.current) return;
    yaPusoPorDefecto.current = true;
    if (valor) return;
    const porDefecto = estado.combinaciones.find((c) => idBodegaOrigen != null && c.id_bodega_por_defecto === Number(idBodegaOrigen));
    if (porDefecto) onCambiar(porDefecto.id, porDefecto);
  }, [estado, idBodegaOrigen, valor, onCambiar]);

  const elegida = useMemo(
    () => estado.combinaciones.find((c) => c.id === Number(valor)) ?? null,
    [estado.combinaciones, valor],
  );

  if (estado.cargando) return null;
  if (estado.combinaciones.length === 0) {
    if (!estado.exigida) return null;
    return (
      <p className="text-sm text-red-700">
        Falta el transporte: crea la combinación en{" "}
        <Link to="/Logistica/transporte" className="underline font-medium">Logística → Transporte</Link>.
      </p>
    );
  }

  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        Transporte{estado.exigida && !elegida && <span className="text-red-600"> *</span>}
      </span>
      <select
        value={valor ?? ""}
        onChange={(e) => {
          const c = estado.combinaciones.find((x) => x.id === Number(e.target.value)) ?? null;
          onCambiar(c ? c.id : null, c);
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-transparent"
      >
        <option value="">{estado.exigida ? "Elige el transporte" : "Sin transporte"}</option>
        {estado.combinaciones.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre} · {c.patente}</option>
        ))}
      </select>
      {elegida && (
        <span className="block mt-1 text-xs text-gray-500">
          {elegida.chofer_nombre} ({elegida.chofer_rut}) · transportista {elegida.transportista ? `${elegida.transportista}, ` : ""}{elegida.rut_transportista}
        </span>
      )}
    </label>
  );
}
