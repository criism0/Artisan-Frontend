import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { buildApiUrl } from "../../lib/api";

/**
 * Lo que registró el chofer en una parada (rutas de entrega, Fase 2): el resultado, las
 * respuestas del formulario —las mismas que pedía AppSheet—, lo que se llevaba contra lo que se
 * recibió línea por línea, y las fotos.
 *
 * Las fotos se piden al backend (`/rutas/entregas/fotos/:id`), que redirige a una URL firmada de
 * S3 en producción o al archivo local en desarrollo: la misma vista funciona en los dos.
 */

const ETIQUETA_FOTO = {
  DOCUMENTO_FIRMADO: "Documento firmado",
  HOJA_RECEPCION: "Hoja de recepción",
  INCIDENCIA: "Incidencia",
  COMPROBANTE_EXTERNO: "Comprobante",
};

const TONO_ENTREGA = {
  Completa: "bg-green-100 text-green-800 border-green-200",
  Parcial: "bg-amber-100 text-amber-800 border-amber-200",
  "No entregada": "bg-red-100 text-red-800 border-red-200",
};

const fechaHora = (v) =>
  v ? new Date(v).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const cantidad = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 3 });
const urlFoto = (id) => buildApiUrl(`/rutas/entregas/fotos/${id}`);

/** `onAnular(entrega)`: si viene, se ofrece «Anular registro» (quien planifica, para corregir un error). */
export default function EntregaParada({ entrega, anuladas = [], onAnular }) {
  const [visor, setVisor] = useState(null); // índice de la foto abierta (entre las imágenes)
  const [verTodas, setVerTodas] = useState(false);

  if (!entrega) {
    return anuladas.length ? (
      <p className="text-xs text-gray-500 mt-2">Sin entrega vigente ({anuladas.length} anulada{anuladas.length > 1 ? "s" : ""}).</p>
    ) : null;
  }

  const lineas = entrega.documentos.flatMap((d) => d.lineas.map((l) => ({ ...l, documento: d })));
  const noEntregada = entrega.estado === "No entregada";
  const conDiferencia = noEntregada ? [] : lineas.filter((l) => Math.abs(l.recibida - l.esperada) > 1e-6);
  // En una no entregada no hay «diferencias»: no se entregó nada. Se muestra lo que se llevaba.
  const visibles = verTodas || noEntregada ? lineas : conDiferencia;

  const respuestas = [
    entrega.estado === "Parcial" && ["Motivo", entrega.motivo],
    entrega.estado === "Parcial" && ["Acuerdo con el cliente", entrega.acuerdo || "Sin acuerdo"],
    entrega.estado === "No entregada" && ["Por qué no se entregó", entrega.motivo_no_entrega],
    ["Comentario", entrega.comentario || "—"],
  ].filter(Boolean);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${TONO_ENTREGA[entrega.estado] ?? ""}`}>
          {entrega.estado}
        </span>
        <span className="text-gray-600">{fechaHora(entrega.fecha_hora)}</span>
        {entrega.registrador && <span className="text-gray-500">· {entrega.registrador}</span>}
        {entrega.estado_revision === "Pendiente" && (
          <span className="px-2 py-0.5 rounded-full border text-xs bg-amber-50 text-amber-800 border-amber-300">En revisión</span>
        )}
        {onAnular && (
          <button type="button" onClick={() => onAnular(entrega)} className="ml-auto text-xs text-red-600 hover:underline">
            Anular registro
          </button>
        )}
        {entrega.estado_revision === "Resuelta" && (
          <span className="px-2 py-0.5 rounded-full border text-xs bg-blue-50 text-blue-800 border-blue-200">
            Resuelta: {entrega.resolucion}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {entrega.documentos.map((d) => `${d.tipo_dte === 52 ? "Guía" : "Factura"} ${d.folio ?? `#${d.id}`} (OV #${d.id_orden_venta})`).join(" · ")}
      </div>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {respuestas.map(([t, v]) => (
          <div key={t} className={t === "Comentario" ? "sm:col-span-2" : ""}>
            <dt className="text-xs text-gray-500">{t}</dt>
            <dd className="text-gray-800 whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
        {entrega.nota_resolucion && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Nota de la revisión</dt>
            <dd className="text-gray-800 whitespace-pre-wrap">{entrega.nota_resolucion}</dd>
          </div>
        )}
      </dl>

      {lineas.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {noEntregada
                ? "Lo que se llevaba (vuelve a quedar pendiente)"
                : conDiferencia.length
                  ? `${conDiferencia.length} línea${conDiferencia.length > 1 ? "s" : ""} con diferencia`
                  : "Todo se recibió como venía"}
            </span>
            {!noEntregada && (
              <button type="button" onClick={() => setVerTodas((v) => !v)} className="text-xs text-primary hover:underline">
                {verTodas ? "Ver sólo diferencias" : `Ver las ${lineas.length} líneas`}
              </button>
            )}
          </div>
          {visibles.length > 0 && (
            <table className="mt-1 w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="py-1 font-medium">Producto</th>
                  <th className="py-1 font-medium text-right">Se llevaba</th>
                  <th className="py-1 font-medium text-right">Recibido</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => {
                  const difiere = !noEntregada && Math.abs(l.recibida - l.esperada) > 1e-6;
                  return (
                    <tr key={`${l.documento.id}:${l.linea}`} className={`border-t border-gray-200 ${difiere ? "bg-amber-50" : ""}`}>
                      <td className="py-1 pr-2 text-gray-800">{l.nombre}</td>
                      <td className="py-1 text-right text-gray-600">{cantidad(l.esperada)}</td>
                      <td className={`py-1 text-right font-medium ${difiere ? "text-amber-800" : "text-gray-800"}`}>{cantidad(l.recibida)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {entrega.fotos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entrega.fotos.map((f, i) => /\.pdf$/i.test(f.nombre) ? (
            <a
              key={f.id}
              href={urlFoto(f.id)}
              target="_blank"
              rel="noreferrer"
              className="w-28 h-28 flex flex-col items-center justify-center gap-1 rounded-md border border-gray-200 bg-white text-xs text-gray-600 hover:border-primary"
              title={f.nombre}
            >
              <span className="font-semibold text-red-600">PDF</span>
              <span className="px-1 truncate w-full text-center">{ETIQUETA_FOTO[f.tipo] ?? "Archivo"}</span>
            </a>
          ) : (
            <button
              key={f.id}
              type="button"
              onClick={() => setVisor(i)}
              className="group w-28 text-left"
              title={`${ETIQUETA_FOTO[f.tipo] ?? "Foto"} — ${f.nombre}`}
            >
              <img
                src={urlFoto(f.id)}
                alt={ETIQUETA_FOTO[f.tipo] ?? "Foto de la entrega"}
                loading="lazy"
                className="w-28 h-28 object-cover rounded-md border border-gray-200 bg-white group-hover:border-primary"
              />
              <span className="block text-[11px] text-gray-500 mt-0.5 truncate">{ETIQUETA_FOTO[f.tipo] ?? "Foto"}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Sin fotos</p>
      )}

      {anuladas.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Antes se registró y se anuló {anuladas.length} vez{anuladas.length > 1 ? "es" : ""}.
        </p>
      )}

      {visor != null && (
        <VisorFotos
          fotos={entrega.fotos.filter((f) => !/\.pdf$/i.test(f.nombre))}
          inicial={entrega.fotos.filter((f) => !/\.pdf$/i.test(f.nombre)).indexOf(entrega.fotos[visor])}
          onCerrar={() => setVisor(null)}
        />
      )}
    </div>
  );
}

/** Las fotos en grande, con flechas y Escape para cerrar. */
function VisorFotos({ fotos, inicial, onCerrar }) {
  const [i, setI] = useState(inicial);
  const foto = fotos[i];

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") setI((x) => Math.min(fotos.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = previo;
    };
  }, [fotos.length, onCerrar]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col" onClick={onCerrar}>
      <div className="flex items-center justify-between px-4 py-3 text-white text-sm" onClick={(e) => e.stopPropagation()}>
        <span>{ETIQUETA_FOTO[foto.tipo] ?? "Foto"} · {i + 1} de {fotos.length}</span>
        <div className="flex items-center gap-3">
          <a href={urlFoto(foto.id)} target="_blank" rel="noreferrer" className="underline text-white/80 hover:text-white">Abrir original</a>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"><X className="w-6 h-6" /></button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center gap-2 px-2 pb-6 min-h-0">
        <button
          type="button"
          disabled={i === 0}
          onClick={(e) => { e.stopPropagation(); setI(i - 1); }}
          className="p-2 text-white disabled:opacity-20"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
        <img
          src={urlFoto(foto.id)}
          alt={ETIQUETA_FOTO[foto.tipo] ?? "Foto"}
          className="max-h-full max-w-full object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          disabled={i === fotos.length - 1}
          onClick={(e) => { e.stopPropagation(); setI(i + 1); }}
          className="p-2 text-white disabled:opacity-20"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
