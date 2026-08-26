/**
 * CentroDocumentos — TODO lo documental de una orden de venta, en un solo lugar y siempre visible.
 *
 * Pedido de Cristóbal, 2026-08-25: *«las pestañas sólo para ver los productos solicitados en una
 * OV y la asignación; y una vista que siempre esté disponible de documentos tributarios (donde
 * hoy se hace la emisión y se consultan algunos documentos). Que se vea de manera clara los
 * documentos tanto tributarios como adjuntos.»*
 *
 * 🔴 LO QUE ESTO ARREGLA NO ERA UNA FALTA, ERA UNA DUPLICACIÓN.
 *
 * Había DOS vistas de los mismos documentos en la misma pantalla, pidiendo el mismo endpoint:
 *
 *   · `PanelFacturacion` (siempre visible) — estado del SII, emisión, motivo de rechazo… pero
 *     sin distinguir el origen y sin los adjuntos.
 *   · La pestaña «Documentos» (`DocumentosYAdjuntos`, a dos clics) — origen ERP/externo,
 *     vincular y desvincular, y los archivos sueltos… pero sin nada de la emisión.
 *
 * Cada una con la mitad de las acciones sobre la misma factura. Acá se fusionan: reemplaza a las
 * dos y la pestaña desaparece.
 *
 * Se compone de piezas propias en vez de ser un archivo gigante:
 *   `TablaDocumentosTributarios` · `SeccionAdjuntos` · `BuscadorDteExterno` · `VisorArchivo`.
 */

import { useEffect, useRef, useState } from 'react';
import {
  FileText, Truck, FileMinus, FilePlus, FileSearch, RefreshCw, AlertCircle, X, Link2,
} from 'lucide-react';
import NotaCreditoModal from './NotaCreditoModal.jsx';
import NotaDebitoModal from './NotaDebitoModal.jsx';
import DTEDetallesModal from './DTEDetallesModal.jsx';
import DTEPreview from './DTEPreview.jsx';
import TablaDocumentosTributarios from './TablaDocumentosTributarios.jsx';
import SeccionAdjuntos from './SeccionAdjuntos.jsx';
import BuscadorDteExterno from './BuscadorDteExterno.jsx';
import VisorArchivo from './VisorArchivo.jsx';
import Modal from '../UI/Modal.jsx';
import { useDTE } from '../../hooks/useDTE.js';
import { dteService } from '../../services/dteService.js';
// Del wrapper de la app, NO de react-toastify: la app no monta ToastContainer y esos avisos no se
// muestran en ninguna parte.
import { toast } from '../../lib/toast';
import { formatCLP } from '../../services/formatHelpers.js';

const TIPO_LABEL = {
  33: 'Factura', 34: 'Factura exenta', 39: 'Boleta',
  52: 'Guía de Despacho', 56: 'Nota de Débito', 61: 'Nota de Crédito',
};

function estadoIncludes(estado, ...substrings) {
  const s = String(estado ?? '').toLowerCase();
  return substrings.some((sub) => s.includes(sub));
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

export default function CentroDocumentos({ orden, accionPrincipal = null, onCambio }) {
  const {
    documentos, loading, error,
    cargarDocumentos, emitirGuiaDespacho,
  } = useDTE(orden?.id);

  const [modalNC,       setModalNC]       = useState(null);
  const [modalND,       setModalND]       = useState(null);
  const [modalDetalles, setModalDetalles] = useState(null);
  const [modalRechazo,  setModalRechazo]  = useState(null);
  const [preEmitiendo,  setPreEmitiendo]  = useState(false);
  const [viendoBorradorGuia, setViendoBorradorGuia] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [visorEn, setVisorEn] = useState(null);
  // Documento que se está por desvincular, con su motivo. Antes era un `window.prompt`, que no
  // deja explicar qué se está deshaciendo ni distinguir un documento externo de uno que emitió
  // el propio ERP — y eso es justamente lo que hay que decir antes de apretar.
  const [aDesvincular, setADesvincular] = useState(null);
  const [notaDesvincular, setNotaDesvincular] = useState('');
  const [desvinculando, setDesvinculando] = useState(false);

  /**
   * 🔴 Al abrir la orden se le pregunta al SII en qué quedó cada documento.
   *
   * `estado_sii` se escribía al emitir y no se volvía a tocar nunca. El SII resuelve minutos
   * después, así que una factura ya aceptada seguía mostrando «Pendiente SII» para siempre.
   * Reportado con los tres primeros documentos reales —factura 24262 y guías 3471/3472—, los
   * tres en PENDIENTE con su track_id guardado, o sea enviados correctamente.
   *
   * ⚠️ La consulta YA EXISTÍA: es el mismo `actualizarYRecargar` del botón. Pero colgaba de un
   * ícono de 14 píxeles en gris claro, sin etiqueta, en una esquina. Nadie sabía que había que
   * apretarlo, así que en la práctica el estado no se actualizaba nunca.
   *
   * ⚠️ Corre UNA sola vez por orden abierta, con guarda de `useRef`. Consultar no gasta folio,
   * pero es una llamada a LibreDTE por documento: sin la guarda, cada recarga de `documentos`
   * dispararía otra tanda, que es el mecanismo exacto de la ráfaga de 136 peticiones al abrir
   * una solicitud. Y va ANTES de cualquier salida temprana porque un hook no puede quedar detrás
   * de un `return`.
   */
  const yaConsultoSii = useRef(false);
  useEffect(() => {
    if (yaConsultoSii.current || loading) return;
    const pendientes = documentos.filter(
      (d) => d.folio && estadoIncludes(d.estadoSii, 'enviado', 'pendiente', 'proceso'),
    );
    if (pendientes.length === 0) return;
    yaConsultoSii.current = true;
    Promise.allSettled(pendientes.map((d) => dteService.actualizarEstadoSii(d.id)))
      .then(() => cargarDocumentos())
      .catch(() => {
        // Si el SII o LibreDTE no responden, el estado guardado se queda como está y el botón
        // sigue disponible. No se avisa: el operario no pidió esto, pasa al abrir la pantalla.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos, loading]);

  // Abre el PDF de la guía tal como saldría, a folio 0 y sin gastar folio.
  const verBorradorGuia = async () => {
    setViendoBorradorGuia(true);
    try {
      await dteService.verPrevisualizacion('guia-venta', orden.id);
    } catch (err) {
      toast.error('No se pudo generar el borrador de la guía: ' + (err?.message ?? 'error desconocido'));
    } finally {
      setViendoBorradorGuia(false);
    }
  };

  if (!orden) return null;

  const estado = orden.estado ?? '';
  const cliente = orden.cliente ?? orden.direccion?.cliente ?? {};
  const tieneRUT = !!cliente.rut;

  const facturaEmitida = documentos.find((d) => d.tipoDte === 33 && d.estadoSii !== 'anulado');
  const guiaEmitida    = documentos.find((d) => d.tipoDte === 52 && d.estadoSii !== 'anulado');

  // 🔴 ALTERNANCIA RECURSIVA: tras facturar sólo una Nota de Crédito; tras esa NC sólo una Nota
  // de Débito; tras esa ND sólo otra NC — y así sucesivamente (pedido de Cristóbal, 2026-08-17).
  // Antes `ncEmitida`/`ndEmitida` buscaban CUALQUIER NC/ND de la orden sin filtrar anuladas —
  // una NC anulada dejaba el botón "Nota de Crédito" deshabilitado para siempre— y sólo
  // permitían una de cada una, sin importar el orden cronológico entre ellas.
  const ultimaCorreccion = documentos
    .filter((d) => (d.tipoDte === 61 || d.tipoDte === 56) && d.estadoSii !== 'anulado')
    .sort((a, b) => new Date(b.fechaEmision ?? 0) - new Date(a.fechaEmision ?? 0))[0] ?? null;

  // ── Guards de acciones ──
  // Una orden facturada ya no emite Guía de Despacho: la factura reemplaza a la guía como
  // documento de despacho (mismo pedido; el backend aplica la misma regla en payloadGuiaVenta).
  const puedeEmitirGD = !guiaEmitida && !facturaEmitida && estadoIncludes(estado, 'pend', 'asig', 'list', 'listo', 'factur');

  // 🔴 EL BOTÓN "EMITIR FACTURA" SOBRE UNA ORDEN YA FACTURADA SE RETIRÓ (2026-08-12).
  //
  // Existía como reparación de OVs legacy que quedaron en Facturada sin documento, y la
  // condición era `!facturaEmitida && estado in (facturada, entregada)`. El problema es que esa
  // condición describe **todas** las órdenes facturadas hasta ahora: `DocumentoTributarios`
  // estaba en 0 porque hasta el traspaso se facturó en el portal MIPYME.
  //
  // Medido en producción antes de retirarlo: 3 órdenes mostraban el botón, entre ellas la OV 698
  // (la de Jumbo con la cantidad 20 veces menor) y la 726 (con ingreso en $0). Apretarlo en
  // cualquiera de las dos habría emitido al SII un documento equivocado, gastando un folio por
  // una venta que ya tenía su factura emitida fuera del ERP.
  //
  // La vía de emisión es una sola: "Facturar orden" desde `Lista para facturación`. Lo que sí
  // corresponde en ese caso es **vincular** el documento que se emitió afuera, que no gasta folio
  // y es justo el botón que ahora está al lado.
  const facturadaSinDocumento =
    !facturaEmitida && estadoIncludes(estado, 'facturada', 'entregada');

  const puedeEmitirNC = !!facturaEmitida && (!ultimaCorreccion || ultimaCorreccion.tipoDte === 56);
  const puedeEmitirND = !!facturaEmitida && !!ultimaCorreccion && ultimaCorreccion.tipoDte === 61;

  // ── Chip documental del header ──
  const chipDocumental = facturaEmitida
    ? { tone: 'ok', texto: `Factura folio ${facturaEmitida.folio}` }
    : guiaEmitida
      ? { tone: 'warn', texto: 'Guía emitida · falta factura' }
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
      (d) => d.folio && estadoIncludes(d.estadoSii, 'enviado', 'pendiente', 'proceso'),
    );
    await Promise.allSettled(pendientes.map((d) => dteService.actualizarEstadoSii(d.id)));
    await cargarDocumentos();
  }

  async function confirmarDesvincular() {
    if (!aDesvincular) return;
    if (notaDesvincular.trim().length < 5) {
      toast.error('Hay que anotar el motivo (mínimo 5 caracteres).');
      return;
    }
    setDesvinculando(true);
    try {
      await dteService.desvincularDocumento(aDesvincular.id, notaDesvincular.trim());
      toast.success('Documento desvinculado.');
      setADesvincular(null);
      setNotaDesvincular('');
      await cargarDocumentos();
      onCambio?.();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo desvincular');
    } finally {
      setDesvinculando(false);
    }
  }

  // Sólo los que tienen folio: sin folio no hay PDF que pedirle a LibreDTE.
  const documentosConPdf = documentos.filter((d) => d.folio != null);
  const itemsVisor = documentosConPdf.map((d) => ({
    clave: `dte-${d.id}`,
    titulo: `${TIPO_LABEL[d.tipoDte] ?? `DTE ${d.tipoDte}`} N° ${d.folio}`,
    subtitulo: [
      d.fechaEmision ? new Date(d.fechaEmision).toLocaleDateString() : null,
      d.montoTotal > 0 ? formatCLP(d.montoTotal, 0) : null,
      d.origen === 'EXTERNO' ? 'Emitido fuera del ERP' : null,
    ].filter(Boolean).join(' · '),
    mimeType: 'application/pdf',
    obtenerFuente: async () => {
      const blob = await dteService.obtenerBlobPDF(d);
      return { url: URL.createObjectURL(blob), esBlob: true };
    },
    onDescargar: () => dteService.descargarPDF(d),
  }));

  function verDocumento(dte) {
    const idx = documentosConPdf.findIndex((d) => d.id === dte.id);
    if (idx >= 0) setVisorEn(idx);
  }

  const esExternoADesvincular = aDesvincular?.origen === 'EXTERNO';

  return (
    <div className="bg-white rounded-lg shadow p-5">

      {/* ── Cabecera ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FileText size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-gray-900">Documentos</h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Chip tone="info">OV: {estado || '—'}</Chip>
          <Chip tone={chipDocumental.tone}>{chipDocumental.texto}</Chip>
          {/* Con etiqueta: como ícono suelto de 14px en gris claro, nadie sabía que existía — y
              era justamente lo que hacía falta apretar para ver el estado real del SII. */}
          <button
            type="button"
            onClick={actualizarYRecargar}
            disabled={loading}
            title="Vuelve a preguntarle al SII en qué quedó cada documento"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200
                       text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800
                       disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar estado SII
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Facturada fuera del ERP: se explica, y se ofrece VINCULAR —que no gasta folio— en vez de
          un botón de emitir que crearía un segundo documento para una venta ya facturada. */}
      {facturadaSinDocumento && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 mb-3">
          Esta orden está <strong>{estado.toLowerCase()}</strong> y no tiene documento electrónico
          en el sistema: se facturó fuera del ERP. No se emite uno nuevo desde acá, porque sería un
          segundo documento para una venta ya facturada — si el documento existe en LibreDTE, lo
          que corresponde es <strong>vincularlo</strong>.
        </div>
      )}

      {!tieneRUT && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-3">
          ⚠ El cliente <strong>{cliente.nombre_empresa ?? '—'}</strong> no tiene RUT registrado.
          No se puede emitir Factura Electrónica hasta que se registre.
        </div>
      )}

      {/* Acción principal según estado (la entrega el padre: Facturar / Entregar) */}
      {accionPrincipal && <div className="mb-4">{accionPrincipal}</div>}

      {/* ── Documentos tributarios ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Documentos tributarios
        </h3>
        <div className="flex flex-wrap gap-2">
          {puedeEmitirGD && (
            <>
              {/* La guía consume folio y no se edita después, igual que la factura: mirarla antes
                  tiene que costar lo mismo que emitirla. */}
              <button
                type="button"
                onClick={verBorradorGuia}
                disabled={viendoBorradorGuia}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <FileSearch size={14} />
                {viendoBorradorGuia ? 'Generando…' : 'Ver cómo saldrá la guía'}
              </button>
              <button
                type="button"
                onClick={() => emitirGuiaDespacho()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Truck size={14} />
                {loading ? 'Generando…' : 'Emitir Guía de Despacho'}
              </button>
            </>
          )}

          {puedeEmitirNC && (
            <button
              type="button"
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
              type="button"
              onClick={() => handleAbrirND(ultimaCorreccion)}
              disabled={preEmitiendo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
            >
              <FilePlus size={14} />
              {preEmitiendo ? 'Verificando…' : 'Nota de Débito'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setVinculando((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
              vinculando
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-primary text-primary hover:bg-primary/5'
            }`}
          >
            <Link2 size={14} /> Vincular documento externo
          </button>
        </div>
      </div>

      {/* El buscador de LibreDTE se abre ACÁ, no en un modal: buscar el documento que falta es
          parte de armar el expediente de la orden, y en un modal se pierde de vista la lista con
          la que hay que compararlo. */}
      {vinculando && (
        <div className="mb-4 border border-primary/30 rounded-lg p-4 bg-primary/[0.03]">
          <BuscadorDteExterno
            idOrdenVenta={orden.id}
            onCancelar={() => setVinculando(false)}
            onSuccess={() => {
              setVinculando(false);
              cargarDocumentos();
              onCambio?.();
            }}
          />
        </div>
      )}

      <TablaDocumentosTributarios
        documentos={documentos}
        cargando={loading}
        onVer={verDocumento}
        onDescargar={(d) => dteService.descargarPDF(d)}
        onVerDetalles={setModalDetalles}
        onVerRechazo={setModalRechazo}
        onDesvincular={(d) => { setADesvincular(d); setNotaDesvincular(''); }}
      />

      {/* Lo que va a decir la factura, si todavía no se emite. Es EL MISMO componente que ve el
          operario al apretar "Facturar orden": el centro de documentos y el modal de emisión
          dejan de mostrar cosas distintas para la misma acción. */}
      {!facturaEmitida && tieneRUT && estadoIncludes(estado, 'lista') && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 font-medium uppercase mb-2">
            Vista previa de la factura
          </div>
          <DTEPreview ordenId={orden.id} tipo="factura" />
        </div>
      )}

      {/* ── Archivos adjuntos ────────────────────────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t border-gray-200">
        <SeccionAdjuntos idOrdenVenta={orden.id} compacto />
      </div>

      {/* ── Visor ────────────────────────────────────────────────────────────────── */}
      {visorEn != null && itemsVisor[visorEn] && (
        <VisorArchivo
          items={itemsVisor}
          indice={visorEn}
          onCambiarIndice={setVisorEn}
          onCerrar={() => setVisorEn(null)}
        />
      )}

      {/* ── Modales ──────────────────────────────────────────────────────────────── */}
      {/* Sin `orden`: la nota se arma desde el `detalle` de la factura, no desde la orden
          (tarea #120). Pasársela invitaría a volver a mezclarlas. */}
      {modalNC && (
        <NotaCreditoModal
          dte={modalNC}
          onClose={() => setModalNC(null)}
          onSuccess={() => { setModalNC(null); cargarDocumentos(); }}
        />
      )}

      {modalND && (
        <NotaDebitoModal
          dte={modalND}
          onClose={() => setModalND(null)}
          onSuccess={() => { setModalND(null); cargarDocumentos(); }}
        />
      )}

      {modalDetalles && (
        <DTEDetallesModal dte={modalDetalles} onClose={() => setModalDetalles(null)} />
      )}

      <Modal
        abierto={!!aDesvincular}
        onCerrar={() => { setADesvincular(null); setNotaDesvincular(''); }}
        titulo="Desvincular documento del proceso"
        descripcion={
          aDesvincular
            ? `${TIPO_LABEL[aDesvincular.tipoDte] ?? `DTE ${aDesvincular.tipoDte}`} N° ${aDesvincular.folio ?? '—'}`
            : undefined
        }
        pie={
          <>
            <button
              type="button"
              onClick={() => { setADesvincular(null); setNotaDesvincular(''); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarDesvincular}
              disabled={desvinculando || notaDesvincular.trim().length < 5}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {desvinculando ? 'Desvinculando…' : 'Desvincular'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          El documento <strong>no se borra</strong> y su folio <strong>sigue consumido</strong> ante
          el SII. Lo único que se deshace es a qué proceso corresponde.
        </p>

        {/* El aviso cambia según el origen, porque el riesgo es distinto. */}
        {aDesvincular && !esExternoADesvincular && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ⚠ Este documento <strong>lo emitió el ERP para esta orden</strong>: el vínculo no lo
            creó nadie a mano. Al soltarlo, la orden deja de mostrarlo y para volver a encontrarlo
            hay que buscarlo por folio en «Vincular documento externo».
          </div>
        )}

        <label className="block text-xs text-gray-600 mt-4 mb-1">
          ¿Por qué se desvincula? (queda registrado)
        </label>
        <textarea
          value={notaDesvincular}
          onChange={(e) => setNotaDesvincular(e.target.value)}
          rows={2}
          placeholder="Ej: se facturó contra la orden equivocada, corresponde a la OV 825"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </Modal>

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
