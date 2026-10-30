import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, PackageOpen, ScanLine } from "lucide-react";
import Modal from "../UI/Modal";
import EntregaParada from "./EntregaParada";
import DecidirDevolucion from "./DecidirDevolucion";
import NotaCreditoModal from "../DTE/NotaCreditoModal";
import { listarDevoluciones, resolverRevision } from "../../services/rutasService";
import { dteService } from "../../services/dteService.js";
import { formatearFecha } from "../../utils/rutas";
import { decidible, describirBulto, TONO_BULTO } from "../../utils/despacho";
import { toast } from "../../lib/toast.js";

/**
 * Qué se hizo con una entrega en revisión (plan §5.3). Lo resuelto cuenta como cumplido —la OV
 * puede quedar Entregada—; «Re-despachar» devuelve el saldo a la lista de pendientes.
 *
 * 🔴 El documento y lo físico son dos cosas (Cristóbal, 2026-10-29), y se resuelven acá mismo:
 * - el DOCUMENTO: lo que no quedó en el cliente se acredita con nota de crédito, porque la factura
 *   ya lo declaró vendido. «NC emitida», «Merma» y «Reingresado a stock» la exigen (el backend
 *   también). El botón abre el modal de NC de siempre con las líneas y cantidades ya puestas;
 * - lo FÍSICO: los bultos que volvieron se reintegran, se dan de merma o vuelven a salir, igual
 *   que en Devoluciones, escaneando su etiqueta o desde la lista.
 */
const RESOLUCIONES = [
  { valor: "Re-despachar", ayuda: "Lo que faltó vuelve a la lista de pendientes para otra ruta." },
  { valor: "NC emitida", ayuda: "Se acreditó la diferencia con nota de crédito.", exigeNC: true },
  { valor: "Reingresado a stock", ayuda: "Lo devuelto volvió a la bodega en buen estado.", exigeNC: true },
  { valor: "Merma", ayuda: "Lo devuelto no se puede vender.", exigeNC: true },
  { valor: "Sin acción", ayuda: "No hubo diferencia real (el cliente aceptó, fue un error de conteo…)." },
];

const redondear = (n) => Math.round(n * 1000) / 1000;

export default function ModalResolverRevision({ entrega, soloLectura = false, onCerrar, onResuelta, onCambio }) {
  const [resolucion, setResolucion] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [nc, setNc] = useState(null); // { dte, prellenado }
  const [abriendoNC, setAbriendoNC] = useState(null);
  const [devueltos, setDevueltos] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [resaltado, setResaltado] = useState(null);

  const idEntrega = entrega?.id;
  const cargarDevueltos = useCallback(async () => {
    if (!idEntrega) return;
    try {
      const r = await listarDevoluciones();
      setDevueltos((Array.isArray(r) ? r : []).filter((b) => b.entrega?.id === idEntrega));
    } catch {
      setDevueltos([]);
    }
  }, [idEntrega]);

  useEffect(() => {
    setResolucion("");
    setNota("");
    setResaltado(null);
    setCodigo("");
    cargarDevueltos();
  }, [idEntrega, cargarDevueltos]);

  if (!entrega) return null;
  const pendiente = entrega.estado_revision === "Pendiente" && !soloLectura;
  const facturas = (entrega.documentos ?? []).filter((d) => d.exige_nc);
  const sinNC = facturas.filter((d) => !(d.notas_credito ?? []).length);

  const abrirNC = async (doc) => {
    setAbriendoNC(doc.id);
    try {
      const docs = await dteService.listarPorOrden(doc.id_orden_venta);
      const dte = docs.find((d) => d.id === doc.id);
      if (!dte) throw new Error("No se encontró la factura en los documentos de la OV.");
      const cantidades = Object.fromEntries(
        doc.lineas.filter((l) => l.recibida < l.esperada).map((l) => [l.linea, redondear(l.esperada - l.recibida)]),
      );
      const motivo = entrega.estado === "No entregada" ? entrega.motivo_no_entrega : entrega.motivo;
      const razon = `Entrega ${entrega.estado.toLowerCase()} del ${formatearFecha(String(entrega.fecha_hora).slice(0, 10))}${motivo ? `: ${motivo}` : ""}`;
      setNc({ dte, prellenado: { cantidades, razon } });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAbriendoNC(null);
    }
  };

  const buscar = (e) => {
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (!c) return;
    const b = devueltos.find((x) => String(x.identificador ?? "").toUpperCase() === c);
    if (b) setResaltado(b.id);
    else toast.error("Ese código no es de un bulto de esta entrega.");
    setCodigo("");
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await resolverRevision(entrega.id, { resolucion, nota: nota.trim() });
      toast.success("Revisión resuelta");
      onResuelta?.();
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const bloqueada = (r) => r.exigeNC && sinNC.length > 0;

  return (
    <>
      <Modal
        abierto
        onCerrar={onCerrar}
        ancho="max-w-3xl"
        titulo={`${entrega.cliente} · ${entrega.estado}`}
        descripcion={
          entrega.ruta ? (
            <span>
              <Link to={`/Logistica/entregas/${entrega.ruta.id}`} className="text-primary hover:underline">Ruta #{entrega.ruta.id}</Link>
              {` del ${formatearFecha(entrega.ruta.fecha)}${entrega.ruta.transportista ? ` · ${entrega.ruta.transportista}` : ""}${entrega.parada?.direccion ? ` · ${entrega.parada.direccion}` : ""}`}
            </span>
          ) : null
        }
        pie={
          pendiente ? (
            <>
              <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Volver</button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !resolucion || nota.trim().length < 3 || bloqueada(RESOLUCIONES.find((r) => r.valor === resolucion) ?? {})}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Resolver"}
              </button>
            </>
          ) : (
            <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Cerrar</button>
          )
        }
      >
        <EntregaParada entrega={entrega} />

        {(facturas.length > 0 || devueltos.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {facturas.length > 0 && (
              <section className="rounded-lg border border-gray-200 p-3 flex flex-col gap-2">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Documento</h3>
                {facturas.map((d) => {
                  const ncs = d.notas_credito ?? [];
                  return (
                    <div key={d.id} className="flex flex-col gap-1.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-gray-700">Factura N° {d.folio ?? d.id}</span>
                        {ncs.length ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                            NC {ncs.map((n) => `N° ${n.folio ?? n.id}`).join(", ")}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">Falta la NC</span>
                        )}
                      </div>
                      {pendiente && (
                        <button
                          type="button"
                          onClick={() => abrirNC(d)}
                          disabled={abriendoNC === d.id}
                          className="self-start px-3 py-1.5 rounded-lg text-xs font-medium border border-primary text-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          {abriendoNC === d.id ? "Abriendo…" : ncs.length ? "Emitir otra NC" : "Emitir NC por lo que no quedó"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {devueltos.length > 0 && (
              <section className="rounded-lg border border-gray-200 p-3 flex flex-col gap-2">
                <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2"><PackageOpen className="w-4 h-4 text-primary" />Lo que volvió</h3>
                {pendiente && devueltos.some(decidible) && (
                  <form onSubmit={buscar} className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Escanea DESP-… o BULTO-…"
                      className="flex-1 min-w-0 h-8 px-2 border border-gray-300 rounded-lg text-xs font-mono"
                    />
                  </form>
                )}
                {devueltos.map((b) => (
                  <div key={b.id} className={`rounded-lg p-2 flex flex-col gap-1.5 text-sm ${resaltado === b.id ? "bg-primary/10 ring-2 ring-primary" : "bg-gray-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-700">{describirBulto(b)}</span>
                      <span className={`px-2 py-0.5 rounded-full border text-xs ${TONO_BULTO[b.estado] ?? ""}`}>{b.estado === "Faltante" ? "No volvió" : b.estado}</span>
                      {b.identificador && <span className="font-mono text-xs text-gray-500">{b.identificador}</span>}
                    </div>
                    {pendiente && decidible(b) && (
                      <DecidirDevolucion
                        bulto={b}
                        compacto
                        // Se queda en la lista con lo que se hizo: la bandeja de devoluciones sólo trae
                        // lo pendiente, y si desapareciera no se vería qué se decidió.
                        onResuelto={(r) => setDevueltos((ds) => ds.map((x) => (x.id === b.id ? { ...x, ...(r ?? {}), estado: r?.estado ?? x.estado } : x)))}
                      />
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {pendiente && (
          <div className="mt-4 flex flex-col gap-3">
            <span className="text-sm font-medium text-gray-800">¿Qué se hizo?</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RESOLUCIONES.map((r) => (
                <label
                  key={r.valor}
                  title={bloqueada(r) ? "Primero emite la NC de la factura por lo que no quedó en el cliente." : undefined}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-sm ${bloqueada(r) ? "opacity-50 cursor-not-allowed border-gray-200" : `cursor-pointer ${resolucion === r.valor ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"}`}`}
                >
                  <input
                    type="radio"
                    name="resolucion"
                    className="mt-1 accent-primary"
                    disabled={bloqueada(r)}
                    checked={resolucion === r.valor}
                    onChange={() => setResolucion(r.valor)}
                  />
                  <span>
                    <span className="font-medium text-gray-800">{r.valor}</span>
                    <span className="block text-xs text-gray-500">{bloqueada(r) ? "Falta la NC de la factura." : r.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Nota
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Qué se decidió y por qué"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </label>
          </div>
        )}
      </Modal>

      {nc && (
        <NotaCreditoModal
          dte={nc.dte}
          prellenado={nc.prellenado}
          onClose={() => setNc(null)}
          onSuccess={async () => {
            setNc(null);
            await onCambio?.();
          }}
        />
      )}
    </>
  );
}
