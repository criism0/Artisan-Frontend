/**
 * SeccionAdjuntos — los archivos sueltos que cuelgan de un proceso.
 *
 * Fotos del despacho, el PDF de la OC del cliente, un comprobante. Vive dentro del centro de
 * documentos de una orden de venta y, por ahora, como pestaña propia de una solicitud.
 *
 * Salió de `DocumentosYAdjuntos`, que hacía dos cosas —los DTE y los adjuntos— y por eso
 * terminaba duplicando la tabla de documentos que el panel de facturación ya mostraba. Acá quedó
 * sólo la mitad de los archivos, que es la que de verdad se comparte entre OV y solicitud.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paperclip, Upload, Trash2, Eye, Download, FileText, Image as ImageIcon, File,
} from 'lucide-react';
import { adjuntosService, formatearTamano, TIPOS_ACEPTADOS, MAX_BYTES } from '../../services/adjuntosService.js';
import { toast } from '../../lib/toast.js';
import VisorArchivo from './VisorArchivo.jsx';
import { sePuedePrevisualizar } from '../../utils/previsualizacion.js';

function fechaCorta(v) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

/**
 * Ícono por tipo, no miniatura.
 *
 * Una miniatura obligaría a pedir la URL firmada de CADA imagen al abrir la pantalla, y esas
 * URLs son permisos de lectura de vida corta que el backend entrega de a uno justamente para no
 * repartirlos sin que nadie los use. Diez adjuntos serían diez permisos emitidos para mostrar
 * diez recuadros que quizás nadie mira.
 */
function IconoArchivo({ mimeType }) {
  const mime = String(mimeType ?? '');
  if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-violet-500" />;
  if (mime === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

export default function SeccionAdjuntos({ idOrdenVenta, idSolicitud, compacto = false }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  // El archivo elegido y todavía no subido: se confirma con una descripción opcional en vez de
  // un `window.prompt`, que es un cuadro del navegador y no se puede ni leer con calma.
  const [pendiente, setPendiente] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [visorEn, setVisorEn] = useState(null);
  const inputArchivo = useRef(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setAdjuntos(await adjuntosService.listar({ idOrdenVenta, idSolicitud }));
    } catch (err) {
      toast.error(err?.message ?? 'No se pudieron cargar los archivos adjuntos');
    } finally {
      setCargando(false);
    }
  }, [idOrdenVenta, idSolicitud]);

  useEffect(() => { cargar(); }, [cargar]);

  function elegirArchivo(archivo) {
    if (!archivo) return;
    if (archivo.size > MAX_BYTES) {
      toast.error(
        `"${archivo.name}" pesa ${formatearTamano(archivo.size)} y el máximo es ${MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    setPendiente(archivo);
    setDescripcion('');
  }

  async function confirmarSubida() {
    if (!pendiente) return;
    setSubiendo(true);
    try {
      await adjuntosService.subir({
        archivo: pendiente,
        descripcion: descripcion.trim(),
        idOrdenVenta,
        idSolicitud,
      });
      toast.success('Archivo adjuntado.');
      setPendiente(null);
      setDescripcion('');
      await cargar();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo subir el archivo');
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminar(adj) {
    if (!window.confirm(`¿Quitar "${adj.nombre}" de este proceso?`)) return;
    try {
      await adjuntosService.eliminar(adj.id);
      toast.success('Adjunto eliminado.');
      await cargar();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo eliminar');
    }
  }

  // Sólo los que el visor puede mostrar entran en la lista de navegación: si un .xlsx ocupara un
  // lugar entre las flechas, recorrer los adjuntos se interrumpiría en un cartel de "no se puede
  // ver" sin motivo aparente.
  const visibles = adjuntos.filter((a) => sePuedePrevisualizar(a.mimeType));

  const itemsVisor = visibles.map((a) => ({
    clave: `adjunto-${a.id}`,
    titulo: a.nombre,
    subtitulo: [a.descripcion, formatearTamano(a.tamanoBytes), a.subidoPor, fechaCorta(a.fecha)]
      .filter(Boolean)
      .join(' · '),
    mimeType: a.mimeType,
    obtenerFuente: async () => {
      const { url } = await adjuntosService.obtenerUrl(a.id);
      // `esBlob: false` — es una URL firmada de S3, no un objeto creado por nosotros: revocarla
      // no significa nada y `URL.revokeObjectURL` sobre una http(s) es un no-op silencioso.
      return { url, esBlob: false };
    },
  }));

  async function abrirFuera(adj) {
    try {
      await adjuntosService.abrir(adj.id);
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo abrir el archivo');
    }
  }

  function abrir(adj) {
    const idx = visibles.findIndex((v) => v.id === adj.id);
    if (idx >= 0) setVisorEn(idx);
    else abrirFuera(adj);
  }

  return (
    <div className={compacto ? '' : 'bg-white rounded-lg shadow p-5'}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-base font-semibold text-text flex items-center gap-2">
          <Paperclip className="w-4 h-4" /> Archivos adjuntos
          {adjuntos.length > 0 && (
            <span className="text-xs font-normal text-gray-400">({adjuntos.length})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => inputArchivo.current?.click()}
          disabled={subiendo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" /> Adjuntar archivo
        </button>
        <input
          ref={inputArchivo}
          type="file"
          accept={TIPOS_ACEPTADOS.join(',')}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            // El input se limpia siempre: si no, elegir el mismo archivo dos veces seguidas no
            // dispara el evento y parece que el botón dejó de andar.
            e.target.value = '';
            elegirArchivo(archivo);
          }}
          className="hidden"
        />
      </div>

      {/* Confirmación de subida: el nombre de lo que se va a subir y una descripción opcional. */}
      {pendiente && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
          <p className="text-sm text-gray-800 font-medium truncate">
            {pendiente.name}
            <span className="ml-2 text-xs font-normal text-gray-500">
              {formatearTamano(pendiente.size)}
            </span>
          </p>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional) — ej: foto del despacho firmada"
            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') confirmarSubida(); }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => { setPendiente(null); setDescripcion(''); }}
              disabled={subiendo}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarSubida}
              disabled={subiendo}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
            >
              {subiendo ? 'Subiendo…' : 'Subir archivo'}
            </button>
          </div>
        </div>
      )}

      {/* Zona de la lista: también recibe archivos arrastrados, como cualquier gestor de
          archivos. El `accept` del input no aplica al arrastre, así que el tipo lo valida el
          backend con su lista blanca — que es donde tiene que estar la decisión de todos modos. */}
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          elegirArchivo(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-lg transition-colors ${
          arrastrando ? 'ring-2 ring-primary/50 bg-primary/5' : ''
        }`}
      >
        {cargando ? (
          <p className="text-sm text-gray-500 py-3">Cargando archivos…</p>
        ) : adjuntos.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg py-6 text-center">
            <p className="text-sm text-gray-500">No hay archivos adjuntos.</p>
            <p className="text-xs text-gray-400 mt-1">
              Arrastrá un archivo acá, o usá «Adjuntar archivo». Se aceptan fotos, PDF, planillas
              y documentos.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {adjuntos.map((a) => {
              const verEnLinea = sePuedePrevisualizar(a.mimeType);
              return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <IconoArchivo mimeType={a.mimeType} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => abrir(a)}
                      className="text-sm text-primary hover:underline truncate block text-left"
                      title={verEnLinea ? 'Ver el archivo acá mismo' : 'Abrir el archivo'}
                    >
                      {a.nombre}
                    </button>
                    <p className="text-xs text-gray-500 truncate">
                      {[a.descripcion, formatearTamano(a.tamanoBytes), a.subidoPor, fechaCorta(a.fecha)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrir(a)}
                      className="p-1.5 rounded text-gray-400 hover:text-primary hover:bg-gray-50"
                      title={verEnLinea ? 'Ver acá mismo' : 'Abrir en una pestaña'}
                    >
                      {verEnLinea ? <Eye className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(a)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-50"
                      title="Quitar el archivo de este proceso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
