import { useState, useEffect } from "react";
import { CHILE_UBICACIONES } from "../data/chileUbicaciones";
import { createPortal } from "react-dom";

const tiposDireccion = [
  { value: "Facturación", label: "Facturación" },
  { value: "Despacho", label: "Despacho" },
  { value: "Cobranza", label: "Cobranza" }
];

const tiposRecinto = [
  { value: "DEPARTAMENTO", label: "Depto" },
  { value: "OFICINA", label: "Oficina" },
  { value: "BODEGA", label: "Bodega" }
];

export default function DireccionModal({ 
  isOpen, 
  onClose, 
  onSave, 
  direccion = null, 
  isEditing = false,
  direccionesExistentes = []
}) {
  const [formData, setFormData] = useState({
    tipo_direccion: "",
    nombre_sucursal: "",
    calle: "",
    numero: "",
    comuna: "",
    region: "",
    tipo_recinto: "",
    es_principal: false
  });
  const [errors, setErrors] = useState({});
  const [regiones, setRegiones] = useState([]);
  const [comunas, setComunas] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && direccion) {
        setFormData({
          tipo_direccion: direccion.tipo_direccion || "",
          nombre_sucursal: direccion.nombre_sucursal || "",
          calle: direccion.calle || "",
          numero: direccion.numero || "",
          comuna: direccion.comuna || "",
          region: direccion.region || "",
          tipo_recinto: direccion.tipo_recinto || "",
          es_principal: direccion.es_principal || false
        });
      } else {
        setFormData({
          tipo_direccion: "",
          nombre_sucursal: "",
          calle: "",
          numero: "",
          comuna: "",
          region: "",
          tipo_recinto: "",
          es_principal: false
        });
      }
      setErrors({});
      // Cargar regiones estáticas
      setRegiones(CHILE_UBICACIONES || []);
    }
  }, [isOpen, isEditing, direccion]);

  useEffect(() => {
    const regionSeleccionada = regiones.find((r) => r.nombre === formData.region || r.codigo === formData.region);
    if (!regionSeleccionada) {
      setComunas([]);
      return;
    }
    setComunas(regionSeleccionada.comunas || []);
  }, [formData.region, regiones]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'es_principal' && checked) {
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.tipo_direccion.trim()) {
      newErrors.tipo_direccion = "El tipo de dirección es obligatorio";
    }
    if (!formData.nombre_sucursal.trim()) {
      newErrors.nombre_sucursal = "El nombre de sucursal es obligatorio";
    }
    if (!formData.calle.trim()) {
      newErrors.calle = "La calle es obligatoria";
    }
    if (!formData.numero.trim()) {
      newErrors.numero = "El número es obligatorio";
    }
    if (!formData.comuna.trim()) {
      newErrors.comuna = "La comuna es obligatoria";
    }
    if (!formData.region.trim()) {
      newErrors.region = "La región es obligatoria";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      if (formData.es_principal) {
        const direccionesActualizadas = direccionesExistentes.map(dir => ({
          ...dir,
          es_principal: false
        }));
        onSave(formData, direccionesActualizadas);
      } else {
        onSave(formData);
      }
      onClose();
    }
  };

  const handleClose = () => {
    setFormData({
      tipo_direccion: "",
      nombre_sucursal: "",
      calle: "",
      numero: "",
      comuna: "",
      region: "",
      es_principal: false
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isEditing ? "Editar Dirección" : "Nueva Dirección"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Dirección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Dirección <span className="text-red-500">*</span>
            </label>
            <select
              name="tipo_direccion"
              value={formData.tipo_direccion}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.tipo_direccion ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Selecciona un tipo</option>
              {tiposDireccion.map(tipo => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
            {errors.tipo_direccion && (
              <p className="text-red-500 text-xs mt-1">{errors.tipo_direccion}</p>
            )}
          </div>

          {/* Tipo de Recinto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Recinto
            </label>
            <select
              name="tipo_recinto"
              value={formData.tipo_recinto}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none border-gray-300"
            >
              <option value="">Selecciona un tipo</option>
              {tiposRecinto.map((tr) => (
                <option key={tr.value} value={tr.value}>{tr.label}</option>
              ))}
            </select>
          </div>

          {/* Nombre Sucursal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Sucursal / Referencia <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nombre_sucursal"
              value={formData.nombre_sucursal}
              onChange={handleChange}
              placeholder="Ej: Casa Matriz, Local Viña del Mar"
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.nombre_sucursal ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.nombre_sucursal && (
              <p className="text-red-500 text-xs mt-1">{errors.nombre_sucursal}</p>
            )}
          </div>

          {/* Calle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Calle <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="calle"
              value={formData.calle}
              onChange={handleChange}
              placeholder="Ej: Av. Libertador"
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.calle ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.calle && (
              <p className="text-red-500 text-xs mt-1">{errors.calle}</p>
            )}
          </div>

          {/* Número */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="numero"
              value={formData.numero}
              onChange={handleChange}
              placeholder="Ej: 123"
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.numero ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.numero && (
              <p className="text-red-500 text-xs mt-1">{errors.numero}</p>
            )}
          </div>

          {/* Región */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Región <span className="text-red-500">*</span>
            </label>
            <select
              name="region"
              value={formData.region}
              onChange={(e) => {
                // Reset comuna al cambiar región
                setFormData((prev) => ({ ...prev, region: e.target.value, comuna: "" }));
                setErrors((prev) => ({ ...prev, region: "", comuna: "" }));
              }}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.region ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Selecciona una región</option>
              {regiones.map((r) => (
                <option key={r.codigo} value={r.nombre}>{r.nombre}</option>
              ))}
            </select>
            {errors.region && (
              <p className="text-red-500 text-xs mt-1">{errors.region}</p>
            )}
          </div>

          {/* Comuna */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comuna <span className="text-red-500">*</span>
            </label>
            <select
              name="comuna"
              value={formData.comuna}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.comuna ? "border-red-500" : "border-gray-300"
              }`}
              disabled={!formData.region}
            >
              <option value="">Selecciona una comuna</option>
              {comunas.map((c) => (
                <option key={c.codigo} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
            {errors.comuna && (
              <p className="text-red-500 text-xs mt-1">{errors.comuna}</p>
            )}
            {!formData.region && (
              <p className="text-xs text-gray-500 mt-1">
                Primero selecciona una región para habilitar las comunas.
              </p>
            )}
          </div>

          {/* Es Principal */}
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="es_principal"
                checked={formData.es_principal}
                onChange={handleChange}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Dirección de despacho principal
              </label>
            </div>
            {formData.es_principal && (
              <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                ℹ️ Al marcar esta dirección como principal, se desmarcarán automáticamente otras direcciones principales del cliente.
              </p>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {isEditing ? "Actualizar" : "Guardar"} Dirección
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
