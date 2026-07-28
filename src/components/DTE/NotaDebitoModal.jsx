// Nota de Débito (Tipo 56) — charge additional costs against an existing invoice.
// Use cases: extra freight, storage fees, price underbilling.
// API: POST /dte/emitidos/:dteId/nota-debito  body: { razon, items }

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { dteService } from '../../services/dteService.js';
import { toast } from '../../lib/toast.js';

const EMPTY_ITEM = () => ({ nombre: '', cantidad: 1, precioUnitario: 0, unidad: 'un' });

export default function NotaDebitoModal({ dte, onClose, onSuccess }) {
  const [razon, setRazon]   = useState('');
  const [items, setItems]   = useState([EMPTY_ITEM()]);
  const [loading, setLoading] = useState(false);

  function updateItem(i, key, value) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: value } : it));
  }

  function addItem() {
    setItems(prev => [...prev, EMPTY_ITEM()]);
  }

  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!razon.trim()) { toast.error('Ingresa el motivo de la Nota de Débito'); return; }
    if (items.some(it => !it.nombre.trim())) { toast.error('Todos los ítems deben tener nombre'); return; }
    if (items.some(it => Number(it.precioUnitario) <= 0)) { toast.error('El precio de cada ítem debe ser mayor a 0'); return; }

    setLoading(true);
    try {
      const payload = {
        razon,
        items: items.map(it => ({
          nombre:         it.nombre.trim(),
          cantidad:       Number(it.cantidad),
          precioUnitario: Number(it.precioUnitario),
          unidad:         it.unidad,
        })),
      };
      const res = await dteService.emitirNotaDebito(dte.id, payload);
      toast.success(`Nota de Débito${res?.folio ? ` N° ${res.folio}` : ''} emitida`);
      onSuccess(res);
      onClose();
    } catch (e) {
      toast.error(e.message ?? 'Error al emitir Nota de Débito');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-gray-900">Emitir Nota de Débito</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Referencia a Factura{dte.folio ? ` N° ${dte.folio}` : ' (sin folio)'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700">
            <strong>Nota de Débito:</strong> registra cargos adicionales sobre la Factura referenciada (flete, almacenaje, corrección de precio hacia arriba). No implica movimiento de inventario.
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del cargo adicional <span className="text-red-500">*</span>
            </label>
            <textarea
              value={razon}
              onChange={e => setRazon(e.target.value)}
              rows={2}
              placeholder="Ej: Flete adicional por despacho en segunda vuelta, almacenaje por retiro tardío"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Líneas de cargo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ítems del cargo adicional
            </label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <input
                    placeholder="Descripción del cargo"
                    value={it.nombre}
                    onChange={e => updateItem(i, 'nombre', e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm min-w-0"
                    required
                  />
                  <input
                    type="number" min={1} value={it.cantidad}
                    onChange={e => updateItem(i, 'cantidad', e.target.value)}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                    title="Cantidad"
                  />
                  <input
                    type="number" min={1} value={it.precioUnitario}
                    onChange={e => updateItem(i, 'precioUnitario', e.target.value)}
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                    placeholder="Precio"
                    title="Precio unitario"
                    required
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:underline"
            >
              <Plus size={12} /> Agregar línea
            </button>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Emitiendo...' : 'Emitir Nota de Débito'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
