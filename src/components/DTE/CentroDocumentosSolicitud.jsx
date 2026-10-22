/**
 * CentroDocumentosSolicitud — todo lo documental de una solicitud de mercadería, siempre visible.
 *
 * Es el mismo movimiento que `CentroDocumentos` hizo en la orden de venta, llevado a la
 * solicitud: los documentos tributarios y los archivos adjuntos dejan de ser dos pestañas
 * distintas y pasan a una vista única que no hay que ir a buscar.
 *
 * 🔴 POR QUÉ NO ES EL MISMO COMPONENTE QUE EL DE LA OV.
 *
 * En la orden de venta la lista de documentos es una tabla: hay varios tipos (factura, guía,
 * NC, ND) y lo que importa de cada uno es folio, monto y estado. Acá hay **un solo documento**
 * —la guía de traslado— y lo que importa de él es otra cosa: de qué bodega a qué bodega, con qué
 * transportista, y **si ya llegó**. Eso no entra en una fila de tabla sin volverse ilegible, y
 * «Confirmar llegada» es una acción que la OV no tiene.
 *
 * Lo que sí se comparte es todo lo que era genuinamente común: `SeccionAdjuntos`, `VisorArchivo`
 * y `BuscadorDteExterno`.
 */

import { useState } from 'react';
import {
  FileText, FileSearch, Link2, Truck, Eye, FileDown, CheckCircle2, Paperclip,
} from 'lucide-react';
import SeccionAdjuntos from './SeccionAdjuntos.jsx';
import BuscadorDteExterno from './BuscadorDteExterno.jsx';
import VisorArchivo from './VisorArchivo.jsx';
import { dteService } from '../../services/dteService.js';
import { urlFirmadaDeS3 } from '../../lib/uploadToS3.js';
import { sePuedePrevisualizar } from '../../utils/previsualizacion.js';
import { toast } from '../../lib/toast.js';
import { formatCLP } from '../../services/formatHelpers.js';
import { formatFecha } from '../../lib/dateUtils';
import Ayuda from '../UI/Ayuda.jsx';
import { DTEStatusBadge } from './DTEStatusBadge.jsx';

export default function CentroDocumentosSolicitud({
  solicitudId,
  solicitud,
  gds = [],
  cargando = false,
  emitiendo = false,
  viendoBorrador = false,
  onEmitirGD,
  onVerBorradorGD,
  onConfirmarLlegada,
  onCambio,
}) {
  const [vinculando, setVinculando] = useState(false);
  const [visorEn, setVisorEn] = useState(null);

  /**
   * Los archivos que se subían al marcar la solicitud como enviada.
   *
   * 🔴 Vivían en el JSONB `archivos_guia_despacho` y **NADIE los mostraba**: en todo el frontend
   * había una sola mención del campo, la que los escribía. O sea que alguien adjuntaba la guía
   * firmada al despachar y no había forma de volver a verla desde la aplicación.
   *
   * Se muestran acá para que dejen de estar perdidos. Lo nuevo ya no entra por este camino: el
   * formulario de envío adjunta con `adjuntosService`, que guarda quién subió qué.
   */
  const archivosGuiaLegado = Array.isArray(solicitud?.archivos_guia_despacho)
    ? solicitud.archivos_guia_despacho.filter((a) => a?.s3_key)
    : [];

  const gdsConFolio = gds.filter((g) => g.folio != null);

  // El visor recorre las guías emitidas y, detrás de ellas, los archivos heredados que se puedan
  // mostrar. Es una sola lista para que las flechas no se corten en la mitad.
  const itemsVisor = [
    ...gdsConFolio.map((gd) => ({
      clave: `gd-${gd.id}`,
      titulo: `Guía de Despacho N° ${gd.folio}`,
      subtitulo: [
        gd.fechaEmision ? formatFecha(gd.fechaEmision) : null,
        gd.montoTotal > 0 ? formatCLP(gd.montoTotal, 0) : null,
        gd.origen === 'EXTERNO' ? 'Emitida fuera del ERP' : null,
      ].filter(Boolean).join(' · '),
      mimeType: 'application/pdf',
      obtenerFuente: async () => {
        const blob = await dteService.obtenerBlobPDF(gd);
        return { url: URL.createObjectURL(blob), esBlob: true };
      },
      onDescargar: () => dteService.descargarPDF(gd),
    })),
    ...archivosGuiaLegado
      .filter((a) => sePuedePrevisualizar(a.mime_type))
      .map((a) => ({
        clave: `legado-${a.s3_key}`,
        titulo: a.original_name ?? 'Archivo de la guía',
        subtitulo: 'Adjuntado al enviar la solicitud',
        mimeType: a.mime_type,
        // `esBlob: false` — es una URL firmada de S3, no un objeto creado por nosotros.
        obtenerFuente: async () => ({ url: await urlFirmadaDeS3(a.s3_key), esBlob: false }),
      })),
  ];

  function verEnVisor(clave) {
    const idx = itemsVisor.findIndex((i) => i.clave === clave);
    if (idx >= 0) setVisorEn(idx);
  }

  async function abrirLegadoFuera(a) {
    try {
      window.open(await urlFirmadaDeS3(a.s3_key), '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo abrir el archivo');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-5 mb-6">

      {/* ── Cabecera ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <FileText size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-gray-900">Documentos</h2>
      </div>

      {/* ── Guías de despacho ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Guías de despacho
          <Ayuda titulo="Guía de despacho">
            La guía declara sólo lo que se despachó, con el valor de los bultos cargados en los
            pallets. Se emite antes de enviar la solicitud y su folio queda como el número de la
            guía. Si ya se emitió fuera del sistema, se vincula en vez de emitir otra.
          </Ayuda>
        </h3>
        {/* Las acciones de emisión sólo aparecen mientras no haya guía: una solicitud lleva UNA,
            y su folio es el número de la guía. Ofrecer «emitir» con una ya emitida abriría la
            puerta a gastar un segundo folio para el mismo traslado. */}
        {gds.length === 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onVerBorradorGD}
              disabled={viendoBorrador || cargando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <FileSearch className="w-4 h-4" />
              {viendoBorrador ? 'Generando…' : 'Ver cómo saldrá'}
            </button>
            <button
              type="button"
              onClick={onEmitirGD}
              disabled={emitiendo || cargando}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              {emitiendo ? 'Emitiendo…' : 'Emitir guía de despacho'}
            </button>
            {/* Tarea #108: las guías de traslado se emiten a mano en LibreDTE muy seguido —eran
                ~17 al mes cuando el ERP no tenía botón— y quedaban sin forma de asociarse a su
                solicitud. Va junto a «emitir» porque es la otra respuesta a la misma pregunta:
                «esta solicitud ya tiene guía». */}
            <button
              type="button"
              onClick={() => setVinculando((v) => !v)}
              disabled={cargando}
              title="Si la guía ya se emitió fuera del ERP, vincularla en vez de emitir otra"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-50 ${
                vinculando
                  ? 'bg-gray-100 border-gray-300 text-gray-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Link2 className="w-4 h-4" /> Vincular guía ya emitida
            </button>
          </div>
        )}
      </div>

      {/* El buscador se abre acá adentro, no en un modal: buscar la guía que falta es parte de
          armar el expediente de la solicitud, y en un modal se pierde de vista la lista con la
          que hay que compararla. */}
      {vinculando && (
        <div className="mb-4 border border-gray-200 rounded-lg p-4">
          <BuscadorDteExterno
            idSolicitud={solicitudId}
            onCancelar={() => setVinculando(false)}
            onSuccess={() => { setVinculando(false); onCambio?.(); }}
          />
        </div>
      )}

      {gds.length === 0 ? (
        <p className="text-sm text-gray-500">
          {solicitud?.numero_guia_despacho
            ? `Guía N° ${solicitud.numero_guia_despacho}, registrada a mano al enviar (sin documento en el sistema).`
            : 'Sin guía de despacho.'}
        </p>
      ) : (
        <div className="space-y-2">
          {gds.map((gd) => {
            const meta = gd.metadata ?? {};
            const fechaLlegada = meta.fecha_llegada;
            return (
              <div
                key={gd.id}
                className="flex items-center justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* El mismo badge de estado SII que en la orden de venta. */}
                    <DTEStatusBadge
                      tipoDte={gd.tipoDte ?? 52}
                      folio={gd.folio}
                      estadoSii={gd.estadoSii ?? 'pendiente'}
                    />
                    {gd.origen === 'EXTERNO' && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                        title={
                          'Se emitió fuera del ERP y se vinculó a mano.' +
                          (gd.notaVinculacion ? `\n\nMotivo: ${gd.notaVinculacion}` : '')
                        }
                      >
                        <Link2 className="w-3 h-3" /> Externa
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-3 mt-0.5">
                    {meta.bodega_origen && <span>De: <strong>{meta.bodega_origen}</strong></span>}
                    {meta.bodega_destino && <span>→ <strong>{meta.bodega_destino}</strong></span>}
                    {meta.transportista && <span>· Transportista: {meta.transportista}</span>}
                    {gd.fechaEmision && (
                      <span>· Emitida: {formatFecha(gd.fechaEmision)}</span>
                    )}
                    {fechaLlegada ? (
                      <span className="inline-flex items-center gap-1">
                        · <CheckCircle2 className="w-3 h-3 text-green-600" />
                        Llegó el {new Date(fechaLlegada).toLocaleString('es-CL')}
                      </span>
                    ) : (
                      <span>· En tránsito</span>
                    )}
                  </div>
                  {gd.montoTotal > 0 && (
                    <span className="text-xs text-gray-500">Total: {formatCLP(gd.montoTotal, 0)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!fechaLlegada && (
                    <button
                      type="button"
                      onClick={() => onConfirmarLlegada(gd.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Confirmar llegada
                    </button>
                  )}
                  {gd.folio != null && (
                    <>
                      <button
                        type="button"
                        onClick={() => verEnVisor(`gd-${gd.id}`)}
                        title="Ver la guía acá mismo"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => dteService.descargarPDF(gd)}
                        title="Descargar el PDF"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        <FileDown className="w-3 h-3" /> PDF
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Archivos heredados del formulario de envío ────────────────────────────── */}
      {archivosGuiaLegado.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
            Archivos subidos al enviar
            <Ayuda titulo="Archivos subidos al enviar">
              Se subieron al marcar la solicitud como enviada, cuando todavía no existían los
              adjuntos, y no se veían en ninguna parte. Lo que se adjunte de ahora en adelante
              aparece abajo, en «Archivos adjuntos».
            </Ayuda>
          </p>
          <ul className="divide-y divide-gray-100">
            {archivosGuiaLegado.map((a) => {
              const verEnLinea = sePuedePrevisualizar(a.mime_type);
              return (
                <li key={a.s3_key} className="flex items-center gap-2 py-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <button
                    type="button"
                    onClick={() => (verEnLinea ? verEnVisor(`legado-${a.s3_key}`) : abrirLegadoFuera(a))}
                    className="text-sm text-gray-700 hover:text-primary hover:underline truncate text-left flex-1 min-w-0"
                    title={verEnLinea ? 'Ver el archivo acá mismo' : 'Abrir el archivo'}
                  >
                    {a.original_name ?? a.s3_key}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Archivos adjuntos ────────────────────────────────────────────────────── */}
      <div className="mt-6 pt-5 border-t border-gray-200">
        <SeccionAdjuntos idSolicitud={solicitudId} compacto />
      </div>

      {visorEn != null && itemsVisor[visorEn] && (
        <VisorArchivo
          items={itemsVisor}
          indice={visorEn}
          onCambiarIndice={setVisorEn}
          onCerrar={() => setVisorEn(null)}
        />
      )}
    </div>
  );
}
