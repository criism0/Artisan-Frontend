import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState } from "react";
import { ApiError, useApi } from "../../lib/api";
import SimilarNameConfirmModal from "../../components/SimilarNameConfirmModal";

export default function AddProducto() {
  const navigate = useNavigate();
  const api = useApi();
  const [error, setError] = useState(null);
  const [similarModal, setSimilarModal] = useState({
    open: false,
    inputName: "",
    matches: [],
  });
  const [pendingPayload, setPendingPayload] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    peso: "",
    unidad_medida: "",
    precio: "",
    unidades_por_caja: "",
    codigo_ean: "",
    codigo_sap: ""
  });
  const [errors, setErrors] = useState({});

  // Validación de campos obligatorios
  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim() || formData.nombre.trim().length < 3) newErrors.nombre = "El nombre del producto debe tener al menos 3 caracteres";
    if (!formData.codigo_ean.trim())  newErrors.codigo_ean = "El código EAN es obligatorio" 
    if (!formData.codigo_sap.trim())  newErrors.codigo_sap = "El código SAP es obligatorio" 
    if (!formData.descripcion.trim() || formData.descripcion.trim().length < 10) newErrors.descripcion = "La descripción debe tener al menos 10 caracteres.";
    if (!formData.peso || parseFloat(formData.peso) <= 0)
      newErrors.peso = "Debe ingresar un peso mayor a 0.";
    if (!formData.unidad_medida)
      newErrors.unidad_medida = "Debe seleccionar una unidad de medida.";
    if (!formData.precio || parseFloat(formData.precio) <= 0)
      newErrors.precio = "Debe ingresar un precio mayor a 0.";
    if (!formData.unidades_por_caja || parseInt(formData.unidades_por_caja) <= 0)
      newErrors.unidades_por_caja = "La cantidad de unidades por caja debe ser mayor a 0"
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejo de cambios
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setError(null);
      const formattedData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        peso_unitario: parseFloat(formData.peso),
        unidad_medida: formData.unidad_medida,
        precio_unitario: parseFloat(formData.precio),
        unidades_por_caja: parseInt(formData.unidades_por_caja),
        codigo_ean: formData.codigo_ean,
        codigo_sap: formData.codigo_sap
      };

      await api("/productos-base", {
        method: "POST",
        body: JSON.stringify(formattedData)
      });

      navigate("/Productos");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.data?.code === "SIMILAR_NAME") {
        const formattedData = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          peso_unitario: parseFloat(formData.peso),
          unidad_medida: formData.unidad_medida,
          precio_unitario: parseFloat(formData.precio),
          unidades_por_caja: parseInt(formData.unidades_por_caja),
          codigo_ean: formData.codigo_ean,
          codigo_sap: formData.codigo_sap,
        };
        setPendingPayload(formattedData);
        setSimilarModal({
          open: true,
          inputName: error.data?.input || formData.nombre,
          matches: error.data?.matches || [],
        });
        return;
      }

      console.error("Error al crear producto:", error);
      setError(error?.message || "No se pudo crear el producto. Verifica los datos e intenta nuevamente.");
    }
  };

  const confirmCreateAnyway = async () => {
    if (!pendingPayload) return;
    try {
      await api("/productos-base", {
        method: "POST",
        body: JSON.stringify({ ...pendingPayload, confirmSimilarName: true }),
      });
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      navigate("/Productos");
    } catch (error) {
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      setError(error?.message || "No se pudo crear el producto. Verifica los datos e intenta nuevamente.");
    }
  };

  // Renderizado
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Productos" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-6">
        Añadir Producto Terminado
      </h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4"
      >
        {/* NOMBRE */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre del Producto *
          </label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Queso Cabra Premium"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.nombre ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>
          )}
        </div>

        {/* DESCRIPCIÓN */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Descripción *
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ej: Queso artesanal elaborado con leche de cabra, textura cremosa y sabor suave."
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.descripcion ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.descripcion && (
            <p className="text-red-500 text-sm mt-1">{errors.descripcion}</p>
          )}
        </div>

        {/* PESO */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Cantidad por Unidad *
          </label>
          <input
            type="number"
            name="peso"
            value={formData.peso}
            onChange={handleChange}
            placeholder="Ej: 0.25"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.peso ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.peso && (
            <p className="text-red-500 text-sm mt-1">{errors.peso}</p>
          )}
        </div>

        {/* UNIDAD DE MEDIDA */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Unidad de Medida *
          </label>
          <select
            name="unidad_medida"
            value={formData.unidad_medida}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${errors.unidad_medida ? "border-red-500" : "border-gray-300"
              }`}
          >
            <option value="">Seleccionar unidad</option>
            <option value="Kilogramos">Kilogramos</option>
            <option value="Litros">Litros</option>
            <option value="Unidades">Unidades</option>
          </select>
          {errors.unidad_medida && (
            <p className="text-red-500 text-sm mt-1">{errors.unidad_medida}</p>
          )}
        </div>

        {/* PRECIO */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Precio Unitario *
          </label>
          <input
            type="number"
            name="precio"
            value={formData.precio}
            onChange={handleChange}
            placeholder="Ej: 4500"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.precio ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.precio && (
            <p className="text-red-500 text-sm mt-1">{errors.precio}</p>
          )}
        </div>

        {/* UNIDADES POR CAJA */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Unidades por Caja *
          </label>
          <input
            type="number"
            name="unidades_por_caja"
            value={formData.unidades_por_caja}
            onChange={handleChange}
            placeholder="Ej: 12"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.unidades_por_caja ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.unidades_por_caja && (
            <p className="text-red-500 text-sm mt-1">{errors.unidades_por_caja}</p>
          )}
        </div>

        {/* CODIGO EAN*/}
        <div>
          <label className="block text-sm font-medium mb-1">
            Código EAN *
          </label>
          <input
            type="number"
            name="codigo_ean"
            value={formData.codigo_ean}
            onChange={handleChange}
            placeholder="Ej: 5901234123457"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.unidades_por_caja ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.codigo_ean && (
            <p className="text-red-500 text-sm mt-1">{errors.codigo_ean}</p>
          )}
        </div>

        {/* CODIGO SAP*/}
        <div>
          <label className="block text-sm font-medium mb-1">
            Código SAP *
          </label>
          <input
            type="number"
            name="codigo_sap"
            value={formData.codigo_sap}
            onChange={handleChange}
            placeholder="Ej: 1234567"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${errors.unidades_por_caja ? "border-red-500" : "border-gray-300"
              }`}
          />
          {errors.codigo_sap && (
            <p className="text-red-500 text-sm mt-1">{errors.codigo_sap}</p>
          )}
        </div>

        {/* BOTÓN */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
          >
            Crear Producto
          </button>
        </div>
      </form>

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="producto"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        onCancel={() => {
          setSimilarModal({ open: false, inputName: "", matches: [] });
          setPendingPayload(null);
        }}
        onConfirm={confirmCreateAnyway}
        confirmText="Crear producto igualmente"
      />
    </div>
  );
}
