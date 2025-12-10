import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useState, useEffect } from "react";

export default function EditAsociacion() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const api = useApi();

  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);

  const [formData, setFormData] = useState({
    id_proveedor: "",
    id_materia_prima: "",
    peso_unitario: "",
    precio_unitario: "",
    moneda: "",
    formato: "",
  });

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [precioInputValue, setPrecioInputValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [provRes, insRes, asocRes] = await Promise.all([
          api(`/proveedores`),
          api(`/materias-primas`),
          api(`/proveedor-materia-prima/${id}`),
        ]);

        const proveedoresData = Array.isArray(provRes?.data) ? provRes.data : provRes;
        const proveedoresActivos = proveedoresData.filter((p) => p.activo === true);
        const insumosData = Array.isArray(insRes?.data) ? insRes.data : insRes;

        setProveedores(proveedoresActivos || []);
        setInsumos(insumosData?.filter((i) => i.activo) || []);

        const asociacion = asocRes?.data || asocRes;

        const precioUnitario = asociacion.precio_unitario?.toString() || "";
        setFormData({
          id_proveedor: asociacion.id_proveedor?.toString() || "",
          id_materia_prima: asociacion.id_materia_prima?.toString() || "",
          peso_unitario:
            (asociacion.cantidad_por_formato ??
              asociacion.peso_unitario ??
              "")?.toString() || "",
          precio_unitario: precioUnitario,
          moneda: asociacion.moneda || "CLP",
          formato: asociacion.formato || "",
        });
        setPrecioInputValue(precioUnitario ? precioUnitario.replace('.', ',') : '');
      } catch (error) {
        console.error("Error al cargar datos:", error);
        setError("No se pudieron cargar los datos.");
      }
    };
    fetchData();
  }, [id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.id_proveedor) newErrors.id_proveedor = "Debe seleccionar un proveedor.";
    if (!formData.id_materia_prima) newErrors.id_materia_prima = "Debe seleccionar un insumo.";
    if (!formData.peso_unitario) newErrors.peso_unitario = "Debe ingresar un peso unitario.";
    if (!formData.precio_unitario) newErrors.precio_unitario = "Debe ingresar un precio unitario.";
    if (!formData.moneda) newErrors.moneda = "Debe seleccionar una moneda.";
    if (!formData.formato) newErrors.formato = "Debe ingresar un formato.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const selectedInsumo = insumos.find(
        (i) => i.id === parseInt(formData.id_materia_prima)
      );

      const precioUnitario = typeof formData.precio_unitario === 'string' 
        ? parseFloat(formData.precio_unitario.replace(',', '.')) 
        : parseFloat(formData.precio_unitario);

      const body = {
        id_proveedor: parseInt(formData.id_proveedor),
        id_materia_prima: parseInt(formData.id_materia_prima),
        peso_unitario: parseFloat(formData.peso_unitario),
        precio_unitario: precioUnitario,
        moneda: formData.moneda,
        formato: formData.formato,
        unidad_medida: selectedInsumo?.unidad_medida || "Unidad",
      };

      await api(`/proveedor-materia-prima/por-materia-prima/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Asociación actualizada correctamente");
      navigate(`/Insumos/${formData.id_materia_prima}`);
    } catch (error) {
      toast.error("Error al actualizar la asociación.");
      setError("Error al actualizar la asociación.");
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      navigate(`/Insumos/${formData.id_materia_prima}`);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    navigate(`/Insumos/${formData.id_materia_prima}`);
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Insumos/${formData.id_materia_prima}`} />
      <h1 className="text-2xl font-bold text-text mb-6">Editar Asociación</h1>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4"
      >
        {/* Proveedor */}
        <div>
          <label className="block text-sm font-medium mb-1">Proveedor *</label>
          <select
            name="id_proveedor"
            value={formData.id_proveedor}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_proveedor ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_empresa}
              </option>
            ))}
          </select>
          {errors.id_proveedor && (
            <p className="text-red-500 text-sm mt-1">{errors.id_proveedor}</p>
          )}
        </div>

        {/* Insumo */}
        <div>
          <label className="block text-sm font-medium mb-1">Insumo *</label>
          <select
            name="id_materia_prima"
            value={formData.id_materia_prima}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_materia_prima ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar insumo</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
          {errors.id_materia_prima && (
            <p className="text-red-500 text-sm mt-1">{errors.id_materia_prima}</p>
          )}
        </div>

        {/* Peso y precio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Peso / Cantidad por formato *
            </label>
            <input
              name="peso_unitario"
              type="number"
              value={formData.peso_unitario}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.peso_unitario ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.peso_unitario && (
              <p className="text-red-500 text-sm mt-1">{errors.peso_unitario}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Precio Unitario *
            </label>
            <input
              name="precio_unitario"
              type="text"
              value={precioInputValue !== '' ? precioInputValue : (formData.precio_unitario ? String(formData.precio_unitario).replace('.', ',') : '')}
              onChange={(e) => {
                let inputValue = e.target.value;
                // Permitir solo números, comas y puntos
                inputValue = inputValue.replace(/[^0-9,.]/g, '');
                // Reemplazar punto por coma para consistencia
                inputValue = inputValue.replace(/\./g, ',');
                // Permitir solo una coma
                const parts = inputValue.split(',');
                if (parts.length > 2) {
                  inputValue = parts[0] + ',' + parts.slice(1).join('');
                }
                
                setPrecioInputValue(inputValue);
                
                // Convertir a número para guardar (reemplazar coma por punto)
                const valorConPunto = inputValue.replace(',', '.');
                const nuevoValor = inputValue === '' || inputValue.endsWith(',') ? formData.precio_unitario : (valorConPunto || '');
                
                setFormData((prev) => ({ ...prev, precio_unitario: nuevoValor }));
                setHasChanges(true);
              }}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.precio_unitario ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.precio_unitario && (
              <p className="text-red-500 text-sm mt-1">{errors.precio_unitario}</p>
            )}
          </div>
        </div>

        {/* Moneda y formato */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Moneda *</label>
            <select
              name="moneda"
              value={formData.moneda}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.moneda ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Seleccionar</option>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UF">UF</option>
            </select>
            {errors.moneda && (
              <p className="text-red-500 text-sm mt-1">{errors.moneda}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Formato *</label>
            <input
              name="formato"
              value={formData.formato}
              onChange={handleChange}
              placeholder="Ej: caja, saco, rollo..."
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.formato ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.formato && (
              <p className="text-red-500 text-sm mt-1">{errors.formato}</p>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={handleCancelClick}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded transition"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded transition"
          >
            Guardar Cambios
          </button>
        </div>
      </form>

      {/* Modal de confirmación */}
      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              Cambios sin guardar
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Tienes cambios sin guardar. Si sales ahora, se perderán todos los
              cambios realizados.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition"
              >
                Volver
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
