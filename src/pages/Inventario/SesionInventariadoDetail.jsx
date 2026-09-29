import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import Tabs from "../../components/UI/Tabs.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { mensajeDelBackend } from "../../utils/mensajeError.js";
import { abreviaturaUnidad, agruparConteo, conteoACsv } from "../../utils/tomaInventario.js";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("es-CL", { maximumFractionDigits: 4 }));
const fmtFecha = (d) => (d ? new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—");

function getEstadoBadgeClasses(estado) {
  switch (estado) {
    case "Activa":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "Terminada":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Validada":
      return "border-green-200 bg-green-50 text-green-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

function Seccion({ titulo, tono, items, columns, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items?.length) return null;
  const tonos = {
    rojo: "border-red-200 bg-red-50 text-red-800",
    ambar: "border-amber-200 bg-amber-50 text-amber-800",
    azul: "border-blue-200 bg-blue-50 text-blue-800",
    verde: "border-green-200 bg-green-50 text-green-800",
    gris: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {titulo}
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tonos[tono]}`}>
            {items.length}
          </span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                {columns.map((c) => <th key={c.key} className="px-4 py-2">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id ?? i} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2">{c.render(it)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const COLS_BASE = [
  { key: "ident", label: "Bulto", render: (b) => <span className="font-mono text-xs">{b.identificador}</span> },
  { key: "item", label: "Ítem", render: (b) => b.item },
];

// Columna con quién escaneó cada bulto (y cuándo). Solo aplica a bultos escaneados
// (los faltantes no se escanearon). El backend expone escaneado_por + fecha_escaneo.
const COL_ESCANEO = {
  key: "esc",
  label: "Escaneado por",
  render: (b) =>
    b.escaneado_por?.nombre ? (
      <div className="leading-tight">
        <div>{b.escaneado_por.nombre}</div>
        {b.fecha_escaneo && <div className="text-xs text-gray-400">{fmtFecha(b.fecha_escaneo)}</div>}
      </div>
    ) : (
      "—"
    ),
};

const TIPO_AJUSTE = {
  merma_faltante: { label: "Faltantes marcados como merma", tono: "rojo" },
  ajuste_cantidad: { label: "Ajustes de cantidad", tono: "ambar" },
  traslado: { label: "Traslados desde otra bodega", tono: "azul" },
  reaparecido: { label: "Reaparecidos (se desmarcó la merma)", tono: "azul" },
};

function Kpi({ valor, etiqueta, color = "text-gray-800" }) {
  return (
    <div className="bg-white rounded-lg shadow px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{valor}</div>
      <div className="text-xs text-gray-500">{etiqueta}</div>
    </div>
  );
}

/**
 * Detalle de una toma de inventario (rehecho el 2026-09-29).
 *
 * Dos pestañas, en todos los estados:
 * - «Lo contado»: lo escaneado, agrupado por ítem y descargable. Antes esto no se veía una vez
 *   validada la sesión —sólo los cambios— y una toma sin cambios quedaba en blanco (la #9 de
 *   Santiago: 524 bultos contados, cero cambios). Reporte de Logística.
 * - «Cambios»: antes de validar, lo que se aplicará (previsualización); después, lo aplicado.
 */
export default function SesionInventariadoDetail() {
  const { id } = useParams();
  const api = useApi();
  const canWrite = checkScope(ModelType.SESION_INVENTARIADO, ScopeType.WRITE);

  const [sesion, setSesion] = useState(null);
  const [diff, setDiff] = useState(null);
  const [ajustes, setAjustes] = useState(null);
  const [conteo, setConteo] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [pestana, setPestana] = useState("contado");
  const [busqueda, setBusqueda] = useState("");
  const [abiertos, setAbiertos] = useState(() => new Set());

  const cargar = async () => {
    setIsLoading(true);
    try {
      const res = await api(`/sesiones-inventariado/${id}`);
      const s = res?.data ?? res;
      setSesion(s);
      const [cambios, contado] = await Promise.all([
        s.estado === "Validada"
          ? api(`/sesiones-inventariado/${id}/ajustes`)
          : api(`/sesiones-inventariado/${id}/diferencias`),
        api(`/sesiones-inventariado/${id}/conteo`),
      ]);
      if (s.estado === "Validada") { setAjustes(cambios); setDiff(null); }
      else { setDiff(cambios); setAjustes(null); }
      setConteo(Array.isArray(contado) ? contado : []);
    } catch {
      toast.error("No se pudo cargar la sesión");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const grupos = useMemo(() => agruparConteo(conteo), [conteo]);
  const gruposVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => g.item.toLowerCase().includes(q) || g.filas.some((f) => f.identificador.toLowerCase().includes(q)));
  }, [grupos, busqueda]);

  const porTipo = useMemo(() => {
    const m = {};
    for (const a of ajustes?.ajustes ?? []) (m[a.tipo] ??= []).push(a);
    return m;
  }, [ajustes]);

  const validar = async () => {
    setValidando(true);
    try {
      const res = await api(`/sesiones-inventariado/${id}/validar`, { method: "PUT" });
      toast.success(res?.message ?? "Sesión validada");
      setConfirmando(false);
      await cargar();
    } catch (err) {
      toast.error(mensajeDelBackend(err) ?? "No se pudo validar la sesión (¿tienes el permiso privilegiado?)");
    } finally {
      setValidando(false);
    }
  };

  const descargarCsv = () => {
    const blob = new Blob([conteoACsv(conteo)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toma-${sesion.id}-${sesion.bodega?.nombre ?? "bodega"}.csv`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  };

  const alternar = (clave) => setAbiertos((prev) => {
    const next = new Set(prev);
    if (next.has(clave)) next.delete(clave); else next.add(clave);
    return next;
  });

  if (isLoading) return <PageLoader message="Cargando sesión" />;
  if (!sesion) return null;

  const validada = sesion.estado === "Validada";
  const r = diff?.resumen;
  const nCambios = validada ? (ajustes?.ajustes?.length ?? 0) : null;
  const nCambiosPrevios = r ? r.ajustes_cantidad + r.traslados + r.reaparecidos + r.faltantes_a_merma : 0;

  return (
    <div>
      <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <BackButton to="/Inventario/tomas" />
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">Toma de inventario #{sesion.id}</h1>
            <span className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(sesion.estado)}`}>
              {sesion.estado === "Terminada" ? "Por validar" : sesion.estado}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Bodega <span className="font-medium">{sesion.bodega?.nombre ?? sesion.id_bodega}</span>
            {sesion.creador?.nombre ? ` · Iniciada por ${sesion.creador.nombre}` : ""}
            {sesion.validador?.nombre
              ? ` · Validada por ${sesion.validador.nombre} el ${new Date(sesion.fecha_validacion).toLocaleDateString("es-CL")}`
              : ""}
          </p>
        </div>
        {sesion.estado === "Terminada" && canWrite && (
          <button
            onClick={() => setConfirmando(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-violet-700"
          >
            Validar sesión…
          </button>
        )}
      </div>

      {sesion.estado === "Activa" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-md px-4 py-3 text-sm mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Sesión aún activa en la app móvil — lo contado y la previsualización cambiarán con nuevos escaneos.
        </div>
      )}
      {validada && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-md px-4 py-3 text-sm mb-4">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {nCambios === 0
            ? "Sesión validada sin cambios: todo lo contado cuadraba con el sistema."
            : `Sesión validada: se aplicaron ${nCambios} cambio${nCambios === 1 ? "" : "s"} sobre la bodega.`}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi valor={fmt(conteo.length)} etiqueta="Bultos contados" />
        <Kpi valor={fmt(grupos.length)} etiqueta="Ítems contados" />
        {validada ? (
          <>
            <Kpi valor={fmt(nCambios)} etiqueta="Cambios aplicados" color={nCambios ? "text-amber-700" : "text-green-700"} />
            <Kpi valor={fmt(porTipo.merma_faltante?.length ?? 0)} etiqueta="Marcados como merma" color="text-red-700" />
          </>
        ) : r ? (
          <>
            <Kpi valor={fmt(nCambiosPrevios)} etiqueta="Cambios al validar" color={nCambiosPrevios ? "text-amber-700" : "text-green-700"} />
            <Kpi valor={fmt(r.faltantes_a_merma)} etiqueta="Faltantes → merma" color="text-red-700" />
          </>
        ) : null}
      </div>

      <Tabs
        pestanas={[
          { id: "contado", label: "Lo contado", cantidad: grupos.length },
          { id: "cambios", label: validada ? "Cambios aplicados" : "Cambios al validar", cantidad: validada ? nCambios : nCambiosPrevios },
        ]}
        activa={pestana}
        onCambiar={setPestana}
      />

      {pestana === "contado" && (
        <div className="bg-white rounded-lg shadow">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ítem o bulto"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
            />
            <button
              type="button"
              onClick={descargarCsv}
              disabled={conteo.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Descargar CSV
            </button>
          </div>
          {gruposVisibles.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">
              {conteo.length === 0 ? "Todavía no se escaneó ningún bulto." : "Nada coincide con la búsqueda."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ítem</th>
                    <th className="px-4 py-2 text-right font-medium">Bultos</th>
                    <th className="px-4 py-2 text-right font-medium">Contado</th>
                    <th className="px-4 py-2 text-right font-medium">En sistema al escanear</th>
                    <th className="px-4 py-2 text-right font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gruposVisibles.map((g) => {
                    const u = abreviaturaUnidad(g.unidad_medida);
                    const abierto = abiertos.has(g.clave);
                    return (
                      <Fragment key={g.clave}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => alternar(g.clave)}>
                          <td className="px-4 py-2 font-medium text-text">
                            <span className="inline-flex items-center gap-1.5">
                              {abierto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              {g.item}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{g.bultos}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(g.contado)} {u}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600">{fmt(g.en_sistema)} {u}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${g.diferencia < 0 ? "text-red-600" : g.diferencia > 0 ? "text-green-700" : "text-gray-400"}`}>
                            {g.diferencia === 0 ? "—" : `${g.diferencia > 0 ? "+" : ""}${fmt(g.diferencia)} ${u}`}
                          </td>
                        </tr>
                        {abierto && (
                          <tr>
                            <td colSpan={5} className="bg-gray-50 px-6 py-3">
                              <table className="w-full text-xs bg-white rounded border border-gray-200">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Bulto</th>
                                    <th className="px-3 py-2 text-right font-medium">Contado</th>
                                    <th className="px-3 py-2 text-right font-medium">En sistema</th>
                                    <th className="px-3 py-2 text-left font-medium">Registrado en</th>
                                    <th className="px-3 py-2 text-left font-medium">Escaneado por</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {g.filas.map((f) => (
                                    <tr key={f.id_bulto}>
                                      <td className="px-3 py-1.5 font-mono">{f.identificador}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.contado)} {u}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{fmt(f.en_sistema)} {u}</td>
                                      <td className="px-3 py-1.5">{f.bodega_original ?? "—"}</td>
                                      <td className="px-3 py-1.5">{f.escaneado_por ?? "—"} <span className="text-gray-400">{fmtFecha(f.fecha_escaneo)}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {pestana === "cambios" && validada && (
        nCambios === 0 ? (
          <div className="bg-white rounded-lg shadow px-4 py-6 text-sm text-gray-600 text-center">
            Al validar no hubo nada que cambiar: cada bulto contado coincidía con el sistema y no quedaron faltantes nuevos.
          </div>
        ) : (
          Object.entries(TIPO_AJUSTE).map(([tipo, cfg]) => (
            <Seccion
              key={tipo}
              titulo={cfg.label}
              tono={cfg.tono}
              defaultOpen
              items={porTipo[tipo]}
              columns={[
                { key: "b", label: "Bulto", render: (a) => <span className="font-mono text-xs">{a.bulto?.identificador ?? a.bulto?.id}</span> },
                { key: "i", label: "Ítem", render: (a) => a.bulto?.item ?? "—" },
                { key: "u", label: "Unidades", render: (a) =>
                  a.unidades_antes !== a.unidades_despues
                    ? `${fmt(a.unidades_antes)} → ${fmt(a.unidades_despues)}`
                    : fmt(a.unidades_despues) },
                { key: "bod", label: "Bodega", render: (a) =>
                  a.id_bodega_antes !== a.id_bodega_despues
                    ? `${a.bodega_antes_nombre ?? "—"} → ${a.bodega_despues_nombre ?? "—"}`
                    : "sin cambio" },
              ]}
            />
          ))
        )
      )}

      {pestana === "cambios" && diff && (
        <>
          {nCambiosPrevios === 0 && (
            <div className="bg-white rounded-lg shadow px-4 py-6 text-sm text-gray-600 text-center mb-4">
              Por ahora validar no cambiaría nada: lo contado coincide con el sistema.
            </div>
          )}
          <Seccion
            titulo="Faltantes — se marcarán como MERMA al validar"
            tono="rojo"
            defaultOpen
            items={diff.faltantes}
            columns={[
              ...COLS_BASE,
              { key: "u", label: "Unidades en sistema", render: (b) => fmt(b.unidades_disponibles) },
            ]}
          />
          <Seccion
            titulo="Ajustes de cantidad (contado ≠ sistema)"
            tono="ambar"
            defaultOpen
            items={diff.ajustes_cantidad}
            columns={[
              ...COLS_BASE,
              { key: "sis", label: "Sistema", render: (b) => fmt(b.unidades_disponibles) },
              { key: "cont", label: "Contado", render: (b) => <span className="font-semibold">{fmt(b.unidades_contadas)}</span> },
              { key: "dif", label: "Diferencia", render: (b) => (
                <span className={b.diferencia_unidades < 0 ? "text-red-600" : "text-green-700"}>
                  {b.diferencia_unidades > 0 ? "+" : ""}{fmt(b.diferencia_unidades)}
                </span>
              ) },
              COL_ESCANEO,
            ]}
          />
          <Seccion
            titulo="Traslados — estaban registrados en otra bodega"
            tono="azul"
            defaultOpen
            items={diff.traslados}
            columns={[
              ...COLS_BASE,
              { key: "bod", label: "Bodega registrada", render: (b) => b.bodega_nombre ?? "—" },
              { key: "cont", label: "Contado", render: (b) => fmt(b.unidades_contadas) },
              COL_ESCANEO,
            ]}
          />
          <Seccion
            titulo="Reaparecidos — estaban marcados como merma"
            tono="azul"
            defaultOpen
            items={diff.reaparecidos}
            columns={[
              ...COLS_BASE,
              { key: "cont", label: "Contado", render: (b) => fmt(b.unidades_contadas) },
              COL_ESCANEO,
            ]}
          />
          <Seccion
            titulo="Omitidos por estar en pallet (comprometidos en otro proceso — NO se tocan)"
            tono="gris"
            items={diff.omitidos_en_pallet}
            columns={[
              ...COLS_BASE,
              { key: "u", label: "Unidades", render: (b) => fmt(b.unidades_disponibles) },
            ]}
          />
        </>
      )}

      {/* Confirmación de validación */}
      {confirmando && r && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-2">Validar toma de inventario</h2>
            <p className="text-sm text-gray-600 mb-4">
              Se aplicarán estos cambios <span className="font-semibold">irreversibles</span> sobre la bodega:
            </p>
            <ul className="text-sm space-y-1 mb-5">
              <li>• <span className="font-semibold">{r.ajustes_cantidad}</span> ajuste(s) de cantidad</li>
              <li>• <span className="font-semibold">{r.traslados}</span> traslado(s) desde otras bodegas</li>
              <li>• <span className="font-semibold">{r.reaparecidos}</span> bulto(s) desmarcados de merma</li>
              <li className="text-red-700">• <span className="font-semibold">{r.faltantes_a_merma}</span> faltante(s) se marcarán como MERMA</li>
              {r.omitidos_en_pallet > 0 && (
                <li className="text-gray-500">• {r.omitidos_en_pallet} en pallet no se tocan</li>
              )}
            </ul>
            <p className="text-xs text-gray-500 mb-4">Lo contado seguirá disponible en la pestaña «Lo contado» después de validar.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={validando}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={validar}
                disabled={validando}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {validando ? "Validando…" : "Validar y aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
