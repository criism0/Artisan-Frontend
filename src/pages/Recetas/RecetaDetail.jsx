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
  const [pautasElaboracion, setPautasElaboracion] = useState([]);
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

  // Editor de MPs secundarias (equivalentes) por ingrediente
  const [editingEquivalentesIngredient, setEditingEquivalentesIngredient] =
    useState(null);
  const [equivalentesSelectedIds, setEquivalentesSelectedIds] = useState([]);
  const [equivalentesQuery, setEquivalentesQuery] = useState("");
  const [showEquivalentesOptions, setShowEquivalentesOptions] = useState(false);

  // Pauta selector state (similar a ingredientes/subproductos)
  const [showPautaSelector, setShowPautaSelector] = useState(false);
  const [pautaQuery, setPautaQuery] = useState("");
  const [showPautaOptions, setShowPautaOptions] = useState(false);
  const [selectedPautaId, setSelectedPautaId] = useState("");

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

      const pasosData = recetaData.pautaElaboracion?.pasosPautaElaboracion || [];
      const ingredientesData = recetaData.ingredientesReceta || [];
      const subproductosData = recetaData.posiblesSubproductos || [];

      if (recetaData.id_producto_base) {
        recetaData.tipo = RECIPE_TYPES.PRODUCTO_TERMINADO;
      } else if (recetaData.id_materia_prima) {
        recetaData.tipo = RECIPE_TYPES.PIP;
      }

      setReceta(recetaData);
      setPasos(pasosData);
      setIngredientes(ingredientesData);
      setSubproductos(subproductosData);
      setMateriasPrimas(Array.isArray(materiasPrimasRes) ? materiasPrimasRes : []);
      setProductos(productosRes);
      setCategoriasMaterias(Array.isArray(categoriasRes) ? categoriasRes : []);

      if (recetaData.pautaElaboracion) {
        setPautaElaboracion(recetaData.pautaElaboracion);
      } else {
        setPautaElaboracion(null);
      }

      setError(null);
    } catch (err) {
      console.error("Error cargando receta:", err);
      setError("No se pudo cargar la receta. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────
  // Fetch completa de receta + pasos + subproductos + ingredientes + cat. MP
  // ───────────────────────────────
  useEffect(() => {
    void fetchReceta();
  }, [id, api]);

  useEffect(() => {
    const fetchPautas = async () => {
      try {
        const pautasRes = await api(`/pautas-elaboracion`);
        const lista = Array.isArray(pautasRes) ? pautasRes : [];
        // Preferimos mostrar activas primero, pero mantenemos el resto si existen.
        const ordenadas = [...lista].sort((a, b) => {
          const aActiva = a?.is_active === false ? 0 : 1;
          const bActiva = b?.is_active === false ? 0 : 1;
          if (aActiva !== bActiva) return bActiva - aActiva;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        });
        setPautasElaboracion(ordenadas);
      } catch (err) {
        console.warn('No se pudieron cargar pautas de elaboración:', err);
        setPautasElaboracion([]);
      }
    };
    void fetchPautas();
  }, [api]);

  const openPautaSelector = () => {
    setShowPautaSelector(true);
    setShowPautaOptions(true);
    setSelectedPautaId(pautaElaboracion?.id != null ? String(pautaElaboracion.id) : '');
    setPautaQuery(pautaElaboracion?.name || '');
  };

  const closePautaSelector = () => {
    setShowPautaSelector(false);
    setShowPautaOptions(false);
    setSelectedPautaId('');
    setPautaQuery('');
  };

  const updatePautaElaboracion = async (nextPautaIdOrNull) => {
    if (!receta) return;

    try {
      const payload = {
        nombre: receta.nombre,
        descripcion: receta.descripcion || '',
        peso: typeof receta.peso === 'string' ? parseFloat(receta.peso) : receta.peso,
        unidad_medida: receta.unidad_medida,
        costo_referencial_produccion:
          typeof receta.costo_referencial_produccion === 'string'
            ? parseFloat(receta.costo_referencial_produccion)
            : receta.costo_referencial_produccion,
        id_pauta_elaboracion: nextPautaIdOrNull,
      };

      if (receta.id_producto_base != null) {
        payload.id_producto_base = Number(receta.id_producto_base);
      }
      if (receta.id_materia_prima != null) {
        payload.id_materia_prima = Number(receta.id_materia_prima);
      }

      await api(`/recetas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      closePautaSelector();
      await fetchReceta();
      return true;
    } catch (err) {
      console.error('Error actualizando pauta de elaboración:', err);
      return false;
    }
  };

  const handleSavePauta = async () => {
    if (!selectedPautaId) {
      toast.error('Selecciona una pauta de elaboración.');
      return;
    }
    const ok = await updatePautaElaboracion(parseInt(selectedPautaId));
    if (ok) toast.success('Pauta de elaboración actualizada.');
    else toast.error('No se pudo actualizar la pauta de elaboración.');
  };

  const handleUnassignPauta = async () => {
    const ok = await updatePautaElaboracion(null);
    if (ok) toast.success('Pauta de elaboración desasignada.');
    else toast.error('No se pudo desasignar la pauta de elaboración.');
  };

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

  const normalizeUnidad = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const openEquivalentesEditor = (ingrediente) => {
    setEditingEquivalentesIngredient(ingrediente.id);
    const currentIds = (ingrediente.materiasPrimasEquivalentes || [])
      .map((mp) => mp?.id)
      .filter(Boolean);
    setEquivalentesSelectedIds(currentIds);
    setEquivalentesQuery("");
    setShowEquivalentesOptions(false);
  };

  const closeEquivalentesEditor = () => {
    setEditingEquivalentesIngredient(null);
    setEquivalentesSelectedIds([]);
    setEquivalentesQuery("");
    setShowEquivalentesOptions(false);
  };

  const toggleEquivalente = (idMateriaPrima) => {
    setEquivalentesSelectedIds((prev) => {
      const idNum = Number(idMateriaPrima);
      if (!Number.isFinite(idNum)) return prev;
      return prev.includes(idNum)
        ? prev.filter((x) => x !== idNum)
        : [...prev, idNum];
    });
  };

  const handleSaveEquivalentes = async () => {
    if (!editingEquivalentesIngredient) return;
    try {
      await api(`/ingredientes-receta/${editingEquivalentesIngredient}/equivalentes`, {
        method: "PUT",
        body: JSON.stringify({
          ids_materia_prima: equivalentesSelectedIds,
        }),
      });

      const recetaRes = await api(`/recetas/${id}`);
      setIngredientes(recetaRes.ingredientesReceta || []);
      toast.success("MPs secundarias actualizadas.");
      closeEquivalentesEditor();
    } catch (err) {
      console.error("Error guardando equivalentes:", err);
      toast.error(err?.message || "No se pudieron guardar las MPs secundarias.");
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          <BackButton to="/Recetas" />
          <div className="flex gap-2">
            <ModifyButton onClick={() => navigate(`/Recetas/${id}/edit`)} />
            <DeleteButton
              onConfirmDelete={handleDelete}
              tooltipText="Eliminar Receta"
              entityName="receta"
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">{receta.nombre}</h1>
            {receta.tipo ? (
              <span className="px-3 py-1 rounded-full text-xs border border-gray-200 text-text bg-white">
                {receta.tipo}
              </span>
            ) : null}
          </div>
          {receta.descripcion ? (
            <p className="mt-2 text-sm text-gray-600">{receta.descripcion}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Sin descripción.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar / Resumen */}
          <div className="lg:col-span-1 lg:order-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Resumen</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Tipo</span>
                  <span className="text-text font-medium text-right">
                    {receta.tipo || "—"}
                  </span>
                </div>

                {receta.tipo === RECIPE_TYPES.PIP && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-500">Materia prima a producir</span>
                    <span className="text-text font-medium text-right">
                      {receta.materiaPrima?.nombre || receta.id_materia_prima}
                    </span>
                  </div>
                )}

                {receta.tipo === RECIPE_TYPES.PRODUCTO_TERMINADO && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-500">Producto a producir</span>
                    <span className="text-text font-medium text-right">
                      {receta.productoBase?.nombre ||
                        (receta.id_producto_base &&
                          productos.find((p) => p.id === receta.id_producto_base)
                            ?.nombre) ||
                        receta.id_producto_base}
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Unidad de medida</span>
                  <span className="text-text font-medium text-right">
                    {receta.unidad_medida || "—"}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Rendimiento teórico</span>
                  <span className="text-text font-medium text-right">
                    {receta.peso} {receta.unidad_medida}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Costo referencial</span>
                  <span className="text-text font-medium text-right">
                    ${receta.costo_referencial_produccion}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Creación</span>
                  <span className="text-text font-medium text-right">
                    {new Date(receta.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Última actualización</span>
                  <span className="text-text font-medium text-right">
                    {new Date(receta.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="lg:col-span-2 lg:order-1 space-y-6">

      {/* ─────────────── INGREDIENTES ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-text">Ingredientes</h2>
          <button
            onClick={() => setShowAddIngredient(!showAddIngredient)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
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
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
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
                    <div className="col-span-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
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
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded"
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
                className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
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

                        <p className="text-xs text-gray-500 mt-1">
                          <span className="font-semibold">MPs secundarias:</span>{" "}
                          {(ingrediente.materiasPrimasEquivalentes || []).length > 0
                            ? (ingrediente.materiasPrimasEquivalentes || [])
                                .map((mp) => mp?.nombre)
                                .filter(Boolean)
                                .join(", ")
                            : "—"}
                        </p>

                        {editingEquivalentesIngredient === ingrediente.id && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-gray-800">
                                Editar MPs secundarias
                              </p>
                              <button
                                type="button"
                                onClick={closeEquivalentesEditor}
                                className="text-gray-600 hover:text-gray-800 text-sm"
                                title="Cerrar"
                              >
                                ×
                              </button>
                            </div>

                            <p className="text-xs text-gray-500 mt-1">
                              Solo se permiten materias primas con la misma unidad ({
                                ingrediente.unidad_medida
                              }).
                            </p>

                            <div className="mt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Buscar materia prima
                              </label>

                              <div className="relative">
                                <input
                                  type="text"
                                  value={equivalentesQuery}
                                  onChange={(e) => {
                                    setEquivalentesQuery(e.target.value);
                                    setShowEquivalentesOptions(true);
                                  }}
                                  onFocus={() => setShowEquivalentesOptions(true)}
                                  onBlur={() => {
                                    setTimeout(
                                      () => setShowEquivalentesOptions(false),
                                      120
                                    );
                                  }}
                                  placeholder="Ej: Leche"
                                  className="w-full border border-gray-300 rounded px-3 py-2"
                                />

                                {showEquivalentesOptions && (
                                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow">
                                    {(() => {
                                      const expectedUnidad = normalizeUnidad(
                                        ingrediente.unidad_medida ||
                                          ingrediente.materiaPrima?.unidad_medida
                                      );

                                      const base = (materiasPrimas || []).filter((mp) => {
                                        if (!mp) return false;
                                        if (isEnvase(mp, categoriasMaterias)) return false;
                                        if (mp.id === ingrediente.materiaPrima?.id) return false;
                                        return (
                                          normalizeUnidad(mp.unidad_medida) === expectedUnidad
                                        );
                                      });

                                      const q = (equivalentesQuery || "")
                                        .toLowerCase()
                                        .trim();
                                      const filtradas = q
                                        ? base.filter((mp) =>
                                            (mp.nombre || "")
                                              .toLowerCase()
                                              .includes(q)
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
                                          {grupo.items.map((mp) => {
                                            const checked = equivalentesSelectedIds.includes(
                                              Number(mp.id)
                                            );
                                            return (
                                              <button
                                                key={mp.id}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => toggleEquivalente(mp.id)}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                                              >
                                                <span
                                                  className={`inline-flex items-center justify-center w-4 h-4 rounded border ${
                                                    checked
                                                      ? "bg-primary border-primary text-white"
                                                      : "bg-white border-gray-300"
                                                  }`}
                                                  aria-hidden="true"
                                                >
                                                  {checked ? "✓" : ""}
                                                </span>
                                                <span className="flex-1">{mp.nombre}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Seleccionadas
                              </p>
                              {equivalentesSelectedIds.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {equivalentesSelectedIds
                                    .map((idMp) =>
                                      (materiasPrimas || []).find(
                                        (m) => Number(m?.id) === Number(idMp)
                                      )
                                    )
                                    .filter(Boolean)
                                    .map((mp) => (
                                      <span
                                        key={mp.id}
                                        className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded border border-gray-300 bg-white"
                                      >
                                        {mp.nombre}
                                        <button
                                          type="button"
                                          className="text-gray-600 hover:text-gray-900"
                                          title="Quitar"
                                          onClick={() => toggleEquivalente(mp.id)}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">
                                  No hay MPs secundarias seleccionadas.
                                </p>
                              )}
                            </div>

                            <div className="mt-4 flex gap-2">
                              <button
                                type="button"
                                onClick={handleSaveEquivalentes}
                                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded text-sm"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={closeEquivalentesEditor}
                                className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100 text-sm"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

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
                      type="button"
                      onClick={() => {
                        if (editingEquivalentesIngredient === ingrediente.id) {
                          closeEquivalentesEditor();
                        } else {
                          openEquivalentesEditor(ingrediente);
                        }
                      }}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border border-gray-300 transition-colors"
                      title="Gestionar MPs secundarias"
                    >
                      Equivalentes
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
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-text">
            Subproductos Posibles
          </h2>
          <button
            onClick={() => setShowAddSubproduct(!showAddSubproduct)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
          >
            {showAddSubproduct ? "Cancelar" : "Agregar Subproducto"}
          </button>
        </div>

        {/* Add Subproduct Form */}
        {showAddSubproduct && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
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
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded"
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
              <h2 className="text-lg font-semibold text-text">
                Pauta de Elaboración: {pautaElaboracion.name}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={openPautaSelector}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm"
                >
                  Cambiar pauta
                </button>
                <button
                  onClick={() =>
                    navigate(`/PautasElaboracion/${pautaElaboracion.id}`)
                  }
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
                >
                  Ver detalles
                </button>
              </div>
            </div>

            {showPautaSelector && (
              <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                <h3 className="font-medium text-gray-800">Seleccionar pauta de elaboración</h3>

                <div className="relative">
                  <input
                    type="text"
                    value={pautaQuery}
                    onChange={(e) => {
                      setPautaQuery(e.target.value);
                      setShowPautaOptions(true);
                    }}
                    onFocus={() => setShowPautaOptions(true)}
                    onBlur={() => setTimeout(() => setShowPautaOptions(false), 120)}
                    placeholder="Buscar pauta (ej: Elaboración Shampoo)"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />

                  {showPautaOptions && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow">
                      {(() => {
                        const base = (pautasElaboracion || []).filter((p) => p);
                        const q = (pautaQuery || '').toLowerCase().trim();
                        const filtradas = q
                          ? base.filter((p) =>
                              String(p.name || '').toLowerCase().includes(q)
                            )
                          : base;

                        if (!filtradas.length) {
                          return (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              Sin resultados
                            </div>
                          );
                        }

                        return filtradas.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedPautaId(String(p.id));
                              setPautaQuery(p.name || '');
                              setShowPautaOptions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                            title={p.description || ''}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-800">{p.name}</span>
                              {p.is_active === false ? (
                                <span className="text-xs text-gray-500">Inactiva</span>
                              ) : null}
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                <input type="hidden" value={selectedPautaId} readOnly />

                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSavePauta()}
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => void handleUnassignPauta()}
                    className="px-4 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50"
                    title="Quita la pauta de elaboración de esta receta"
                  >
                    Desasignar
                  </button>
                  <button
                    onClick={closePautaSelector}
                    className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 mb-6">
              <div>
                <span className="font-semibold">Descripción:</span>
                <p className="mt-1 text-gray-600">
                  {pautaElaboracion.description}
                </p>
              </div>
            </div>

            <h3 className="text-md font-semibold text-text mb-4">
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
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              pH
                            </span>
                          )}
                          {paso.requires_temperature && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                              Temperatura
                            </span>
                          )}
                          {paso.requires_obtained_quantity && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
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
            <h2 className="text-lg font-semibold text-text">
              Pasos de Elaboración
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700">
                <strong>Sin pauta asignada:</strong> Esta receta no tiene una
                pauta de elaboración asociada. Crea una pauta y asóciala
                haciendo click en editar.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={openPautaSelector}
                  className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded text-sm"
                >
                  Asignar pauta
                </button>
              <button
                onClick={() => navigate("/PautasElaboracion")}
                className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100 text-sm"
              >
                Crear Pauta
              </button>
              </div>

              {showPautaSelector && (
                <div className="mt-4 bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                  <h3 className="font-medium text-gray-800">Seleccionar pauta de elaboración</h3>

                  <div className="relative">
                    <input
                      type="text"
                      value={pautaQuery}
                      onChange={(e) => {
                        setPautaQuery(e.target.value);
                        setShowPautaOptions(true);
                      }}
                      onFocus={() => setShowPautaOptions(true)}
                      onBlur={() => setTimeout(() => setShowPautaOptions(false), 120)}
                      placeholder="Buscar pauta (ej: Elaboración Shampoo)"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />

                    {showPautaOptions && (
                      <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded shadow">
                        {(() => {
                          const base = (pautasElaboracion || []).filter((p) => p);
                          const q = (pautaQuery || '').toLowerCase().trim();
                          const filtradas = q
                            ? base.filter((p) =>
                                String(p.name || '').toLowerCase().includes(q)
                              )
                            : base;

                          if (!filtradas.length) {
                            return (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                Sin resultados
                              </div>
                            );
                          }

                          return filtradas.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedPautaId(String(p.id));
                                setPautaQuery(p.name || '');
                                setShowPautaOptions(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                              title={p.description || ''}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-gray-800">{p.name}</span>
                                {p.is_active === false ? (
                                  <span className="text-xs text-gray-500">Inactiva</span>
                                ) : null}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  <input type="hidden" value={selectedPautaId} readOnly />

                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleSavePauta()}
                      className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={closePautaSelector}
                      className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
