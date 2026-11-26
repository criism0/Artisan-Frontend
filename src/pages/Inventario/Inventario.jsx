import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import BarraInventario from "../../components/Inventario/BarraInventario";
import GoogleSheetsExportButton from "../../components/UI/GoogleSheetsExportButton";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { createAndOpenSheet } from "../../lib/googleSheets";
import { formatCLP } from "../../services/formatHelpers";
import {
  ENCABEZADOS_EXPORTACION,
  TIPOS,
  conteoPorTipo,
  esCritico,
  etiquetaTipo,
  filaExportacion,
  filtrarCriticos,
  filtrarPorTipo,
  formatearStock,
  textoBusqueda,
} from "../../utils/inventarioVista.js";

const TONO_TIPO = {
  materia_prima: "bg-blue-100 text-blue-700",
  pip: "bg-amber-100 text-amber-800",
  subproducto: "bg-purple-100 text-purple-700",
  producto_terminado: "bg-green-100 text-green-700",
};

const PUNTO_TIPO = {
  materia_prima: "bg-blue-500",
  pip: "bg-amber-500",
  subproducto: "bg-purple-500",
  producto_terminado: "bg-green-500",
};

// Nombres cortos de los chips: «En proceso (PIP)» y «Productos terminados» no caben en una fila.
const CHIP_TIPO = {
  materia_prima: "Materias primas",
  pip: "En proceso",
  subproducto: "Subproductos",
  producto_terminado: "Terminados",
};

const LINK_A_BULTOS = new Set(["materia_prima", "producto_terminado"]);

const SIGLA_TIPO =Object.fromEntries(TIPOS.map((t) => [t.id, t.corta]));

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors whitespace-nowrap";
const chipOn = "border-primary bg-primary-light text-primary font-medium";
const chipOff = "border-gray-200 bg-white text-gray-700 hover:bg-gray-50";

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "—";

/**
 * Inventario: el stock por ítem, filtrable por bodega y tipo (rehecha el 2026-09-29).
 *
 * 🔴 Todas las filas salen de UN cálculo (`GET /inventario/resumen`) y el tipo se filtra acá
 * sobre ellas, así que un ítem no puede aparecer con un filtro y desaparecer con otro. Antes
 * cada tipo pedía un endpoint distinto: «Materias Primas» sumaba los bultos en merma y «Todos»
 * no, y la leche en polvo de Santiago aparecía con 2.300 kg que no existían.
 *
 * Sólo cuenta STOCK: bultos sin merma y con unidades. Las mermas se consultan en «Bultos».
 * Al expandir una fila se ven sus bultos, calculados con la misma clasificación: suman la fila.
 */
export default function Inventario() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bodegaId, setBodegaId] = useState(() => Number(searchParams.get("bodega")) || 0);
  const [tipo, setTipo] = useState(() => {
    const t = searchParams.get("tipo");
    return TIPOS.some((x) => x.id === t) ? t : "todos";
  });
  const [soloCriticos, setSoloCriticos] = useState(() => searchParams.get("critico") === "1");
  const [bodegas, setBodegas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [expandidas, setExpandidas] = useState(() => new Set());
  const [bultos, setBultos] = useState({});
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    api("/bodegas")
      .then((res) => setBodegas(Array.isArray(res?.bodegas) ? res.bodegas : Array.isArray(res) ? res : []))
      .catch(() => setBodegas([]));
  }, [api]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api(`/inventario/resumen${bodegaId ? `?id_bodega=${bodegaId}` : ""}`)
      .then((res) => {
        if (cancelado) return;
        setFilas((Array.isArray(res) ? res : []).map((f) => ({ ...f, id: f.clave })));
        // Lo expandido y lo seleccionado es de la bodega anterior: se descarta.
        setExpandidas(new Set());
        setSeleccion(new Set());
      })
      .catch(() => { if (!cancelado) toast.error("No se pudo cargar el inventario"); })
      .finally(() => { if (!cancelado) { setCargando(false); setPrimeraCarga(false); } });
    return () => { cancelado = true; };
  }, [api, bodegaId]);

  const cambiarParam = (clave, valor) => {
    const next = new URLSearchParams(searchParams);
    if (valor) next.set(clave, String(valor)); else next.delete(clave);
    setSearchParams(next, { replace: true });
  };

  // El chip «Bajo crítico» se suma al tipo: los conteos de los tipos siguen siendo del total, y
  // el de «Bajo crítico», del tipo elegido.
  const delTipo = useMemo(() => filtrarPorTipo(filas, tipo), [filas, tipo]);
  const visibles = useMemo(() => filtrarCriticos(delTipo, soloCriticos), [delTipo, soloCriticos]);
  const conteo = useMemo(() => conteoPorTipo(filas), [filas]);
  const nCriticos = useMemo(() => delTipo.filter(esCritico).length, [delTipo]);
  const valorVisible = useMemo(() => visibles.reduce((s, f) => s + Number(f.precio_total || 0), 0), [visibles]);

  // Los bultos se piden al expandir, y se guardan por bodega + fila: con otra bodega son otros.
  const claveBultos = useCallback((f) => `${bodegaId}|${f.clave}`, [bodegaId]);

  const alternarFila = useCallback(async (f) => {
    const abierta = expandidas.has(f.clave);
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (abierta) next.delete(f.clave); else next.add(f.clave);
      return next;
    });
    const k = claveBultos(f);
    if (abierta || bultos[k]) return;
    setBultos((prev) => ({ ...prev, [k]: "cargando" }));
    try {
      const qs = new URLSearchParams({ tipo: f.tipo, id_item: String(f.id_item) });
      if (bodegaId) qs.set("id_bodega", String(bodegaId));
      const res = await api(`/inventario/resumen/bultos?${qs}`);
      setBultos((prev) => ({ ...prev, [k]: Array.isArray(res) ? res : [] }));
    } catch {
      toast.error("No se pudieron cargar los bultos");
      setBultos((prev) => { const { [k]: _, ...resto } = prev; return resto; });
    }
  }, [api, bodegaId, bultos, claveBultos, expandidas]);

  const alternarSeleccion = (clave) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  const exportar = async ({ access_token }) => {
    try {
      setExportando(true);
      const datos = seleccion.size ? visibles.filter((f) => seleccion.has(f.clave)) : visibles;
      const bodega = bodegas.find((b) => b.id === bodegaId)?.nombre ?? "Todas las bodegas";
      const titulo = `Inventario ${bodega} — ${tipo === "todos" ? "Todos" : etiquetaTipo(tipo)} — ${new Date().toLocaleDateString("es-CL")}`;
      const url = await createAndOpenSheet(access_token, titulo, [ENCABEZADOS_EXPORTACION, ...datos.map(filaExportacion)]);
      if (url) toast.success("Planilla creada en Google Sheets");
    } catch {
      toast.error("No se pudo exportar a Google Sheets");
    } finally {
      setExportando(false);
    }
  };

  const columns = useMemo(() => [
    {
      header: "",
      accessor: "_sel",
      hideable: false,
      filtro: false,
      Cell: ({ row }) => (
        <input
          type="checkbox"
          checked={seleccion.has(row.clave)}
          onChange={() => alternarSeleccion(row.clave)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary focus:ring-primary"
          title="Seleccionar para exportar"
        />
      ),
    },
    {
      // La categoría va como segunda línea del nombre (Fase 5): como columna propia empujaba
      // «Costo» fuera de la pantalla a 1.300 px. Sigue ordenable/filtrable desde «Columnas».
      header: "Ítem",
      accessor: "nombre",
      sortable: true,
      hideable: false,
      Cell: ({ row }) => (
        <button
          type="button"
          onClick={() => alternarFila(row)}
          className="flex items-start gap-1.5 text-left text-text hover:text-primary"
          title={expandidas.has(row.clave) ? "Ocultar bultos" : `Ver bultos de ${row.nombre}`}
        >
          {expandidas.has(row.clave)
            ? <ChevronDown className="mt-0.5 w-4 h-4 shrink-0 text-gray-400" />
            : <ChevronRight className="mt-0.5 w-4 h-4 shrink-0 text-gray-400" />}
          <span className="min-w-0">
            <span className="block max-w-[420px] truncate font-medium">{row.nombre}</span>
            {row.categoria && <span className="block text-xs text-gray-400">{row.categoria}</span>}
          </span>
        </button>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
      sortable: true,
      filtroValor: (row) => etiquetaTipo(row.tipo),
      Cell: ({ row }) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold ${TONO_TIPO[row.tipo] ?? "bg-gray-100 text-gray-600"}`}
          title={etiquetaTipo(row.tipo)}
        >
          {SIGLA_TIPO[row.tipo] ?? etiquetaTipo(row.tipo)}
        </span>
      ),
    },
    { header: "Categoría", accessor: "categoria", sortable: true, defaultHidden: true },
    {
      header: "Stock",
      accessor: "stock",
      align: "right",
      sortable: true,
      Cell: ({ row }) => (
        <span className="tabular-nums">
          {formatearStock(row.stock, row.unidad_medida)}
          {esCritico(row) && (
            <span className="block text-xs font-semibold text-red-700" title="Bajo el stock mínimo del ítem">⚠ bajo crítico</span>
          )}
        </span>
      ),
    },
    { header: "Bultos", accessor: "bultos", align: "right", sortable: true },
    {
      header: "Estado",
      accessor: "estado_stock",
      sortable: true,
      defaultHidden: true,
      Cell: ({ value }) => value === "Peligro"
        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-800">Bajo crítico</span>
        : value === "Bien"
          ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-green-200 bg-green-50 text-green-800">Bien</span>
          : <span className="text-gray-400">—</span>,
    },
    {
      header: "Costo",
      accessor: "precio_total",
      align: "right",
      sortable: true,
      Cell: ({ value }) => <span className="tabular-nums">{formatCLP(Number(value || 0), 0)}</span>,
    },
    {
      header: "Último movimiento",
      accessor: "ultimo_movimiento",
      sortable: true,
      filtro: "fecha",
      defaultHidden: true,
      Cell: ({ value }) => <span className="text-xs text-gray-500">{fmtFecha(value)}</span>,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [seleccion, expandidas, bodegaId, bultos]);

  const renderExpandedRow = (row) => {
    if (!expandidas.has(row.clave)) return null;
    const lista = bultos[claveBultos(row)];
    return (
      <tr key={`${row.clave}-bultos`}>
        <td colSpan={columns.length + 1} className="bg-gray-50 px-6 py-4">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Bultos de {row.nombre} · {etiquetaTipo(row.tipo)}
          </div>
          {lista === "cargando" || lista === undefined ? (
            <div className="text-sm text-gray-500">Cargando bultos…</div>
          ) : lista.length === 0 ? (
            <div className="text-sm text-gray-500">Sin bultos con stock.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Bulto</th>
                    <th className="px-3 py-2 text-left font-medium">Bodega</th>
                    <th className="px-3 py-2 text-left font-medium">Pallet</th>
                    <th className="px-3 py-2 text-right font-medium">Disponible</th>
                    <th className="px-3 py-2 text-right font-medium">Unidades</th>
                    <th className="px-3 py-2 text-right font-medium">Costo</th>
                    <th className="px-3 py-2 text-left font-medium">Ingreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lista.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 font-mono text-xs">{b.identificador}</td>
                      <td className="px-3 py-2">{b.bodega ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{b.pallet ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatearStock(b.disponible, row.unidad_medida)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                        {Number(b.unidades_disponibles).toLocaleString("es-CL", { maximumFractionDigits: 4 })}/{b.cantidad_unidades}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCLP(Number(b.costo || 0), 0)}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{fmtFecha(b.ingreso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Del stock al bulto: para editar, dividir o reimprimir la etiqueta. Sólo insumos y
              terminados, que son los que la lista de Bultos sabe buscar por nombre. */}
          {Array.isArray(lista) && lista.length > 0 && LINK_A_BULTOS.has(row.tipo) && (
            <Link
              to={`/inventario/bultos?${new URLSearchParams({ item: row.nombre, ...(bodegaId ? { bodega: String(bodegaId) } : {}) })}`}
              className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Ver {lista.length === 1 ? "el bulto" : `los ${lista.length}`} en Bultos →
            </Link>
          )}
        </td>
      </tr>
    );
  };

  const elegirTipo = (t) => { setTipo(t); cambiarParam("tipo", t === "todos" ? null : t); };
  const alternarCriticos = () => {
    const v = !soloCriticos;
    setSoloCriticos(v);
    cambiarParam("critico", v ? "1" : null);
  };

  // Tipos como chips (Fase 5), igual que los estados en Ventas y Entregas, y al lado
  // «⚠ Bajo crítico», que antes no se podía aislar: se mezclaba con las filas «Bien».
  const chips = (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por tipo">
      <button type="button" aria-pressed={tipo === "todos"} onClick={() => elegirTipo("todos")} className={`${chipBase} ${tipo === "todos" ? chipOn : chipOff}`}>
        Todos <b className="font-semibold">{conteo.todos}</b>
      </button>
      {TIPOS.filter((t) => conteo[t.id] > 0).map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={tipo === t.id}
          title={t.label}
          onClick={() => elegirTipo(tipo === t.id ? "todos" : t.id)}
          className={`${chipBase} ${tipo === t.id ? chipOn : chipOff}`}
        >
          <span className={`h-2 w-2 rounded-full ${PUNTO_TIPO[t.id]}`} aria-hidden="true" />
          {CHIP_TIPO[t.id]} <b className="font-semibold">{conteo[t.id]}</b>
        </button>
      ))}
      {(nCriticos > 0 || soloCriticos) && (
        <>
          <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={soloCriticos}
            onClick={alternarCriticos}
            title="Ítems bajo su stock mínimo"
            className={`${chipBase} ${soloCriticos ? "border-red-600 bg-red-50 text-red-700 font-medium" : "border-red-200 bg-white text-red-700 hover:bg-red-50"}`}
          >
            ⚠ Bajo crítico <b className="font-semibold">{nCriticos}</b>
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
    <div className="px-6 pt-6">
      <BarraInventario />
    </div>
    <DataTable
      title="Stock"
      data={visibles}
      columns={columns}
      getSearchText={textoBusqueda}
      renderExpandedRow={renderExpandedRow}
      loading={primeraCarga && cargando}
      loadingMessage="Cargando inventario"
      defaultRowsPerPage={25}
      initialSort={{ key: "nombre", direction: "asc" }}
      // v2: cambió qué columnas se ven por defecto (Fase 5); la clave vieja guardaba las de antes.
      persistKey="inventario_v2"
      emptyMessage={cargando ? "Cargando…" : soloCriticos ? "Nada bajo crítico para esta bodega y tipo." : "Sin stock para esta bodega y tipo."}
      headerActions={
        <div className="flex items-center gap-2">
          {seleccion.size > 0 && (
            <span className="text-xs text-gray-500">{seleccion.size} seleccionada{seleccion.size === 1 ? "" : "s"}</span>
          )}
          <GoogleSheetsExportButton
            onToken={exportar}
            onError={() => toast.error("No se pudo autenticar con Google")}
            isExporting={exportando}
            disabled={exportando || visibles.length === 0}
            etiqueta="Exportar"
            title={seleccion.size ? `Exportar ${seleccion.size} seleccionada(s) a Google Sheets` : "Exportar lo que se ve a Google Sheets"}
          />
        </div>
      }
      headerExtra={chips}
      toolbarStart={
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-700">
            <span className="sr-only">Bodega</span>
            <select
              aria-label="Bodega"
              value={bodegaId}
              onChange={(e) => { const v = Number(e.target.value); setBodegaId(v); cambiarParam("bodega", v || null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value={0}>Todas las bodegas</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <span className="text-gray-500">
            {cargando ? "Actualizando…" : <>Valor <span className="font-medium text-text tabular-nums">{formatCLP(valorVisible, 0)}</span></>}
          </span>
        </div>
      }
    />
    </>
  );
}
