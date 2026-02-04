import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from '../../lib/toast';
import {jwtDecode} from 'jwt-decode';

export default function ModalAnalisisSensorial({ isOpen, onClose, idOrdenManufactura, api }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [definicion, setDefinicion] = useState(null);
  const [registro, setRegistro] = useState(null);
  const [valores, setValores] = useState({});

  useEffect(() => {
    if (isOpen && idOrdenManufactura) {
      fetchData();
    }
  }, [isOpen, idOrdenManufactura]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Obtener estado del análisis (incluye definición y registro si existe)
      const checkRes = await api(`/analisis-sensorial/check-pendiente/${idOrdenManufactura}`);
      
      if (!checkRes.requiere_analisis) {
        toast.info('Esta orden no requiere análisis sensorial');
        onClose();
        return;
      }

      setDefinicion(checkRes?.definicion ?? null);
      setRegistro(checkRes?.registro ?? null);

      const camposDefinicion = Array.isArray(checkRes?.definicion?.campos_definicion)
        ? checkRes.definicion.campos_definicion
        : [];

      // Si ya existe registro, prellenar valores
      if (checkRes?.registro) {
        setValores(checkRes.registro.valores_evaluacion || {});
      } else {
        if (camposDefinicion.length === 0) {
          toast.info('No hay campos definidos para el análisis sensorial');
          onClose();
          return;
        }

        const valoresIniciales = {};
        camposDefinicion.forEach((campo) => {
          if (campo?.nombre) valoresIniciales[campo.nombre] = '';
        });
        setValores(valoresIniciales);
      }
    } catch (error) {
      console.error('Error al cargar análisis sensorial:', error);
      toast.error('Error al cargar el análisis sensorial');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (nombreCampo, valor) => {
    setValores(prev => ({
      ...prev,
      [nombreCampo]: valor
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!definicion || !Array.isArray(definicion?.campos_definicion)) {
      toast.error('No hay definición válida de análisis sensorial para esta orden');
      return;
    }

    // Validar campos obligatorios
    const camposObligatorios = definicion.campos_definicion.filter(c => c.obligatorio);
    for (const campo of camposObligatorios) {
      const valor = valores[campo.nombre];
      if (valor === undefined || valor === null || valor === '') {
        toast.error(`El campo "${campo.etiqueta}" es obligatorio`);
        return;
      }
    }

    try {
      setSaving(true);

      await api('/analisis-sensorial/registro', {
        method: 'POST',
        body: JSON.stringify({
          id_orden_manufactura: idOrdenManufactura,
          valores_evaluacion: valores
        })
      });

      toast.success(registro ? 'Análisis sensorial actualizado' : 'Análisis sensorial completado');
      onClose(true); // true = recarga datos
    } catch (error) {
      console.error('Error al guardar análisis:', error);
      toast.error(error.message || 'Error al guardar el análisis sensorial');
    } finally {
      setSaving(false);
    }
  };

  const renderCampo = (campo) => {
    const valor = valores[campo.nombre] || '';

    switch (campo.tipo) {
      case 'text':
        return (
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={valor}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            step="any"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={valor}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      case 'select':
        const opciones = Array.isArray(campo.opciones) ? campo.opciones : [];
        return (
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={valor}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          >
            <option value="">Seleccione...</option>
            {opciones.map((opcion, idx) => (
              <option key={idx} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={valor}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              checked={Boolean(valor)}
              onChange={(e) => handleChange(campo.nombre, e.target.checked)}
            />
            <label className="ml-2 text-sm text-gray-700">Sí</label>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Análisis Sensorial - OM #{idOrdenManufactura}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-600">Cargando...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {definicion && definicion.campos_definicion.map((campo, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {campo.etiqueta}
                    {campo.obligatorio && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderCampo(campo)}
                  {campo.tipo === 'select' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Opciones: {campo.opciones.join(', ')}
                    </p>
                  )}
                </div>
              ))}

              {/* Info de quien completó */}
              {registro && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Completado por:</span> {registro.usuario?.nombre} {registro.usuario?.apellido}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Fecha:</span> {new Date(registro.completado_en).toLocaleString('es-CL')}
                  </p>
                  {registro.editado_en && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Última edición:</span> {new Date(registro.editado_en).toLocaleString('es-CL')}
                    </p>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-hover disabled:opacity-50"
            disabled={saving || loading}
          >
            {saving ? 'Guardando...' : (registro ? 'Actualizar' : 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
