// Visual badge for a received document (GD or Factura).
// Shows acceptance status, discrepancy, and SII 8-day countdown.

import { formatCLP } from '../../services/formatHelpers.js';

export function DocumentoRecibidoBadge({ doc }) {
  const { estadoAceptacion, diasRestantes, descuadre, tipoDte } = doc ?? {};

  // ── Acceptance state ──────────────────────────────────────────────────────
  if (estadoAceptacion === 'aceptada') {
    return <Badge cls="bg-green-100 text-green-800">✅ Aceptada</Badge>;
  }
  if (estadoAceptacion === 'reclamada') {
    return <Badge cls="bg-red-100 text-red-700">🚫 Reclamada</Badge>;
  }
  if (estadoAceptacion === 'vencida') {
    return <Badge cls="bg-red-200 text-red-900 font-semibold">💀 Plazo SII vencido</Badge>;
  }

  // GDs don't have acceptance deadlines — just show "registrada"
  if (tipoDte === 52) {
    return <Badge cls="bg-blue-100 text-blue-700">📦 Registrada</Badge>;
  }

  // ── Pending factura ───────────────────────────────────────────────────────
  if (estadoAceptacion === 'pendiente') {
    const dias = diasRestantes != null ? Number(diasRestantes) : null;

    if (dias !== null && dias <= 0) {
      return <Badge cls="bg-red-200 text-red-900 font-semibold">⏰ Plazo vencido hoy</Badge>;
    }
    if (dias !== null && dias <= 2) {
      return (
        <Badge cls="bg-red-100 text-red-800 font-semibold animate-pulse">
          ⏰ {dias} día{dias !== 1 ? 's' : ''} para reclamar
        </Badge>
      );
    }
    if (dias !== null && dias <= 5) {
      return (
        <Badge cls="bg-orange-100 text-orange-800">
          ⏰ {dias} días para reclamar
        </Badge>
      );
    }

    // Check for amount discrepancy
    if (descuadre != null && Math.abs(descuadre) > 0) {
      const sign = descuadre > 0 ? '+' : '';
      return (
        <Badge cls="bg-amber-100 text-amber-800">
          ⚠ Descuadre {sign}{formatCLP(descuadre, 0)}
        </Badge>
      );
    }

    return <Badge cls="bg-blue-100 text-blue-700">🔵 Pendiente revisión</Badge>;
  }

  return <Badge cls="bg-gray-100 text-gray-500">—</Badge>;
}

function Badge({ children, cls }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}
