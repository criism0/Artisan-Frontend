import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

// ────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────
const RECIPE_TYPES = {
  PIP: "PIP",
  PRODUCTO_TERMINADO: "Producto terminado"
};

export default function AddReceta() {
  const navigate = useNavigate();
  const api = useApi();

  // ────────────────────────────────────────────────
  // MAIN STATES
  // ────────────────────────────────────────────────
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pautasElaboracion, setPautasElaboracion] = useState([]);

  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "",
    rendimiento: "",
    id_materia_prima: "",
    id_producto_base: "",
    unidad_medida: "",
    costo_referencial_produccion: "",
    id_pauta_elaboracion: "",
  });

  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [errors, setErrors] = useState({});
  
  // Ingredientes form state
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [selectedIngredientMateriaPrima, setSelectedIngredientMateriaPrima] = useState("");
  const [ingredientPeso, setIngredientPeso] = useState("");
  const [ingredientUnidad, setIngredientUnidad] = useState("");
  
  // Subproductos form state
  const [showAddSubproduct, setShowAddSubproduct] = useState(false);
  const [selectedMateriaPrima, setSelectedMateriaPrima] = useState("");

  // ────────────────────────────────────────────────
  // FETCHES
  // ────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [materiasRes, productosRes, pautasRes] = await Promise.all([
          api("/materias-primas"),
          api("/productos-base"),
          api("/pautas-elaboracion")
        ]);
        
        setMateriasPrimas(materiasRes);
        setProductos(productosRes);
        setPautasElaboracion(
          pautasRes.filter(p => p.is_active).map((p) => ({ value: p.id, label: p.name }))
        );
      } catch (err) {
        console.error("Error cargando datos:", err);
        toast.error("Error cargando datos iniciales.");
      }
    };
    fetchData();
  }, [api]);

  // ────────────────────────────────────────────────
  // VALIDATION
  // ────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "Este campo es obligatorio.";
    if (!formData.tipo.trim()) newErrors.tipo = "Este campo es obligatorio.";
    
    // Conditional validation
    if (formData.tipo === RECIPE_TYPES.PIP && !formData.id_materia_prima) {
      newErrors.id_materia_prima = "Para recetas PIP debe seleccionar una materia prima.";
    }
    if (formData.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && !formData.id_producto_base) {
      newErrors.id_producto_base = "Para recetas de producto terminado debe seleccionar un Producto Comercial.";
    }
    
    if (!formData.unidad_medida) newErrors.unidad_medida = "Debe seleccionar una unidad.";
    if (!formData.costo_referencial_produccion) newErrors.costo_referencial_produccion = "Debe ingresar un costo.";
    if (!formData.rendimiento) newErrors.rendimiento = "Debe indicar el rendimiento.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ────────────────────────────────────────────────
  // GENERAL HANDLERS
  // ────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Al cambiar el producto a producir, la unidad se deriva y no debe ser editable.
    if (name === "id_materia_prima") {
      const mp = materiasPrimas.find((m) => String(m.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        unidad_medida: mp?.unidad_medida || "",
      }));
      return;
    }

    if (name === "id_producto_base") {
      const producto = productos.find((p) => String(p.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        unidad_medida: producto?.unidad_medida || "",
      }));
      return;
    }

    if (name === "tipo") {
      // Reset de campos condicionales al cambiar el tipo
      setFormData((prev) => ({
        ...prev,
        tipo: value,
        id_materia_prima: "",
        id_producto_base: "",
        unidad_medida: "",
      }));
      return;
    }

    // No permitir set manual de unidad_medida
    if (name === "unidad_medida") {
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddIngrediente = () => {
    if (!selectedIngredientMateriaPrima || !ingredientPeso || !ingredientUnidad) {
      toast.error("Completa todos los campos del ingrediente.");
      return;
    }

    if (parseFloat(ingredientPeso) <= 0) {
      toast.error("El peso debe ser un número positivo.");
      return;
    }

    const selectedMateriaPrima = materiasPrimas.find(mp => mp.id === parseInt(selectedIngredientMateriaPrima));
    
    setIngredientes([...ingredientes, {
      id_materia_prima: parseInt(selectedIngredientMateriaPrima),
      materiaPrima: { nombre: selectedMateriaPrima?.nombre || "" },
      peso: parseFloat(ingredientPeso),
      unidad_medida: ingredientUnidad
    }]);

    // Reset form
    setSelectedIngredientMateriaPrima("");
    setIngredientPeso("");
    setIngredientUnidad("");
    setShowAddIngredient(false);
  };

  const handleRemoveIngrediente = (index) => {
    const updated = ingredientes.filter((_, i) => i !== index);
    setIngredientes(updated);
  };

  const handleAddSubproducto = () => {
    if (!selectedMateriaPrima) {
      toast.error("Selecciona una materia prima.");
      return;
    }

    const selectedMateriaPrimaObj = materiasPrimas.find(mp => mp.id === parseInt(selectedMateriaPrima));
    
    // Check if already added
    const alreadyAdded = subproductos.some(sp => sp.id === parseInt(selectedMateriaPrima));
    if (alreadyAdded) {
      toast.error("Esta materia prima ya está agregada como subproducto.");
      return;
    }
    
    setSubproductos([...subproductos, {
      id: parseInt(selectedMateriaPrima),
      nombre: selectedMateriaPrimaObj?.nombre || "",
      unidad_medida: selectedMateriaPrimaObj?.unidad_medida || ""
    }]);

    // Reset form
    setSelectedMateriaPrima("");
    setShowAddSubproduct(false);
  };

  const handleRemoveSubproducto = (index) => {
    const updated = subproductos.filter((_, i) => i !== index);
    setSubproductos(updated);
  };

  // Get available materias primas (excluding already added ones)
  const getAvailableMateriasPrimas = () => {
    const addedIds = subproductos.map((sp) => sp.id);
    return materiasPrimas.filter((mp) => !addedIds.includes(mp.id));
  };


  // ────────────────────────────────────────────────
  // FINAL SUBMIT
  // ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      // Create the recipe
      const recetaBody = {
        nombre: formData.nombre,
        descripcion: `Receta para ${formData.tipo}`,
        peso: parseFloat(formData.rendimiento),
        unidad_medida: formData.unidad_medida,
        costo_referencial_produccion: parseFloat(formData.costo_referencial_produccion),
        id_pauta_elaboracion: formData.id_pauta_elaboracion ? parseInt(formData.id_pauta_elaboracion) : null,
      };

      // Add the correct field according to recipe type
      if (formData.tipo === RECIPE_TYPES.PIP && formData.id_materia_prima) {
        recetaBody.id_materia_prima = parseInt(formData.id_materia_prima);
      }
      if (formData.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && formData.id_producto_base) {
        recetaBody.id_producto_base = parseInt(formData.id_producto_base);
      }

      const recetaRes = await api(`/recetas`,
        { method: "POST", body: JSON.stringify(recetaBody) }
      );

      const idReceta = recetaRes.id;
      console.log("Receta creada:", idReceta);

      // Add ingredientes if any were specified
      if (ingredientes.length > 0) {
        try {
          for (const ingrediente of ingredientes) {
            await api(`/recetas/${idReceta}/ingredientes`, {
              method: "POST",
              body: JSON.stringify({
                id_materia_prima: ingrediente.id_materia_prima,
                peso: ingrediente.peso,
                unidad_medida: ingrediente.unidad_medida,
              }),
            });
          }
          console.log("Ingredientes agregados:", ingredientes.length);
        } catch (err) {
          console.error("Error agregando ingredientes:", err);
          toast.error("Receta creada pero hubo problemas agregando algunos ingredientes.");
        }
      }

      // Add subproductos if any were specified
      if (subproductos.length > 0) {
        try {
          for (const subproducto of subproductos) {
            await api(`/recetas/${idReceta}/subproductos`, {
              method: "POST",
              body: JSON.stringify({
                id_materia_prima: subproducto.id,
              }),
            });
          }
          console.log("Subproductos agregados:", subproductos.length);
        } catch (err) {
          console.error("Error agregando subproductos:", err);
          toast.error("Receta creada pero hubo problemas agregando algunos subproductos.");
        }
      }

      // No need to create steps manually - they come from the selected PautaElaboracion
      if (formData.id_pauta_elaboracion) {
        toast.success("Receta creada correctamente con pauta de elaboración asociada.");
      } else {
        toast.success("Receta creada correctamente (sin pauta de elaboración).");
      }
      
      navigate(`/Recetas/${idReceta}`);
    } catch (err) {
      console.error("Error al crear receta:", err);
      toast.error(err.message|| "Error al crear la receta. Verifica los campos e intenta nuevamente.");
    }
  };

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Recetas" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Añadir Receta</h1>

      {/* ─────────────── SECCIÓN 1: CREACIÓN DE RECETA ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Datos de la Receta</h2>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre de la Receta: <span className="text-red-500">*</span>
          </label>
          <input
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Queso Cabra Artesanal"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.nombre ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Tipo de Receta: <span className="text-red-500">*</span>
          </label>
          <select
            name="tipo"
            value={formData.tipo}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.tipo ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar tipo</option>
            <option value={RECIPE_TYPES.PIP}>Producto Intermedio (PIP)</option>
            <option value={RECIPE_TYPES.PRODUCTO_TERMINADO}>Producto Terminado</option>
          </select>
          {errors.tipo && <p className="text-red-500 text-sm mt-1">{errors.tipo}</p>}
        </div>

        {/* Campo condicional según el tipo de receta */}
        {formData.tipo === RECIPE_TYPES.PIP && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Materia prima a producir: <span className="text-red-500">*</span>
            </label>
            <select
              name="id_materia_prima"
              value={formData.id_materia_prima}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.id_materia_prima ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Seleccionar materia prima</option>
              {materiasPrimas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {errors.id_materia_prima && (
              <p className="text-red-500 text-sm mt-1">{errors.id_materia_prima}</p>
            )}
          </div>
        )}

        {formData.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Producto a producir: <span className="text-red-500">*</span>
            </label>
            <select
              name="id_producto_base"
              value={formData.id_producto_base}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.id_producto_base ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Seleccionar producto a producir</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {errors.id_producto_base && (
              <p className="text-red-500 text-sm mt-1">{errors.id_producto_base}</p>
            )}
          </div>
        )}

        {/* Unidad (derivada del producto a producir) */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Unidad de Medida: <span className="text-red-500">*</span>
          </label>
          <input
            name="unidad_medida"
            value={formData.unidad_medida}
            readOnly
            placeholder="Se completa automáticamente"
            className={`w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700 placeholder-gray-400 ${
              errors.unidad_medida ? "border-red-500" : "border-gray-300"
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">
            La unidad se obtiene desde el producto a producir.
          </p>
          {errors.unidad_medida && (
            <p className="text-red-500 text-sm mt-1">{errors.unidad_medida}</p>
          )}
        </div>

        {/* Rendimiento */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Rendimiento Teórico en {formData.unidad_medida}: <span className="text-red-500">*</span>
          </label>
          <input
            name="rendimiento"
            value={formData.rendimiento}
            onChange={handleChange}
            placeholder="Ej: 100"
            type="number"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.rendimiento ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.rendimiento && (
            <p className="text-red-500 text-sm mt-1">{errors.rendimiento}</p>
          )}
        </div>

        {/* Costo */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Costo Directo Produccion Referencial: <span className="text-red-500">*</span>
          </label>
          <input
            name="costo_referencial_produccion"
            value={formData.costo_referencial_produccion}
            onChange={handleChange}
            placeholder="Ej: 5000"
            type="number"
            className={`w-full border rounded-lg px-3 py-2 placeholder-gray-400 ${
              errors.costo_referencial_produccion ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.costo_referencial_produccion && (
            <p className="text-red-500 text-sm mt-1">
              {errors.costo_referencial_produccion}
            </p>
          )}
        </div>

        {/* Pauta de Elaboración */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Pauta de Elaboración (Opcional):
          </label>
          <select
            name="id_pauta_elaboracion"
            value={formData.id_pauta_elaboracion}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="">Seleccionar pauta de elaboración</option>
            {pautasElaboracion.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Selecciona una pauta de elaboración para definir los pasos del proceso de producción.
          </p>
        </div>
      </div>

      {/* ─────────────── SECCIÓN 2: INGREDIENTES Y SUBPRODUCTOS ─────────────── */}
      <div className="bg-white mt-8 p-6 rounded-lg shadow space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Ingredientes</h2>
        
        {/* Add Ingredient Form */}
        {!showAddIngredient ? (
          <button
            onClick={() => setShowAddIngredient(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Agregar Nuevo Ingrediente
          </button>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-md font-medium text-gray-800 mb-4">
              Agregar Nuevo Ingrediente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materia Prima
                </label>
                <select
                  value={selectedIngredientMateriaPrima}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setSelectedIngredientMateriaPrima(selectedId);
                    // Auto-set unit from selected materia prima
                    if (selectedId) {
                      const selectedMateriaPrima = materiasPrimas.find(mp => mp.id === parseInt(selectedId));
                      if (selectedMateriaPrima) {
                        setIngredientUnidad(selectedMateriaPrima.unidad_medida);
                      }
                    } else {
                      setIngredientUnidad("");
                    }
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Selecciona una materia prima</option>
                  {materiasPrimas.map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Peso/Cantidad
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ingredientPeso}
                  onChange={(e) => setIngredientPeso(e.target.value)}
                  placeholder="Ej: 5.5"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidad
                </label>
                <input
                  type="text"
                  value={ingredientUnidad}
                  readOnly
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-600"
                  title="La unidad se establece automáticamente según la materia prima seleccionada"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddIngrediente}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Agregar
              </button>
              <button
                onClick={() => {
                  setShowAddIngredient(false);
                  setSelectedIngredientMateriaPrima("");
                  setIngredientPeso("");
                  setIngredientUnidad("");
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Ingredients List */}
        {ingredientes.length > 0 ? (
          <div className="space-y-3">
            {ingredientes.map((ingrediente, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">
                    {ingrediente.materiaPrima.nombre}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {ingrediente.peso} {ingrediente.unidad_medida}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveIngrediente(index)}
                  className="text-red-500 hover:text-red-700 px-2 py-1"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-500 text-sm">
              No hay ingredientes agregados aún.
            </p>
          </div>
        )}

        <h2 className="text-lg font-semibold text-gray-800 mt-6">
          Subproductos Posibles
        </h2>
        
        {/* Add Subproduct Form */}
        {!showAddSubproduct ? (
          <button
            onClick={() => setShowAddSubproduct(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Agregar Subproducto
          </button>
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-800">
              Agregar Nuevo Subproducto
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materia Prima
                </label>
                <select
                  value={selectedMateriaPrima}
                  onChange={(e) => setSelectedMateriaPrima(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Selecciona una materia prima</option>
                  {getAvailableMateriasPrimas().map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.nombre} ({mp.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddSubproducto}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Agregar
              </button>
              <button
                onClick={() => {
                  setShowAddSubproduct(false);
                  setSelectedMateriaPrima("");
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancelar
              </button>
            </div>
            {getAvailableMateriasPrimas().length === 0 && (
              <p className="text-sm text-gray-500">
                No hay materias primas disponibles para agregar como subproductos.
              </p>
            )}
          </div>
        )}

        {/* Subproducts List */}
        {subproductos.length > 0 ? (
          <div className="space-y-3 mt-4">
            {subproductos.map((subproducto, index) => (
              <div
                key={subproducto.id}
                className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">
                    {subproducto.nombre}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Unidad: {subproducto.unidad_medida}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveSubproducto(index)}
                  className="text-red-500 hover:text-red-700 px-2 py-1"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg mt-4">
            <p className="text-gray-500 text-sm">
              No hay subproductos definidos para esta receta.
            </p>
          </div>
        )}
      </div>

      {/* ─────────────── SECCIÓN 3: INFORMACIÓN DE PAUTA ─────────────── */}
      {formData.id_pauta_elaboracion && (
        <div className="bg-white mt-8 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Pauta de Elaboración Seleccionada</h2>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Los pasos de elaboración se obtendrán automáticamente de la pauta seleccionada.
              No es necesario definir pasos manualmente.
            </p>
          </div>
        </div>
      )}

      {/* BOTÓN FINAL */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Crear Receta
        </button>
      </div>
    </div>
  );
}
