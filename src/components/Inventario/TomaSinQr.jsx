import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { mensajeError } from "../../utils/mensajeError.js";
import { cantidadSinQr } from "../../utils/stockSinQr.js";

/**
 * La pestaña «Sin QR» de una toma (2026-10-29): los productos sin bultos se cuentan por cantidad.
 * Con la toma Activa se anota acá (o en el móvil); al validar, lo contado fija el stock.
 */
export default function TomaSinQr({ idSesion, editable, onCambio }) {
  const api = useApi();
  const [filas, setFilas] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api(`/sesiones-inventariado/${idSesion}/sin-qr`);
      setFilas(Array.isArray(r) ? r : r?.data ?? []);
    } catch (err) {
      toast.error(mensajeError(err, "cargar los productos sin QR"));
      setFilas([]);
    }
  }, [api, idSesion]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (fila, cantidad) => {
    try {
      await api(`/sesiones-inventariado/${idSesion}/sin-qr/${fila.id_nombre_facturacion}`, { method: "PUT", body: { cantidad } });
      await cargar();
      onCambio?.();
    } catch (err) {
      toast.error(mensajeError(err, "anotar el conteo"));
    }
  };

  if (filas == null) return <p className="text-sm text-gray-500 p-4">Cargando…</p>;
  if (!filas.length) return <p className="text-sm text-gray-500 p-4">No hay productos sin QR para contar.</p>;

  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Producto</th>
            <th className="px-4 py-2 text-right">En sistema</th>
            <th className="px-4 py-2 text-right">Contado</th>
            <th className="px-4 py-2 text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id_nombre_facturacion} className="border-t border-gray-100">
              <td className="px-4 py-2">{f.nombre}</td>
              <td className="px-4 py-2 text-right tabular-nums text-gray-600">{cantidadSinQr(f.en_sistema, f)}</td>
              <td className="px-4 py-2 text-right">
                {editable ? <Contador fila={f} onGuardar={(c) => guardar(f, c)} /> : f.contado == null ? <span className="text-gray-400">—</span> : <span className="tabular-nums font-semibold">{cantidadSinQr(f.contado, f)}</span>}
              </td>
              <td className={`px-4 py-2 text-right tabular-nums ${f.diferencia < 0 ? "text-red-600" : f.diferencia > 0 ? "text-green-700" : "text-gray-400"}`}>
                {f.diferencia == null ? "—" : `${f.diferencia > 0 ? "+" : ""}${cantidadSinQr(f.diferencia, f)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cajas + sueltas (o kilos); se guarda al salir del campo. Vacío = sin contar. */
function Contador({ fila, onGuardar }) {
  const porCaja = fila.unidad_venta === "Unidades" && Number(fila.unidades_por_caja) > 1 ? Number(fila.unidades_por_caja) : 0;
  const inicial = fila.contado;
  const [cajas, setCajas] = useState(inicial != null && porCaja ? String(Math.floor(inicial / porCaja)) : "");
  const [sueltas, setSueltas] = useState(inicial != null ? String(porCaja ? inicial % porCaja : inicial).replace(".", ",") : "");

  const total = () => {
    if (cajas === "" && sueltas === "") return null;
    const s = Number(String(sueltas).replace(",", ".")) || 0;
    return porCaja ? (Number(cajas) || 0) * porCaja + s : s;
  };
  const alSalir = () => {
    const t = total();
    if (t === (inicial ?? null)) return;
    onGuardar(t);
  };
  const clase = "w-16 h-8 px-2 border border-gray-300 rounded-lg text-right text-sm";
  return (
    <span className="inline-flex items-center gap-1">
      {porCaja > 0 && (
        <>
          <input inputMode="numeric" aria-label="Cajas" value={cajas} onChange={(e) => setCajas(e.target.value.replace(/\D/g, ""))} onBlur={alSalir} className={clase} />
          <span className="text-xs text-gray-500">cj</span>
        </>
      )}
      <input
        inputMode={fila.unidad_venta === "Unidades" ? "numeric" : "decimal"}
        aria-label={porCaja ? "Sueltas" : "Cantidad"}
        value={sueltas}
        onChange={(e) => setSueltas(fila.unidad_venta === "Unidades" ? e.target.value.replace(/\D/g, "") : e.target.value)}
        onBlur={alSalir}
        className={clase}
      />
      <span className="text-xs text-gray-500">{fila.unidad_venta === "Kilogramos" ? "kg" : fila.unidad_venta === "Litros" ? "L" : "un"}</span>
    </span>
  );
}
