import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

/**
 * Los correos que la Cola IA apartó sin poder crear la orden.
 *
 * 🔴 POR QUÉ EXISTE ESTA PANTALLA. Hasta el 2026-08-07 estos correos se descartaban en
 * silencio: se etiquetaban como procesados, no se creaba nada y nadie se enteraba. Se midieron
 * **79 en producción**, incluidos pedidos de Jumbo y WalMart. El worker ya no los pierde —los
 * aparta y deja el correo sin leer— pero hasta acá no había forma de verlos desde la app.
 *
 * ⚠️ LA TARJETA NO MENCIONA LA ETIQUETA DE GMAIL, y es a propósito. El worker le pone
 * `artisan-ov-requiere-revision` al correo, pero esa etiqueta **sólo la ve la cuenta que la
 * creó**: para el resto del equipo no existe. Mandar a alguien a buscar una etiqueta que no
 * puede ver es peor que no decir nada. Por eso la tarjeta trae acá todo lo necesario para
 * cargar el pedido —el motivo, el borrador rescatado y el texto del correo— en vez de
 * derivar a la bandeja.
 */

// ---------------------------------------------------------------------------
// Traducción del error técnico a algo accionable
// ---------------------------------------------------------------------------

/**
 * El `error_detalle` que guarda el worker es para diagnosticar, no para leer: llega a traer
 * el stack de Sequelize entero. Acá se convierte en una frase y una instrucción; el texto
 * original queda disponible plegado, porque para reportar un problema sigue haciendo falta.
 */
function explicar(a) {
  const detalle = a?.error_detalle || "";
  const cuerpo = a?.raw_email_texto || "";

  if (detalle.startsWith("La cantidad pedida no corresponde a unidades enteras:")) {
    return {
      titulo: "La cantidad pedida no son unidades enteras",
      // El detalle ya viene redactado por el worker con la línea y el valor.
      cuerpo: detalle.replace("La cantidad pedida no corresponde a unidades enteras:", "").trim(),
      queHacer:
        "El pedido vino en kilos y no calza con un número entero de unidades. Hay que decidir cuántas se despachan y cargar la orden a mano.",
    };
  }

  if (detalle.startsWith("Respuesta IA no parseable")) {
    // El retail chileno manda las OC en EDIFACT (un formato EDI), no en texto: la IA se atora
    // con eso. Reconocerlo acá ahorra abrir el correo para descubrirlo.
    const esEdi = /UNB\+UNOA/.test(cuerpo);
    return {
      titulo: "La IA no pudo leer el pedido",
      cuerpo: esEdi
        ? "El correo trae la orden en formato EDI (el que usan WalMart y Jumbo), que la IA todavía no interpreta."
        : "La respuesta de la IA no vino en un formato que se pueda usar.",
      queHacer: "Hay que cargar el pedido a mano desde el texto del correo.",
    };
  }

  if (detalle.startsWith("Se abandonó tras")) {
    return {
      titulo: "No se pudo guardar el pedido",
      cuerpo: "Se intentó cinco veces y falló siempre, así que se dejó de reintentar.",
      queHacer: "Hay que cargar el pedido a mano. Si se repite, conviene avisar con el detalle técnico.",
    };
  }

  // Cuerpo muy corto: la firma de las OC que vienen en un adjunto que no se pudo leer.
  if (cuerpo && cuerpo.trim().length < 200) {
    return {
      titulo: "El correo no traía el pedido en el texto",
      cuerpo: `El cuerpo tiene sólo ${cuerpo.trim().length} caracteres: el pedido venía en un archivo adjunto.`,
      queHacer: "Hay que abrir el adjunto y cargar el pedido a mano.",
    };
  }

  return {
    titulo: "No se pudo crear la orden",
    cuerpo: "",
    queHacer: "Hay que revisar el correo y cargar el pedido a mano.",
  };
}

// ---------------------------------------------------------------------------

function Fecha({ valor }) {
  if (!valor) return <span className="text-gray-400">—</span>;
  try {
    return (
      <span>
        {new Date(valor).toLocaleString("es-CL", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })}
      </span>
    );
  } catch {
    return <span>{String(valor)}</span>;
  }
}

const numeroCL = (v) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("es-CL", { maximumFractionDigits: 4 });

/** El borrador como texto plano, para pegarlo mientras se llena el formulario. */
function borradorComoTexto(b) {
  const lineas = [];
  if (b.numero_oc) lineas.push(`OC: ${b.numero_oc}`);
  if (b.fecha_orden) lineas.push(`Fecha: ${b.fecha_orden}`);
  lineas.push("");
  for (const l of b.lineas ?? []) {
    const partes = [l.descripcion || "(sin descripción)", `x ${numeroCL(l.cantidad)}`];
    if (l.precio_unitario != null) partes.push(`$${numeroCL(l.precio_unitario)}`);
    lineas.push(partes.join("  "));
  }
  return lineas.join("\n").trim();
}

function Borrador({ b }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(borradorComoTexto(b));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-medium text-gray-600">
          Lo que se alcanzó a leer
          {b.numero_oc && <span className="text-gray-400"> · OC {b.numero_oc}</span>}
        </p>
        <button
          onClick={copiar}
          className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
        >
          {copiado ? <Check size={12} /> : <Copy size={12} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      {b.lineas?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left font-medium px-3 py-1.5">Producto</th>
                <th className="text-right font-medium px-3 py-1.5 whitespace-nowrap">Cantidad</th>
                <th className="text-right font-medium px-3 py-1.5 whitespace-nowrap">Precio</th>
              </tr>
            </thead>
            <tbody>
              {b.lineas.map((l, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-1.5 text-gray-800">{l.descripcion || "(sin descripción)"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {numeroCL(l.cantidad)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap text-gray-600">
                    {l.precio_unitario == null ? "—" : `$${numeroCL(l.precio_unitario)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-gray-500">No se rescataron líneas de este correo.</p>
      )}
    </div>
  );
}

function TarjetaApartado({ a }) {
  const [abierto, setAbierto] = useState(false);
  const motivo = explicar(a);

  return (
    <div className="bg-white border border-gray-200 border-l-4 border-l-amber-400 rounded-xl">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5"
      >
        {abierto ? (
          <ChevronDown size={15} className="text-gray-400 mt-0.5 shrink-0" />
        ) : (
          <ChevronRight size={15} className="text-gray-400 mt-0.5 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {a.email_asunto || "(sin asunto)"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {a.email_remitente || "remitente desconocido"}
            <span className="text-gray-300"> · </span>
            <Fecha valor={a.procesado_en} />
            {a.intentos > 1 && (
              <>
                <span className="text-gray-300"> · </span>
                {a.intentos} intentos
              </>
            )}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {motivo.titulo}
            {motivo.cuerpo && <span className="text-gray-500"> — {motivo.cuerpo}</span>}
          </p>
        </div>
      </button>

      {abierto && (
        <div className="px-3 pb-3 pt-0.5 ml-[26px] space-y-3">
          <p className="text-xs text-gray-600">{motivo.queHacer}</p>

          {a.borrador && <Borrador b={a.borrador} />}

          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 list-none">
              <span className="group-open:hidden">▸ Ver el texto del correo</span>
              <span className="hidden group-open:inline">▾ Texto del correo</span>
            </summary>
            <pre className="mt-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2.5 max-h-52 overflow-auto whitespace-pre-wrap break-words">
              {a.raw_email_texto || "(vacío)"}
            </pre>
          </details>

          {/*
            El detalle técnico se conserva —es lo único que sirve para reportar un problema—
            pero plegado: llega a traer el stack de Sequelize completo, y eso arriba no ayuda
            a nadie a cargar un pedido.
          */}
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 list-none">
              <span className="group-open:hidden">▸ Detalle técnico</span>
              <span className="hidden group-open:inline">▾ Detalle técnico</span>
            </summary>
            <pre className="mt-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg p-2.5 max-h-40 overflow-auto whitespace-pre-wrap break-words text-gray-600">
              {a.error_detalle || "(sin detalle)"}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default function PanelApartados({ apartados, loading, error }) {
  if (loading) return <div className="text-center py-20 text-gray-400">Cargando…</div>;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900">
        No se pudieron cargar los correos apartados: {error}
      </div>
    );
  }

  if (!apartados?.length) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-gray-500 font-medium">Ningún correo quedó apartado</p>
        <p className="text-xs text-gray-400 mt-1">
          Todos los correos recibidos se pudieron convertir en orden o se descartaron por no ser
          un pedido.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 px-1 pb-1">
        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">
            {apartados.length} {apartados.length === 1 ? "correo no se pudo" : "correos no se pudieron"} convertir en orden.
          </span>{" "}
          No se perdieron: el pedido está acá abajo y hay que cargarlo a mano.
        </p>
      </div>

      {apartados.map((a) => (
        <TarjetaApartado key={a.id} a={a} />
      ))}
    </div>
  );
}
