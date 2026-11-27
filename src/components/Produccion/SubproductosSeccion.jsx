// Subproductos dentro de «Registrar producción» (Fase 5, 2026-11-26). Antes eran dos pantallas
// aparte («¿Se produjeron subproductos?» y el formulario), antes de la salida principal, y la
// página se recargaba sola después de cada uno. Entran al inventario a costo 0.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatFecha } from "../../lib/dateUtils";
import { formatNumberCL } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

export default function SubproductosSeccion({ om, onCambio }) {
  const posibles = om?.receta?.posiblesSubproductos ?? [];
  const [registrados, setRegistrados] = useState([]);
  const [form, setForm] = useState({ id_materia_prima: "", peso: "", fecha_vencimiento: "" });
  const [guardando, setGuardando] = useState(false);
  const puede = checkScope(ModelType.REGISTRO_SUBPRODUCTO, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    try {
      const r = await api(`/ordenes_manufactura/${om.id}/productos_finales`);
      setRegistrados(Array.isArray(r?.subproductos) ? r.subproductos : []);
    } catch {
      setRegistrados([]);
    }
  }, [om.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (posibles.length === 0 && registrados.length === 0) return null;

  const registrar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api("/registro-subproductos", {
        method: "POST",
        body: {
          id_orden_manufactura: Number(om.id),
          id_materia_prima: Number(form.id_materia_prima),
          peso: Number(form.peso),
          fecha_vencimiento: form.fecha_vencimiento,
          id_bodega: Number(om.bodega?.id ?? om.id_bodega),
        },
      });
      toast.success("Subproducto registrado");
      setForm({ id_materia_prima: "", peso: "", fecha_vencimiento: "" });
      await cargar();
      onCambio?.();
    } catch (err) {
      toast.error(mensajeDelBackend(err) || "No se pudo registrar el subproducto");
    } finally {
      setGuardando(false);
    }
  };

  const listo = form.id_materia_prima && Number(form.peso) > 0 && form.fecha_vencimiento;
  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-text">Subproductos</h2>
      {registrados.length > 0 && (
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {registrados.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{s.materiaPrima?.nombre ?? s.MateriaPrima?.nombre ?? `Subproducto #${s.id}`}</span>
              <span className="tabular-nums text-gray-600">
                {formatNumberCL(s.peso, 2)} kg{s.fecha_vencimiento ? ` · vence ${formatFecha(s.fecha_vencimiento)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {puede && posibles.length > 0 && (
        <form onSubmit={registrar} className="flex flex-wrap items-end gap-2 text-sm">
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className="block text-xs font-medium text-gray-600">Subproducto</span>
            <select value={form.id_materia_prima} onChange={(e) => setForm((f) => ({ ...f, id_materia_prima: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5">
              <option value="">Elige…</option>
              {posibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Peso (kg)</span>
            <input type="number" min="0" step="any" value={form.peso} onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-gray-600">Vence</span>
            <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
              className="rounded-lg border border-gray-300 px-2 py-1.5" />
          </label>
          <button type="submit" className="btn btn-secundario" disabled={guardando || !listo}>
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}
    </section>
  );
}
