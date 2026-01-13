import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Selector from "../../components/Selector";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { insumoToSearchText } from "../../services/fuzzyMatch";

function TabButton({ active, disabled, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-lg text-sm border transition disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function CreatePipWizard() {
  const api = useApi();
  const navigate = useNavigate();

  const [tab, setTab] = useState("datos");

  const [categorias, setCategorias] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [costosCatalogo, setCostosCatalogo] = useState([]);

  const [pipId, setPipId] = useState(null);
  const [recetaId, setRecetaId] = useState(null);

  const [pipForm, setPipForm] = useState({
    nombre: "",
    unidad_medida: "",
    stock_critico: "0",
  });

  const [recetaForm, setRecetaForm] = useState({
    nombre: "",
    descripcion: "",
    peso: "1",
    unidad_medida: "",
    costo_referencial_produccion: "0",
  });

  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientPeso, setIngredientPeso] = useState("");
  const [ingredientUnidad, setIngredientUnidad] = useState("");
  const [selectedSubproductId, setSelectedSubproductId] = useState("");

  const [selectedPautaId, setSelectedPautaId] = useState("");

  const [crearPautaOpen, setCrearPautaOpen] = useState(false);
  const [nuevaPauta, setNuevaPauta] = useState({
    name: "",
    description: "",
    paso1: "",
    is_active: true,
  });

  const [recetaCostos, setRecetaCostos] = useState([]);
  const [selectedCostoId, setSelectedCostoId] = useState("");
  const [costoPorKg, setCostoPorKg] = useState("0");
  const [nuevoCosto, setNuevoCosto] = useState({ nombre: "", descripcion: "" });

  const idCategoriaPip = useMemo(() => {
    const pip = (categorias || []).find((c) => String(c?.nombre || "").toLowerCase() === "pip");
    return pip?.id ?? null;
  }, [categorias]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, mps, pautasRes, costosRes] = await Promise.all([
          api("/categorias-materia-prima"),
          api("/materias-primas"),
          api("/pautas-elaboracion"),
          api("/costos-indirectos?is_active=true"),
        ]);
        setCategorias(Array.isArray(cats) ? cats : []);
        setMateriasPrimas(Array.isArray(mps) ? mps : []);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);
        setCostosCatalogo(Array.isArray(costosRes) ? costosRes : []);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar catálogos para el wizard");
      }
    };
    void load();
  }, [api]);

  const mpById = useMemo(() => {
    const map = new Map();
    for (const mp of materiasPrimas || []) {
      if (!mp?.id) continue;
      map.set(String(mp.id), mp);
    }
    return map;
  }, [materiasPrimas]);

  const opcionesMateriaPrima = useMemo(() => {
    const list = Array.isArray(materiasPrimas) ? materiasPrimas : [];
    return list
      .filter((mp) => mp && mp.id)
      .filter((mp) => mp?.activo !== false)
      .map((mp) => {
        const categoria = mp?.categoria?.nombre || "Sin categoría";
        return {
          value: String(mp.id),
          label: mp.nombre,
          category: categoria,
          unidad: mp?.unidad_medida ? String(mp.unidad_medida) : "",
          searchText: insumoToSearchText(mp),
        };
      });
  }, [materiasPrimas]);

  const opcionesIngredientes = useMemo(() => {
    const selectedIds = new Set(
      (ingredientes || [])
        .map((i) => String(i?.id_materia_prima ?? i?.materiaPrima?.id ?? i?.materiaPrimaId ?? ""))
        .filter(Boolean)
    );
    return (opcionesMateriaPrima || []).filter(
      (opt) => opt.value === String(selectedIngredientId || "") || !selectedIds.has(opt.value)
    );
  }, [opcionesMateriaPrima, ingredientes, selectedIngredientId]);

  const opcionesSubproductos = useMemo(() => {
    const selectedIds = new Set(
      (subproductos || [])
        .map((s) => String(s?.id ?? s?.id_materia_prima ?? ""))
        .filter(Boolean)
    );
    return (opcionesMateriaPrima || []).filter(
      (opt) => opt.value === String(selectedSubproductId || "") || !selectedIds.has(opt.value)
    );
  }, [opcionesMateriaPrima, subproductos, selectedSubproductId]);

  const refreshRecetaParts = async (targetRecetaId) => {
    if (!targetRecetaId) return;
    const [ings, subs, costos] = await Promise.all([
      api(`/recetas/${targetRecetaId}/ingredientes`),
      api(`/recetas/${targetRecetaId}/subproductos`),
      api(`/recetas/${targetRecetaId}/costos-indirectos`),
    ]);
    setIngredientes(Array.isArray(ings) ? ings : []);
    setSubproductos(Array.isArray(subs) ? subs : []);
    setRecetaCostos(Array.isArray(costos) ? costos : []);
  };

  const handleGuardarPip = async () => {
    if (!idCategoriaPip) {
      toast.error("No existe la categoría PIP en el sistema");
      return;
    }
    if (!pipForm.nombre.trim()) {
      toast.error("Nombre es obligatorio");
      return;
    }
    if (!pipForm.unidad_medida.trim()) {
      toast.error("Unidad de medida es obligatoria");
      return;
    }

    try {
      const payload = {
        nombre: pipForm.nombre.trim(),
        id_categoria: Number(idCategoriaPip),
        unidad_medida: pipForm.unidad_medida,
        stock_critico: Number(pipForm.stock_critico || 0),
      };

      if (pipId) {
        const updated = await api(`/materias-primas/${pipId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setPipId(updated?.id ?? pipId);
        toast.success("PIP actualizado. Ahora completa la receta.");
      } else {
        const created = await api("/materias-primas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setPipId(created?.id ?? null);
        toast.success("PIP creado. Ahora completa la receta.");
      }

      setRecetaForm((prev) => ({
        ...prev,
        nombre: prev.nombre || payload.nombre,
        unidad_medida: prev.unidad_medida || payload.unidad_medida,
      }));
      setTab("receta");
    } catch (e) {
      console.error(e);
      toast.error(`Error guardando PIP: ${e?.message || e}`);
    }
  };

  const buildRecetaPayload = () => {
    return {
      id_materia_prima: Number(pipId),
      nombre: recetaForm.nombre.trim(),
      descripcion: recetaForm.descripcion || "",
      peso: toNumber(recetaForm.peso),
      unidad_medida: recetaForm.unidad_medida,
      costo_referencial_produccion: toNumber(recetaForm.costo_referencial_produccion),
      id_pauta_elaboracion: null,
    };
  };

  const handleGuardarReceta = async () => {
    if (!pipId) {
      toast.error("Primero debes crear el PIP");
      return;
    }

    const pesoNum = toNumber(recetaForm.peso);
    if (pesoNum <= 0) {
      toast.error("El peso debe ser mayor a 0");
      return;
    }
    if (!recetaForm.unidad_medida.trim()) {
      toast.error("Unidad de medida es obligatoria");
      return;
    }
    if (!recetaForm.nombre.trim()) {
      toast.error("Nombre de receta es obligatorio");
      return;
    }

    try {
      const payload = buildRecetaPayload();

      if (recetaId) {
        await api(`/recetas/${recetaId}`, { method: "PUT", body: JSON.stringify(payload) });
        await refreshRecetaParts(recetaId);
        toast.success("Receta actualizada. Puedes seguir con ingredientes/subproductos.");
      } else {
        const created = await api("/recetas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const newId = created?.id ?? null;
        setRecetaId(newId);
        await refreshRecetaParts(newId);
        toast.success("Receta creada. Ahora agrega ingredientes/subproductos.");
      }

      setTab("ingredientes");
    } catch (e) {
      console.error(e);
      toast.error(`Error guardando receta: ${e?.message || e}`);
    }
  };

  const handleCrearPautaInline = async () => {
    const name = String(nuevaPauta.name || "").trim();
    const description = String(nuevaPauta.description || "").trim();
    const paso1 = String(nuevaPauta.paso1 || "").trim();

    if (!name) {
      toast.error("Nombre de la pauta es obligatorio");
      return;
    }
    if (!description) {
      toast.error("Descripción de la pauta es obligatoria");
      return;
    }
    if (!paso1 || paso1.length < 5) {
      toast.error("El paso 1 debe tener al menos 5 caracteres");
      return;
    }

    try {
      const pautaRes = await api("/pautas-elaboracion", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          is_active: !!nuevaPauta.is_active,
        }),
      });

      const idPauta = pautaRes?.id;
      await api("/pasos-pauta-elaboracion", {
        method: "POST",
        body: JSON.stringify({
          id_pauta_elaboracion: idPauta,
          orden: 1,
          descripcion: paso1,
          requires_ph: false,
          requires_temperature: false,
          requires_obtained_quantity: false,
          extra_input_data: null,
        }),
      });

      const pautasRes = await api("/pautas-elaboracion");
      setPautas(Array.isArray(pautasRes) ? pautasRes : []);
      setSelectedPautaId(String(idPauta));
      setCrearPautaOpen(false);
      setNuevaPauta({ name: "", description: "", paso1: "", is_active: true });
      toast.success("Pauta creada y seleccionada");
    } catch (e) {
      console.error(e);
      toast.error(`Error creando pauta: ${e?.message || e}`);
    }
  };

  const handleAddIngrediente = async () => {
    if (!recetaId) return;
    if (!selectedIngredientId) {
      toast.error("Selecciona un ingrediente");
      return;
    }
    const pesoNum = toNumber(ingredientPeso);
    if (pesoNum <= 0) {
      toast.error("El peso del ingrediente debe ser mayor a 0");
      return;
    }

    try {
      await api(`/recetas/${recetaId}/ingredientes`, {
        method: "POST",
        body: JSON.stringify({
          id_materia_prima: Number(selectedIngredientId),
          peso: pesoNum,
          unidad_medida: ingredientUnidad || recetaForm.unidad_medida,
        }),
      });

      setSelectedIngredientId("");
      setIngredientPeso("");
      setIngredientUnidad("");
      await refreshRecetaParts(recetaId);
      toast.success("Ingrediente agregado");
    } catch (e) {
      console.error(e);
      toast.error(`Error agregando ingrediente: ${e?.message || e}`);
    }
  };

  const handleRemoveIngrediente = async (ingredienteId) => {
    if (!recetaId) return;
    try {
      await api(`/recetas/${recetaId}/ingredientes/${ingredienteId}`, { method: "DELETE" });
      await refreshRecetaParts(recetaId);
      toast.success("Ingrediente eliminado");
    } catch (e) {
      console.error(e);
      toast.error(`Error eliminando ingrediente: ${e?.message || e}`);
    }
  };

  const handleAddSubproducto = async () => {
    if (!recetaId) return;
    if (!selectedSubproductId) {
      toast.error("Selecciona un subproducto");
      return;
    }
    try {
      await api(`/recetas/${recetaId}/subproductos`, {
        method: "POST",
        body: JSON.stringify({ id_materia_prima: Number(selectedSubproductId) }),
      });
      setSelectedSubproductId("");
      await refreshRecetaParts(recetaId);
      toast.success("Subproducto agregado");
    } catch (e) {
      console.error(e);
      toast.error(`Error agregando subproducto: ${e?.message || e}`);
    }
  };

  const handleRemoveSubproducto = async (mpId) => {
    if (!recetaId) return;
    try {
      await api(`/recetas/${recetaId}/subproductos/${mpId}`, { method: "DELETE" });
      await refreshRecetaParts(recetaId);
      toast.success("Subproducto eliminado");
    } catch (e) {
      console.error(e);
      toast.error(`Error eliminando subproducto: ${e?.message || e}`);
    }
  };

  const handleGuardarPauta = async () => {
    if (!recetaId) return;
    if (!selectedPautaId) {
      toast.error("Selecciona una pauta");
      return;
    }

    try {
      const recetaActual = await api(`/recetas/${recetaId}`);
      const payload = {
        nombre: recetaActual.nombre,
        descripcion: recetaActual.descripcion || "",
        peso: recetaActual.peso,
        unidad_medida: recetaActual.unidad_medida,
        costo_referencial_produccion: recetaActual.costo_referencial_produccion ?? 0,
        id_pauta_elaboracion: Number(selectedPautaId),
        id_materia_prima: recetaActual.id_materia_prima ?? null,
        id_producto_base: recetaActual.id_producto_base ?? null,
      };
      await api(`/recetas/${recetaId}`, { method: "PUT", body: JSON.stringify(payload) });
      toast.success("Pauta asignada");
      setTab("costos");
    } catch (e) {
      console.error(e);
      toast.error(`Error asignando pauta: ${e?.message || e}`);
    }
  };

  const handleCrearCosto = async () => {
    const nombre = String(nuevoCosto.nombre || "").trim();
    if (!nombre) {
      toast.error("Nombre de costo indirecto es obligatorio");
      return;
    }
    try {
      await api("/costos-indirectos", {
        method: "POST",
        body: JSON.stringify({ nombre, descripcion: String(nuevoCosto.descripcion || "") }),
      });
      const costosRes = await api("/costos-indirectos?is_active=true");
      setCostosCatalogo(Array.isArray(costosRes) ? costosRes : []);
      setNuevoCosto({ nombre: "", descripcion: "" });
      toast.success("Costo indirecto creado");
    } catch (e) {
      console.error(e);
      toast.error(`Error creando costo indirecto: ${e?.message || e}`);
    }
  };

  const handleAddCostoReceta = async () => {
    if (!recetaId) return;
    if (!selectedCostoId) {
      toast.error("Selecciona un costo indirecto");
      return;
    }
    const costoNum = toNumber(costoPorKg);
    if (costoNum < 0) {
      toast.error("Costo por kg no puede ser negativo");
      return;
    }

    try {
      const updated = await api(`/recetas/${recetaId}/costos-indirectos`, {
        method: "POST",
        body: JSON.stringify({
          id_costo_indirecto: Number(selectedCostoId),
          costo_por_kg: costoNum,
        }),
      });
      setRecetaCostos(Array.isArray(updated) ? updated : []);
      setSelectedCostoId("");
      setCostoPorKg("0");
      toast.success("Costo indirecto asociado");
    } catch (e) {
      console.error(e);
      toast.error(`Error asociando costo indirecto: ${e?.message || e}`);
    }
  };

  const handleUpdateCostoReceta = async (idCosto, nextCostoPorKg) => {
    if (!recetaId) return;
    const costoNum = toNumber(nextCostoPorKg);
    if (costoNum < 0) return;
    try {
      await api(`/recetas/${recetaId}/costos-indirectos/${idCosto}`, {
        method: "PUT",
        body: JSON.stringify({ costo_por_kg: costoNum }),
      });
      await refreshRecetaParts(recetaId);
    } catch (e) {
      console.error(e);
      toast.error(`Error actualizando costo: ${e?.message || e}`);
    }
  };

  const handleRemoveCostoReceta = async (idCosto) => {
    if (!recetaId) return;
    try {
      await api(`/recetas/${recetaId}/costos-indirectos/${idCosto}`, { method: "DELETE" });
      await refreshRecetaParts(recetaId);
      toast.success("Costo indirecto desasociado");
    } catch (e) {
      console.error(e);
      toast.error(`Error desasociando costo: ${e?.message || e}`);
    }
  };

  const canGoReceta = !!pipId;
  const canGoIngredientes = !!recetaId;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/InsumosPIPProductos" />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Crear PIP</h1>
          <p className="text-sm text-gray-600 mt-1">
            Flujo centralizado: datos del PIP → receta → ingredientes/subproductos → pauta → costos indirectos.
          </p>
        </div>
        <div className="flex gap-2">
          {recetaId ? (
            <button
              type="button"
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => navigate(`/Recetas/${recetaId}`)}
            >
              Abrir receta
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>1) Datos</TabButton>
        <TabButton
          active={tab === "receta"}
          disabled={!canGoReceta}
          onClick={() => setTab("receta")}
        >
          2) Receta
        </TabButton>
        <TabButton
          active={tab === "ingredientes"}
          disabled={!canGoIngredientes}
          onClick={() => setTab("ingredientes")}
        >
          3) Ingredientes
        </TabButton>
        <TabButton
          active={tab === "pauta"}
          disabled={!canGoIngredientes}
          onClick={() => setTab("pauta")}
        >
          4) Pauta
        </TabButton>
        <TabButton
          active={tab === "costos"}
          disabled={!canGoIngredientes}
          onClick={() => setTab("costos")}
        >
          5) Costos indirectos
        </TabButton>
      </div>

      {tab === "datos" ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="text-sm font-semibold text-gray-800">Datos del PIP</div>

          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={pipForm.nombre}
              onChange={(e) => setPipForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Mezcla base shampoo"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Unidad de medida *</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={pipForm.unidad_medida}
                onChange={(e) => setPipForm((p) => ({ ...p, unidad_medida: e.target.value }))}
                placeholder="Ej: Kilogramos, Litros, Unidades"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock crítico</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                value={pipForm.stock_critico}
                onChange={(e) => setPipForm((p) => ({ ...p, stock_critico: e.target.value }))}
              />
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Categoría: <span className="font-medium">PIP</span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
              onClick={handleGuardarPip}
            >
              {pipId ? "Actualizar y continuar" : "Guardar y continuar"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "receta" ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="text-sm font-semibold text-gray-800">Receta del PIP</div>
          <div>
            <label className="block text-sm font-medium mb-1">Nombre receta *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={recetaForm.nombre}
              onChange={(e) => setRecetaForm((r) => ({ ...r, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2"
              value={recetaForm.descripcion}
              onChange={(e) => setRecetaForm((r) => ({ ...r, descripcion: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Peso *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                value={recetaForm.peso}
                onChange={(e) => setRecetaForm((r) => ({ ...r, peso: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidad de medida *</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={recetaForm.unidad_medida}
                onChange={(e) => setRecetaForm((r) => ({ ...r, unidad_medida: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Costo referencial producción</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2"
                value={recetaForm.costo_referencial_produccion}
                onChange={(e) => setRecetaForm((r) => ({ ...r, costo_referencial_produccion: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
              onClick={handleGuardarReceta}
            >
              {recetaId ? "Actualizar receta y continuar" : "Crear receta y continuar"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "ingredientes" ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Agregar ingrediente</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Materia prima</label>
                <Selector
                  options={opcionesIngredientes}
                  selectedValue={selectedIngredientId}
                  onSelect={(value) => {
                    setSelectedIngredientId(value);
                    const mp = mpById.get(String(value));
                    if (mp?.unidad_medida) setIngredientUnidad(String(mp.unidad_medida));
                  }}
                  useFuzzy
                  groupBy="category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1">Peso *</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={ingredientPeso}
                  onChange={(e) => setIngredientPeso(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidad</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={ingredientUnidad}
                  onChange={(e) => setIngredientUnidad(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                  onClick={handleAddIngrediente}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Ingredientes</div>
            {ingredientes.length === 0 ? (
              <div className="text-sm text-gray-600">Sin ingredientes por ahora.</div>
            ) : (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Materia prima</th>
                    <th className="px-3 py-2 text-left">Peso</th>
                    <th className="px-3 py-2 text-left">Unidad</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2">{i?.materiaPrima?.nombre || "—"}</td>
                      <td className="px-3 py-2">{i.peso}</td>
                      <td className="px-3 py-2">{i.unidad_medida}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => handleRemoveIngrediente(i.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Subproductos</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Materia prima</label>
                <Selector
                  options={opcionesSubproductos}
                  selectedValue={selectedSubproductId}
                  onSelect={(value) => setSelectedSubproductId(value)}
                  useFuzzy
                  groupBy="category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                onClick={handleAddSubproducto}
              >
                Agregar subproducto
              </button>
            </div>

            <div className="mt-4">
              {subproductos.length === 0 ? (
                <div className="text-sm text-gray-600">Sin subproductos por ahora.</div>
              ) : (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Materia prima</th>
                      <th className="px-3 py-2 text-left">Unidad</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subproductos.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2">{s.nombre}</td>
                        <td className="px-3 py-2">{s.unidad_medida}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => handleRemoveSubproducto(s.id)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setTab("pauta")}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "pauta" ? (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="text-sm font-semibold text-gray-800">Asignar pauta de elaboración</div>
          <div>
            <label className="block text-sm font-medium mb-1">Pauta</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedPautaId}
              onChange={(e) => setSelectedPautaId(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {pautas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.is_active === false ? "(inactiva)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setCrearPautaOpen((v) => !v)}
            >
              {crearPautaOpen ? "Cerrar creación rápida" : "+ Crear nueva pauta"}
            </button>
          </div>

          {crearPautaOpen ? (
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
              <div className="text-sm font-semibold text-gray-800">Nueva pauta (rápida)</div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nuevaPauta.name}
                  onChange={(e) => setNuevaPauta((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nuevaPauta.description}
                  onChange={(e) => setNuevaPauta((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Paso 1 (mínimo) *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nuevaPauta.paso1}
                  onChange={(e) => setNuevaPauta((p) => ({ ...p, paso1: e.target.value }))}
                  placeholder="Ej: Mezclar hasta homogeneizar"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                  onClick={handleCrearPautaInline}
                >
                  Crear y seleccionar
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => setTab("costos")}
            >
              Omitir
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
              onClick={handleGuardarPauta}
            >
              Guardar pauta
            </button>
          </div>
        </div>
      ) : null}

      {tab === "costos" ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Asociar costo indirecto a receta (por kg)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Costo indirecto</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={selectedCostoId}
                  onChange={(e) => setSelectedCostoId(e.target.value)}
                >
                  <option value="">Seleccionar</option>
                  {costosCatalogo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Costo $/kg</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={costoPorKg}
                  onChange={(e) => setCostoPorKg(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                  onClick={handleAddCostoReceta}
                >
                  Asociar
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Costos indirectos asociados</div>
            {recetaCostos.length === 0 ? (
              <div className="text-sm text-gray-600">Sin costos indirectos asociados.</div>
            ) : (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Costo $/kg</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recetaCostos.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2">{c.nombre}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="border rounded-lg px-2 py-1 w-32"
                          defaultValue={c?.RecetaCostoIndirecto?.costo_por_kg ?? c?.recetaCostoIndirecto?.costo_por_kg ?? 0}
                          onBlur={(e) => handleUpdateCostoReceta(c.id, e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => handleRemoveCostoReceta(c.id)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-3">Crear nuevo costo indirecto</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nuevoCosto.nombre}
                  onChange={(e) => setNuevoCosto((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nuevoCosto.descripcion}
                  onChange={(e) => setNuevoCosto((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                onClick={handleCrearCosto}
              >
                Crear costo
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
              onClick={() => {
                toast.success("PIP creado");
                navigate(`/Recetas/${recetaId}`);
              }}
              disabled={!recetaId}
            >
              Finalizar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
