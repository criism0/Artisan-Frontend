/**
 * Los documentos tributarios de un proceso, en UNA tabla.
 *
 * 🔴 ESTA TABLA EXISTÍA DOS VECES. `PanelFacturacion` tenía una (con el estado del SII, el motivo
 * de rechazo y los detalles de una NC/ND) y la pestaña «Documentos» tenía otra (con el origen del
 * documento y el botón de desvincular), las dos pidiendo el MISMO
 * `GET /facturacion/ordenes-venta/:id/documentos`. O sea que la misma factura se mostraba en dos
 * lugares de la misma pantalla, cada uno con la mitad de las acciones.
 *
 * Para quien consulta, un documento tributario es un documento tributario: da igual quién apretó
 * el botón. Lo que sí se distingue es el ORIGEN, con una etiqueta, porque un documento vinculado
 * desde afuera tiene una propiedad que importa — **no trae el detalle de líneas**, y ese vacío es
 * esperado, no un error.
 */

import { AlertCircle, Eye, FileDown, Info, Link2, Unlink } from 'lucide-react';
import { DTEStatusBadge } from './DTEStatusBadge.jsx';
import { formatCLP } from '../../services/formatHelpers.js';

const TIPO_LABEL = {
  33: 'Factura', 34: 'Factura exenta', 39: 'Boleta',
  52: 'Guía de Despacho', 56: 'Nota de Débito', 61: 'Nota de Crédito',
};

function formatFecha(f) {
  return f ? new Date(f).toLocaleDateString() : '—';
}

function referenciaLabel(dte) {
  const ref = dte.referencias?.[0];
  if (!ref) return null;
  const tipoRef = TIPO_LABEL[ref.tipo_dte_ref] ?? `Tipo ${ref.tipo_dte_ref}`;
  return `→ ${tipoRef} N° ${ref.folio_ref}`;
}

export default function TablaDocumentosTributarios({
  documentos,
  cargando,
  onVer,
  onDescargar,
  onVerDetalles,
  onVerRechazo,
  onDesvincular,
}) {
  if (cargando && documentos.length === 0) {
    return <p className="text-sm text-gray-400 italic py-3">Cargando documentos…</p>;
  }

  if (documentos.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg py-6 text-center">
        <p className="text-sm text-gray-500">Esta orden todavía no tiene documentos tributarios.</p>
        <p className="text-xs text-gray-400 mt-1">
          Si se emitió alguno fuera del ERP —en el panel de LibreDTE o en el portal del SII— se
          puede vincular con «Vincular documento externo».
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Documento</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Monto</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Origen</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase"></th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((dte) => {
            const esNcNd = dte.tipoDte === 61 || dte.tipoDte === 56;
            const refLabel = esNcNd ? referenciaLabel(dte) : null;
            const esExterno = dte.origen === 'EXTERNO';

            return (
              <tr key={dte.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <DTEStatusBadge tipoDte={dte.tipoDte} folio={dte.folio} estadoSii={dte.estadoSii} />
                  {refLabel && <div className="text-xs text-gray-400 italic mt-0.5">{refLabel}</div>}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatFecha(dte.fechaEmision)}</td>
                <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                  {dte.montoTotal != null && dte.montoTotal > 0 ? formatCLP(dte.montoTotal, 0) : '—'}
                </td>
                <td className="px-3 py-2">
                  {esExterno ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200"
                      title={
                        'Se emitió fuera del ERP y se vinculó a mano. ' +
                        'No trae el detalle de líneas porque LibreDTE no lo entrega.' +
                        (dte.notaVinculacion ? `\n\nMotivo: ${dte.notaVinculacion}` : '')
                      }
                    >
                      <Link2 className="w-3 h-3" /> Externo
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Emitido en el ERP</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    {dte.estadoSii === 'rechazado' && dte.metadata?.glosa_sii && (
                      <button
                        type="button"
                        onClick={() => onVerRechazo(dte)}
                        title="Ver el motivo por el que el SII lo rechazó"
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <AlertCircle size={12} /> Motivo
                      </button>
                    )}
                    {esNcNd && (
                      <button
                        type="button"
                        onClick={() => onVerDetalles(dte)}
                        title="Ver detalles"
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        <Info size={12} /> Detalles
                      </button>
                    )}
                    {dte.folio != null && (
                      <>
                        <button
                          type="button"
                          onClick={() => onVer(dte)}
                          title="Ver el documento acá mismo"
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          <Eye size={12} /> Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => onDescargar(dte)}
                          title="Descargar el PDF"
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          <FileDown size={12} /> PDF
                        </button>
                      </>
                    )}
                    {/* ⚠️ Se ofrece para CUALQUIER documento, no sólo los vinculados a mano, y es
                        deliberado: el backend lo permite y existe el caso real de una factura que
                        el ERP emitió contra la orden equivocada —pasó con la OV 824— donde
                        desvincular y volver a vincular al proceso correcto es la salida. Lo que
                        cambia según el origen es el aviso: soltar un documento que el ERP emitió
                        para esta orden borra un vínculo que nadie creó a mano. */}
                    <button
                      type="button"
                      onClick={() => onDesvincular(dte)}
                      title="Desvincular de este proceso (no borra el documento ni libera el folio)"
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
