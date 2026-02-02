import { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';

const TIPOS_CAMPO = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Selección' },
  { value: 'textarea', label: 'Área de texto' },
  { value: 'boolean', label: 'Sí/No' }
];

export default function AnalisisSensorialDefinicionForm({ campos, setCampos }) {
  const [campoActual, setCampoActual] = useState({
    nombre: '',
    etiqueta: '',
    tipo: 'text',
    obligatorio: false,
    opciones: []
  });
  const [opcionesTexto, setOpcionesTexto] = useState('');
  const [modoEdicion, setModoEdicion] = useState(false);
  const [indiceEdicion, setIndiceEdicion] = useState(null);

  const resetForm = () => {
    setCampoActual({
      nombre: '',
      etiqueta: '',
      tipo: 'text',
      obligatorio: false,
      opciones: []
    });
    setOpcionesTexto('');
    setModoEdicion(false);
    setIndiceEdicion(null);
  };

  const generarNombreTecnico = (etiqueta) => {
    const base = String(etiqueta || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');

    return base || `campo_${Date.now()}`;
  };

  const handleAgregar = () => {
    // Validaciones
    if (!campoActual.etiqueta.trim()) {
      alert('La etiqueta del campo es obligatoria');
      return;
    }

    // Permitir cualquier texto al usuario; el sistema asegura un identificador interno.
    const nombreFinal = campoActual.nombre.trim()
      ? campoActual.nombre.trim()
      : generarNombreTecnico(campoActual.etiqueta);

    // Validar nombre único
    const nombreExiste = modoEdicion 
      ? campos.some((c, idx) => idx !== indiceEdicion && c.nombre === nombreFinal)
      : campos.some(c => c.nombre === nombreFinal);

    if (nombreExiste) {
      alert('Ya existe un campo con ese nombre');
      return;
    }

    // Validar opciones si es select
    if (campoActual.tipo === 'select') {
      const opciones = opcionesTexto
        .split('\n')
        .map(o => o.trim())
        .filter(o => o);
      
      if (opciones.length === 0) {
        alert('Debe agregar al menos una opción para campos de selección');
        return;
      }
      campoActual.opciones = opciones;
    } else {
      campoActual.opciones = [];
    }

    const campoParaGuardar = { ...campoActual, nombre: nombreFinal };

    if (modoEdicion) {
      // Actualizar campo existente
      const nuevosCampos = [...campos];
      nuevosCampos[indiceEdicion] = campoParaGuardar;
      setCampos(nuevosCampos);
    } else {
      // Agregar nuevo campo
      setCampos([...campos, campoParaGuardar]);
    }

    resetForm();
  };

  const handleEditar = (index) => {
    const campo = campos[index];
    setCampoActual({ ...campo });
    setOpcionesTexto(campo.opciones?.join('\n') || '');
    setModoEdicion(true);
    setIndiceEdicion(index);
  };

  const handleEliminar = (index) => {
    if (confirm('¿Está seguro de eliminar este campo?')) {
      setCampos(campos.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Análisis Sensorial
        </h3>
        <span className="text-sm text-gray-500">
          {campos.length} campo{campos.length !== 1 ? 's' : ''} configurado{campos.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Columna Izquierda: Formulario */}
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-700">
            {modoEdicion ? 'Editar Campo' : 'Nuevo Campo'}
          </h4>

          {/* Nombre del campo (identificador técnico) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identificador (opcional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={campoActual.nombre}
              onChange={(e) => setCampoActual({ ...campoActual, nombre: e.target.value })}
              placeholder="Opcional. Si lo dejas vacío se autogenera desde la etiqueta"
              disabled={modoEdicion} // No permitir cambiar nombre al editar
            />
            <p className="text-xs text-gray-500 mt-1">
              Se usa como clave interna del formulario y registros.
            </p>
          </div>

          {/* Etiqueta (lo que ve el usuario) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etiqueta *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={campoActual.etiqueta}
              onChange={(e) => setCampoActual({ ...campoActual, etiqueta: e.target.value })}
              placeholder="ej: Color del Producto"
            />
          </div>

          {/* Tipo de campo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de campo *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={campoActual.tipo}
              onChange={(e) => setCampoActual({ ...campoActual, tipo: e.target.value })}
            >
              {TIPOS_CAMPO.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          {/* Opciones (solo si es select) */}
          {campoActual.tipo === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opciones (una por línea) *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
                value={opcionesTexto}
                onChange={(e) => setOpcionesTexto(e.target.value)}
                placeholder="Blanco&#10;Amarillo&#10;Rosa"
              />
            </div>
          )}

          {/* Obligatorio */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="campo-obligatorio"
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              checked={campoActual.obligatorio}
              onChange={(e) => setCampoActual({ ...campoActual, obligatorio: e.target.checked })}
            />
            <label htmlFor="campo-obligatorio" className="ml-2 text-sm text-gray-700">
              Campo obligatorio
            </label>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-2">
            {modoEdicion && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleAgregar}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-hover"
            >
              {modoEdicion ? 'Actualizar' : 'Agregar Campo'}
            </button>
          </div>
        </div>

        {/* Columna Derecha: Lista de campos */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">Campos Configurados</h4>
          
          {campos.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500">No hay campos configurados</p>
              <p className="text-sm text-gray-400 mt-1">
                Agrega campos desde el formulario de la izquierda
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {campos.map((campo, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {campo.etiqueta}
                        </span>
                        {campo.obligatorio && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            Obligatorio
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          <code className="bg-gray-100 px-1 rounded">{campo.nombre}</code>
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {TIPOS_CAMPO.find(t => t.value === campo.tipo)?.label}
                        </span>
                      </div>
                      {campo.tipo === 'select' && campo.opciones && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">Opciones:</span> {campo.opciones.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        type="button"
                        onClick={() => handleEditar(index)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
