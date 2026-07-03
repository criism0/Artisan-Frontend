import { useState, useCallback } from 'react';
import { Send, Search, RefreshCw, FileText, Truck, FileMinus, FilePlus } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { formatCLP } from '../../services/formatHelpers.js';
import { toast } from '../../lib/toast.js';

const TIPO_LABEL = {
  33: 'Factura',
  39: 'Boleta',
  52: 'Guía de Despacho',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
};

const TIPO_ICON = {
  33: <FileText size={14} className="text-blue-600" />,
  39: <FileText size={14} className="text-green-600" />,
  52: <Truck size={14} className="text-amber-600" />,
  56: <FilePlus size={14} className="text-purple-600" />,
  61: <FileMinus size={14} className="text-red-600" />,
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: '33', label: 'Factura (33)' },
  { value: '52', label: 'Guía de Despacho (52)' },
  { value: '61', label: 'Nota de Crédito (61)' },
  { value: '56', label: 'Nota de Débito (56)' },
];

function formatFecha(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function BandejaDTEEmitidos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [filtros, setFiltros] = useState({
    desde_fecha: hace30,
    hasta_fecha: hoy,
    receptor: '',
    dte: '',
  });
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [buscado, setBuscado]       = useState(false);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const buscar = useCallback(async () => {
    setLoading(true);
    setBuscado(false);
    try {
      const params = {};
      if (filtros.desde_fecha) params.desde_fecha = filtros.desde_fecha;
      if (filtros.hasta_fecha) params.hasta_fecha = filtros.hasta_fecha;
      if (filtros.receptor.trim()) params.receptor = filtros.receptor.trim();
      if (filtros.dte) params.dte = Number(filtros.dte);

      const data = await dteService.listarBandejaSiiEmitidos(params);
      setDocumentos(Array.isArray(data) ? data : []);
      setBuscado(true);
    } catch (err) {
      toast.error('Error al cargar bandeja DTE emitidos: ' + (err?.message ?? 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Send size={22} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Bandeja DTE Emitidos</h1>
          <p className="text-sm text-gray-500">
            Documentos tributarios emitidos a clientes vía LibreDTE
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow border border-border p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              name="desde_fecha"
              value={filtros.desde_fecha}
              onChange={handleFiltroChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              name="hasta_fecha"
              value={filtros.hasta_fecha}
              onChange={handleFiltroChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">RUT Receptor</label>
            <input
              type="text"
              name="receptor"
              value={filtros.receptor}
              onChange={handleFiltroChange}
              placeholder="Ej: 76059975-1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo DTE</label>
            <select
              name="dte"
              value={filtros.dte}
              onChange={handleFiltroChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TIPO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={buscar}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading
              ? <RefreshCw size={14} className="animate-spin" />
              : <Search size={14} />}
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      <div className="bg-white rounded-xl shadow border border-border overflow-hidden">
        {!buscado && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Send size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Aplica los filtros y presiona <strong>Buscar</strong> para ver documentos emitidos</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <RefreshCw size={24} className="animate-spin text-green-500" />
          </div>
        )}

        {buscado && !loading && documentos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="text-sm">No se encontraron documentos con los filtros seleccionados</p>
          </div>
        )}

        {buscado && !loading && documentos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Receptor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Razón Social</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documentos.map((doc, i) => (
                  <tr key={`${doc.receptor}-${doc.dte}-${doc.folio}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        {TIPO_ICON[doc.dte] ?? <FileText size={14} className="text-gray-400" />}
                        {TIPO_LABEL[doc.dte] ?? `DTE ${doc.dte}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {doc.folio ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 text-xs">
                      {doc.receptor ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                      {doc.razon_social ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatFecha(doc.fecha)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {doc.total != null ? formatCLP(doc.total, 0) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {doc.estado ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          String(doc.estado).toLowerCase().includes('acept')
                            ? 'bg-green-100 text-green-700'
                            : String(doc.estado).toLowerCase().includes('rechaz')
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {doc.estado}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} encontrado{documentos.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
