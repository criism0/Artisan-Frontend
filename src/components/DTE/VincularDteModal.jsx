/**
 * `BuscadorDteExterno` dentro de un modal.
 *
 * El buscador de documentos emitidos fuera del ERP se usa en dos formas distintas y es el MISMO
 * flujo, así que vive una sola vez (`BuscadorDteExterno`) y acá sólo se le pone el overlay:
 *
 *   · En la **orden de venta** se abre DENTRO del centro de documentos, sin modal: buscar un
 *     documento es parte de armar el expediente de la orden, no una interrupción de otra cosa.
 *   · En la **solicitud de mercadería** sigue siendo un modal, porque se invoca desde la pestaña
 *     de guías de despacho, que tiene su propio flujo de emisión y todavía no se rediseñó.
 *
 * Cuando la solicitud reciba su propio centro de documentos —el paso siguiente— este envoltorio
 * probablemente sobre.
 */

import { X } from 'lucide-react';
import BuscadorDteExterno from './BuscadorDteExterno.jsx';

export default function VincularDteModal({ idOrdenVenta, idSolicitud, onClose, onSuccess }) {
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
          <BuscadorDteExterno
            idOrdenVenta={idOrdenVenta}
            idSolicitud={idSolicitud}
            onCancelar={onClose}
            onSuccess={() => { onSuccess?.(); onClose?.(); }}
          />
        </div>
      </div>
    </div>
  );
}
