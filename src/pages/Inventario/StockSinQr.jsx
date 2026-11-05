import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History, Plus, SlidersHorizontal, X } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import Modal from "../../components/UI/Modal";
import Ayuda from "../../components/UI/Ayuda";
import Selector from "../../components/Forms/Selector";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { mensajeError } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { fmtFechaHora } from "../../utils/consumoInterno.js";
import { cantidadSinQr, TONO_MOVIMIENTO_SIN_QR } from "../../utils/stockSinQr.js";

const lista = (r, clave) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.[clave]) ? r[clave] : []);

/**
 * Inventario → Productos sin QR (2026-10-29, Fase A del planificador semanal): los productos
 * terminados que no tienen bultos —se producen fuera del sistema y se pickean y despachan por
 * cantidad— con su stock por bodega. La toma lo fija; aquí se registra la producción no
 * registrada y los ajustes, y se ve el historial.
 */
export default function StockSinQr() {
  const api = useApi();
  const [bodegas, setBodegas] = useState([]);
  const [idBodega, setIdBodega] = useState("");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [movimiento, setMovimiento] = useState(null); // { tipo, fila? }
  const [historial, setHistorial] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [quitar, setQuitar] = useState(null);
  const puede = checkScope(ModelType.BULTO, ScopeType.WRITE);

  useEffect(() => {
    (async () => {
      try {
        const bs = lista(await api("/bodegas"), "bodegas").filter((b) => !/tránsito|transito/i.test(b.nombre ?? ""));
        setBodegas(bs);
        setIdBodega(String((bs.find((b) => b.nombre === "Santiago") ?? bs[0])?.id ?? ""));
      } catch (err) {
        toast.error(mensajeError(err, "cargar las bodegas"));
      }
    })();
  }, [api]);

  const cargar = useCallback(async () => {
    if (!idBodega) return;
    setCargando(true);
    try {
      setFilas(lista(await api(`/stock-sin-qr?bodega=${idBodega}`)));
    } catch (err) {
      toast.error(mensajeError(err, "cargar el stock"));
    } finally {
      setCargando(false);
    }
  }, [api, idBodega]);
  useEffect(() => { cargar(); }, [cargar]);

  const columns = useMemo(() => [
    { header: "Producto", accessor: "nombre", sortable: true, hideable: false },
    {
      header: "Stock",
      accessor: "cantidad",
      align: "right",
      sortable: true,
      Cell: ({ row }) => (
        <span className={row.cantidad < 0 ? "text-red-600 font-semibold" : ""}>{cantidadSinQr(row.cantidad, row)}</span>
      ),
    },
    { header: "Último movimiento", accessor: "actualizado_en", sortable: true, filtro: "fecha", Cell: ({ value }) => (value ? fmtFechaHora(value) : "—") },
  ], []);

  const acciones = (row) => (
    <div className="flex gap-3 justify-center items-center">
      {puede && (
        <button type="button" title="Ajustar" onClick={() => setMovimiento({ tipo: "Ajuste", fila: row })} className="text-gray-400 hover:text-primary">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}
      <button type="button" title="Historial" onClick={() => setHistorial(row)} className="text-gray-400 hover:text-primary">
        <History className="w-5 h-5" />
      </button>
      {puede && (
        <button type="button" title="Dejar de controlar sin QR" onClick={() => setQuitar(row)} className="text-gray-400 hover:text-red-600">
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );

  const bodega = bodegas.find((b) => String(b.id) === String(idBodega));

  return (
    <>
      <DataTable
        title={
          <span className="inline-flex items-center gap-2">
            Productos sin QR
            <Ayuda titulo="Productos sin QR">
              Productos terminados sin bultos: se cuentan en la toma (pestaña «Sin QR») y se descuentan al pickear o despachar por cantidad. Aquí se suma la producción que no pasó por el sistema.
            </Ayuda>
          </span>
        }
        persistKey="dt:stock-sin-qr"
        data={filas}
        columns={columns}
        actions={acciones}
        stickyActions
        loading={cargando}
        loadingMessage="Cargando stock"
        emptyMessage="Ningún producto se controla sin QR todavía."
        toolbarStart={
          <div className="w-48">
            <Selector
              options={bodegas.map((b) => ({ value: String(b.id), label: b.nombre }))}
              selectedValue={idBodega}
              onSelect={setIdBodega}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        }
        headerActions={
          puede ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAgregando(true)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
                Agregar producto
              </button>
              <button type="button" onClick={() => setMovimiento({ tipo: "Producción no registrada" })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-sm hover:bg-primary-dark">
                <Plus className="w-4 h-4" /> Producción
              </button>
            </div>
          ) : null
        }
      />

      {movimiento && (
        <ModalMovimiento
          tipo={movimiento.tipo}
          fila={movimiento.fila}
          productos={filas}
          bodega={bodega}
          onCerrar={() => setMovimiento(null)}
          onListo={() => { setMovimiento(null); cargar(); }}
        />
      )}
      {historial && <ModalHistorial fila={historial} bodega={bodega} onCerrar={() => setHistorial(null)} />}
      {agregando && (
        <ModalAgregar
          yaMarcados={new Set(filas.map((f) => f.id_nombre_facturacion))}
          onCerrar={() => setAgregando(false)}
          onListo={() => { setAgregando(false); cargar(); }}
        />
      )}
      <Modal
        abierto={Boolean(quitar)}
        onCerrar={() => setQuitar(null)}
        titulo={quitar ? `Dejar de controlar «${quitar.nombre}» sin QR` : ""}
        pie={
          <>
            <button type="button" onClick={() => setQuitar(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await api(`/stock-sin-qr/productos/${quitar.id_nombre_facturacion}`, { method: "PUT", body: { stock_sin_qr: false } });
                  toast.success("Listo");
                  setQuitar(null);
                  cargar();
                } catch (err) {
                  toast.error(mensajeError(err, "quitar el producto"));
                }
              }}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Quitar
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Deja de contarse en la toma y de descontarse al pickear. Su stock e historial se conservan.</p>
      </Modal>
    </>
  );
}

/** Producción no registrada (suma) o ajuste (suma o resta), en cajas + sueltas o en kilos. */
function ModalMovimiento({ tipo, fila, productos, bodega, onCerrar, onListo }) {
  const api = useApi();
  const [idNf, setIdNf] = useState(fila ? String(fila.id_nombre_facturacion) : "");
  const [cajas, setCajas] = useState("");
  const [sueltas, setSueltas] = useState("");
  const [kilos, setKilos] = useState("");
  const [signo, setSigno] = useState(1);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const p = productos.find((x) => String(x.id_nombre_facturacion) === String(idNf));
  const porUnidad = !p || p.unidad_venta === "Unidades";
  const porCaja = porUnidad && Number(p?.unidades_por_caja) > 1 ? Number(p.unidades_por_caja) : 0;
  const cantidad = porUnidad
    ? (porCaja ? (Number(cajas) || 0) * porCaja : 0) + (Number(sueltas) || 0)
    : Number(String(kilos).replace(",", ".")) || 0;
  const esAjuste = tipo === "Ajuste";
  const valido = p && cantidad > 0 && nota.trim().length >= 3;

  const guardar = async () => {
    setGuardando(true);
    try {
      await api("/stock-sin-qr/ajustes", {
        method: "POST",
        body: { id_nombre_facturacion: p.id_nombre_facturacion, id_bodega: bodega.id, cantidad: esAjuste ? signo * cantidad : cantidad, tipo, nota: nota.trim() },
      });
      toast.success(`${esAjuste ? (signo > 0 ? "+" : "−") : "+"}${cantidadSinQr(cantidad, p)} · ${p.nombre}`);
      onListo();
    } catch (err) {
      toast.error(mensajeError(err, "registrar el movimiento"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={esAjuste ? "Ajustar stock" : "Producción no registrada"}
      descripcion={bodega?.nombre}
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button type="button" onClick={guardar} disabled={!valido || guardando} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {!fila && (
          <Selector
            options={productos.map((x) => ({ value: String(x.id_nombre_facturacion), label: x.nombre }))}
            selectedValue={idNf}
            onSelect={setIdNf}
            placeholder="Producto"
            useFuzzy
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        )}
        {fila && <span className="font-medium text-gray-800">{fila.nombre} · hoy {cantidadSinQr(fila.cantidad, fila)}</span>}
        {esAjuste && (
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden self-start">
            {[[1, "Suma"], [-1, "Resta"]].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setSigno(v)} className={`px-3 py-1.5 text-sm ${signo === v ? "bg-primary text-white" : "bg-white text-gray-700"}`}>{t}</button>
            ))}
          </div>
        )}
        {porUnidad ? (
          <div className="flex items-end gap-2">
            {porCaja > 0 && (
              <label className="flex flex-col gap-1 text-xs text-gray-500">Cajas de {porCaja}
                <input inputMode="numeric" value={cajas} onChange={(e) => setCajas(e.target.value.replace(/\D/g, ""))} className="w-24 h-9 px-2 border border-gray-300 rounded-lg text-right text-sm text-gray-900" />
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-gray-500">{porCaja ? "Sueltas" : "Unidades"}
              <input inputMode="numeric" value={sueltas} onChange={(e) => setSueltas(e.target.value.replace(/\D/g, ""))} className="w-24 h-9 px-2 border border-gray-300 rounded-lg text-right text-sm text-gray-900" />
            </label>
            {porCaja > 0 && <span className="pb-2 text-gray-600">= {cantidad} un</span>}
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-gray-500">{p?.unidad_venta === "Litros" ? "Litros" : "Kilos"}
            <input inputMode="decimal" value={kilos} onChange={(e) => setKilos(e.target.value)} className="w-28 h-9 px-2 border border-gray-300 rounded-lg text-right text-sm text-gray-900" />
          </label>
        )}
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={esAjuste ? "Motivo" : "Motivo (ej.: producción de la semana en San Felipe)"} className="h-9 px-3 border border-gray-300 rounded-lg" />
      </div>
    </Modal>
  );
}

function ModalHistorial({ fila, bodega, onCerrar }) {
  const api = useApi();
  const [movs, setMovs] = useState(null);
  useEffect(() => {
    api(`/stock-sin-qr/movimientos?bodega=${bodega?.id ?? ""}&producto=${fila.id_nombre_facturacion}&limite=200`)
      .then((r) => setMovs(lista(r)))
      .catch((err) => { toast.error(mensajeError(err, "cargar el historial")); setMovs([]); });
  }, [api, bodega, fila]);

  const referencia = (m) =>
    m.id_orden_venta ? <Link className="text-primary hover:underline" to={`/ventas/ordenes/${m.id_orden_venta}`}>OV #{m.id_orden_venta}</Link>
      : m.id_solicitud_mercaderia ? <Link className="text-primary hover:underline" to={`/Solicitudes/${m.id_solicitud_mercaderia}`}>Solicitud #{m.id_solicitud_mercaderia}</Link>
      : m.id_sesion_inventariado ? <Link className="text-primary hover:underline" to={`/Inventario/tomas/${m.id_sesion_inventariado}`}>Toma #{m.id_sesion_inventariado}</Link>
      : null;

  return (
    <Modal abierto onCerrar={onCerrar} ancho="max-w-3xl" titulo={fila.nombre} descripcion={`${bodega?.nombre ?? ""} · hoy ${cantidadSinQr(fila.cantidad, fila)}`}>
      {movs == null ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : movs.length === 0 ? (
        <p className="text-sm text-gray-500">Sin movimientos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 text-left">
                <th className="py-1 pr-3">Fecha</th><th className="pr-3">Movimiento</th><th className="pr-3 text-right">Cantidad</th><th className="pr-3 text-right">Queda</th><th className="pr-3">Origen</th><th>Quién</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmtFechaHora(m.fecha)}</td>
                  <td className="pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TONO_MOVIMIENTO_SIN_QR[m.tipo] ?? "bg-gray-100 text-gray-700"}`} title={m.nota ?? undefined}>{m.tipo}</span>
                  </td>
                  <td className={`pr-3 text-right tabular-nums ${m.cantidad < 0 ? "text-red-600" : "text-green-700"}`}>{m.cantidad > 0 ? "+" : ""}{cantidadSinQr(m.cantidad, fila)}</td>
                  <td className="pr-3 text-right tabular-nums">{cantidadSinQr(m.saldo_despues, fila)}</td>
                  <td className="pr-3">{referencia(m) ?? <span className="text-gray-400" title={m.nota ?? undefined}>{m.nota ? "nota" : "—"}</span>}</td>
                  <td className="text-gray-600">{m.usuario ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function ModalAgregar({ yaMarcados, onCerrar, onListo }) {
  const api = useApi();
  const [nfs, setNfs] = useState([]);
  const [idNf, setIdNf] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    api("/nombres-facturacion")
      .then((r) => setNfs(lista(r, "nombres").filter((n) => !yaMarcados.has(n.id))))
      .catch((err) => toast.error(mensajeError(err, "cargar los productos")));
  }, [api, yaMarcados]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await api(`/stock-sin-qr/productos/${idNf}`, { method: "PUT", body: { stock_sin_qr: true } });
      toast.success("Producto agregado");
      onListo();
    } catch (err) {
      toast.error(mensajeError(err, "agregar el producto"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Agregar producto sin QR"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
          <button type="button" onClick={guardar} disabled={!idNf || guardando} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50">Agregar</button>
        </>
      }
    >
      <Selector
        options={nfs.map((n) => ({ value: String(n.id), label: n.nombre }))}
        selectedValue={idNf}
        onSelect={setIdNf}
        placeholder="Nombre de facturación"
        useFuzzy
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
    </Modal>
  );
}
