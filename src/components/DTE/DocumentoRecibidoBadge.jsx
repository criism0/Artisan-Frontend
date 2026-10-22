// Estado de un documento recibido (GD o factura): aceptación, descuadre y el plazo de 8 días del SII.
//
// Sin emojis y con tres colores: rojo sólo cuando el plazo para reclamar vence o venció (después
// la factura queda aceptada sin vuelta), ámbar cuando quedan pocos días o el monto no cuadra, y
// verde para la aceptada. Lo demás es gris. Antes eran siete colores, un emoji por estado y un
// parpadeo.

import { formatCLP } from '../../services/formatHelpers.js';

export function DocumentoRecibidoBadge({ doc }) {
  const { estadoAceptacion, diasRestantes, descuadre, tipoDte } = doc ?? {};

  if (estadoAceptacion === 'aceptada') {
    return <Badge cls="bg-green-50 text-green-700">Aceptada</Badge>;
  }
  if (estadoAceptacion === 'reclamada') {
    return <Badge cls="bg-gray-100 text-gray-600">Reclamada</Badge>;
  }
  if (estadoAceptacion === 'vencida') {
    return <Badge cls="bg-red-50 text-red-700">Plazo SII vencido</Badge>;
  }

  // Las guías no tienen plazo de aceptación.
  if (tipoDte === 52) {
    return <Badge cls="bg-gray-100 text-gray-600">Registrada</Badge>;
  }

  if (estadoAceptacion === 'pendiente') {
    const dias = diasRestantes != null ? Number(diasRestantes) : null;

    if (dias !== null && dias <= 0) {
      return <Badge cls="bg-red-50 text-red-700">Vence hoy</Badge>;
    }
    if (dias !== null && dias <= 2) {
      return (
        <Badge cls="bg-red-50 text-red-700">
          {dias} día{dias !== 1 ? 's' : ''} para reclamar
        </Badge>
      );
    }
    if (dias !== null && dias <= 5) {
      return <Badge cls="bg-amber-50 text-amber-800">{dias} días para reclamar</Badge>;
    }

    if (descuadre != null && Math.abs(descuadre) > 0) {
      const sign = descuadre > 0 ? '+' : '';
      return (
        <Badge cls="bg-amber-50 text-amber-800">
          Descuadre {sign}{formatCLP(descuadre, 0)}
        </Badge>
      );
    }

    return <Badge cls="bg-gray-100 text-gray-600">Por revisar</Badge>;
  }

  return <Badge cls="bg-gray-100 text-gray-500">—</Badge>;
}

function Badge({ children, cls }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
