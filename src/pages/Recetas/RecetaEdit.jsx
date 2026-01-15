import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { AlertTriangle } from "lucide-react";

// ────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────
const RECIPE_TYPES = {
  PIP: "PIP",
  PRODUCTO_TERMINADO: "Producto terminado"
};


export default function RecetaEdit() {
  const api = useApi();
  const { id } = useParams();
  const navigate = useNavigate();

  const [receta, setReceta] = useState(null);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pautasElaboracion, setPautasElaboracion] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ────────────────────────────────────────────────
  // FETCH DATOS
  // ────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [materiasRes, productosRes, pautasRes, recetaRes] = await Promise.all([
          api(`/materias-primas`),
          api(`/productos-base`),
          api(`/pautas-elaboracion`),
          api(`/recetas/${id}`),
        ]);

        setMateriasPrimas(materiasRes);
        setProductos(productosRes);
        // Remove duplicates and map to dropdown format
        const uniquePautas = pautasRes.filter((p, index, self) => 
          index === self.findIndex(pa => pa.id === p.id)
        );
        setPautasElaboracion(
          uniquePautas.map((p) => ({ value: p.id, label: p.name }))
        );

        // Handle new API structure with recipe-centric ingredients
        const recetaData = recetaRes;
        
        // Infer recipe type based on available fields
        if (recetaData.id_producto_base) {
          recetaData.tipo = RECIPE_TYPES.PRODUCTO_TERMINADO;
        } else if (recetaData.id_materia_prima) {
          recetaData.tipo = RECIPE_TYPES.PIP;
        }
        
        setReceta(recetaData);
      } catch (err) {
        console.error("Error cargando receta:", err);
        setError("No se pudo cargar la receta. Intenta nuevamente.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, api]);

  // ────────────────────────────────────────────────
  // HANDLERS DE CAMBIOS
  // ────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Unidad de medida no es editable: siempre se deriva.
    if (name === 'unidad_medida') return;

    // Derivar unidad al seleccionar materia prima
    if (name === 'id_materia_prima') {
      const mp = materiasPrimas.find((m) => String(m.id) === String(value));
      setReceta((prev) => ({
        ...prev,
        id_materia_prima: value,
        unidad_medida: mp?.unidad_medida || '',
      }));
      return;
    }

    // Derivar unidad al seleccionar Producto Comercial
    if (name === 'id_producto_base') {
      const producto = productos.find((p) => String(p.id) === String(value));
      setReceta((prev) => ({
        ...prev,
        id_producto_base: value,
        unidad_medida: producto?.unidad_medida || '',
      }));
      return;
    }

    setReceta((prev) => {
      const newData = { ...prev, [name]: value };

      // Si cambia el tipo, limpiar el campo que no corresponde y resetear unidad
      if (name === 'tipo') {
        if (value === RECIPE_TYPES.PIP) {
          newData.id_producto_base = '';
        } else if (value === RECIPE_TYPES.PRODUCTO_TERMINADO) {
          newData.id_materia_prima = '';
        }
        newData.unidad_medida = '';
      }

      return newData;
    });
  };

  // ────────────────────────────────────────────────
  // GUARDAR CAMBIOS
  // ────────────────────────────────────────────────
  const handleSave = async () => {
    // Validate required fields based on recipe type
    if (receta.tipo === RECIPE_TYPES.PIP && !receta.id_materia_prima) {
      toast.error("Debe seleccionar un insumo para recetas PIP.");
      return;
    }
    if (receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && !receta.id_producto_base) {
      toast.error("Debe seleccionar un Producto Comercial para recetas de producto terminado.");
      return;
    }

    if (!receta.nombre?.trim()) {
      toast.error("El nombre de la receta es obligatorio.");
      return;
    }

    if (!receta.peso || parseFloat(receta.peso) <= 0) {
      toast.error("El peso debe ser un número positivo.");
      return;
    }

    if (!receta.costo_referencial_produccion || parseFloat(receta.costo_referencial_produccion) <= 0) {
      toast.error("El costo referencial debe ser un número positivo.");
      return;
    }

    try {
      // Actualiza los datos principales
      const body = {
        nombre: receta.nombre,
        descripcion: receta.descripcion || `Receta para ${receta.tipo}`,
        peso: parseFloat(receta.peso),  
        unidad_medida: receta.unidad_medida,
        costo_referencial_produccion: parseFloat(receta.costo_referencial_produccion),
        id_pauta_elaboracion: receta.id_pauta_elaboracion ? parseInt(receta.id_pauta_elaboracion) : null,
      };

      // Add the correct field according to recipe type
      if (receta.tipo === RECIPE_TYPES.PIP && receta.id_materia_prima) {
        body.id_materia_prima = parseInt(receta.id_materia_prima);
      }
      if (receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && receta.id_producto_base) {
        body.id_producto_base = parseInt(receta.id_producto_base);
      }

      await api(`/recetas/${id}`, {method: 'PUT', body: JSON.stringify(body)});

      toast.success("Receta actualizada correctamente.");
      navigate(`/Recetas/${id}`);
    } catch (err) {
      console.error("Error al guardar cambios:", err);
      toast.error(err.message || "Error al guardar la receta. Verifica los datos.");
    }
  }

  // ────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-primary">Cargando receta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!receta) return null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Recetas/${id}`} />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Editar Receta</h1>

      {/* SECCIÓN 1: DATOS DE LA RECETA */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Datos de la Receta</h2>
          {receta.tipo === RECIPE_TYPES.PIP && !receta.id_materia_prima && (
            <div className="flex items-center text-orange-600 text-sm">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Insumo a producir requerido
            </div>
          )}
          {receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && !receta.id_producto_base && (
            <div className="flex items-center text-orange-600 text-sm">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Producto a producir requerido
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre:</label>
            <input
              name="nombre"
              value={receta.nombre || ""}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 placeholder-gray-400"
              placeholder="Ej: Queso Cabra Artesanal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo:</label>
            <select
              name="tipo"
              value={receta.tipo || ""}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Seleccionar tipo</option>
              <option value={RECIPE_TYPES.PIP}>PIP</option>
              <option value={RECIPE_TYPES.PRODUCTO_TERMINADO}>Producto terminado/comercializable</option>
            </select>
          </div>

          {receta.tipo === RECIPE_TYPES.PIP && (
            <div>
              <label className="block text-sm font-medium mb-1">Insumo a producir:</label>
              <select
                name="id_materia_prima"
                value={receta.id_materia_prima || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Seleccionar insumo a producir</option>
                {materiasPrimas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && (
            <div>
              <label className="block text-sm font-medium mb-1">Producto a producir:</label>
              <select
                name="id_producto_base"
                value={receta.id_producto_base || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Seleccionar producto a producir</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Unidad de Medida:</label>
            <input
              name="unidad_medida"
              value={receta.unidad_medida || ""}
              readOnly
              placeholder="Se completa automáticamente según el producto a producir"
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700 placeholder-gray-400"
            />
            <p className="text-xs text-gray-500 mt-1">
              La unidad de medida se obtiene desde el Producto Comercial o insumo seleccionado.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rendimiento (Peso):</label>
            <input
              type="number"
              name="peso"
              value={receta.peso || ""}
              onChange={handleChange}
              placeholder="Ej: 100"
              className="w-full border border-gray-300 rounded px-3 py-2 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Costo Directo Produccion Referencial:</label>
            <input
              type="number"
              name="costo_referencial_produccion"
              value={receta.costo_referencial_produccion || ""}
              onChange={handleChange}
              placeholder="Ej: 5000"
              className="w-full border border-gray-300 rounded px-3 py-2 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pauta de Elaboración:</label>
            <select
              name="id_pauta_elaboracion"
              value={receta.id_pauta_elaboracion || ""}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Sin pauta asignada</option>
              {pautasElaboracion.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: INFORMACIÓN ADICIONAL */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800">Gestión de Ingredientes y Subproductos</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Los ingredientes y subproductos se gestionan desde la vista de detalle de la receta.
          </p>
        </div>
      </div>

      {/* BOTÓN GUARDAR */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleSave}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
