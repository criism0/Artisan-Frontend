import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import Modal from "../UI/Modal";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";

/**
 * Los sectores de entrega (grupos de comunas) que define Logística (2026-10-30). Cada sector se
 * guarda por su cuenta; una comuna no puede estar en dos (lo dice el backend).
 */
export default function ModalSectores({ sectores, comunasConocidas, onCerrar, onCambio }) {
  const [filas, setFilas] = useState(() => sectores.map((s) => ({ ...s, comunas: [...s.comunas], nuevo: "" })));
  const [guardando, setGuardando] = useState(null);

  const cambiar = (i, cambios) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...cambios, sucio: true } : f)));
  const agregarComuna = (i) => {
    const t = filas[i].nuevo.trim();
    if (!t) return;
    if (filas[i].comunas.some((c) => c.toLowerCase() === t.toLowerCase())) return cambiar(i, { nuevo: "" });
    cambiar(i, { comunas: [...filas[i].comunas, t], nuevo: "" });
  };

  const guardar = async (i) => {
    const f = filas[i];
    setGuardando(i);
    try {
      const datos = { nombre: f.nombre, color: f.color, comunas: f.comunas };
      const r = f.id ? await rutasApi.actualizarSector(f.id, datos) : await rutasApi.crearSector(datos);
      setFilas((fs) => fs.map((x, k) => (k === i ? { ...r, comunas: [...r.comunas], nuevo: "", sucio: false } : x)));
      toast.success(`Sector «${r.nombre}» guardado`);
      onCambio?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(null);
    }
  };

  const eliminar = async (i) => {
    const f = filas[i];
    if (!f.id) return setFilas((fs) => fs.filter((_, k) => k !== i));
    try {
      await rutasApi.eliminarSector(f.id);
      setFilas((fs) => fs.filter((_, k) => k !== i));
      onCambio?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const enUso = new Set(filas.flatMap((f) => f.comunas.map((c) => c.toLowerCase())));
  const libres = comunasConocidas.filter((c) => !enUso.has(c.toLowerCase()));

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      titulo="Sectores"
      descripcion={libres.length ? `Sin sector: ${libres.join(", ")}` : undefined}
      pie={<button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Cerrar</button>}
    >
      <datalist id="comunas-conocidas">{libres.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="flex flex-col gap-3">
        {filas.map((f, i) => (
          <div key={f.id ?? `n${i}`} className="rounded-lg border border-gray-200 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input type="color" value={f.color} onChange={(e) => cambiar(i, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0 p-0" aria-label="Color" />
              <input value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} className="flex-1 h-8 px-2 border border-gray-300 rounded-lg text-sm font-medium" aria-label="Nombre del sector" />
              {f.sucio && (
                <button type="button" onClick={() => guardar(i)} disabled={guardando === i} className="px-3 h-8 rounded-lg bg-primary text-white text-sm hover:bg-primary-dark disabled:opacity-50">
                  {guardando === i ? "Guardando…" : "Guardar"}
                </button>
              )}
              <button type="button" onClick={() => eliminar(i)} className="p-1.5 text-gray-400 hover:text-red-600" title="Eliminar sector"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {f.comunas.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {c}
                  <button type="button" onClick={() => cambiar(i, { comunas: f.comunas.filter((x) => x !== c) })} className="text-gray-400 hover:text-red-600" aria-label={`Quitar ${c}`}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input
                list="comunas-conocidas"
                value={f.nuevo}
                onChange={(e) => setFilas((fs) => fs.map((x, k) => (k === i ? { ...x, nuevo: e.target.value } : x)))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarComuna(i); } }}
                onBlur={() => agregarComuna(i)}
                placeholder="+ comuna"
                className="w-36 h-7 px-2 border border-dashed border-gray-300 rounded-full text-xs"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFilas((fs) => [...fs, { nombre: "", color: "#7A5AF8", comunas: [], nuevo: "", sucio: true }])}
          className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" /> Sector
        </button>
      </div>
    </Modal>
  );
}
