import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import Tabs from "../../components/UI/Tabs.jsx";
import GoogleSheetsExportButton from "../../components/UI/GoogleSheetsExportButton";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { createAndOpenSheet } from "../../lib/googleSheets";
import { formatCLP } from "../../services/formatHelpers";
import {
  ENCABEZADOS_EXPORTACION,
  TIPOS,
  conteoPorTipo,
  etiquetaTipo,
  filaExportacion,
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

  const visibles = useMemo(() => filtrarPorTipo(filas, tipo), [filas, tipo]);
  const conteo = useMemo(() => conteoPorTipo(filas), [filas]);
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
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      hideable: false,
      Cell: ({ row }) => (
        <button
          type="button"
          onClick={() => alternarFila(row)}
          className="flex items-center gap-1.5 text-left font-medium text-text hover:text-primary"
          title={expandidas.has(row.clave) ? "Ocultar bultos" : "Ver bultos"}
        >
          {expandidas.has(row.clave)
            ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
          <span className="max-w-[380px] truncate">{row.nombre}</span>
        </button>
      ),
    },
    {
      header: "Tipo",
      accessor: "tipo",
      sortable: true,
      filtroValor: (row) => etiquetaTipo(row.tipo),
      Cell: ({ row }) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TONO_TIPO[row.tipo] ?? "bg-gray-100 text-gray-600"}`}>
          {etiquetaTipo(row.tipo)}
        </span>
      ),
    },
    { header: "Categoría", accessor: "categoria", sortable: true },
    {
      header: "Stock",
      accessor: "stock",
      align: "right",
      sortable: true,
      Cell: ({ row }) => <span className="tabular-nums">{formatearStock(row.stock, row.unidad_medida)}</span>,
    },
    { header: "Bultos", accessor: "bultos", align: "right", sortable: true },
    {
      header: "Estado",
      accessor: "estado_stock",
      sortable: true,
      Cell: ({ value }) => value === "Peligro"
        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-red-200 bg-red-50 text-red-800">Bajo crítico</span>
        : value === "Bien"
          ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-green-200 bg-green-50 text-green-800">Bien</span>
          : <span className="text-gray-400">—</span>,
    },
    {
      header: "Costo total",
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
        </td>
      </tr>
    );
  };

  const pestanas = [
    { id: "todos", label: "Todos", cantidad: conteo.todos },
    ...TIPOS.map((t) => ({ id: t.id, label: t.label, cantidad: conteo[t.id] })),
  ];

  return (
    <DataTable
      title="Inventario"
      data={visibles}
      columns={columns}
      getSearchText={textoBusqueda}
      renderExpandedRow={renderExpandedRow}
      loading={primeraCarga && cargando}
      loadingMessage="Cargando inventario"
      defaultRowsPerPage={25}
      initialSort={{ key: "nombre", direction: "asc" }}
      persistKey="inventario"
      emptyMessage={cargando ? "Cargando…" : "Sin stock para esta bodega y tipo."}
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
            title={seleccion.size ? `Exportar ${seleccion.size} seleccionada(s) a Google Sheets` : "Exportar lo que se ve a Google Sheets"}
          />
        </div>
      }
      headerExtra={
        <Tabs
          pestanas={pestanas}
          activa={tipo}
          onCambiar={(t) => { setTipo(t); cambiarParam("tipo", t === "todos" ? null : t); }}
        />
      }
      toolbarStart={
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-700">
            <span className="font-medium">Bodega</span>
            <select
              value={bodegaId}
              onChange={(e) => { const v = Number(e.target.value); setBodegaId(v); cambiarParam("bodega", v || null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value={0}>Todas</option>
              {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </label>
          <span className="text-gray-500">
            {cargando ? "Actualizando…" : <>Valor: <span className="font-medium text-text">{formatCLP(valorVisible, 0)}</span></>}
          </span>
        </div>
      }
    />
  );
}
