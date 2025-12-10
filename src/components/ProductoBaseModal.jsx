import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";

function ProductCombobox({
  value,
  onChange,
  options,
  onSelect,
  placeholder = "Escribe para buscar producto..."
}) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const filtered = (value || "").trim()
    ? options.filter((p) =>
        p.nombre.toLowerCase().includes(value.toLowerCase())
      )
    : options;

  const updatePosition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useEffect(() => {
    updatePosition();
  }, [open, value]);

  useEffect(() => {
    const onScroll = () => open && updatePosition();
    const onResize = () => open && updatePosition();
    const onClick = (e) => {
      if (!inputRef.current) return;
      if (!open) return;
      const target = e.target;
      if (target === inputRef.current || inputRef.current.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", onClick, true);
    };
  }, [open]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        placeholder={placeholder}
        className="border px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
      />

      {open && filtered.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 2147483647
            }}
          >
            <ul className="bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
              {filtered.map((prod) => (
                <li
                  key={prod.id}
                  className="px-3 py-2 hover:bg-green-100 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(prod);
                    setOpen(false);
                  }}
                >
                  {prod.nombre}
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

export default function ProductoBaseModal({
  isOpen,
  onClose,
  onSave,
  producto,
  isEditing = false
}) {
  const [productos, setProductos] = useState([]);
  const [formData, setFormData] = useState({
    id_producto_base: "",
    nombre_producto: "",
    unidades_por_caja: "",
    precio_unidad: "",
    precio_caja: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Cargar productos base
      api("/productos-base")
        .then((data) => setProductos(data))
        .catch(console.error);

      // Si estamos editando, cargar datos del producto
      if (isEditing && producto) {
        setFormData({
          id_producto_base: producto.id_producto_base || "",
          nombre_producto: producto.nombre_producto || "",
          unidades_por_caja: producto.unidades_por_caja || "",
          precio_unidad: producto.precio_unidad || "",
          precio_caja: producto.precio_caja || ""
        });
      } else {
        // Resetear formulario para nuevo producto
        setFormData({
          id_producto_base: "",
          nombre_producto: "",
          unidades_por_caja: "",
          precio_unidad: "",
          precio_caja: ""
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, producto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleProductSelect = (producto) => {
    setFormData(prev => ({
      ...prev,
      id_producto_base: producto.id,
      nombre_producto: producto.nombre,
      unidades_por_caja: producto.unidades_por_caja || ""
    }));
    setErrors(prev => ({ ...prev, id_producto_base: "" }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.id_producto_base) {
      newErrors.id_producto_base = "Debe seleccionar un producto";
    }
    if (!formData.precio_unidad || parseFloat(formData.precio_unidad) <= 0) {
      newErrors.precio_unidad = "El precio por unidad debe ser mayor a 0";
    }
    if (!formData.precio_caja || parseFloat(formData.precio_caja) <= 0) {
      newErrors.precio_caja = "El precio por caja debe ser mayor a 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const productoData = {
        id_producto_base: parseInt(formData.id_producto_base),
        nombre_producto: formData.nombre_producto,
        unidades_por_caja: parseInt(formData.unidades_por_caja),
        precio_unidad: parseFloat(formData.precio_unidad),
        precio_caja: parseFloat(formData.precio_caja)
      };

      await onSave(productoData);
      onClose();
    } catch (error) {
      console.error("Error al guardar producto:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? "Editar Producto" : "Agregar Producto"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selección de Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto *
            </label>
            <ProductCombobox
              value={formData.nombre_producto}
              onChange={(value) => setFormData(prev => ({ ...prev, nombre_producto: value }))}
              options={productos}
              onSelect={handleProductSelect}
              placeholder="Buscar producto..."
            />
            {errors.id_producto_base && (
              <p className="text-red-500 text-sm mt-1">{errors.id_producto_base}</p>
            )}
          </div>

          {/* Unidades por Caja */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidades por Caja
            </label>
            <input
              type="number"
              name="unidades_por_caja"
              value={formData.unidades_por_caja}
              onChange={handleChange}
              className="border px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Este valor se obtiene automáticamente del producto seleccionado
            </p>
          </div>

          {/* Precio por Unidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio por Unidad *
            </label>
            <input
              type="number"
              name="precio_unidad"
              value={formData.precio_unidad}
              onChange={handleChange}
              placeholder="Ej: 1500"
              step="0.01"
              min="0"
              className={`border px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.precio_unidad ? "border-red-500" : ""
              }`}
            />
            {errors.precio_unidad && (
              <p className="text-red-500 text-sm mt-1">{errors.precio_unidad}</p>
            )}
          </div>

          {/* Precio por Caja */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio por Caja *
            </label>
            <input
              type="number"
              name="precio_caja"
              value={formData.precio_caja}
              onChange={handleChange}
              placeholder="Ej: 18000"
              step="0.01"
              min="0"
              className={`border px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none ${
                errors.precio_caja ? "border-red-500" : ""
              }`}
            />
            {errors.precio_caja && (
              <p className="text-red-500 text-sm mt-1">{errors.precio_caja}</p>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : isEditing ? "Actualizar" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
