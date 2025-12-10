import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useParams, useNavigate } from "react-router-dom";
import {
  ModifyButton,
  DeleteButton,
  BackButton,
} from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

// ────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────
const RECIPE_TYPES = {
  PIP: "Producto Intermedio (PIP)",
  PRODUCTO_TERMINADO: "Producto Terminado",
};

export default function RecetaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [receta, setReceta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [pasos, setPasos] = useState([]);
  const [pautaElaboracion, setPautaElaboracion] = useState(null);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productos, setProductos] = useState([]); // For future use with product-based recipes
  const [showAddSubproduct, setShowAddSubproduct] = useState(false);
  const [selectedMateriaPrima, setSelectedMateriaPrima] = useState("");
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [selectedIngredientMateriaPrima, setSelectedIngredientMateriaPrima] =
    useState("");
  const [ingredientPeso, setIngredientPeso] = useState("");
  const [ingredientUnidad, setIngredientUnidad] = useState("");
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [categoriasMaterias, setCategoriasMaterias] = useState([]);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [showIngredientOptions, setShowIngredientOptions] = useState(false);
  const [subproductQuery, setSubproductQuery] = useState("");
  const [showSubproductOptions, setShowSubproductOptions] = useState(false);

  // ───────────────────────────────
  // Fetch completa de receta + pasos + subproductos + ingredientes + cat. MP
  // ───────────────────────────────
  useEffect(() => {
    const fetchReceta = async () => {
      try {
        setLoading(true);

        const [recetaRes, materiasPrimasRes, productosRes, categoriasRes] =
          await Promise.all([
            api(`/recetas/${id}`),
            api(`/materias-primas`),
            api(`/productos-base`),
            api(`/categorias-materia-prima`),
          ]);

        const recetaData = recetaRes;

        // Handle new API structure with nested pautaElaboracion
        const pasosData =
          recetaData.pautaElaboracion?.pasosPautaElaboracion || [];
        const ingredientesData = recetaData.ingredientesReceta || [];
        // Handle new API structure with nested subproducts
        const subproductosData = recetaData.posiblesSubproductos || [];

        // Infer recipe type based on available fields
        if (recetaData.id_producto_base) {
          recetaData.tipo = RECIPE_TYPES.PRODUCTO_TERMINADO;
        } else if (recetaData.id_materia_prima) {
          recetaData.tipo = RECIPE_TYPES.PIP;
        }

        setReceta(recetaData);
        setPasos(pasosData);
        setIngredientes(ingredientesData);
        setSubproductos(subproductosData);
        setMateriasPrimas(
          Array.isArray(materiasPrimasRes) ? materiasPrimasRes : []
        );
        setProductos(productosRes);
        setCategoriasMaterias(
          Array.isArray(categoriasRes) ? categoriasRes : []
        ); // 👈 set categorías

        if (recetaData.pautaElaboracion) {
          setPautaElaboracion(recetaData.pautaElaboracion);
        }

        setError(null);
      } catch (err) {
        console.error("Error cargando receta:", err);
        setError("No se pudo cargar la receta. Intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };
    fetchReceta();
  }, [id, api]);

  // ───────────────────────────────
  // Eliminar receta
  // ───────────────────────────────
  const handleDelete = async () => {
    try {
      await api(`/recetas/${id}`, { method: "DELETE" });
      toast.success("Receta eliminada correctamente.");
      navigate("/Recetas");
    } catch (err) {
      console.error("Error eliminando receta:", err);
      toast.error("No se pudo eliminar la receta.");
    }
  };

  // ───────────────────────────────
  // Subproduct management
  // ───────────────────────────────
  const handleAddSubproduct = async () => {
    if (!selectedMateriaPrima) {
      toast.error("Selecciona una materia prima.");
      return;
    }

    try {
      await api(`/recetas/${id}/subproductos`, {
        method: "POST",
        body: JSON.stringify({
          id_materia_prima: parseInt(selectedMateriaPrima),
        }),
      });

      // Refresh the recipe data
      const recetaRes = await api(`/recetas/${id}`);
      setSubproductos(recetaRes.posiblesSubproductos || []);
      setSelectedMateriaPrima("");
      setShowAddSubproduct(false);
      toast.success("Subproducto agregado correctamente.");
    } catch (err) {
      console.error("Error agregando subproducto:", err);
      toast.error("No se pudo agregar el subproducto.");
    }
  };

  const handleRemoveSubproduct = async (idMateriaPrima) => {
    try {
      await api(`/recetas/${id}/subproductos/${idMateriaPrima}`, {
        method: "DELETE",
      });

      // Refresh the recipe data
      const recetaRes = await api(`/recetas/${id}`);
      setSubproductos(recetaRes.posiblesSubproductos || []);
      toast.success("Subproducto eliminado correctamente.");
    } catch (err) {
      console.error("Error eliminando subproducto:", err);
      toast.error("No se pudo eliminar el subproducto.");
    }
  };

  // Get available materias primas (excluding already added ones)
  const getAvailableMateriasPrimas = () => {
    const addedIds = subproductos.map((sp) => sp.id);
    return materiasPrimas.filter(
      (mp) => !addedIds.includes(mp.id) && !isEnvase(mp, categoriasMaterias)
    );
  };

  // Get available materias primas for ingredients (excluding already added ones)
  const getAvailableIngredientMateriasPrimas = () => {
    const addedIds = ingredientes.map((ing) => ing.materiaPrima.id);
    return materiasPrimas.filter(
      (mp) => !addedIds.includes(mp.id) && !isEnvase(mp, categoriasMaterias)
    );
  };

  // ───────────────────────────────
  // Ingredient management
  // ───────────────────────────────
  const handleAddIngredient = async () => {
    if (
      !selectedIngredientMateriaPrima ||
      !ingredientPeso ||
      !ingredientUnidad
    ) {
      toast.error("Completa todos los campos del ingrediente.");
      return;
    }

    if (parseFloat(ingredientPeso) <= 0) {
      toast.error("El peso debe ser un número positivo.");
      return;
    }

    try {
      await api(`/recetas/${id}/ingredientes`, {
        method: "POST",
        body: JSON.stringify({
          id_materia_prima: parseInt(selectedIngredientMateriaPrima),
          peso: parseFloat(ingredientPeso),
          unidad_medida: ingredientUnidad,
        }),
      });

      // Refresh the recipe data
      const recetaRes = await api(`/recetas/${id}`);
      setIngredientes(recetaRes.ingredientesReceta || []);
      setSelectedIngredientMateriaPrima("");
      setIngredientPeso("");
      setIngredientUnidad("");
      setShowAddIngredient(false);
      toast.success("Ingrediente agregado correctamente.");
    } catch (err) {
      console.error("Error agregando ingrediente:", err);
      toast.error("No se pudo agregar el ingrediente.");
    }
  };

  const handleUpdateIngredient = async (ingredientId, newPeso, newUnidad) => {
    if (!newPeso || !newUnidad) {
      toast.error("Completa todos los campos.");
      return;
    }

    if (parseFloat(newPeso) <= 0) {
      toast.error("El peso debe ser un número positivo.");
      return;
    }

    try {
      await api(`/recetas/${id}/ingredientes/${ingredientId}`, {
        method: "PUT",
        body: JSON.stringify({
          peso: parseFloat(newPeso),
          unidad_medida: newUnidad,
        }),
      });

      // Refresh the recipe data
      const recetaRes = await api(`/recetas/${id}`);
      setIngredientes(recetaRes.ingredientesReceta || []);
      setEditingIngredient(null);
      toast.success("Ingrediente actualizado correctamente.");
    } catch (err) {
      console.error("Error actualizando ingrediente:", err);
      toast.error("No se pudo actualizar el ingrediente.");
    }
  };

  const handleRemoveIngredient = async (ingredientId) => {
    try {
      await api(`/recetas/${id}/ingredientes/${ingredientId}`, {
        method: "DELETE",
      });

      // Refresh the recipe data
      const recetaRes = await api(`/recetas/${id}`);
      setIngredientes(recetaRes.ingredientesReceta || []);
      toast.success("Ingrediente eliminado correctamente.");
    } catch (err) {
      console.error("Error eliminando ingrediente:", err);
      toast.error("No se pudo eliminar el ingrediente.");
    }
  };

  function groupMPByCategoria(list, categorias) {
    const catNameById = {};
    (categorias || []).forEach((c) => {
      if (c && c.id != null)
        catNameById[c.id] = c.nombre || `Categoría ${c.id}`;
    });

    const grupos = {};

    (list || []).forEach((m) => {
      const cid =
        m.categoria_id ??
        m.id_categoria ??
        m.id_categoria_materia_prima ??
        null;

      const label = catNameById[cid] || "Sin categoría";
      if (!grupos[label]) grupos[label] = [];
      grupos[label].push(m);
    });

    const ordenCat = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    return ordenCat.map((label) => ({
      label,
      items: grupos[label].sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "")
      ),
    }));
  }

  function isEnvase(mp, categorias) {
    const cid =
      mp.categoria_id ??
      mp.id_categoria ??
      mp.id_categoria_materia_prima ??
      null;

    const cat = (categorias || []).find((c) => c && c.id === cid);
    const name = (cat?.nombre || "").toLowerCase();

    return name === "envase" || name === "envases";
  }

  // ───────────────────────────────
  // UI
  // ───────────────────────────────
  if (loading) {
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
      <div className="flex justify-between items-center mb-6">
        <BackButton onClick={() => navigate("/Recetas")} />
        <div className="flex gap-2">
          <ModifyButton onClick={() => navigate(`/Recetas/${id}/edit`)} />
          <DeleteButton
            onConfirmDelete={handleDelete}
            tooltipText="Eliminar Receta"
            entityName="receta"
          />
        </div>
      </div>

      {/* ─────────────── DATOS PRINCIPALES ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
        <h1 className="text-2xl font-bold text-center text-text mb-4">
          {receta.nombre}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <span className="font-semibold">Tipo de Producto Resultante:</span>{" "}
            {receta.tipo || "—"}
          </div>
          <div>
            <span className="font-semibold">Descripción:</span>{" "}
            {receta.descripcion || "—"}
          </div>
          {receta.tipo === RECIPE_TYPES.PIP && (
            <div>
              <span className="font-semibold">Materia Prima a Producir:</span>{" "}
              {receta.materiaPrima?.nombre || receta.id_materia_prima}
            </div>
          )}
          {receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && (
            <div>
              <span className="font-semibold">Producto a Producir:</span>{" "}
              {receta.productoBase?.nombre ||
                (receta.id_producto_base &&
                  productos.find((p) => p.id === receta.id_producto_base)
                    ?.nombre) ||
                receta.id_producto_base}
            </div>
          )}
          <div>
            <span className="font-semibold">Unidad de Medida:</span>{" "}
            {receta.unidad_medida}
          </div>
          <div>
            <span className="font-semibold">Rendimiento Teórico:</span>{" "}
            {receta.peso} {receta.unidad_medida}
          </div>
          <div>
            <span className="font-semibold">Costo Referencial Producción:</span>{" "}
            ${receta.costo_referencial_produccion}
          </div>
          <div>
            <span className="font-semibold">Fecha de Creación:</span>{" "}
            {new Date(receta.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="font-semibold">Última Actualización:</span>{" "}
            {new Date(receta.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* ─────────────── INGREDIENTES ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-8">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Ingredientes</h2>
          <button
            onClick={() => setShowAddIngredient(!showAddIngredient)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm"
          >
            {showAddIngredient ? "Cancelar" : "Agregar Ingrediente"}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Los ingredientes son sólo referenciales, y no tienen impacto en la
          producción final.
        </p>

        {/* Add Ingredient Form */}
        {showAddIngredient && (
          <div className="bg-green-50 p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-800">
              Agregar Nuevo Ingrediente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materia Prima
                </label>

                {/* Combobox con búsqueda */}
                <div className="relative">
                  <input
                    type="text"
                    value={ingredientQuery}
                    onChange={(e) => {
                      setIngredientQuery(e.target.value);
                      setShowIngredientOptions(true);
                    }}
                    onFocus={() => setShowIngredientOptions(true)}
                    onBlur={() => {
                      // permitir click en opción antes de cerrar
                      setTimeout(() => setShowIngredientOptions(false), 120);
                    }}
                    placeholder="Ej: Leche de Vaca"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />

                  {showIngredientOptions && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow">
                      {(() => {
                        // 1) Partimos de las disponibles (ya excluye duplicadas y 'Envase/Envases' si aplicaste el helper)
                        const base = getAvailableIngredientMateriasPrimas();

                        // 2) Filtro por texto (case-insensitive)
                        const q = (ingredientQuery || "").toLowerCase().trim();
                        const filtradas = q
                          ? base.filter((mp) =>
                              (mp.nombre || "").toLowerCase().includes(q)
                            )
                          : base;

                        // 3) Agrupar por categoría para mostrar headers
                        const grupos = groupMPByCategoria(
                          filtradas,
                          categoriasMaterias
                        );

                        if (
                          !grupos.length ||
                          grupos.every((g) => g.items.length === 0)
                        ) {
                          return (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Sin resultados
                            </div>
                          );
                        }

                        return grupos.map((grupo) => (
                          <div key={grupo.label}>
                            <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b">
                              {grupo.label}
                            </div>
                            {grupo.items.map((mp) => (
                              <button
                                key={mp.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()} // evita perder foco
                                onClick={() => {
                                  setSelectedIngredientMateriaPrima(
                                    String(mp.id)
                                  );
                                  setIngredientUnidad(mp.unidad_medida || "");
                                  setIngredientQuery(mp.nombre || "");
                                  setShowIngredientOptions(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                              >
                                {mp.nombre}
                              </button>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* Campo oculto para mantener el id seleccionado si lo necesitas en validaciones */}
                <input
                  type="hidden"
                  value={selectedIngredientMateriaPrima}
                  readOnly
                />
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
                  placeholder="Se selecciona automáticamente"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  La unidad se hereda automáticamente de la materia prima
                  seleccionada.
                </p>
              </div>

              {(() => {
                const selectedMP = materiasPrimas.find(
                  (mp) => String(mp.id) === selectedIngredientMateriaPrima
                );
                if (selectedMP && selectedMP.costo_promedio != null) {
                  const peso = parseFloat(ingredientPeso) || 0;
                  const costoPromedio = selectedMP.costo_promedio;
                  const costoEstimado = costoPromedio * peso;
                  return (
                    <div className="col-span-full mt-2 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm">
                        <span className="font-semibold">
                          Costo promedio por unidad de medida:
                        </span>{" "}
                        $
                        {costoPromedio.toLocaleString("es-CL", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-sm">
                        <span className="font-semibold">Costo estimado:</span> $
                        {costoEstimado.toLocaleString("es-CL", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleAddIngredient();
                  // limpiar buscador tras agregar
                  setIngredientQuery("");
                  setShowIngredientOptions(false);
                }}
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
                  setIngredientQuery(""); // limpiar query al cancelar
                  setShowIngredientOptions(false); // cerrar dropdown
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancelar
              </button>
            </div>

            {getAvailableIngredientMateriasPrimas().length === 0 && (
              <p className="text-sm text-gray-500">
                No hay materias primas disponibles para agregar como
                ingredientes.
              </p>
            )}
          </div>
        )}

        {/* Ingredients List */}
        {ingredientes.length > 0 ? (
          <div className="space-y-3">
            {ingredientes.map((ingrediente) => {
              const materiaPrima = materiasPrimas.find(
                (mp) => mp.id === ingrediente.materiaPrima.id
              );
              const costoPromedio = materiaPrima?.costo_promedio;
              const costoEstimado =
                costoPromedio != null
                  ? costoPromedio * parseFloat(ingrediente.peso)
                  : null;

              return (
                <div
                  key={ingrediente.id}
                  className="flex justify-between items-start p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">
                      {ingrediente.materiaPrima.nombre}
                    </h4>
                    {editingIngredient === ingrediente.id ? (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={ingrediente.peso}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                          onBlur={(e) => {
                            const newPeso = e.target.value;
                            if (newPeso !== ingrediente.peso.toString()) {
                              handleUpdateIngredient(
                                ingrediente.id,
                                newPeso,
                                ingrediente.unidad_medida
                              );
                            }
                          }}
                        />
                        <input
                          id={`unidad-${ingrediente.id}`}
                          type="text"
                          value={ingrediente.unidad_medida}
                          readOnly
                          className="w-32 border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 text-gray-600"
                          title="La unidad no se puede editar (heredada de la materia prima)"
                        />
                      </div>
                    ) : (
                      <div className="mt-1">
                        <p className="text-sm text-gray-600">
                          {ingrediente.peso} {ingrediente.unidad_medida}
                        </p>
                        {costoPromedio != null && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1">
                            <p>
                              <span className="font-semibold">
                                Costo promedio por unidad:
                              </span>{" "}
                              $
                              {costoPromedio.toLocaleString("es-CL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p>
                              <span className="font-semibold">
                                Costo estimado:
                              </span>{" "}
                              $
                              {costoEstimado.toLocaleString("es-CL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEditingIngredient(
                          editingIngredient === ingrediente.id
                            ? null
                            : ingrediente.id
                        )
                      }
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300 transition-colors"
                    >
                      {editingIngredient === ingrediente.id
                        ? "Guardar"
                        : "Editar"}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Estás seguro de que quieres eliminar este ingrediente?"
                          )
                        ) {
                          handleRemoveIngredient(ingrediente.id);
                        }
                      }}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300 transition-colors"
                      title="Eliminar ingrediente"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-500 text-sm">
              No hay ingredientes definidos para esta receta.
            </p>
          </div>
        )}
      </div>

      {/* ─────────────── SUBPRODUCTOS POSIBLES ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-8">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Subproductos Posibles
          </h2>
          <button
            onClick={() => setShowAddSubproduct(!showAddSubproduct)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            {showAddSubproduct ? "Cancelar" : "Agregar Subproducto"}
          </button>
        </div>

        {/* Add Subproduct Form */}
        {showAddSubproduct && (
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-800">
              Agregar Nuevo Subproducto
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materia Prima
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={subproductQuery}
                    onChange={(e) => {
                      setSubproductQuery(e.target.value);
                      setShowSubproductOptions(true);
                    }}
                    onFocus={() => setShowSubproductOptions(true)}
                    onBlur={() => {
                      // permitir click en la opción antes de cerrar
                      setTimeout(() => setShowSubproductOptions(false), 120);
                    }}
                    placeholder="Ej: Leche de Vaca"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />

                  {showSubproductOptions && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow">
                      {(() => {
                        const base = getAvailableMateriasPrimas();

                        const q = (subproductQuery || "").toLowerCase().trim();
                        const filtradas = q
                          ? base.filter((mp) =>
                              (mp.nombre || "").toLowerCase().includes(q)
                            )
                          : base;

                        const grupos = groupMPByCategoria(
                          filtradas,
                          categoriasMaterias
                        );

                        if (
                          !grupos.length ||
                          grupos.every((g) => g.items.length === 0)
                        ) {
                          return (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Sin resultados
                            </div>
                          );
                        }

                        return grupos.map((grupo) => (
                          <div key={grupo.label}>
                            <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-500 bg-gray-50 border-b">
                              {grupo.label}
                            </div>
                            {grupo.items.map((mp) => (
                              <button
                                key={mp.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedMateriaPrima(String(mp.id));
                                  setSubproductQuery(
                                    `${mp.nombre} (${
                                      mp.unidad_medida || ""
                                    })`.trim()
                                  );
                                  setShowSubproductOptions(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                              >
                                {mp.nombre}{" "}
                                {mp.unidad_medida
                                  ? `(${mp.unidad_medida})`
                                  : ""}
                              </button>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <input type="hidden" value={selectedMateriaPrima} readOnly />
              </div>

              <button
                onClick={async () => {
                  await handleAddSubproduct();
                  setSubproductQuery("");
                  setShowSubproductOptions(false);
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              >
                Agregar
              </button>
            </div>

            {getAvailableMateriasPrimas().length === 0 && (
              <p className="text-sm text-gray-500">
                No hay materias primas disponibles para agregar como
                subproductos.
              </p>
            )}
          </div>
        )}

        {/* Subproducts List */}
        {subproductos.length > 0 ? (
          <div className="space-y-3">
            {subproductos.map((subproducto) => (
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
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Estás seguro de que quieres eliminar este subproducto?"
                      )
                    ) {
                      handleRemoveSubproduct(subproducto.id);
                    }
                  }}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300 transition-colors"
                  title="Eliminar subproducto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-500 text-sm">
              No hay subproductos definidos para esta receta.
            </p>
          </div>
        )}
      </div>

      {/* ─────────────── PAUTA DE ELABORACIÓN Y PASOS ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        {pautaElaboracion ? (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">
                Pauta de Elaboración: {pautaElaboracion.name}
              </h2>
              <button
                onClick={() =>
                  navigate(`/PautasElaboracion/${pautaElaboracion.id}`)
                }
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                Ver detalles completos
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 mb-6">
              <div>
                <span className="font-semibold">Descripción:</span>
                <p className="mt-1 text-gray-600">
                  {pautaElaboracion.description}
                </p>
              </div>
            </div>

            <h3 className="text-md font-semibold text-gray-800 mb-4">
              Pasos de Elaboración
            </h3>
            {pasos.length > 0 ? (
              <div className="space-y-4">
                {pasos
                  .sort((a, b) => a.orden - b.orden)
                  .map((paso) => (
                    <div
                      key={paso.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-700">
                          Paso {paso.orden}
                        </h4>
                        <div className="flex gap-2">
                          {paso.requires_ph && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              pH
                            </span>
                          )}
                          {paso.requires_temperature && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                              Temperatura
                            </span>
                          )}
                          {paso.requires_obtained_quantity && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              Cantidad
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600">{paso.descripcion}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-500 text-sm">
                  No se encontraron pasos en la pauta de elaboración.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800">
              Pasos de Elaboración
            </h2>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Sin pauta asignada:</strong> Esta receta no tiene una
                pauta de elaboración asociada. Crea una pauta y asóciala
                haciendo click en editar.
              </p>
              <button
                onClick={() => navigate("/PautasElaboracion")}
                className="mt-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm"
              >
                Crear Pauta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
