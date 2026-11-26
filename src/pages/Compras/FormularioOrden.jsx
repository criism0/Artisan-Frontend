import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Selector from "../../components/Forms/Selector";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { adjuntosService, TIPOS_ACEPTADOS } from "../../services/adjuntosService.js";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import PageHeader from "../../components/UI/PageHeader";

/**
 * Nueva orden de compra y edición de una existente (con `:ordenId`).
 *
 * Antes eran dos archivos de ~820 líneas, uno copia del otro, que ya se habían separado (el de
 * editar no tenía la búsqueda por insumo). Además cada uno guardaba lo elegido dos veces —en la
 * lista de insumos del proveedor y en otra de «seleccionados»— y las mantenía a mano en sincronía.
 * Ahora hay un solo estado, `lineas` (cantidad y precio por formato), y lo demás se deriva.
 */

const hoyISO = () => new Date().toISOString().slice(0, 10);
const haceTresMeses = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};
const lista = (res, clave) => (Array.isArray(res?.data) ? res.data : Array.isArray(res?.[clave]) ? res[clave] : Array.isArray(res?.data?.[clave]) ? res.data[clave] : Array.isArray(res) ? res : []);

export default function FormularioOrden() {
  const { ordenId } = useParams();
  const editando = Boolean(ordenId);
  const navigate = useNavigate();
  const api = useApi();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [catalogo, setCatalogo] = useState([]); // formatos que vende el proveedor elegido
  const [lineasOrden, setLineasOrden] = useState([]); // líneas que ya tenía la orden (editar)
  const [lineas, setLineas] = useState({}); // id formato → { cantidad, precio }
  const [form, setForm] = useState({ id_proveedor: "", id_bodega: "", fecha: hoyISO(), condiciones: "", requiere_prepago: false });
  // Se suben como adjuntos de la orden (los mismos de una OV) recién guardada; los que ya tenía se
  // ven y se borran en «Documentos» del detalle.
  const [archivosNuevos, setArchivosNuevos] = useState([]);
  const [errores, setErrores] = useState({});

  // Búsqueda por insumo: qué proveedores lo ofrecen y a qué precio.
  const [porInsumo, setPorInsumo] = useState(false);
  const [insumos, setInsumos] = useState(null);
  const [insumoBuscado, setInsumoBuscado] = useState("");
  const [ofertas, setOfertas] = useState([]);

  const puedeEscribir = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const campo = (nombre, valor) => setForm((f) => ({ ...f, [nombre]: valor }));

  useEffect(() => {
    (async () => {
      try {
        const [prov, bod, orden] = await Promise.all([
          api(`/proveedores`),
          api(`/bodegas`),
          editando ? api(`/proceso-compra/ordenes/${ordenId}`) : null,
        ]);
        setProveedores(lista(prov, "proveedores").filter((p) => p.activo === true));
        setBodegas(lista(bod, "bodegas").filter((b) => typeof b?.nombre === "string" && b.nombre.toLowerCase().trim() !== "en tránsito"));
        if (orden) {
          setForm({
            id_proveedor: String(orden.id_proveedor ?? ""),
            id_bodega: String(orden.id_bodega_solicitante ?? ""),
            fecha: orden.fecha?.slice(0, 10) || hoyISO(),
            condiciones: orden.condiciones || "",
            requiere_prepago: Boolean(orden.requiere_prepago),
          });
          setLineasOrden(orden.materiasPrimas || []);
          setLineas(
            Object.fromEntries(
              (orden.materiasPrimas || []).map((l) => [
                String(l.id_proveedor_materia_prima),
                { cantidad: String(l.cantidad_formato ?? ""), precio: String(l.precio_unitario ?? "") },
              ])
            )
          );
        }
      } catch (error) {
        toast.error(mensajeDelBackend(error) || "No se pudieron cargar los datos");
      } finally {
        setCargando(false);
      }
    })();
  }, [api, editando, ordenId]);

  useEffect(() => {
    if (!form.id_proveedor) {
      setCatalogo([]);
      return;
    }
    api(`/proveedores/${form.id_proveedor}`)
      .then((res) => setCatalogo((res?.materiasPrimas || []).filter((i) => i.materiaPrima?.activo === true)))
      .catch((error) => {
        toast.error(mensajeDelBackend(error) || "No se pudieron cargar los insumos del proveedor");
        setCatalogo([]);
      });
  }, [api, form.id_proveedor]);

  useEffect(() => {
    if (!porInsumo || insumos !== null) return;
    api(`/materias-primas`)
      .then((res) => setInsumos(lista(res, "materiasPrimas").filter((i) => i.activo === true)))
      .catch(() => setInsumos([]));
  }, [api, porInsumo, insumos]);

  useEffect(() => {
    if (!insumoBuscado) {
      setOfertas([]);
      return;
    }
    api(`/proveedor-materia-prima/por-materia-prima?id_materia_prima=${insumoBuscado}`)
      .then((res) => setOfertas(lista(res).filter((o) => o.proveedor?.activo === true)))
      .catch(() => setOfertas([]));
  }, [api, insumoBuscado]);

  const elegirProveedor = (id) => {
    if (String(id ?? "") === form.id_proveedor) return;
    campo("id_proveedor", String(id ?? ""));
    setLineas({});
    setLineasOrden([]);
  };

  // Formatos a mostrar: los del proveedor, más los que la orden ya tenía y hoy no están activos.
  const filas = useMemo(() => {
    const ids = new Set(catalogo.map((c) => String(c.id)));
    const extras = lineasOrden
      .filter((l) => !ids.has(String(l.id_proveedor_materia_prima)))
      .map((l) => ({ id: l.id_proveedor_materia_prima, precio_unitario: l.precio_unitario, ...l.proveedorMateriaPrima, id_extra: true }));
    return [...catalogo, ...extras];
  }, [catalogo, lineasOrden]);

  const grupos = useMemo(() => {
    const m = new Map();
    for (const f of filas) {
      const nombre = f.materiaPrima?.nombre || "Insumo";
      if (!m.has(nombre)) m.set(nombre, []);
      m.get(nombre).push(f);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filas]);

  const precioDe = (f) => {
    const p = lineas[String(f.id)]?.precio;
    return p !== undefined && p !== "" ? Number(p) || 0 : Number(f.precio_unitario) || 0;
  };
  const cantidadDe = (f) => Number(lineas[String(f.id)]?.cantidad) || 0;
  const cambiar = (f, clave, valor) =>
    setLineas((prev) => ({ ...prev, [String(f.id)]: { ...prev[String(f.id)], [clave]: valor } }));

  const elegidas = filas.filter((f) => cantidadDe(f) > 0);
  const neto = elegidas.reduce((s, f) => s + cantidadDe(f) * precioDe(f), 0);
  const iva = Math.round(neto * 0.19);

  const validar = () => {
    const e = {};
    if (!form.id_proveedor) e.id_proveedor = "Elige un proveedor.";
    if (!form.id_bodega) e.id_bodega = "Elige una bodega.";
    if (!form.fecha) e.fecha = "Indica la fecha.";
    else if (!editando && form.fecha < haceTresMeses()) e.fecha = "No puede ser de hace más de 3 meses.";
    if (elegidas.length === 0) e.insumos = "Indica la cantidad de al menos un insumo.";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const body = {
        id_proveedor: Number(form.id_proveedor),
        id_bodega_solicitante: Number(form.id_bodega),
        id_bodega_destino: Number(form.id_bodega),
        fecha: form.fecha,
        condiciones: form.condiciones,
        requiere_prepago: form.requiere_prepago,
        materias_primas: elegidas.map((f) => ({
          id_proveedor_materia_prima: Number(f.id),
          cantidad_formato: cantidadDe(f),
          precio_unitario: precioDe(f),
        })),
      };
      const res = await api(editando ? `/proceso-compra/ordenes/${ordenId}` : `/proceso-compra/ordenes`, {
        method: editando ? "PUT" : "POST",
        body,
      });
      const id = editando ? ordenId : res?.orden?.id;
      for (const archivo of archivosNuevos) {
        try {
          await adjuntosService.subir({ archivo, idOrdenCompra: id });
        } catch (err) {
          toast.error(`La orden quedó guardada, pero no se pudo adjuntar ${archivo.name}: ${err.message || err}`);
        }
      }
      toast.success(editando ? "Orden actualizada" : "Orden creada");
      navigate(`/adquisiciones/ordenes-compra/${id ?? ""}`);
    } catch (error) {
      toast.error(mensajeDelBackend(error) || "No se pudo guardar la orden");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <PageLoader message="Cargando datos" />;

  const opcionesProveedor = proveedores.map((p) => ({ label: p.nombre_empresa || p.nombre || `Proveedor #${p.id}`, value: String(p.id), searchText: `${p.nombre_empresa || ""} ${p.rut_empresa || ""}` }));
  const opcionesBodega = bodegas.map((b) => ({ label: b.nombre, value: String(b.id) }));
  const opcionesInsumo = (insumos || []).map((i) => ({ label: i.nombre || `Insumo #${i.id}`, value: String(i.id) }));
  const error = (clave) => errores[clave] && <p className="text-red-600 text-xs mt-1">{errores[clave]}</p>;
  const lbl = "block text-sm font-medium text-gray-700 mb-1";
  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm";

  return (
    <div>
      <PageHeader volverA={editando ? `/adquisiciones/ordenes-compra/${ordenId}` : "/adquisiciones/ordenes-compra"} titulo={editando ? `Editar OC #${ordenId}` : "Nueva orden de compra"} />

      <form onSubmit={guardar} className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <div className="flex items-center justify-between">
                <span className={lbl}>{porInsumo ? "Insumo" : "Proveedor"}</span>
                {!editando && (
                  <button type="button" onClick={() => setPorInsumo((v) => !v)} className="text-xs font-medium text-primary hover:underline mb-1">
                    {porInsumo ? "Elegir por proveedor" : "o buscar por insumo"}
                  </button>
                )}
              </div>
              {porInsumo ? (
                <Selector options={opcionesInsumo} selectedValue={insumoBuscado} onSelect={(v) => setInsumoBuscado(String(v ?? ""))} useFuzzy className="p-2 border rounded" />
              ) : (
                <Selector options={opcionesProveedor} selectedValue={form.id_proveedor} onSelect={elegirProveedor} useFuzzy className="p-2 border rounded" />
              )}
              {error("id_proveedor")}
            </div>
            <div>
              <span className={lbl}>Bodega</span>
              <Selector options={opcionesBodega} selectedValue={form.id_bodega} onSelect={(v) => campo("id_bodega", String(v ?? ""))} className="p-2 border rounded" />
              {error("id_bodega")}
            </div>
            <div>
              <label htmlFor="oc-fecha" className={lbl}>Fecha</label>
              <input id="oc-fecha" type="date" value={form.fecha} min={editando ? undefined : haceTresMeses()} onChange={(e) => campo("fecha", e.target.value)} className={inp} />
              {error("fecha")}
            </div>
          </div>

          {porInsumo && insumoBuscado && (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              {ofertas.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">Ningún proveedor activo ofrece este insumo.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {ofertas.map((o) => {
                      const elegido = String(o.id_proveedor) === form.id_proveedor;
                      return (
                        <tr key={o.id} className={`border-t first:border-t-0 ${elegido ? "bg-primary/10" : ""}`}>
                          <td className="px-3 py-2">{o.proveedor?.nombre_empresa || `Proveedor #${o.id_proveedor}`}</td>
                          <td className="px-3 py-2 text-gray-600">{o.formato || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCLP(o.precio_unitario, 0)}</td>
                          <td className="px-3 py-2 text-right">
                            {elegido ? (
                              <span className="text-primary font-semibold">Elegido</span>
                            ) : (
                              <button type="button" onClick={() => elegirProveedor(o.id_proveedor)} className="text-primary font-medium hover:underline">
                                Elegir
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label htmlFor="oc-condiciones" className={lbl}>Condiciones</label>
              <input id="oc-condiciones" type="text" value={form.condiciones} onChange={(e) => campo("condiciones", e.target.value)} className={inp} />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={form.requiere_prepago} onChange={(e) => campo("requiere_prepago", e.target.checked)} />
              Requiere prepago
            </label>
            <label className="btn btn-secundario cursor-pointer">
              📎 Adjuntar
              <input
                type="file"
                accept={TIPOS_ACEPTADOS.join(",")}
                multiple
                className="hidden"
                onChange={(e) => {
                  const nuevos = Array.from(e.target.files || []);
                  setArchivosNuevos((prev) => [...prev, ...nuevos.filter((n) => !prev.some((p) => p.name === n.name))]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {archivosNuevos.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {archivosNuevos.map((a, i) => (
                <li key={`n${i}`} className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1">
                  {a.name}
                  <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => setArchivosNuevos((p) => p.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-600">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            {filas.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">{form.id_proveedor ? "Este proveedor no tiene insumos activos." : "Elige un proveedor para ver sus insumos."}</p>
            ) : (
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Insumo · formato</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Cantidad</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Precio</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([nombre, formatos]) => (
                    <Fragment key={nombre}>
                      {formatos.map((f, i) => {
                        const cantidad = cantidadDe(f);
                        return (
                          <tr key={f.id} className={`border-t border-gray-100 ${cantidad > 0 ? "bg-primary/5" : ""}`}>
                            <td className="px-4 py-2">
                              {i === 0 ? <span className="font-medium text-gray-900">{nombre}</span> : <span className="text-gray-400">″</span>}{" "}
                              <span className="text-xs text-gray-500">
                                · {f.formato || "—"}
                                {Number(f.cantidad_por_formato) > 0 && ` (${f.cantidad_por_formato} ${f.materiaPrima?.unidad_medida || f.unidad_medida || ""})`}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                aria-label={`Cantidad de ${nombre} ${f.formato || ""}`}
                                value={lineas[String(f.id)]?.cantidad ?? ""}
                                onChange={(e) => cambiar(f, "cantidad", e.target.value)}
                                className="w-24 border border-gray-300 rounded-md px-2 py-1"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                aria-label={`Precio de ${nombre} ${f.formato || ""}`}
                                value={lineas[String(f.id)]?.precio ?? (f.precio_unitario ?? "")}
                                onChange={(e) => cambiar(f, "precio", e.target.value)}
                                className="w-28 border border-gray-300 rounded-md px-2 py-1"
                              />
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {cantidad > 0 ? formatCLP(cantidad * precioDe(f), 0) : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <aside className="bg-white rounded-xl shadow-sm p-4 space-y-3 lg:sticky lg:top-4">
            <div className="text-sm font-semibold text-gray-900">
              {elegidas.length} insumo{elegidas.length === 1 ? "" : "s"}
            </div>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-gray-500">Neto</dt><dd className="tabular-nums">{formatCLP(neto, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">IVA 19%</dt><dd className="tabular-nums">{formatCLP(iva, 0)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCLP(neto + iva, 0)}</dd></div>
            </dl>
            {error("insumos")}
            <button type="submit" disabled={guardando || !puedeEscribir} className="btn btn-primario w-full justify-center disabled:opacity-50">
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar orden"}
            </button>
          </aside>
        </div>
      </form>
    </div>
  );
}
