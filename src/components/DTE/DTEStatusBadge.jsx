const ESTADOS = {
  temporal:  { label: 'Demo / Sin firma', cls: 'bg-amber-100 text-amber-800' },
  pendiente: { label: 'Pendiente SII',    cls: 'bg-gray-100 text-gray-600'   },
  enviado:   { label: 'Enviado al SII',   cls: 'bg-blue-100 text-blue-700'   },
  aceptado:  { label: 'Aceptado SII',     cls: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado SII',    cls: 'bg-red-100 text-red-700'     },
  // Un documento anulado sigue existiendo y su folio sigue consumido: se muestra, tachado. Este
  // estado llega sobre todo desde LibreDTE al vincular un documento emitido fuera del ERP, y
  // faltaba — por eso la pestaña de documentos se había hecho un badge propio en paralelo.
  anulado:   { label: 'Anulado',          cls: 'bg-red-50 text-red-600 line-through' },
};

const TIPOS = {
  33: 'Factura',
  34: 'Factura exenta',
  39: 'Boleta',
  52: 'Guía de Despacho',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
};

export function DTEStatusBadge({ tipoDte, folio, estadoSii = 'temporal' }) {
  const estado = ESTADOS[String(estadoSii ?? '').toLowerCase()] ?? ESTADOS.pendiente;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-gray-800">
        {TIPOS[tipoDte] ?? `DTE ${tipoDte}`}
        {folio ? ` N° ${folio}` : ' (sin folio)'}
      </span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${estado.cls}`}>
        {estado.label}
      </span>
    </div>
  );
}
