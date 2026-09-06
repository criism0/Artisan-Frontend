import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, Loader2, Unlink } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import Selector from "../../components/Forms/Selector";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { dteRecibidoService } from "../../services/dteRecibidoService";
import { formatCLP } from "../../services/formatHelpers";

/**
 * Vincular las facturas que recibimos de proveedores a nuestras órdenes de compra — punto 2 de
 * la reunión con Hernán (2026-09-01).
 *
 * 🔴 LA LISTA VIENE DE LIBREDTE, NO DE NUESTRA BASE. Es la sincronización con el RCV del SII:
 * trae automáticamente todo lo que un proveedor —o un cliente, ver abajo— emitió contra nuestro
 * RUT, sin depender de que alguien reenvíe un correo. Verificado en producción el 2026-09-06:
 * 260 documentos, muchos sin que el ERP supiera que existían.
 *
 * ⚠️ NO TODO LO QUE LLEGA ES UNA COMPRA. Cencosud, Rendic y otros clientes también emiten
 * documentos contra nuestro RUT (notas de crédito, cobros de retail) y aparecen en la misma
 * sincronización — se marcan como «Cliente», no como error.
 *
 * ⚠️ NO TODO SE PUEDE VINCULAR SOLO. Sólo los documentos que además llegaron por el correo de
 * LibreDTE (no sólo por el registro del SII) tienen el XML con la Referencia a la OC. Los demás
 * se muestran igual —esconderlos sería el mismo problema que esto viene a resolver— y se
 * vinculan a mano.
 */

const hoyIso = () => new Date().toISOString().slice(0, 10);
const haceNDiasIso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const TIPO_LABEL = { 33: "Factura", 34: "Factura exenta", 39: "Boleta", 52: "Guía", 56: "Nota de débito", 61: "Nota de crédito" };

function EstadoDocumento({ doc }) {
  if (doc.vinculo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Check className="w-3 h-3" />
        OC #{doc.vinculo.id_orden_compra}
        {doc.vinculo.metodo_vinculacion === "manual" && <span className="text-green-600">(manual)</span>}
      </span>
    );
  }
  if (doc.cliente) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="Este RUT es un cliente, no un proveedor — no corresponde vincular a una OC">
        Es cliente: {doc.cliente.nombre_empresa}
      </span>
    );
  }
  if (!doc.tipo_soportado) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500" title="Sólo se pueden vincular facturas y guías de despacho por ahora">
        {TIPO_LABEL[doc.tipo_dte] ?? `Tipo ${doc.tipo_dte}`} — sin vincular
      </span>
    );
  }
  if (!doc.proveedor) {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title="Este RUT no corresponde a ningún proveedor registrado en el ERP">
        Proveedor no registrado
      </span>
    );
  }
  return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Sin vincular</span>;
}

/** El panel que aparece al apretar "Vincular": intenta la sugerencia automática y, si no hay, deja elegir a mano. */
function PanelVincular({ doc, onCerrar, onVinculado }) {
  const [cargandoSugerencia, setCargandoSugerencia] = useState(true);
  const [sugerencia, setSugerencia] = useState(null);
  const [ordenesDelProveedor, setOrdenesDelProveedor] = useState([]);
  const [ocElegida, setOcElegida] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await dteRecibidoService.sugerirVinculo({
          tipoDte: doc.tipo_dte,
          folio: doc.folio,
          emisorRut: doc.emisor_rut,
          intercambioId: doc.intercambio_id,
        });
        if (!cancelado) setSugerencia(res?.data ?? res);
      } catch (err) {
        if (!cancelado) toast.error(err?.message || "No se pudo consultar la sugerencia");
      } finally {
        if (!cancelado) setCargandoSugerencia(false);
      }
    })();
    // Las OC del mismo proveedor, para el selector manual — no todas las OC del sistema, sólo
    // las que tienen sentido para este documento.
    if (doc.proveedor) {
      api(`/proceso-compra/ordenes`)
        .then((res) => {
          const todas = res?.data ?? res ?? [];
          const propias = todas.filter((o) => o.id_proveedor === doc.proveedor.id);
          if (!cancelado) setOrdenesDelProveedor(propias);
        })
        .catch(() => {});
    }
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.tipo_dte, doc.folio, doc.emisor_rut, doc.intercambio_id]);

  const opcionesOC = useMemo(
    () =>
      ordenesDelProveedor.map((o) => ({
        value: String(o.id),
        label: `OC #${o.id} — ${formatCLP(Number(o.total_pago || 0), 0)} — ${o.estado}`,
        searchText: `${o.id} ${o.estado} ${o.total_pago}`,
      })),
    [ordenesDelProveedor],
  );

  const confirmarAutomatico = async () => {
    setGuardando(true);
    try {
      await dteRecibidoService.vincularLibreDte({
        tipo_dte: doc.tipo_dte,
        folio: doc.folio,
        emisor_rut: doc.emisor_rut,
        emisor_nombre: doc.emisor_nombre,
        fecha_emision: doc.fecha_emision,
        monto_total: doc.monto_total,
        intercambio_id: doc.intercambio_id,
        id_orden_compra: sugerencia.orden_compra.id,
        metodo: "referencia_automatica",
        numero_oc_leido: sugerencia.numero_oc_leido,
      });
      toast.success(`Vinculado a la OC #${sugerencia.orden_compra.id}`);
      onVinculado();
    } catch (err) {
      toast.error(err?.message || "No se pudo vincular");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarManual = async () => {
    if (!ocElegida) {
      toast.error("Hay que elegir una orden de compra.");
      return;
    }
    if (nota.trim().length < 5) {
      toast.error("Hay que anotar por qué esta factura corresponde a esta orden de compra (mínimo 5 caracteres).");
      return;
    }
    setGuardando(true);
    try {
      await dteRecibidoService.vincularLibreDte({
        tipo_dte: doc.tipo_dte,
        folio: doc.folio,
        emisor_rut: doc.emisor_rut,
        emisor_nombre: doc.emisor_nombre,
        fecha_emision: doc.fecha_emision,
        monto_total: doc.monto_total,
        intercambio_id: doc.intercambio_id,
        id_orden_compra: Number(ocElegida),
        metodo: "manual",
        nota: nota.trim(),
        numero_oc_leido: sugerencia?.numero_oc_leido ?? null,
      });
      toast.success(`Vinculado a la OC #${ocElegida}`);
      onVinculado();
    } catch (err) {
      toast.error(err?.message || "No se pudo vincular");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-[420px]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium text-text">{TIPO_LABEL[doc.tipo_dte] ?? doc.tipo_dte} N° {doc.folio}</div>
          <div className="text-xs text-gray-500">{doc.emisor_nombre} · {formatCLP(Number(doc.monto_total || 0), 0)}</div>
        </div>
        <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>

      {cargandoSugerencia ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Buscando a qué orden corresponde…
        </div>
      ) : sugerencia?.orden_compra ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
          <div className="text-sm text-green-900">
            El documento declara la <strong>OC #{sugerencia.orden_compra.id}</strong> — {sugerencia.orden_compra.estado},
            {" "}{formatCLP(Number(sugerencia.orden_compra.total_pago || 0), 0)}.
          </div>
          <button
            onClick={confirmarAutomatico}
            disabled={guardando}
            className="mt-2 w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirmar vínculo con la OC #{sugerencia.orden_compra.id}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 mb-3 text-xs text-amber-800 flex gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{sugerencia?.motivo ?? "No se pudo determinar la orden de compra sola."}</span>
        </div>
      )}

      {!doc.proveedor ? (
        <p className="text-xs text-gray-500">Este RUT no corresponde a ningún proveedor registrado — no hay OC que ofrecer.</p>
      ) : (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-medium text-gray-600 mb-1.5">O elegir la orden a mano</div>
          <Selector
            options={opcionesOC}
            selectedValue={ocElegida}
            onSelect={setOcElegida}
            useFuzzy
            className="w-full mb-2"
          />
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Por qué esta factura corresponde a esta orden de compra (mínimo 5 caracteres)…"
            rows={2}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-2"
          />
          <button
            onClick={confirmarManual}
            disabled={guardando || !ocElegida}
            className="w-full px-3 py-2 border border-primary text-primary rounded-md text-sm hover:bg-primary/5 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Vincular a mano
          </button>
        </div>
      )}
    </div>
  );
}

export default function DocumentosRecibidosLibreDte() {
  const [desde, setDesde] = useState(haceNDiasIso(30));
  const [hasta, setHasta] = useState(hoyIso());
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  // 🔴 NO ES UNA CLAVE: es el doc + la posición donde dibujar el panel, en coordenadas de
  // pantalla. `DataTable` envuelve la tabla en un `overflow-hidden` (para las esquinas
  // redondeadas) — un panel `absolute` DENTRO de una celda queda cortado apenas su alto supera
  // el de esa fila, que es exactamente lo que le pasa a éste (349px de panel contra ~60px de
  // fila). Se renderiza `fixed`, como hermano de la tabla, calculando la posición desde el
  // botón que lo abrió — mismo problema, mismo remedio, que ya documenta `FiltroColumna.jsx`.
  const [panel, setPanel] = useState(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await dteRecibidoService.listarLibreDte(desde, hasta);
      const data = res?.data ?? res;
      setDocumentos(data?.documentos ?? []);
    } catch (err) {
      toast.error(err?.message || "No se pudieron cargar los documentos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirPanel = (e, doc) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Se ancla a la derecha del botón, no a la izquierda: el panel mide 420px y la columna
    // "Opciones" es la última de la tabla, así que anclado a la izquierda se saldría del
    // viewport. `Math.min` lo empuja de vuelta si aun así no cabe (pantallas angostas).
    setPanel({ doc, top: r.bottom + 6, left: Math.min(r.right - 420, window.innerWidth - 430) });
  };

  const desvincular = async (doc) => {
    if (!doc.vinculo) return;
    if (!window.confirm(`¿Desvincular de la OC #${doc.vinculo.id_orden_compra}? El documento sigue existiendo en LibreDTE.`)) return;
    try {
      await dteRecibidoService.desvincularLibreDte(doc.vinculo.id);
      toast.success("Vínculo deshecho");
      cargar();
    } catch (err) {
      toast.error(err?.message || "No se pudo desvincular");
    }
  };

  const columns = [
    {
      header: "Fecha",
      accessor: "fecha_emision",
      sortable: true,
      filtro: "fecha",
    },
    {
      header: "Documento",
      accessor: "folio",
      sortable: true,
      filtro: false,
      Cell: ({ row }) => (
        <span className="font-mono text-xs">
          {TIPO_LABEL[row.tipo_dte] ?? row.tipo_dte} N° {row.folio}
        </span>
      ),
    },
    {
      header: "Emisor",
      accessor: "emisor_nombre",
      sortable: true,
      filtro: "valores",
      Cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.emisor_nombre || "—"}</div>
          <div className="text-xs text-gray-400 font-mono">{row.emisor_rut}</div>
        </div>
      ),
    },
    {
      header: "Monto",
      accessor: "monto_total",
      sortable: true,
      align: "right",
      filtro: "numero",
      Cell: ({ value }) => formatCLP(Number(value || 0), 0),
    },
    {
      header: "Estado",
      accessor: "estado_calculado",
      filtro: false,
      filtroValor: (row) =>
        row.vinculo ? "Vinculado" : row.cliente ? "Es cliente" : !row.tipo_soportado ? "Sin soporte" : !row.proveedor ? "Proveedor no registrado" : "Sin vincular",
      Cell: ({ row }) => <EstadoDocumento doc={row} />,
    },
    {
      header: "Opciones",
      accessor: "opciones",
      filtro: false,
      hideable: false,
      Cell: ({ row }) => {
        const puedeVincular = row.tipo_soportado && row.proveedor && !row.vinculo;
        return (
          <div className="flex items-center gap-2">
            {row.vinculo && (
              <button
                onClick={() => desvincular(row)}
                className="text-gray-400 hover:text-red-500"
                title="Desvincular"
              >
                <Unlink className="w-4 h-4" />
              </button>
            )}
            {puedeVincular && (
              <button
                onClick={(e) => abrirPanel(e, row)}
                className="px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-hover flex items-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5" /> Vincular
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const getSearchText = (row) =>
    [row.emisor_nombre, row.emisor_rut, row.folio, row.proveedor?.nombre_empresa, row.cliente?.nombre_empresa]
      .filter(Boolean)
      .join(" ");

  const sinVincular = documentos.filter((d) => d.tipo_soportado && d.proveedor && !d.vinculo).length;

  return (
    <>
    <DataTable
      title="Facturas por vincular"
      data={documentos}
      columns={columns}
      getSearchText={getSearchText}
      loading={cargando}
      loadingMessage="Cargando documentos desde LibreDTE"
      defaultRowsPerPage={25}
      initialSort={{ key: "fecha_emision", direction: "desc" }}
      persistKey="documentos_recibidos_libredte_v1"
      emptyMessage="No hay documentos en este rango."
      headerExtra={
        <p className="text-sm text-gray-500 -mt-3 mb-4 max-w-3xl">
          Documentos que llegaron de proveedores (y a veces de clientes) contra nuestro RUT,
          sincronizados desde el SII. {sinVincular > 0 && (
            <span className="text-amber-700 font-medium">{sinVincular} sin vincular a una orden de compra.</span>
          )}
        </p>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
          <span className="text-gray-400 text-sm">a</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
          <button
            onClick={cargar}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover text-sm"
          >
            Buscar
          </button>
        </div>
      }
    />

    {panel && (
      <>
        <div className="fixed inset-0 z-20" onClick={() => setPanel(null)} />
        <div className="fixed z-30" style={{ top: panel.top, left: panel.left }}>
          <PanelVincular
            doc={panel.doc}
            onCerrar={() => setPanel(null)}
            onVinculado={() => {
              setPanel(null);
              cargar();
            }}
          />
        </div>
      </>
    )}
    </>
  );
}
