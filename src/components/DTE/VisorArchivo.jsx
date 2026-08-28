/**
 * VisorArchivo — mirar un documento SIN salir de la página.
 *
 * Pedido de Cristóbal, 2026-08-25: previsualizar como en Google Drive o Dropbox, en vez de que
 * cada «Ver» abra una pestaña nueva. Abrir una pestaña por documento obliga a perder de vista la
 * orden, y volver cuesta un cambio de ventana — revisar tres documentos seguidos deja cuatro
 * pestañas abiertas y ningún contexto.
 *
 * 🔴 NO SE SUMÓ NINGUNA LIBRERÍA DE PDF, Y ES LA DECISIÓN DE DISEÑO QUE IMPORTA.
 *
 * El navegador ya trae un visor de PDF completo —zoom, paginación, buscar, imprimir— y se usa
 * poniendo el archivo como `src` de un `<iframe>`. Meter un renderizador propio (`pdfjs-dist` en
 * canvas) habría significado reimplementar peor lo que ya existe, y sobre todo **volver a poner
 * ~470 KB en el bundle**: el mismo peso que el 2026-08-03 viajaba escondido en la vista de
 * órdenes de compra y hubo que sacar (§0-duodetricies), y la misma familia del `import(jspdf)`
 * roto que dejó «Descargar PDF» muerto diez días (§0-sexagies-quater).
 *
 * `pdfjs-dist` sigue en el proyecto y está bien que siga: lo usa `ocrService` para EXTRAER texto,
 * que es algo que el navegador no sabe hacer. Ver un PDF sí sabe.
 *
 * ⚠️ Lo que el iframe no puede mostrar se dice, no se esconde. Un .xlsx o un .heic no se
 * previsualizan en un navegador de escritorio, y ofrecer un visor en blanco es peor que ofrecer
 * la descarga: parece que el archivo está roto.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  X, Download, ExternalLink, ChevronLeft, ChevronRight, FileQuestion, AlertCircle,
} from 'lucide-react';
import { sePuedePrevisualizar, esImagen } from '../../utils/previsualizacion.js';

/**
 * @param items    descriptores `{ clave, titulo, subtitulo, mimeType, obtenerFuente, onDescargar }`.
 *                 `obtenerFuente()` devuelve `{ url, esBlob }` — `esBlob` decide si hay que
 *                 revocarla al cerrar. Es una función y no una URL ya resuelta porque las dos
 *                 fuentes son caras y de vida corta: el PDF de un DTE se baja del backend, y la
 *                 URL firmada de un adjunto dura 5 minutos. Pedirlas de antemano para toda la
 *                 lista repartiría permisos de lectura que nadie va a usar.
 * @param indice   cuál se está mirando. El visor no lo maneja: navegar cambia el índice del
 *                 padre, que es quien conoce la lista.
 */
export default function VisorArchivo({ items, indice, onCambiarIndice, onCerrar }) {
  const [fuente, setFuente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const item = items?.[indice] ?? null;
  const clave = item?.clave ?? null;
  const total = items?.length ?? 0;

  const hayAnterior = indice > 0;
  const haySiguiente = indice < total - 1;

  const irA = useCallback(
    (nuevo) => {
      if (nuevo < 0 || nuevo >= total) return;
      onCambiarIndice?.(nuevo);
    },
    [onCambiarIndice, total],
  );

  // Trae el archivo del item actual. La limpieza revoca la URL de blob: sin eso, recorrer diez
  // documentos deja diez copias del PDF retenidas en memoria hasta recargar la página.
  useEffect(() => {
    if (!item) return undefined;

    let vigente = true;
    let paraRevocar = null;

    setCargando(true);
    setError(null);
    setFuente(null);

    if (!sePuedePrevisualizar(item.mimeType)) {
      setCargando(false);
      return undefined;
    }

    item
      .obtenerFuente()
      .then(({ url, esBlob }) => {
        // Si mientras viajaba la respuesta el operario ya pasó a otro documento, esta URL no se
        // muestra nunca — pero igual hay que revocarla, o queda retenida sin dueño.
        if (!vigente) {
          if (esBlob) URL.revokeObjectURL(url);
          return;
        }
        if (esBlob) paraRevocar = url;
        setFuente({ url, esBlob });
      })
      .catch((err) => {
        if (vigente) setError(err?.message ?? 'No se pudo abrir el archivo');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
      if (paraRevocar) URL.revokeObjectURL(paraRevocar);
    };
    // `clave` y no `item`: el padre arma los descriptores en cada render, así que depender del
    // objeto volvería a bajar el archivo en cada repintado de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Escape cierra; las flechas recorren la lista. Es lo que hace un visor de archivos, y sin
  // esto revisar varios documentos obliga a volver al ratón entre cada uno.
  useEffect(() => {
    const alTeclado = (e) => {
      if (e.key === 'Escape') onCerrar?.();
      else if (e.key === 'ArrowLeft') irA(indice - 1);
      else if (e.key === 'ArrowRight') irA(indice + 1);
    };
    document.addEventListener('keydown', alTeclado);

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar, irA, indice]);

  if (!item) return null;

  const puedeVerse = sePuedePrevisualizar(item.mimeType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        // Igual que el Modal de la app: sólo cierra si el clic EMPEZÓ en el fondo. Si empezó
        // dentro (seleccionando texto del documento) y terminó afuera, no debe desaparecer.
        if (e.target === e.currentTarget) onCerrar?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.titulo}
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Barra superior */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{item.titulo}</h2>
            {item.subtitulo && (
              <p className="text-xs text-gray-500 truncate">{item.subtitulo}</p>
            )}
          </div>

          {total > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => irA(indice - 1)}
                disabled={!hayAnterior}
                title="Documento anterior (←)"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                {indice + 1} de {total}
              </span>
              <button
                type="button"
                onClick={() => irA(indice + 1)}
                disabled={!haySiguiente}
                title="Documento siguiente (→)"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {fuente?.url && (
              <a
                href={fuente.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en una pestaña nueva"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Pestaña
              </a>
            )}
            {item.onDescargar && (
              <button
                type="button"
                onClick={() => item.onDescargar()}
                title="Descargar el archivo"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lienzo */}
        <div className="flex-1 min-h-0 bg-gray-100 flex items-center justify-center">
          {!puedeVerse ? (
            <EstadoVacio
              icono={<FileQuestion className="w-10 h-10 text-gray-400" />}
              titulo="Este archivo no se puede ver acá"
              detalle={
                esImagen(item.mimeType)
                  ? 'El navegador no muestra este formato de imagen (las fotos de iPhone en HEIC son el caso típico). Descargándolo se abre con el visor del computador.'
                  : 'Los navegadores sólo muestran PDF, imágenes y texto. Descargalo para abrirlo con el programa que corresponda.'
              }
              accion={item.onDescargar}
            />
          ) : cargando ? (
            <p className="text-sm text-gray-500">Cargando documento…</p>
          ) : error ? (
            <EstadoVacio
              icono={<AlertCircle className="w-10 h-10 text-red-400" />}
              titulo="No se pudo abrir el documento"
              detalle={error}
              accion={item.onDescargar}
            />
          ) : esImagen(item.mimeType) ? (
            <img
              src={fuente.url}
              alt={item.titulo}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <iframe
              src={fuente.url}
              title={item.titulo}
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoVacio({ icono, titulo, detalle, accion }) {
  return (
    <div className="text-center px-8 max-w-md">
      <div className="flex justify-center mb-3">{icono}</div>
      <p className="text-sm font-medium text-gray-700">{titulo}</p>
      <p className="text-xs text-gray-500 mt-1.5">{detalle}</p>
      {accion && (
        <button
          type="button"
          onClick={() => accion()}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-hover"
        >
          <Download className="w-4 h-4" /> Descargar archivo
        </button>
      )}
    </div>
  );
}
