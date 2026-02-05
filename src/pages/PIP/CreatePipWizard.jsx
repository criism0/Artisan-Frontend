import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { ApiError, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { insumoToSearchText } from "../../services/fuzzyMatch";

import SimilarNameConfirmModal from "../../components/SimilarNameConfirmModal";

import TabButton from "../../components/Wizard/TabButton";
import { toNumber } from "../../utils/toNumber";

import DatosPipTab from "../../components/WizardTabs/DatosPipTab";
import RecetaTab from "../../components/WizardTabs/RecetaTab";
import CostosSecosTab from "../../components/WizardTabs/CostosSecosTab";
import PautaTab from "../../components/WizardTabs/PautaTab";
import PVAsTab from "../../components/WizardTabs/PVAsTab";
import CostosIndirectosTab from "../../components/WizardTabs/CostosIndirectosTab";

export default function CreatePipWizard() {
  const api = useApi();
  const navigate = useNavigate();

  const pendingSimilarActionRef = useRef(null);
  const [similarModal, setSimilarModal] = useState({
    open: false,
    entityLabel: "",
    inputName: "",
    matches: [],
    confirmText: "Crear igualmente",
  });

  const [tab, setTab] = useState("datos");

  const [categorias, setCategorias] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [costosCatalogo, setCostosCatalogo] = useState([]);

  const pipCategoriaId = useMemo(() => {
    const pip = (categorias || []).find((c) => String(c?.nombre || "").toLowerCase() === "pip");
    return pip?.id ?? null;
  }, [categorias]);

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
    dias_vida_util: "",
  });

  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);

  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientPeso, setIngredientPeso] = useState("");
  const [ingredientUnidad, setIngredientUnidad] = useState("");

  const [selectedEquivalenteId, setSelectedEquivalenteId] = useState("");
  const [equivalentesIds, setEquivalentesIds] = useState([]);
  const [editingIngredienteId, setEditingIngredienteId] = useState(null);

  const [selectedSubproductId, setSelectedSubproductId] = useState("");

  const [selectedPautaId, setSelectedPautaId] = useState("");

  const [recetaCostos, setRecetaCostos] = useState([]);
  const [selectedCostoId, setSelectedCostoId] = useState("");
  const [costoPorKg, setCostoPorKg] = useState("0");
  const [nuevoCosto, setNuevoCosto] = useState({ nombre: "", descripcion: "" });

  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, mps, pautasRes, costosRes] = await Promise.all([
          api("/categorias-materia-prima"),
          api("/materias-primas"),
          api("/pautas-elaboracion"),
          api("/costos-indirectos?is_active=true"),
        ]);
        setCategorias(Array.isArray(catRes) ? catRes : []);
        setMateriasPrimas(Array.isArray(mps) ? mps : []);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);
        setCostosCatalogo(Array.isArray(costosRes) ? costosRes : []);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar datos iniciales: " + (e?.message || e));
      }
    };
    void load();
  }, [api]);

  useEffect(() => {
    const u = String(pipForm.unidad_medida || "");
    if (!u) return;
    setRecetaForm((prev) => ({ ...prev, unidad_medida: u }));
  }, [pipForm.unidad_medida]);

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
      .filter((mp) => (pipId ? String(mp.id) !== String(pipId) : true))
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
  }, [materiasPrimas, pipId]);

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

  const handleGuardarPip = async (confirmSimilarNameOrEvent = false) => {
    const confirmSimilarName = typeof confirmSimilarNameOrEvent === "boolean" ? confirmSimilarNameOrEvent : false;
    if (!pipCategoriaId) return toast.error("No existe la categoría 'PIP' en el sistema");
    if (!pipForm.nombre.trim()) return toast.error("Nombre es obligatorio");
    if (!pipForm.unidad_medida) return toast.error("Unidad de medida es obligatoria");

    const stockCriticoNum = toNumber(pipForm.stock_critico);
    if (stockCriticoNum < 0) return toast.error("Stock crítico no puede ser negativo");

    try {
      const payload = {
        nombre: pipForm.nombre.trim(),
        id_categoria: Number(pipCategoriaId),
        unidad_medida: pipForm.unidad_medida,
        stock_critico: stockCriticoNum,
      };

      if (pipId) {
        await api(`/materias-primas/${pipId}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, confirmSimilarName }),
        });
        toast.success("PIP actualizado");
      } else {
        const created = await api(`/materias-primas`, {
          method: "POST",
          body: JSON.stringify({ ...payload, confirmSimilarName }),
        });
        const newId = created?.id ?? null;
        setPipId(newId);
        toast.success("PIP creado");

        setRecetaForm((prev) => ({
          ...prev,
          nombre: prev.nombre || payload.nombre,
          descripcion: prev.descripcion || "",
          unidad_medida: prev.unidad_medida || payload.unidad_medida,
        }));
      }

      setTab("receta");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleGuardarPip(true);
        setSimilarModal({
          open: true,
          entityLabel: "pip",
          inputName: e.data?.input || pipForm.nombre,
          matches: e.data?.matches || [],
          confirmText: pipId ? "Guardar igualmente" : "Crear PIP igualmente",
        });
        return;
      }

      console.error(e);
      toast.error(`Error guardando PIP: ${e?.message || e}`);
    }
  };

  const buildRecetaPayload = () => {
    const diasVidaUtil = Number(recetaForm.dias_vida_util);
    return {
      id_materia_prima: Number(pipId),
      nombre: recetaForm.nombre.trim(),
      descripcion: recetaForm.descripcion || "",
      peso: toNumber(recetaForm.peso),
      unidad_medida: recetaForm.unidad_medida,
      costo_referencial_produccion: toNumber(recetaForm.costo_referencial_produccion),
      dias_vida_util: Number.isFinite(diasVidaUtil) ? Math.trunc(diasVidaUtil) : null,
      id_pauta_elaboracion: null,
    };
  };

  const handleGuardarReceta = async (confirmSimilarNameOrEvent = false) => {
    const confirmSimilarName = typeof confirmSimilarNameOrEvent === "boolean" ? confirmSimilarNameOrEvent : false;
    if (!pipId) return toast.error("Primero debes guardar el PIP");
    const pesoNum = toNumber(recetaForm.peso);
    if (pesoNum <= 0) return toast.error("El peso debe ser mayor a 0");
    if (!recetaForm.unidad_medida) return toast.error("Unidad de medida es obligatoria");
    if (!recetaForm.nombre.trim()) return toast.error("Nombre de receta es obligatorio");
    const diasVidaUtil = Number(recetaForm.dias_vida_util);
    if (!Number.isInteger(diasVidaUtil) || diasVidaUtil <= 0) {
      return toast.error("Días de vida útil debe ser un entero positivo");
    }

    try {
      const payload = buildRecetaPayload();
      if (payload.dias_vida_util == null) {
        return toast.error("Días de vida útil es obligatorio");
      }
      if (recetaId) {
        await api(`/recetas/${recetaId}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, confirmSimilarName }),
        });
        await refreshRecetaParts(recetaId);
        toast.success("Receta actualizada");
      } else {
        const created = await api("/recetas", {
          method: "POST",
          body: JSON.stringify({ ...payload, confirmSimilarName }),
        });
        const newId = created?.id ?? null;
        setRecetaId(newId);
        await refreshRecetaParts(newId);
        toast.success("Receta creada");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleGuardarReceta(true);
        setSimilarModal({
          open: true,
          entityLabel: "receta",
          inputName: e.data?.input || recetaForm.nombre,
          matches: e.data?.matches || [],
          confirmText: recetaId ? "Guardar igualmente" : "Crear receta igualmente",
        });
        return;
      }

      console.error(e);
      toast.error(`Error guardando receta: ${e?.message || e}`);
    }
  };

  const handleStartEditIngrediente = (ingrediente) => {
    if (!ingrediente?.id) return;
    setEditingIngredienteId(String(ingrediente.id));

    const principalId =
      ingrediente?.id_materia_prima ?? ingrediente?.materiaPrima?.id ?? ingrediente?.materiaPrimaId ?? "";

    setSelectedIngredientId(principalId ? String(principalId) : "");
    setIngredientPeso(ingrediente?.peso != null ? String(ingrediente.peso) : "");
    setIngredientUnidad(ingrediente?.unidad_medida != null ? String(ingrediente.unidad_medida) : "");

    const eqIds = (ingrediente?.materiasPrimasEquivalentes || [])
      .map((x) => (x?.id != null ? String(x.id) : null))
      .filter(Boolean);

    setEquivalentesIds(eqIds);
    setSelectedEquivalenteId("");
  };

  const handleCancelEditIngrediente = () => {
    setEditingIngredienteId(null);
    setSelectedIngredientId("");
    setIngredientPeso("");
    setIngredientUnidad("");
    setSelectedEquivalenteId("");
    setEquivalentesIds([]);
  };

  const handleAddOrUpdateIngrediente = async () => {
    if (!recetaId) return;
    if (!selectedIngredientId) return toast.error("Selecciona un ingrediente");
    const pesoNum = toNumber(ingredientPeso);
    if (pesoNum <= 0) return toast.error("El peso del ingrediente debe ser mayor a 0");

    const idsEquivalentes = (equivalentesIds || [])
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);

    try {
      if (editingIngredienteId) {
        await api(`/recetas/${recetaId}/ingredientes/${editingIngredienteId}`, {
          method: "PUT",
          body: JSON.stringify({
            peso: pesoNum,
            unidad_medida: ingredientUnidad || recetaForm.unidad_medida,
            ids_materia_prima_equivalentes: idsEquivalentes,
          }),
        });
        toast.success("Ingrediente actualizado");
      } else {
        await api(`/recetas/${recetaId}/ingredientes`, {
          method: "POST",
          body: JSON.stringify({
            id_materia_prima: Number(selectedIngredientId),
            peso: pesoNum,
            unidad_medida: ingredientUnidad || recetaForm.unidad_medida,
            ids_materia_prima_equivalentes: idsEquivalentes,
          }),
        });
        toast.success("Ingrediente agregado");
      }

      handleCancelEditIngrediente();
      await refreshRecetaParts(recetaId);
    } catch (e) {
      console.error(e);
      toast.error(`Error guardando ingrediente: ${e?.message || e}`);
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
    if (!selectedSubproductId) return toast.error("Selecciona un subproducto");
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

  const handleRemoveSubproducto = async (idMateriaPrima) => {
    if (!recetaId) return;
    try {
      await api(`/recetas/${recetaId}/subproductos/${idMateriaPrima}`, { method: "DELETE" });
      await refreshRecetaParts(recetaId);
      toast.success("Subproducto eliminado");
    } catch (e) {
      console.error(e);
      toast.error(`Error eliminando subproducto: ${e?.message || e}`);
    }
  };


  const handleGuardarPauta = async () => {
    if (!recetaId) return;
    if (!selectedPautaId) return toast.error("Selecciona una pauta");
    try {
      const recetaActual = await api(`/recetas/${recetaId}`);
      await api(`/recetas/${recetaId}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre: recetaActual.nombre,
          descripcion: recetaActual.descripcion || "",
          peso: recetaActual.peso,
          unidad_medida: recetaActual.unidad_medida,
          costo_referencial_produccion: recetaActual.costo_referencial_produccion ?? 0,
          dias_vida_util: recetaActual.dias_vida_util ?? null,
          id_pauta_elaboracion: Number(selectedPautaId),
          id_materia_prima: recetaActual.id_materia_prima ?? null,
          id_producto_base: recetaActual.id_producto_base ?? null,
        }),
      });
      toast.success("Pauta asignada");
      setTab("pvas");
    } catch (e) {
      console.error(e);
      toast.error(`Error asignando pauta: ${e?.message || e}`);
    }
  };

  const handleCrearCosto = async () => {
    const nombre = String(nuevoCosto.nombre || "").trim();
    if (!nombre) return toast.error("Nombre de costo indirecto es obligatorio");
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
    if (!selectedCostoId) return toast.error("Selecciona un costo indirecto");
    const costoNum = toNumber(costoPorKg);
    if (costoNum < 0) return toast.error("Costo por kg no puede ser negativo");
    try {
      const updated = await api(`/recetas/${recetaId}/costos-indirectos`, {
        method: "POST",
        body: JSON.stringify({ id_costo_indirecto: Number(selectedCostoId), costo_por_kg: costoNum }),
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
  const canGoRest = !!recetaId;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/PIP" />
      </div>

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel={similarModal.entityLabel}
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        confirmText={similarModal.confirmText}
        onCancel={() => {
          setSimilarModal({ open: false, entityLabel: "", inputName: "", matches: [], confirmText: "Crear igualmente" });
          pendingSimilarActionRef.current = null;
        }}
        onConfirm={async () => {
          const fn = pendingSimilarActionRef.current;
          setSimilarModal({ open: false, entityLabel: "", inputName: "", matches: [], confirmText: "Crear igualmente" });
          pendingSimilarActionRef.current = null;
          if (typeof fn === "function") await fn();
        }}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Crear PIP</h1>
          <div className="text-sm text-gray-600">
            Formulario para crear insumo PIP + receta.
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>
            Datos
          </TabButton>
          <TabButton active={tab === "receta"} onClick={() => setTab("receta")} disabled={!canGoReceta}>
            Receta
          </TabButton>
          <TabButton
            active={tab === "costos-secos"}
            onClick={() => setTab("costos-secos")}
            disabled={!canGoRest}
          >
            Costos Secos
          </TabButton>
          <TabButton active={tab === "pauta"} onClick={() => setTab("pauta")} disabled={!canGoRest}>
            Pauta
          </TabButton>
          <TabButton active={tab === "pvas"} onClick={() => setTab("pvas")} disabled={!canGoRest}>
            PVAs
          </TabButton>
          <TabButton active={tab === "costos"} onClick={() => setTab("costos")} disabled={!canGoRest}>
            Costos indirectos
          </TabButton>
        </div>
      </div>

      {tab === "datos" ? (
        <DatosPipTab
          pipId={pipId}
          pipForm={pipForm}
          setPipForm={setPipForm}
          onGuardarPip={() => handleGuardarPip(false)}
        />
      ) : null}

      {tab === "receta" ? (
        <RecetaTab
          titulo="Receta del PIP"
          recetaId={recetaId}
          recetaForm={recetaForm}
          setRecetaForm={setRecetaForm}
          onGuardarReceta={() => handleGuardarReceta(false)}
          mpById={mpById}
          opcionesIngredientes={opcionesIngredientes}
          opcionesMateriaPrima={opcionesMateriaPrima}
          selectedIngredientId={selectedIngredientId}
          setSelectedIngredientId={setSelectedIngredientId}
          ingredientPeso={ingredientPeso}
          setIngredientPeso={setIngredientPeso}
          ingredientUnidad={ingredientUnidad}
          setIngredientUnidad={setIngredientUnidad}
          selectedEquivalenteId={selectedEquivalenteId}
          setSelectedEquivalenteId={setSelectedEquivalenteId}
          equivalentesIds={equivalentesIds}
          setEquivalentesIds={setEquivalentesIds}
          editingIngredienteId={editingIngredienteId}
          onSubmitIngrediente={handleAddOrUpdateIngrediente}
          onCancelEditIngrediente={handleCancelEditIngrediente}
          ingredientes={ingredientes}
          onStartEditIngrediente={handleStartEditIngrediente}
          onRemoveIngrediente={handleRemoveIngrediente}
          opcionesSubproductos={opcionesSubproductos}
          selectedSubproductId={selectedSubproductId}
          setSelectedSubproductId={setSelectedSubproductId}
          onAddSubproducto={handleAddSubproducto}
          subproductos={subproductos}
          onRemoveSubproducto={handleRemoveSubproducto}
          onNext={() => setTab("costos-secos")}
        />
      ) : null}

      {tab === "costos-secos" ? (
        <CostosSecosTab
          recetaId={recetaId}
          opcionesMateriaPrima={opcionesMateriaPrima}
          onNext={() => setTab("pauta")}
        />
      ) : null}

      {tab === "pauta" ? (
        <PautaTab
          api={api}
          pautas={pautas}
          setPautas={setPautas}
          selectedPautaId={selectedPautaId}
          setSelectedPautaId={setSelectedPautaId}
          onOmitir={() => setTab("pvas")}
          onGuardar={handleGuardarPauta}
        />
      ) : null}

      {tab === "pvas" ? (
        <PVAsTab
          materiaPrimaId={pipId}
          onNext={() => setTab("costos")}
        />
      ) : null}

      {tab === "costos" ? (
        <CostosIndirectosTab
          costosCatalogo={costosCatalogo}
          recetaCostos={recetaCostos}
          selectedCostoId={selectedCostoId}
          setSelectedCostoId={setSelectedCostoId}
          costoPorKg={costoPorKg}
          setCostoPorKg={setCostoPorKg}
          nuevoCosto={nuevoCosto}
          setNuevoCosto={setNuevoCosto}
          onCrearCosto={handleCrearCosto}
          onAddCostoReceta={handleAddCostoReceta}
          onUpdateCostoReceta={handleUpdateCostoReceta}
          onRemoveCostoReceta={handleRemoveCostoReceta}
        />
      ) : null}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          onClick={() => navigate("/PIP")}
        >
          Volver a PIP
        </button>
      </div>
    </div>
  );
}
