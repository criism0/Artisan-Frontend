import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { etiquetaOpcion, resumenCombinacion } from "../../utils/combinacionTransporte.js";

/**
 * Con qué transportista, chofer y patente sale el documento (Res. Ex. SII N° 144, desde el
 * 1-nov-2026). Se elige de las combinaciones de Logística → Transporte; la de la bodega de origen
 * viene puesta, porque casi siempre sale el mismo camión.
 *
 * `permiteRetiro`: sólo en ventas. Un traslado entre bodegas no puede ser un retiro del cliente.
 * `onExigida(bool)`: con la resolución apagada el documento se emite igual, sin el bloque, y el
 * formulario no debe trabarse.
 */
export default function SelectorTransporte({
  idBodegaOrigen, valor, onCambiar, onExigida, permiteRetiro = false, esFactura = false,
}) {
  const api = useApi();
  const [estado, setEstado] = useState({ cargando: true, exigida: false, oculto: false, combinaciones: [] });

  useEffect(() => {
    let vivo = true;
    api("/combinaciones-transporte?activas=true")
      .then((r) => {
        // Por ahora sólo las guías llevan los datos (2026-11-02): en la factura el selector no
        // aparece mientras `resolucion_154_facturas` esté apagado.
        const exigida = esFactura ? !!r?.resolucion_154_facturas : !!r?.resolucion_154;
        if (vivo) setEstado({ cargando: false, exigida, oculto: esFactura && !exigida, combinaciones: r?.combinaciones ?? [] });
      })
      .catch(() => vivo && setEstado({ cargando: false, exigida: false, oculto: esFactura, combinaciones: [] }));
    return () => { vivo = false; };
  }, [api, esFactura]);

  useEffect(() => { onExigida?.(estado.exigida); }, [estado.exigida, onExigida]);

  const opciones = useMemo(
    () => estado.combinaciones.filter((c) => permiteRetiro || c.modalidad !== "retiro"),
    [estado.combinaciones, permiteRetiro],
  );

  // La de la bodega de origen, si todavía no se eligió ninguna. Una sola vez: si después alguien
  // la quita a propósito, no se vuelve a poner sola.
  const yaPusoPorDefecto = useRef(false);
  useEffect(() => {
    if (estado.cargando || estado.oculto || yaPusoPorDefecto.current) return;
    yaPusoPorDefecto.current = true;
    if (valor) return;
    const porDefecto = opciones.find((c) => idBodegaOrigen != null && c.id_bodega_por_defecto === Number(idBodegaOrigen));
    if (porDefecto) onCambiar(porDefecto.id, porDefecto);
  }, [estado.cargando, estado.oculto, opciones, idBodegaOrigen, valor, onCambiar]);

  const elegida = useMemo(() => opciones.find((c) => c.id === Number(valor)) ?? null, [opciones, valor]);

  if (estado.cargando || estado.oculto) return null;
  if (opciones.length === 0) {
    if (!estado.exigida) return null;
    return (
      <p className="text-sm text-red-700">
        Falta el transporte: créalo en{" "}
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
          const c = opciones.find((x) => x.id === Number(e.target.value)) ?? null;
          onCambiar(c ? c.id : null, c);
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-transparent"
      >
        <option value="">{estado.exigida ? "Elige el transporte" : "Sin transporte"}</option>
        {opciones.map((c) => (
          <option key={c.id} value={c.id}>{etiquetaOpcion(c)}</option>
        ))}
      </select>
      {elegida && <span className="block mt-1 text-xs text-gray-500">{resumenCombinacion(elegida)}</span>}
    </label>
  );
}
