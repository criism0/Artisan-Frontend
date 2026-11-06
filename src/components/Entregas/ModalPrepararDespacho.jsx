import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import Modal from "../UI/Modal";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";
import { repartirParejo, sinCaja } from "../../utils/despacho";

const cant = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });

/**
 * Preparar un pedido para el despacho desde la web (plan de rutas §17): el respaldo de la app de
 * bodega, que es donde se hace normalmente. Las mismas reglas: todo lo que sale en algún bulto,
 * las cajas pickeadas enteras pueden salir cerradas, y una foto del pedido armado.
 */
export default function ModalPrepararDespacho({ idOrden, despacho, onCerrar, onPreparado }) {
  const lineas = useMemo(() => (despacho?.lineas ?? []).filter((l) => l.por_preparar > 0), [despacho]);
  const cajasCerradasPosibles = despacho?.cajas ?? [];
  const [cerradas, setCerradas] = useState(() => new Set());
  const [cajas, setCajas] = useState(1);
  const [reparto, setReparto] = useState(() => repartirParejo(lineas, 1).map((f) => f.map(String)));
  const [archivos, setArchivos] = useState([]);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enCerradasDe = (conjunto) => {
    const r = {};
    for (const c of cajasCerradasPosibles) if (conjunto.has(c.id_bulto)) r[c.id_nombre_facturacion] = (r[c.id_nombre_facturacion] ?? 0) + c.unidades;
    return r;
  };
  const enCerradas = enCerradasDe(cerradas);
  const numerico = reparto.map((f) => f.map((v) => Number(String(v).replace(",", ".")) || 0));
  const sobra = sinCaja(lineas, numerico, enCerradas);
  const hayRestante = lineas.some((l) => l.por_preparar - (enCerradas[l.id_nombre_facturacion] ?? 0) > 1e-6);

  const repartir = (n, conjunto = cerradas) => {
    const enC = enCerradasDe(conjunto);
    const resto = lineas.map((l) => ({ ...l, por_preparar: Math.max(0, l.por_preparar - (enC[l.id_nombre_facturacion] ?? 0)) }));
    setCajas(n);
    setReparto(repartirParejo(resto, n).map((f) => f.map(String)));
  };

  const faltante = (() => {
    const i = sobra.findIndex((x) => Math.abs(x) > 1e-6);
    if (i >= 0) return sobra[i] > 0 ? `Faltan ${cant(sobra[i])} de ${lineas[i].nombre} en alguna caja` : `Sobran ${cant(-sobra[i])} de ${lineas[i].nombre}`;
    if (hayRestante && Array.from({ length: cajas }, (_, k) => numerico.some((f) => (f[k] ?? 0) > 0)).some((lleva) => !lleva)) return "Hay una caja armada vacía";
    if (!archivos.length) return "Falta la foto del pedido preparado";
    return null;
  })();

  const confirmar = async () => {
    if (faltante) return;
    setEnviando(true);
    try {
      const bultos = [
        ...[...cerradas].map((id_bulto) => ({ tipo: "Caja cerrada", id_bulto })),
        ...(hayRestante
          ? Array.from({ length: cajas }, (_, k) => ({
              tipo: "Armado",
              lineas: lineas.map((l, i) => ({ id_nombre_facturacion: l.id_nombre_facturacion, cantidad: numerico[i]?.[k] ?? 0 })).filter((x) => x.cantidad > 0),
            }))
          : []),
      ];
      const form = new FormData();
      form.append("datos", JSON.stringify({ bultos, comentario: comentario.trim() || null }));
      for (const a of archivos) form.append("preparacion", a);
      await rutasApi.prepararDespacho(idOrden, form);
      toast.success(`Pedido preparado en ${bultos.length} bulto${bultos.length === 1 ? "" : "s"}`);
      onPreparado?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      titulo={`Preparar el despacho de la OV #${idOrden}`}
      descripcion="Normalmente lo hace bodega desde la app al terminar el picking. Todo lo que sale tiene que ir en algún bulto."
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!!faltante || enviando}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            title={faltante ?? ""}
          >
            {enviando ? "Guardando…" : faltante ?? "Confirmar preparación"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              <th className="text-left font-medium py-1">Lo que sale</th>
              <th className="text-right font-medium py-1">Cantidad</th>
              <th className="text-right font-medium py-1">Sin caja</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.id_nombre_facturacion} className="border-b border-gray-50">
                <td className="py-1">{l.nombre}</td>
                <td className="py-1 text-right">{cant(l.por_preparar)}</td>
                <td className={`py-1 text-right ${Math.abs(sobra[i]) > 1e-6 ? "text-amber-700 font-medium" : "text-gray-400"}`}>{cant(sobra[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {cajasCerradasPosibles.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900">Cajas que salen cerradas</h3>
            <p className="text-xs text-gray-500 mb-1">Pickeadas enteras: van tal cual, con su propia etiqueta.</p>
            {cajasCerradasPosibles.map((c) => (
              <label key={c.id_bulto} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={cerradas.has(c.id_bulto)}
                  onChange={() => {
                    const s = new Set(cerradas);
                    if (s.has(c.id_bulto)) s.delete(c.id_bulto);
                    else s.add(c.id_bulto);
                    setCerradas(s);
                    repartir(cajas, s);
                  }}
                />
                {cant(c.unidades)} {c.nombre} <span className="text-xs text-gray-400 font-mono">{c.identificador}</span>
              </label>
            ))}
          </div>
        )}

        {hayRestante && (
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-gray-900 flex-1">Cajas armadas</h3>
              <button type="button" onClick={() => repartir(Math.max(1, cajas - 1))} className="p-1 rounded border border-gray-300 hover:bg-gray-50" aria-label="Una caja menos"><Minus className="w-4 h-4" /></button>
              <span className="w-6 text-center font-semibold">{cajas}</span>
              <button type="button" onClick={() => repartir(Math.min(50, cajas + 1))} className="p-1 rounded border border-gray-300 hover:bg-gray-50" aria-label="Una caja más"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left font-medium pr-3">Producto</th>
                    {Array.from({ length: cajas }, (_, k) => (
                      <th key={k} className="font-medium px-1">Caja {cerradas.size + k + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={l.id_nombre_facturacion}>
                      <td className="pr-3 py-1 text-gray-700 max-w-[220px] truncate" title={l.nombre}>{l.nombre}</td>
                      {Array.from({ length: cajas }, (_, k) => (
                        <td key={k} className="px-1 py-1">
                          <input
                            inputMode="decimal"
                            value={reparto[i]?.[k] ?? ""}
                            onChange={(e) => setReparto(reparto.map((f, fi) => (fi === i ? f.map((x, xk) => (xk === k ? e.target.value : x)) : f)))}
                            className="w-16 h-8 px-2 border border-gray-300 rounded text-right"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">Foto del pedido preparado *</span>
          <input type="file" accept="image/*" multiple onChange={(e) => setArchivos([...e.target.files])} className="text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-700">Comentario</span>
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} className="h-9 px-3 border border-gray-300 rounded-lg" placeholder="Opcional" />
        </label>
      </div>
    </Modal>
  );
}
