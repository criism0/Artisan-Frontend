/**
 * Vincular a este proceso un documento tributario emitido FUERA del ERP — tarea #108.
 *
 * EL CASO REAL. Una guía de despacho emitida a mano en el panel de LibreDTE para un traslado
 * que en el ERP es una solicitud, o una factura de una OV emitida desde el portal del SII,
 * queda «en el aire»: consumió un folio y en el sistema no le corresponde nada. Acá se busca
 * ese documento y se dice a qué proceso pertenece.
 *
 * 🔴 LO QUE EL OPERARIO TIENE QUE ENTENDER ANTES DE APRETAR, Y POR ESO ESTÁ ESCRITO EN PANTALLA:
 * vincular es DOCUMENTAL. No mueve inventario, no corrige los montos de la orden y no repone la
 * trazabilidad de lo que salió por fuera. Deja constancia de que ese documento existe y a qué
 * corresponde — nada más. Si el monto no calza, se muestra la diferencia y se vincula igual:
 * rechazar por eso dejaría el documento en el aire, que es el problema que esto resuelve.
 */

import { useState } from 'react';
import { X, Search, Link2, AlertTriangle } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { toast } from '../../lib/toast.js';
import { formatCLP } from '../../services/formatHelpers.js';

const TIPOS_DTE = [
  { value: 33, label: '33 — Factura electrónica' },
  { value: 52, label: '52 — Guía de despacho' },
  { value: 61, label: '61 — Nota de crédito' },
  { value: 56, label: '56 — Nota de débito' },
  { value: 34, label: '34 — Factura exenta' },
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function haceDiasISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function VincularDteModal({ idOrdenVenta, idSolicitud, onClose, onSuccess }) {
  const [modo, setModo] = useState('folio'); // 'folio' | 'rango'
  const [tipo, setTipo] = useState(33);
  const [folio, setFolio] = useState('');
  const [desde, setDesde] = useState(haceDiasISO(30));
  const [hasta, setHasta] = useState(hoyISO());

  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [nota, setNota] = useState('');
  const [vinculando, setVinculando] = useState(false);

  const destino = idOrdenVenta
    ? `la orden de venta #${idOrdenVenta}`
    : `la solicitud #${idSolicitud}`;

  async function buscar(e) {
    e?.preventDefault();
    setBuscando(true);
    setSeleccionado(null);
    try {
      const docs = await dteService.buscarEnLibreDte(
        modo === 'folio'
          ? { tipo, folio: Number(folio) }
          : { desde, hasta, ...(tipo ? { tipo } : {}) },
      );
      setResultados(docs);
      if (docs.length === 0) {
        toast.info('No se encontró ningún documento emitido con esos datos.');
      }
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo consultar LibreDTE');
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  async function vincular() {
    if (!seleccionado) return;
    if (nota.trim().length < 5) {
      toast.error('Anotá por qué este documento corresponde a este proceso (mínimo 5 caracteres).');
      return;
    }
    setVinculando(true);
    try {
      const r = await dteService.vincularDocumento({
        tipoDte: seleccionado.tipo_dte,
        folio: seleccionado.folio,
        idOrdenVenta,
        idSolicitud,
        nota: nota.trim(),
      });

      if (r?.diferencia_monto) {
        const d = r.diferencia_monto;
        toast.warning(
          `Vinculado. ⚠️ El documento dice ${formatCLP(d.documento)} y el proceso ${formatCLP(d.proceso)} ` +
          `(diferencia de ${formatCLP(Math.abs(d.diferencia))}). No se corrigió ningún monto.`,
        );
      } else if (r?.orden_marcada_facturada) {
        toast.success('Documento vinculado. La orden quedó marcada como Facturada.');
      } else {
        toast.success('Documento vinculado.');
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo vincular el documento');
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-text">Vincular documento emitido fuera del ERP</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {/* 🔴 El aviso va ARRIBA y siempre visible, no en letra chica al final: es lo que
              distingue vincular de facturar, y confundirlos haría creer que el inventario se
              movió. */}
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Vincular deja constancia; no mueve nada.</p>
                <p className="mt-1">
                  El documento se asocia a {destino} para poder consultarlo desde acá.
                  <strong> No se mueve inventario, no se corrigen los montos de la orden y no se emite ni anula nada.</strong>{' '}
                  Si el total del documento no calza con el del proceso, se vincula igual y se muestra la diferencia.
                </p>
              </div>
            </div>
          </div>

          {/* Buscador */}
          <form onSubmit={buscar} className="mb-4">
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setModo('folio'); setResultados(null); }}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  modo === 'folio' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'
                }`}
              >
                Por folio
              </button>
              <button
                type="button"
                onClick={() => { setModo('rango'); setResultados(null); }}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  modo === 'rango' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'
                }`}
              >
                Por fecha
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className={modo === 'folio' ? 'sm:col-span-2' : 'sm:col-span-2'}>
                <label className="block text-xs text-gray-600 mb-1">Tipo de documento</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {TIPOS_DTE.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {modo === 'folio' ? (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Folio</label>
                  <input
                    type="number"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="24312"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input
                      type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input
                      type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={buscando || (modo === 'folio' && !folio)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50 text-sm"
              >
                <Search className="w-4 h-4" />
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
          </form>

          {/* Resultados */}
          {resultados !== null && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {resultados.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500 text-center">
                  No hay documentos emitidos que calcen con esa búsqueda.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Documento</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Receptor</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((d) => {
                        const yaVinculado = !!d.vinculado_a;
                        const activo = seleccionado?.folio === d.folio && seleccionado?.tipo_dte === d.tipo_dte;
                        return (
                          <tr
                            key={`${d.tipo_dte}-${d.folio}`}
                            onClick={() => !yaVinculado && setSeleccionado(d)}
                            className={`border-t border-gray-100 ${
                              yaVinculado
                                ? 'opacity-50 cursor-not-allowed'
                                : `cursor-pointer hover:bg-gray-50 ${activo ? 'bg-primary/10' : ''}`
                            }`}
                          >
                            <td className="px-3 py-2 font-medium">
                              {d.tipo_dte}-{d.folio}
                              {d.anulado && <span className="ml-2 text-xs text-red-600">anulado</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{d.fecha}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {d.razon_social || d.receptor_rut || '—'}
                            </td>
                            <td className="px-3 py-2 text-right">{formatCLP(d.total)}</td>
                            <td className="px-3 py-2 text-xs">
                              {/* La marca de "ya está" es lo que hace usable la lista: sin ella el
                                  operario no sabe cuáles ya se resolvieron. */}
                              {yaVinculado ? (
                                <span className="text-gray-500">Ya vinculado a {d.vinculado_a}</span>
                              ) : d.ya_registrado ? (
                                <span className="text-amber-700">En el sistema, sin vincular</span>
                              ) : (
                                <span className="text-blue-700">Sólo en LibreDTE</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Confirmación */}
          {seleccionado && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-700 mb-2">
                Vinculando <strong>{seleccionado.tipo_dte}-{seleccionado.folio}</strong> a {destino}.
              </p>
              <label className="block text-xs text-gray-600 mb-1">
                ¿Por qué este documento corresponde a este proceso? (queda registrado)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Ej: se emitió a mano en LibreDTE el viernes porque el ERP estaba sin folios"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={vincular}
            disabled={!seleccionado || vinculando || nota.trim().length < 5}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            {vinculando ? 'Vinculando…' : 'Vincular documento'}
          </button>
        </div>
      </div>
    </div>
  );
}
