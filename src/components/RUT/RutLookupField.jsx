/**
 * RutLookupField — Input de RUT con botón de búsqueda en el SII.
 *
 * Al hacer clic en "Buscar", consulta el endpoint /facturacion/contribuyentes/:rut
 * y llama a onFound(info) con los datos del contribuyente para que el formulario
 * padre autocomplete razón social, giro, dirección, etc.
 *
 * Props:
 *   value          {string}   — valor actual del campo RUT
 *   onChange       {fn}       — handler onChange estándar para el input
 *   onFound        {fn}       — callback(info) con los datos del SII
 *   error          {string}   — mensaje de error externo (ej. validación)
 *   disabled       {bool}
 *   placeholder    {string}
 */
import { useState } from 'react';
import { Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { contribuyenteService, normalizarRut, validarDvRut } from '../../services/contribuyenteService.js';
import { ApiError } from '../../lib/api.js';

export default function RutLookupField({
  value = '',
  onChange,
  onFound,
  error,
  disabled = false,
  placeholder = 'Ej: 76.059.975-1',
  // Sin `name`, el evento llega con `e.target.name === undefined` y un handler genérico
  // —`const { name, value } = e.target`— escribe en una clave inexistente: el campo se ve
  // pero no se puede editar. Pasarlo es lo que permite reusar el handler del formulario.
  name,
}) {
  const [estado, setEstado] = useState('idle'); // idle | loading | found | not_found | error
  const [mensaje, setMensaje] = useState('');

  async function handleBuscar() {
    const rut = normalizarRut(value);
    if (!rut || rut.length < 3) {
      setEstado('error');
      setMensaje('Ingresa un RUT válido antes de buscar');
      return;
    }
    if (!validarDvRut(rut)) {
      setEstado('error');
      setMensaje('El dígito verificador del RUT no es correcto');
      return;
    }

    setEstado('loading');
    setMensaje('');

    try {
      const info = await contribuyenteService.buscarPorRut(rut);
      setEstado('found');
      setMensaje(`✓ ${info.razon_social}`);
      if (onFound) onFound(info);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setEstado('not_found');
        setMensaje('RUT no encontrado en el SII');
      } else {
        setEstado('error');
        setMensaje(err?.message ?? 'Error al consultar el SII');
      }
    }
  }

  // Colores del estado
  const feedbackColor = {
    found: 'text-green-600',
    not_found: 'text-amber-600',
    error: 'text-red-600',
  }[estado] ?? 'text-gray-500';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-400' : 'border-gray-300'
          } disabled:bg-gray-50 disabled:text-gray-400`}
        />
        <button
          type="button"
          onClick={handleBuscar}
          disabled={disabled || estado === 'loading' || !value.trim()}
          title="Buscar en el SII"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {estado === 'loading'
            ? <Loader2 size={15} className="animate-spin" />
            : <Search size={15} />}
          <span className="hidden sm:inline">Buscar SII</span>
        </button>
      </div>

      {/* Feedback inline */}
      {mensaje && (
        <p className={`flex items-center gap-1 text-xs ${feedbackColor}`}>
          {estado === 'found'     && <CheckCircle2 size={12} />}
          {estado === 'not_found' && <AlertCircle size={12} />}
          {estado === 'error'     && <AlertCircle size={12} />}
          {mensaje}
        </p>
      )}

      {/* Error externo (validación) */}
      {error && !mensaje && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
