/**
 * Todo lo que cuelga documentalmente de un proceso, en un solo lugar.
 *
 * Tres cosas que hasta ahora vivían separadas o no existían:
 *
 *   1. Los DTE que emitió el ERP.
 *   2. Los DTE emitidos FUERA del ERP y vinculados a mano (tarea #108).
 *   3. Los archivos sueltos que alguien adjuntó — fotos, PDFs, comprobantes.
 *
 * 🔴 LOS DOS PRIMEROS SE MUESTRAN JUNTOS, NO EN LISTAS APARTE. Para quien consulta, un
 * documento tributario es un documento tributario: separarlos por quién apretó el botón obliga
 * a mirar dos tablas para responder «¿esta orden está facturada?». Lo que sí se distingue es el
 * ORIGEN, con una etiqueta, porque un documento externo tiene una propiedad que importa: **no
 * trae el detalle de líneas**, y ese vacío es esperado.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText, Link2, Paperclip, Upload, Trash2, ExternalLink, Unlink, RefreshCw,
} from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { adjuntosService, formatearTamano, TIPOS_ACEPTADOS, MAX_BYTES } from '../../services/adjuntosService.js';
import { toast } from '../../lib/toast.js';
import { formatCLP } from '../../services/formatHelpers.js';
import VincularDteModal from './VincularDteModal.jsx';

const NOMBRE_TIPO = {
  33: 'Factura', 34: 'Factura exenta', 39: 'Boleta',
  52: 'Guía de despacho', 56: 'Nota de débito', 61: 'Nota de crédito',
};

/**
 * Pill de estado propio en vez de `DTEStatusBadge`: ese componente imprime también el tipo y el
 * folio —que acá ya son una columna— y no contempla ANULADO, que sí puede venir de un documento
 * importado desde LibreDTE.
 */
const ESTADO_SII = {
  pendiente: { label: 'Pendiente SII', cls: 'bg-gray-100 text-gray-600' },
  enviado:   { label: 'Enviado al SII', cls: 'bg-blue-100 text-blue-700' },
  aceptado:  { label: 'Aceptado SII', cls: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado SII', cls: 'bg-red-100 text-red-700' },
  anulado:   { label: 'Anulado', cls: 'bg-red-50 text-red-600 line-through' },
};

function PillEstado({ estado }) {
  const e = ESTADO_SII[String(estado ?? '').toLowerCase()] ?? ESTADO_SII.pendiente;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${e.cls}`}>{e.label}</span>;
}

function fechaCorta(v) {
  if (!v) return '—';
  return String(v).slice(0, 10);
}

/**
 * @param secciones qué mostrar. Por defecto las dos.
 *   En la solicitud de mercadería se usa `{ documentos: false }` porque su pestaña «Guías de
 *   Despacho» ya tiene una vista propia y muy trabajada de sus DTE (emitir, ver borrador,
 *   confirmar llegada); repetir la lista acá sería mostrar lo mismo dos veces en pestañas
 *   distintas. Ahí la vinculación de documentos externos se ofrece desde esa misma pestaña.
 */
export default function DocumentosYAdjuntos({
  idOrdenVenta,
  idSolicitud,
  onCambio,
  secciones = { documentos: true, adjuntos: true },
}) {
  const verDocumentos = secciones.documentos !== false;
  const verAdjuntos = secciones.adjuntos !== false;
  const [documentos, setDocumentos] = useState([]);
  const [adjuntos, setAdjuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarVincular, setMostrarVincular] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivo = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Sólo se pide lo que se va a mostrar: con `documentos: false` no tiene sentido pagar la
      // consulta de DTE para descartarla.
      const [docs, adjs] = await Promise.all([
        verDocumentos
          ? (idOrdenVenta
              ? dteService.listarPorOrden(idOrdenVenta)
              : dteService.listarPorSolicitud(idSolicitud))
          : Promise.resolve([]),
        verAdjuntos
          ? adjuntosService.listar({ idOrdenVenta, idSolicitud })
          : Promise.resolve([]),
      ]);
      setDocumentos(docs.filter(Boolean));
      setAdjuntos(adjs);
    } catch (err) {
      toast.error(err?.message ?? 'No se pudieron cargar los documentos');
    } finally {
      setCargando(false);
    }
  }, [idOrdenVenta, idSolicitud, verDocumentos, verAdjuntos]);

  useEffect(() => { cargar(); }, [cargar]);

  async function desvincular(dte) {
    const nota = window.prompt(
      'Se va a desvincular este documento del proceso.\n\n' +
      'El documento NO se borra y su folio sigue consumido — lo único que se deshace es a qué ' +
      'proceso corresponde.\n\n¿Por qué se desvincula?',
    );
    if (nota == null) return;
    if (nota.trim().length < 5) {
      toast.error('Hay que anotar el motivo (mínimo 5 caracteres).');
      return;
    }
    try {
      await dteService.desvincularDocumento(dte.id, nota.trim());
      toast.success('Documento desvinculado.');
      await cargar();
      onCambio?.();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo desvincular');
    }
  }

  async function subirArchivo(e) {
    const archivo = e.target.files?.[0];
    // El input se limpia siempre: si no, elegir el mismo archivo dos veces seguidas no dispara
    // el evento y parece que el botón dejó de andar.
    e.target.value = '';
    if (!archivo) return;

    if (archivo.size > MAX_BYTES) {
      toast.error(`El archivo pesa ${formatearTamano(archivo.size)}; el máximo es ${MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }

    const descripcion = window.prompt(`Descripción de "${archivo.name}" (opcional):`) ?? '';

    setSubiendo(true);
    try {
      await adjuntosService.subir({ archivo, descripcion: descripcion.trim(), idOrdenVenta, idSolicitud });
      toast.success('Archivo adjuntado.');
      await cargar();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo subir el archivo');
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminarAdjunto(adj) {
    if (!window.confirm(`¿Quitar "${adj.nombre}" de este proceso?`)) return;
    try {
      await adjuntosService.eliminar(adj.id);
      toast.success('Adjunto eliminado.');
      await cargar();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo eliminar');
    }
  }

  if (cargando) {
    return <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-500">Cargando documentos…</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Documentos tributarios ────────────────────────────────────────────────────── */}
      {verDocumentos && (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <FileText className="w-4 h-4" /> Documentos tributarios
          </h3>
          <div className="flex gap-2">
            <button
              type="button" onClick={cargar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              title="Volver a consultar"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
            <button
              type="button" onClick={() => setMostrarVincular(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-primary text-primary rounded-lg hover:bg-primary/5"
            >
              <Link2 className="w-3.5 h-3.5" /> Vincular documento externo
            </button>
          </div>
        </div>

        {documentos.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            Este proceso no tiene documentos tributarios.
            {' '}Si se emitió alguno fuera del ERP, se puede vincular con el botón de arriba.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Documento</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Fecha</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600">Total</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Estado SII</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Origen</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <span className="font-medium">{NOMBRE_TIPO[d.tipoDte] ?? `Tipo ${d.tipoDte}`}</span>
                      <span className="text-gray-500"> N° {d.folio ?? '—'}</span>
                    </td>
                    <td className="px-2 py-2 text-gray-600">{fechaCorta(d.fechaEmision)}</td>
                    <td className="px-2 py-2 text-right">{formatCLP(d.montoTotal)}</td>
                    <td className="px-2 py-2"><PillEstado estado={d.estadoSii} /></td>
                    <td className="px-2 py-2">
                      {d.origen === 'EXTERNO' ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200"
                          title={
                            'Se emitió fuera del ERP y se vinculó a mano. ' +
                            'No trae el detalle de líneas porque LibreDTE no lo entrega.' +
                            (d.notaVinculacion ? `\n\nMotivo: ${d.notaVinculacion}` : '')
                          }
                        >
                          <Link2 className="w-3 h-3" /> Externo
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Emitido en el ERP</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {d.folio != null && (
                          <button
                            type="button" onClick={() => dteService.verPDF(d)}
                            className="text-gray-400 hover:text-blue-500" title="Ver PDF"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button" onClick={() => desvincular(d)}
                          className="text-gray-400 hover:text-red-600"
                          title="Desvincular de este proceso (no borra el documento)"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ── Archivos adjuntos ─────────────────────────────────────────────────────────── */}
      {verAdjuntos && (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Archivos adjuntos
          </h3>
          <button
            type="button"
            onClick={() => inputArchivo.current?.click()}
            disabled={subiendo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> {subiendo ? 'Subiendo…' : 'Adjuntar archivo'}
          </button>
          <input
            ref={inputArchivo}
            type="file"
            accept={TIPOS_ACEPTADOS.join(',')}
            onChange={subirArchivo}
            className="hidden"
          />
        </div>

        {adjuntos.length === 0 ? (
          <p className="text-sm text-gray-500 py-3">
            No hay archivos adjuntos. Se pueden subir fotos, PDF, planillas o documentos.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {adjuntos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => adjuntosService.abrir(a.id).catch((e) => toast.error(e.message))}
                    className="text-sm text-primary hover:underline truncate block text-left"
                  >
                    {a.nombre}
                  </button>
                  <p className="text-xs text-gray-500 truncate">
                    {[a.descripcion, formatearTamano(a.tamanoBytes), a.subidoPor, fechaCorta(a.fecha)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button" onClick={() => eliminarAdjunto(a)}
                  className="text-gray-400 hover:text-red-600 shrink-0" title="Quitar adjunto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      {mostrarVincular && (
        <VincularDteModal
          idOrdenVenta={idOrdenVenta}
          idSolicitud={idSolicitud}
          onClose={() => setMostrarVincular(false)}
          onSuccess={() => { cargar(); onCambio?.(); }}
        />
      )}
    </div>
  );
}
