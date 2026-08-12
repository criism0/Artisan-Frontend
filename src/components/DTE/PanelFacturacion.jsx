/**
 * PanelFacturacion (M6) — panel ÚNICO de facturación y documentos de una OV.
 *
 * Reemplaza al botón "Facturar orden" + DTEPanel separados: concentra el estado
 * documental (stepper picking → guía → factura → entrega), UNA acción primaria
 * según el estado (la entrega el padre vía `accionPrincipal`), las acciones
 * DTE secundarias (GD / NC / ND / actualizar SII) y la tabla de documentos
 * emitidos. Las bandejas SII / DTE emitidos quedan como vistas de consulta.
 */
import { useState } from 'react';
import { FileText, Truck, FileMinus, FilePlus, FileDown, RefreshCw, Eye, Info, AlertCircle, X } from 'lucide-react';
import { DTEStatusBadge } from './DTEStatusBadge.jsx';
import NotaCreditoModal from './NotaCreditoModal.jsx';
import NotaDebitoModal from './NotaDebitoModal.jsx';
import DTEDetallesModal from './DTEDetallesModal.jsx';
import DTEPreview from './DTEPreview.jsx';
import { useDTE } from '../../hooks/useDTE.js';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';

const TIPO_LABEL = { 33: 'Factura', 39: 'Boleta', 52: 'Guía de Despacho', 56: 'Nota de Débito', 61: 'Nota de Crédito' };

function estadoIncludes(estado, ...substrings) {
  const s = String(estado ?? '').toLowerCase();
  return substrings.some(sub => s.includes(sub));
}

function Chip({ tone = 'off', children }) {
  const tones = {
    ok:   'bg-green-100 text-green-700',
    warn: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    off:  'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Step({ estado, label, detalle }) {
  // estado: 'done' | 'curr' | 'off'
  const barra =
    estado === 'done'
      ? 'bg-primary'
      : estado === 'curr'
        ? 'bg-gradient-to-r from-primary from-50% to-gray-200 to-50%'
        : 'bg-gray-200';
  const texto = estado === 'done' ? 'text-primary' : estado === 'curr' ? 'text-text' : 'text-gray-400';
  return (
    <div className="flex-1 min-w-[120px] pr-2">
      <div className={`h-1 rounded-full mb-1.5 ${barra}`} />
      <div className={`text-xs font-semibold ${texto}`}>{label}</div>
      <div className="text-[11px] text-gray-400">{detalle}</div>
    </div>
  );
}

export default function PanelFacturacion({ orden, accionPrincipal = null }) {
  const {
    documentos, loading, error,
    cargarDocumentos, emitirGuiaDespacho,
  } = useDTE(orden?.id);

  const [modalNC,       setModalNC]       = useState(null);
  const [modalND,       setModalND]       = useState(null);
  const [modalDetalles, setModalDetalles] = useState(null);
  const [modalRechazo,  setModalRechazo]  = useState(null);
  const [preEmitiendo,  setPreEmitiendo]  = useState(false);

  if (!orden) return null;

  const estado = orden.estado ?? '';
  const cliente = orden.cliente ?? orden.direccion?.cliente ?? {};
  const tieneRUT = !!cliente.rut;

  const facturaEmitida = documentos.find(d => d.tipoDte === 33 && d.estadoSii !== 'anulado');
  const guiaEmitida    = documentos.find(d => d.tipoDte === 52 && d.estadoSii !== 'anulado');
  const ncEmitida      = documentos.find(d => d.tipoDte === 61);
  const ndEmitida      = documentos.find(d => d.tipoDte === 56);

  // ── Guards de acciones secundarias ──
  const puedeEmitirGD = !guiaEmitida && estadoIncludes(estado, 'pend', 'asig', 'list', 'listo', 'factur');

  // 🔴 EL BOTÓN "EMITIR FACTURA" SOBRE UNA ORDEN YA FACTURADA SE RETIRÓ (2026-08-12).
  //
  // Existía como reparación de OVs legacy que quedaron en Facturada sin documento, y la
  // condición era `!facturaEmitida && estado in (facturada, entregada)`. El problema es que
  // esa condición describe **todas** las órdenes facturadas hasta ahora: `DocumentoTributarios`
  // está en 0 porque hasta el traspaso se facturó en el portal MIPYME.
  //
  // Medido en producción antes de retirarlo: 3 órdenes mostraban el botón, entre ellas la
  // OV 698 (la de Jumbo con la cantidad 20 veces menor) y la 726 (con ingreso en $0). Apretarlo
  // en cualquiera de las dos habría emitido al SII un documento equivocado, gastando un folio
  // por una venta que ya tenía su factura emitida fuera del ERP.
  //
  // La vía de emisión es una sola: "Facturar orden" desde `Lista para facturación`. Si alguna
  // orden vieja necesitara de verdad su documento electrónico, es un acto deliberado y no
  // corresponde que sea un botón al lado de la operación normal.
  const facturadaSinDocumento =
    !facturaEmitida && estadoIncludes(estado, 'facturada', 'entregada');

  const puedeEmitirNC = !!facturaEmitida && !ncEmitida;
  const puedeEmitirND = !!facturaEmitida && !ndEmitida;

  // ── Stepper documental ──
  const pickingDone = estadoIncludes(estado, 'list', 'factur', 'entreg');
  const pasoPicking = {
    estado: pickingDone ? 'done' : estadoIncludes(estado, 'picking') ? 'curr' : 'off',
    detalle: pickingDone ? 'Completo' : estadoIncludes(estado, 'picking') ? 'En curso' : 'Pendiente',
  };
  const pasoGuia = {
    estado: guiaEmitida ? 'done' : 'off',
    detalle: guiaEmitida ? `Folio ${guiaEmitida.folio}` : 'Opcional',
  };
  const pasoFactura = {
    estado: facturaEmitida ? 'done' : estadoIncludes(estado, 'list') ? 'curr' : 'off',
    detalle: facturaEmitida ? `Folio ${facturaEmitida.folio}` : 'Pendiente',
  };
  const entregada = estadoIncludes(estado, 'entreg');
  const pasoEntrega = {
    estado: entregada ? 'done' : estadoIncludes(estado, 'factur') ? 'curr' : 'off',
    detalle: entregada ? 'Entregada' : estadoIncludes(estado, 'factur') ? 'En curso' : '—',
  };

  // ── Chip documental del header ──
  const chipDocumental = facturaEmitida
    ? { tone: 'ok', texto: `Factura folio ${facturaEmitida.folio}` }
    : guiaEmitida
      ? { tone: 'warn', texto: `Guía emitida · falta factura` }
      : { tone: 'off', texto: 'Sin documentos emitidos' };

  async function handleAbrirNC(factura) {
    setPreEmitiendo(true);
    try {
      await dteService.actualizarEstadoSii(factura.id);
      await cargarDocumentos();
    } catch { /* silencioso — si falla igual abrimos el modal */ } finally {
      setPreEmitiendo(false);
    }
    setModalNC(factura);
  }

  async function handleAbrirND(factura) {
    setPreEmitiendo(true);
    try {
      await dteService.actualizarEstadoSii(factura.id);
      await cargarDocumentos();
    } catch { /* silencioso */ } finally {
      setPreEmitiendo(false);
    }
    setModalND(factura);
  }

  async function actualizarYRecargar() {
    const pendientes = documentos.filter(
      d => d.folio && estadoIncludes(d.estadoSii, 'enviado', 'pendiente', 'proceso')
    );
    await Promise.allSettled(pendientes.map(d => dteService.actualizarEstadoSii(d.id)));
    await cargarDocumentos();
  }

  function getReferenciaLabel(dte) {
    const ref = dte.referencias?.[0];
    if (!ref) return null;
    const tipoRef = TIPO_LABEL[ref.tipo_dte_ref] ?? `Tipo ${ref.tipo_dte_ref}`;
    return `→ ${tipoRef} N° ${ref.folio_ref}`;
  }

  const formatFecha = (f) => (f ? new Date(f).toLocaleDateString() : '—');

  return (
    <div className="bg-white rounded-lg shadow p-5 mt-6">

      {/* Header: título + estado */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FileText size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-gray-900">Facturación y documentos</h2>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone="info">OV: {estado || '—'}</Chip>
          <Chip tone={chipDocumental.tone}>{chipDocumental.texto}</Chip>
          <button
            onClick={actualizarYRecargar}
            disabled={loading}
            title="Actualizar estado en SII"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stepper documental */}
      <div className="flex gap-0 mb-5 overflow-x-auto">
        <Step estado={pasoPicking.estado} label="Picking" detalle={pasoPicking.detalle} />
        <Step estado={pasoGuia.estado} label="Guía de despacho" detalle={pasoGuia.detalle} />
        <Step estado={pasoFactura.estado} label="Factura electrónica" detalle={pasoFactura.detalle} />
        <Step estado={pasoEntrega.estado} label="Entrega" detalle={pasoEntrega.detalle} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Facturada fuera del ERP: se explica en vez de ofrecer un botón que gastaría un folio */}
      {facturadaSinDocumento && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 mb-3">
          Esta orden está <strong>{estado.toLowerCase()}</strong> y no tiene documento electrónico
          en el sistema: se facturó fuera del ERP. No se emite uno nuevo desde acá, porque sería
          un segundo documento para una venta ya facturada.
        </div>
      )}

      {/* Sin RUT */}
      {!tieneRUT && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-3">
          ⚠ El cliente <strong>{cliente.nombre_empresa ?? '—'}</strong> no tiene RUT registrado.
          No se puede emitir Factura Electrónica hasta que se registre.
        </div>
      )}

      {/* Acción principal según estado (la entrega el padre: Facturar / Entregar) */}
      {accionPrincipal && <div className="mb-4">{accionPrincipal}</div>}

      {/* Acciones DTE secundarias */}
      <div className="flex flex-wrap gap-2 mb-4">
        {puedeEmitirGD && (
          <button
            onClick={() => emitirGuiaDespacho()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Truck size={14} />
            {loading ? 'Generando…' : 'Emitir Guía de Despacho'}
          </button>
        )}

        {puedeEmitirNC && (
          <button
            onClick={() => handleAbrirNC(facturaEmitida)}
            disabled={preEmitiendo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
          >
            <FileMinus size={14} />
            {preEmitiendo ? 'Verificando…' : 'Nota de Crédito'}
          </button>
        )}

        {puedeEmitirND && (
          <button
            onClick={() => handleAbrirND(facturaEmitida)}
            disabled={preEmitiendo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
          >
            <FilePlus size={14} />
            {preEmitiendo ? 'Verificando…' : 'Nota de Débito'}
          </button>
        )}
      </div>

      {/* Lo que va a decir la factura, si todavía no se emite. Es EL MISMO componente que ve el
          operario al apretar "Facturar orden": la pestaña de documentos y el modal de emisión
          dejan de mostrar cosas distintas para la misma acción. */}
      {!facturaEmitida && tieneRUT && estadoIncludes(estado, 'lista') && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 font-medium uppercase mb-2">
            Vista previa de la factura
          </div>
          <DTEPreview ordenId={orden.id} tipo="factura" />
        </div>
      )}

      {/* Tabla de documentos */}
      {loading && documentos.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Cargando documentos…</p>
      ) : documentos.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-400 text-center">
          Aún no hay documentos emitidos para esta orden.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Documento</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {documentos.map(dte => {
                const esNcNd = dte.tipoDte === 61 || dte.tipoDte === 56;
                const refLabel = esNcNd ? getReferenciaLabel(dte) : null;
                return (
                  <tr key={dte.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <DTEStatusBadge tipoDte={dte.tipoDte} folio={dte.folio} estadoSii={dte.estadoSii} />
                      {refLabel && <div className="text-xs text-gray-400 italic mt-0.5">{refLabel}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatFecha(dte.fechaEmision)}</td>
                    <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                      {dte.montoTotal != null && dte.montoTotal > 0 ? formatCLP(dte.montoTotal, 0) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {dte.estadoSii === 'rechazado' && dte.metadata?.glosa_sii && (
                          <button
                            onClick={() => setModalRechazo(dte)}
                            title="Ver motivo de rechazo"
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <AlertCircle size={12} /> Motivo
                          </button>
                        )}
                        {esNcNd && (
                          <button
                            onClick={() => setModalDetalles(dte)}
                            title="Ver detalles"
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                          >
                            <Info size={12} /> Detalles
                          </button>
                        )}
                        {dte.folio && (
                          <button
                            onClick={() => dteService.verPDF(dte)}
                            title="Ver PDF"
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                          >
                            <Eye size={12} /> Ver
                          </button>
                        )}
                        {dte.folio && (
                          <button
                            onClick={() => dteService.descargarPDF(dte)}
                            title="Descargar PDF"
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                          >
                            <FileDown size={12} /> PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal NC */}
      {modalNC && (
        <NotaCreditoModal
          dte={modalNC}
          orden={orden}
          onClose={() => setModalNC(null)}
          onSuccess={() => { setModalNC(null); cargarDocumentos(); }}
        />
      )}

      {/* Modal ND */}
      {modalND && (
        <NotaDebitoModal
          dte={modalND}
          onClose={() => setModalND(null)}
          onSuccess={() => { setModalND(null); cargarDocumentos(); }}
        />
      )}

      {/* Modal Ver Detalles NC/ND */}
      {modalDetalles && (
        <DTEDetallesModal dte={modalDetalles} onClose={() => setModalDetalles(null)} />
      )}

      {/* Modal motivo de rechazo SII */}
      {modalRechazo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <h2 className="text-sm font-bold text-gray-900">Motivo de rechazo SII</h2>
              </div>
              <button type="button" onClick={() => setModalRechazo(null)} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500">
                {TIPO_LABEL[modalRechazo.tipoDte] ?? `DTE ${modalRechazo.tipoDte}`}{' '}
                N° {modalRechazo.folio} fue rechazada por el SII con el siguiente motivo:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 font-mono">
                {modalRechazo.metadata.glosa_sii}
              </div>
              <p className="text-xs text-gray-400">
                Debes anular este folio en el portal SII y emitir un nuevo documento corrigiendo el error.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
