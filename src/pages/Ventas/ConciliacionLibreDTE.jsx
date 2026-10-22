import { useState, useCallback, useEffect } from 'react';
import {
  Scale, RefreshCw, ExternalLink, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Unlock, CloudOff, FileText, Truck, FileMinus, FilePlus,
} from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';
import { toast } from '../../lib/toast.js';

/**
 * Conciliación con LibreDTE (B5).
 *
 * LA REGLA QUE ORDENA LA VISTA: ante cualquier diferencia, manda LibreDTE. Por eso cada fila
 * enlaza al documento allá y ninguna acción de acá corrige un documento — sólo se libera el
 * bloqueo, y eso exige escribir qué se vio.
 */

const TIPO_LABEL = { 33: 'Factura', 39: 'Boleta', 52: 'Guía de Despacho', 56: 'Nota de Débito', 61: 'Nota de Crédito' };
const TIPO_ICON = {
  33: <FileText size={14} className="text-blue-600" />,
  39: <FileText size={14} className="text-green-600" />,
  52: <Truck size={14} className="text-amber-600" />,
  56: <FilePlus size={14} className="text-purple-600" />,
  61: <FileMinus size={14} className="text-red-600" />,
};

const CLASE = {
  solo_en_libredte: { titulo: 'Emitido en LibreDTE y ausente en el ERP', explica: 'El folio ya se consumió. Es lo que pasa si una emisión se corta a medio camino, o si alguien facturó a mano desde el portal.' },
  solo_en_nosotros: { titulo: 'Registrado en el ERP y ausente en LibreDTE', explica: 'Nuestro registro dice que existe y allá no aparece. Manda LibreDTE: no debe declararse hasta comprobarlo.' },
  datos_distintos:  { titulo: 'Existe en los dos lados, con diferencias', explica: 'Mismo folio, distinta información. Se corrige copiando lo que dice LibreDTE.' },
  emision_trabada:  { titulo: 'Emisiones trabadas', explica: 'Se interrumpieron a mitad de camino y hoy bloquean el reintento de esa orden. Hay que mirarlas en LibreDTE y liberarlas.' },
  temporal_huerfano:{ titulo: 'Borradores abandonados en LibreDTE', explica: 'Documentos armados que nunca se generaron. No consumieron folio: son ruido, no un problema.' },
};

const SEVERIDAD = {
  alta:  { chip: 'bg-red-100 text-red-700 border-red-200',       icono: <AlertTriangle size={15} className="text-red-600" />,   barra: 'border-l-red-500' },
  media: { chip: 'bg-amber-100 text-amber-700 border-amber-200', icono: <AlertCircle size={15} className="text-amber-600" />,  barra: 'border-l-amber-500' },
  baja:  { chip: 'bg-gray-100 text-gray-600 border-gray-200',    icono: <Info size={15} className="text-gray-500" />,          barra: 'border-l-gray-300' },
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

function Tarjeta({ etiqueta, valor, tono = 'text-text' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className={`text-2xl font-bold ${tono}`}>{valor}</p>
    </div>
  );
}

function ModalLiberar({ discrepancia, onCerrar, onLiberado }) {
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);

  const liberar = async () => {
    setEnviando(true);
    try {
      await dteService.liberarEmision(discrepancia.id_emision, nota.trim());
      toast.success('Emisión liberada. La orden se puede volver a facturar.');
      onLiberado();
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo liberar la emisión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-text">Liberar la emisión trabada</h3>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <p className="font-medium mb-1">Esto no emite ni anula ningún documento.</p>
            <p>
              Lo único que hace es dejar de bloquear el reintento. Antes de liberar, abre el
              documento en LibreDTE y comprueba si existe: si el folio se consumió, volver a
              facturar emitiría un <strong>segundo documento válido</strong>.
            </p>
          </div>

          {discrepancia.url_libredte && (
            <a
              href={discrepancia.url_libredte}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary-dark text-sm font-medium"
            >
              <ExternalLink size={15} /> Abrir en LibreDTE
            </a>
          )}

          <div>
            <label htmlFor="nota-liberar" className="block text-sm font-medium text-text mb-1">
              ¿Qué viste en LibreDTE?
            </label>
            <textarea
              id="nota-liberar"
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej.: el temporal existe pero nunca se generó, no hay folio consumido."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-gray-500 mt-1">Queda registrado junto a la emisión.</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={liberar}
            disabled={nota.trim().length < 5 || enviando}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <Unlock size={15} /> {enviando ? 'Liberando…' : 'Liberar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fila({ d, onLiberar }) {
  const sev = SEVERIDAD[d.severidad] ?? SEVERIDAD.baja;
  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${sev.barra} rounded-lg px-4 py-3`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {TIPO_ICON[d.tipo_dte] ?? <FileText size={14} className="text-gray-400" />}
            <span className="font-medium text-text">{TIPO_LABEL[d.tipo_dte] ?? `Tipo ${d.tipo_dte}`}</span>
            {d.folio != null && <span className="text-gray-500">folio {d.folio}</span>}
            {d.fecha && <span className="text-gray-400">· {d.fecha}</span>}
            {d.total != null && <span className="text-gray-500">· {formatCLP(d.total)}</span>}
          </div>
          {d.razon_social && <p className="text-sm text-gray-600 mt-0.5">{d.razon_social}</p>}
          <p className="text-sm text-text mt-1.5">{d.detalle}</p>
          <p className="text-xs text-gray-500 mt-1">{d.sugerencia}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {d.url_libredte && (
            <a
              href={d.url_libredte}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ExternalLink size={14} /> LibreDTE
            </a>
          )}
          {d.clase === 'emision_trabada' && (
            <button
              onClick={() => onLiberar(d)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark"
            >
              <Unlock size={14} /> Liberar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConciliacionLibreDTE() {
  const [rango, setRango] = useState({ desde: haceDias(7), hasta: hoyISO() });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liberando, setLiberando] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setResultado(await dteService.conciliar(rango));
    } catch (err) {
      toast.error('No se pudo conciliar: ' + (err?.message ?? 'error desconocido'));
      setResultado(null);
    } finally {
      setLoading(false);
    }
  }, [rango]);

  useEffect(() => { cargar(); /* carga inicial */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fuerza la consulta del estado ante el SII de todos los documentos sin resolver.
   *
   * Después vuelve a conciliar: si un documento pasó de PENDIENTE a ACEPTADO, la discrepancia
   * `datos_distintos` que lo señalaba tiene que desaparecer de la lista — dejar el resultado
   * viejo en pantalla haría creer que la sincronización no sirvió.
   */
  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    try {
      const r = await dteService.sincronizarEstados();
      if (r.revisados === 0) {
        toast.info('No hay documentos pendientes de resolución ante el SII.');
      } else if (r.actualizados === 0) {
        toast.info(`${r.revisados} documento(s) consultado(s); el SII todavía no los resuelve.`);
      } else {
        toast.success(`${r.actualizados} de ${r.revisados} documento(s) actualizados con lo que dice el SII.`);
      }
      if (r.errores > 0) {
        toast.warning(`${r.errores} documento(s) no se pudieron consultar. Siguen como estaban.`);
      }
      await cargar();
    } catch (err) {
      toast.error('No se pudieron actualizar los estados: ' + (err?.message ?? 'error desconocido'));
    } finally {
      setSincronizando(false);
    }
  }, [cargar]);

  const grupos = {};
  for (const d of resultado?.discrepancias ?? []) {
    (grupos[d.clase] ??= []).push(d);
  }
  const clasesPresentes = Object.keys(CLASE).filter((c) => grupos[c]?.length);
  const sinDiferencias = resultado && resultado.discrepancias.length === 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Scale size={22} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Conciliación con LibreDTE</h1>
          <p className="text-sm text-gray-500">
            Cruza nuestros documentos con los emitidos y los borradores de LibreDTE. Ante cualquier
            diferencia, manda LibreDTE.
          </p>
        </div>
      </div>

      {/* Rango */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="desde" className="block text-xs text-gray-500 mb-1">Desde</label>
          <input
            id="desde" type="date" value={rango.desde}
            onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input
            id="hasta" type="date" value={rango.hasta}
            onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary-dark disabled:opacity-50 inline-flex items-center gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Consultando…' : 'Conciliar'}
        </button>

        {/* El worker sincroniza solo cada hora; esto es para no esperar el ciclo. Consultar el
            estado ante el SII es una lectura: no emite, no anula y no consume folio. */}
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          title="Le pregunta al SII por todos los documentos que siguen sin resolverse"
          className="px-4 py-2 rounded-lg border border-primary text-primary text-sm hover:bg-primary/5 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <RefreshCw size={15} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Consultando al SII…' : 'Actualizar estados SII'}
        </button>
      </div>

      {/* 🔴 Si LibreDTE no contestó hay que decirlo fuerte: sin eso, "0 diferencias" miente. */}
      {resultado && !resultado.libredte_respondio && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex gap-3">
          <CloudOff size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-semibold">No se pudo consultar LibreDTE.</p>
            <p>{resultado.aviso}</p>
          </div>
        </div>
      )}

      {resultado && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Tarjeta etiqueta="Documentos del ERP" valor={resultado.totales.nuestros} />
          <Tarjeta etiqueta="Emitidos en LibreDTE" valor={resultado.totales.en_libredte} />
          <Tarjeta etiqueta="Borradores allá" valor={resultado.totales.temporales} />
          <Tarjeta
            etiqueta="Emisiones trabadas"
            valor={resultado.totales.emisiones_abiertas}
            tono={resultado.totales.emisiones_abiertas ? 'text-red-600' : 'text-text'}
          />
          <Tarjeta
            etiqueta="Diferencias"
            valor={resultado.totales.discrepancias}
            tono={resultado.totales.discrepancias ? 'text-amber-600' : 'text-green-600'}
          />
        </div>
      )}

      {sinDiferencias && resultado.libredte_respondio && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle2 size={28} className="text-green-600 mx-auto mb-2" />
          <p className="font-medium text-green-900">Todo cuadra en este rango.</p>
          <p className="text-sm text-green-700 mt-1">
            Cada documento del ERP tiene su par en LibreDTE, no hay emisiones trabadas y no
            quedaron borradores sueltos.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {clasesPresentes.map((clase) => (
          <section key={clase}>
            <div className="flex items-center gap-2 mb-1">
              {SEVERIDAD[grupos[clase][0].severidad].icono}
              <h2 className="font-semibold text-text">{CLASE[clase].titulo}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERIDAD[grupos[clase][0].severidad].chip}`}>
                {grupos[clase].length}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-2">{CLASE[clase].explica}</p>
            <div className="space-y-2">
              {grupos[clase].map((d, i) => (
                <Fila key={`${clase}-${d.id_emision ?? d.id_documento ?? d.folio ?? i}`} d={d} onLiberar={setLiberando} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {liberando && (
        <ModalLiberar
          discrepancia={liberando}
          onCerrar={() => setLiberando(null)}
          onLiberado={() => { setLiberando(null); cargar(); }}
        />
      )}
    </div>
  );
}
