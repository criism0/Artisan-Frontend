import { useState, useEffect, useMemo } from 'react';
import { FiX, FiSearch, FiDownload } from 'react-icons/fi';
import { useApi } from '../lib/api';
import { toast } from 'react-toastify';

/**
 * Modal para seleccionar una Orden de Compra y precargar sus insumos
 * (convertidos a unidad base) en una solicitud de mercadería.
 *
 * props:
 * - open: boolean
 * - onClose: () => void
 * - onImport: (insumos, ocId) => void
 *     insumos: [{ id_materia_prima, cantidad_solicitada, comentario }]
 *     (cantidad_solicitada en unidad base de la materia prima)
 */

const ESTADO_BADGE = {
  Recepcionada: 'bg-green-100 text-green-700',
  'Parcialmente recepcionada': 'bg-amber-100 text-amber-800',
  Rechazada: 'bg-red-100 text-red-700',
  Pagada: 'bg-blue-100 text-blue-700',
};

const fmtFecha = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CL');
};

export default function ImportarDesdeOCModal({ open, onClose, onImport }) {
  const api = useApi();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetchOrdenes = async () => {
      setLoading(true);
      try {
        const res = await api(`/proceso-compra/ordenes`, { method: 'GET' });
        const list = Array.isArray(res) ? res : [];
        setOrdenes([...list].sort((a, b) => (b.id || 0) - (a.id || 0)));
      } catch {
        toast.error('Error al cargar las órdenes de compra');
        setOrdenes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrdenes();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordenes;
    return ordenes.filter((o) => {
      const proveedor = (o?.proveedor?.nombre_empresa || '').toLowerCase();
      const idTxt = `oc-${String(o?.id ?? '')}`;
      const estado = (o?.estado || '').toLowerCase();
      return (
        proveedor.includes(q) ||
        idTxt.includes(q) ||
        String(o?.id ?? '').includes(q) ||
        estado.includes(q)
      );
    });
  }, [ordenes, query]);

  const handleSelect = async (ocId) => {
    setImportingId(ocId);
    try {
      const detalle = await api(`/proceso-compra/ordenes/${ocId}`, { method: 'GET' });
      const mps = Array.isArray(detalle?.materiasPrimas) ? detalle.materiasPrimas : [];

      // Agrupar por materia prima sumando cantidades en unidad base
      // (una OC puede traer la misma MP en más de un formato)
      const porMateriaPrima = new Map();
      let omitidos = 0;

      for (const mp of mps) {
        const pmp = mp?.proveedorMateriaPrima;
        const idMateriaPrima = pmp?.materiaPrima?.id ?? pmp?.id_materia_prima;
        const cantidadFormato = Number(mp?.cantidad_formato) || 0;
        const porFormato = Number(pmp?.cantidad_por_formato) || 0;

        if (!idMateriaPrima || cantidadFormato <= 0 || porFormato <= 0) {
          omitidos += 1;
          continue;
        }

        const base = cantidadFormato * porFormato;
        const key = String(idMateriaPrima);
        porMateriaPrima.set(key, (porMateriaPrima.get(key) || 0) + base);
      }

      const insumos = Array.from(porMateriaPrima.entries()).map(([id, cantidad]) => ({
        id_materia_prima: id,
        cantidad_solicitada: Math.round(cantidad * 100) / 100,
        comentario: `Importado desde OC-${String(ocId).padStart(3, '0')}`,
      }));

      if (insumos.length === 0) {
        toast.warn('La OC seleccionada no tiene insumos importables.');
        return;
      }
      if (omitidos > 0) {
        toast.warn(`${omitidos} línea(s) de la OC no se pudieron convertir y fueron omitidas.`);
      }

      onImport(insumos, ocId);
    } catch {
      toast.error('Error al cargar el detalle de la OC');
    } finally {
      setImportingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Importar insumos desde OC</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Selecciona una orden de compra para precargar sus insumos y cantidades.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Cerrar"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por N° de OC, proveedor o estado..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Cargando órdenes...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {query ? 'No hay órdenes que coincidan con la búsqueda.' : 'No hay órdenes de compra.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((o) => {
                const badgeCls = ESTADO_BADGE[o?.estado] || 'bg-gray-100 text-gray-600';
                const nInsumos = Array.isArray(o?.materiasPrimas) ? o.materiasPrimas.length : null;
                return (
                  <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800">
                          OC-{String(o.id).padStart(3, '0')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>
                          {o?.estado || '—'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {o?.proveedor?.nombre_empresa || `Proveedor #${o?.id_proveedor ?? '—'}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        {fmtFecha(o?.fecha)}
                        {nInsumos != null && ` · ${nInsumos} insumo${nInsumos === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(o.id)}
                      disabled={importingId != null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-hover disabled:opacity-50 whitespace-nowrap"
                    >
                      <FiDownload className="w-4 h-4" />
                      {importingId === o.id ? 'Importando...' : 'Importar'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
