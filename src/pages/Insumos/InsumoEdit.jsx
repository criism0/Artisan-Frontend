import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BackButton } from "../../components/Buttons/ActionButtons";
import TabButton from "../../components/Wizard/TabButton";

import DatosPipTab from "../../components/WizardTabs/DatosPipTab";
import RecetaTab from "../../components/WizardTabs/RecetaTab";
import CostosSecosTab from "../../components/WizardTabs/CostosSecosTab";
import PautaTab from "../../components/WizardTabs/PautaTab";
import PVAsTab from "../../components/WizardTabs/PVAsTab";
import CostosIndirectosTab from "../../components/WizardTabs/CostosIndirectosTab";

import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { insumoToSearchText } from "../../services/fuzzyMatch";
import { toNumber } from "../../utils/toNumber";

export default function InsumoEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [insumo, setInsumo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [isPip, setIsPip] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "",
    id_categoria: "",
    stock_critico: "",
    unidad_medida: "",
  });
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [pipForm, setPipForm] = useState({
    nombre: "",
    unidad_medida: "",
    stock_critico: "0",
  });

  const [tab, setTab] = useState("datos");

  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [costosCatalogo, setCostosCatalogo] = useState([]);

  const [recetaId, setRecetaId] = useState(null);
  const [recetaForm, setRecetaForm] = useState({
    nombre: "",
    descripcion: "",
    peso: "",
    unidad_medida: "",
    costo_referencial_produccion: "0",
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
    const fetchBase = async () => {
      try {
        setLoading(true);
        setError(null);

        const [insumoRes, catRes] = await Promise.all([
          api(`/materias-primas/${id}`),
          api(`/categorias-materia-prima`),
        ]);

        setInsumo(insumoRes);
        setCategorias(Array.isArray(catRes) ? catRes : []);

        const pip = insumoRes?.categoria?.nombre === "PIP";
        setIsPip(!!pip);

        setFormData({
          nombre: insumoRes?.nombre || "",
          id_categoria: insumoRes?.id_categoria != null ? String(insumoRes.id_categoria) : "",
          stock_critico: insumoRes?.stock_critico != null ? String(insumoRes.stock_critico) : "",
          unidad_medida: insumoRes?.unidad_medida || "",
        });

        setPipForm({
          nombre: insumoRes?.nombre || "",
          unidad_medida: insumoRes?.unidad_medida || "",
          stock_critico: insumoRes?.stock_critico != null ? String(insumoRes.stock_critico) : "0",
        });

        setTab("datos");
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar los datos.");
      } finally {
        setLoading(false);
      }
    };

    void fetchBase();
  }, [api, id]);

  useEffect(() => {
    const loadPipWizardData = async () => {
      if (!isPip) return;
      if (!insumo) return;

      try {
        const [mps, pautasRes, costosRes, recetasRes] = await Promise.all([
          api("/materias-primas"),
          api("/pautas-elaboracion"),
          api("/costos-indirectos?is_active=true"),
          api(`/recetas/buscar-por-id-producto-base?id_materia_prima=${id}`),
        ]);

        setMateriasPrimas(Array.isArray(mps) ? mps : []);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);
        setCostosCatalogo(Array.isArray(costosRes) ? costosRes : []);

        const recetasList = Array.isArray(recetasRes) ? recetasRes : [];
        const recetaBase = recetasList[0] || null;

        if (recetaBase?.id) {
          const rid = recetaBase.id;
          setRecetaId(rid);

          const recetaFull = await api(`/recetas/${rid}`);
          setRecetaForm({
            nombre: recetaFull?.nombre || recetaBase?.nombre || insumo?.nombre || "",
            descripcion: recetaFull?.descripcion || recetaBase?.descripcion || "",
            peso: recetaFull?.peso != null ? String(recetaFull.peso) : recetaBase?.peso != null ? String(recetaBase.peso) : "",
            unidad_medida: insumo?.unidad_medida || recetaFull?.unidad_medida || "",
            costo_referencial_produccion:
              recetaFull?.costo_referencial_produccion != null
                ? String(recetaFull.costo_referencial_produccion)
                : "0",
          });

          setSelectedPautaId(recetaFull?.id_pauta_elaboracion ? String(recetaFull.id_pauta_elaboracion) : "");

          const [ings, subs, costos] = await Promise.all([
            api(`/recetas/${rid}/ingredientes`),
            api(`/recetas/${rid}/subproductos`),
            api(`/recetas/${rid}/costos-indirectos`),
          ]);

          setIngredientes(Array.isArray(ings) ? ings : []);
          setSubproductos(Array.isArray(subs) ? subs : []);
          setRecetaCostos(Array.isArray(costos) ? costos : []);
        } else {
          setRecetaId(null);
          setIngredientes([]);
          setSubproductos([]);
          setRecetaCostos([]);

          setRecetaForm({
            nombre: insumo?.nombre || "",
            descripcion: "",
            peso: "",
            unidad_medida: insumo?.unidad_medida || "",
            costo_referencial_produccion: "0",
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar datos de receta del PIP");
      }
    };

    void loadPipWizardData();
  }, [api, id, insumo, isPip]);

  useEffect(() => {
    if (!isPip) return;
    const u = String(pipForm.unidad_medida || "");
    if (!u) return;
    setRecetaForm((prev) => ({ ...prev, unidad_medida: u }));
  }, [pipForm.unidad_medida, isPip]);

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
      .filter((mp) => String(mp.id) !== String(id))
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
  }, [materiasPrimas, id]);

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
    const newErrors = {};
    if (!pipForm.nombre.trim()) newErrors.nombre = "Debe ingresar un nombre.";
    if (!formData.id_categoria) newErrors.id_categoria = "Debe seleccionar una categoría.";

    const stockCriticoNum = toNumber(pipForm.stock_critico);
    if (!Number.isFinite(stockCriticoNum) || stockCriticoNum <= 0) {
      newErrors.stock_critico = "Debe ingresar un stock crítico mayor a 0.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const body = {
        nombre: pipForm.nombre,
        unidad_medida: pipForm.unidad_medida,
        stock_critico: stockCriticoNum,
        id_categoria: Number(formData.id_categoria),
      };

      await api(`/materias-primas/${id}`, { method: "PUT", body: JSON.stringify(body) });
      toast.success("PIP actualizado");
      setTab("receta");
    } catch (e) {
      console.error(e);
      toast.error(`Error al actualizar PIP: ${e?.message || e}`);
    }
  };

  const buildRecetaPayload = () => {
    return {
      id_materia_prima: Number(id),
      nombre: recetaForm.nombre.trim(),
      descripcion: recetaForm.descripcion || "",
      peso: toNumber(recetaForm.peso),
      unidad_medida: recetaForm.unidad_medida,
      costo_referencial_produccion: toNumber(recetaForm.costo_referencial_produccion),
      id_pauta_elaboracion: null,
    };
  };

  const handleGuardarReceta = async () => {
    const pesoNum = toNumber(recetaForm.peso);
    if (pesoNum <= 0) return toast.error("El peso debe ser mayor a 0");
    if (!recetaForm.unidad_medida) return toast.error("Unidad de medida es obligatoria");
    if (!recetaForm.nombre.trim()) return toast.error("Nombre de receta es obligatorio");

    try {
      const payload = buildRecetaPayload();
      if (recetaId) {
        await api(`/recetas/${recetaId}`, { method: "PUT", body: JSON.stringify(payload) });
        await refreshRecetaParts(recetaId);
        toast.success("Receta actualizada");
      } else {
        const created = await api("/recetas", { method: "POST", body: JSON.stringify(payload) });
        const newId = created?.id ?? null;
        setRecetaId(newId);
        await refreshRecetaParts(newId);
        toast.success("Receta creada");
      }

      setTab("receta");
    } catch (e) {
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

  const validateNoPip = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) newErrors.nombre = "Debe ingresar un nombre.";
    if (!formData.id_categoria) newErrors.id_categoria = "Debe seleccionar una categoría.";
    const stock = toNumber(formData.stock_critico);
    if (!Number.isFinite(stock) || stock <= 0) newErrors.stock_critico = "Debe ingresar un stock crítico mayor a 0.";
    if (!formData.unidad_medida) newErrors.unidad_medida = "Debe seleccionar unidad de medida.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangeNoPip = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSubmitNoPip = async (e) => {
    e.preventDefault();
    if (!validateNoPip()) return;

    try {
      const body = {
        ...formData,
        id_categoria: Number(formData.id_categoria),
        stock_critico: toNumber(formData.stock_critico),
      };
      await api(`/materias-primas/${id}`, { method: "PUT", body: JSON.stringify(body) });
      toast.success("Insumo actualizado correctamente.");
      navigate(`/Insumos/${id}`);
    } catch (err) {
      console.error(err);
      toast.error(`Error al actualizar insumo: ${err?.message || err}`);
    }
  };

  const handleCancelClick = () => {
    if (hasChanges) setShowCancelModal(true);
    else navigate(`/Insumos/${id}`);
  };

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <span className="ml-3 text-primary">Cargando datos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Insumos/${id}`} />
      <h1 className="text-2xl font-bold text-text mb-6">Editar Insumo</h1>

      {error ? <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div> : null}

      {isPip ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>
              Datos
            </TabButton>
            <TabButton active={tab === "receta"} onClick={() => setTab("receta")}>
              Receta
            </TabButton>
            <TabButton active={tab === "costos-secos"} disabled={!recetaId} onClick={() => setTab("costos-secos")}>
              Costos Secos
            </TabButton>
            <TabButton active={tab === "pauta"} disabled={!recetaId} onClick={() => setTab("pauta")}>
              Pauta
            </TabButton>
            <TabButton active={tab === "pvas"} disabled={!recetaId} onClick={() => setTab("pvas")}>
              PVAs
            </TabButton>
            <TabButton active={tab === "costos"} disabled={!recetaId} onClick={() => setTab("costos")}>
              Costos indirectos
            </TabButton>
          </div>

          {tab === "datos" ? (
            <DatosPipTab
              pipId={Number(id)}
              pipForm={pipForm}
              setPipForm={setPipForm}
              onGuardarPip={handleGuardarPip}
              unidadMedidaReadOnly
            />
          ) : null}

          {tab === "receta" ? (
            <RecetaTab
              titulo="Receta del PIP"
              recetaId={recetaId}
              recetaForm={recetaForm}
              setRecetaForm={setRecetaForm}
              onGuardarReceta={handleGuardarReceta}
              unidadMedidaReadOnly
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
              materiaPrimaId={Number(id)}
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
        </>
      ) : (
        <form onSubmit={handleSubmitNoPip} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              name="nombre"
              value={formData.nombre}
              onChange={handleChangeNoPip}
              className={`w-full border rounded-lg px-3 py-2 ${errors.nombre ? "border-red-500" : "border-gray-300"}`}
            />
            {errors.nombre ? <p className="text-red-500 text-sm mt-1">{errors.nombre}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoría *</label>
            <select
              name="id_categoria"
              value={formData.id_categoria}
              onChange={handleChangeNoPip}
              className={`w-full border rounded-lg px-3 py-2 ${errors.id_categoria ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">Seleccionar</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {errors.id_categoria ? <p className="text-red-500 text-sm mt-1">{errors.id_categoria}</p> : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Unidad de Medida *</label>
              <select
                name="unidad_medida"
                value={formData.unidad_medida}
                onChange={handleChangeNoPip}
                className={`w-full border rounded-lg px-3 py-2 ${errors.unidad_medida ? "border-red-500" : "border-gray-300"}`}
              >
                <option value="">Seleccionar</option>
                <option value="Kilogramos">Kilogramos</option>
                <option value="Litros">Litros</option>
                <option value="Unidades">Unidades</option>
              </select>
              {errors.unidad_medida ? <p className="text-red-500 text-sm mt-1">{errors.unidad_medida}</p> : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stock Crítico *</label>
              <input
                type="number"
                name="stock_critico"
                value={formData.stock_critico}
                onChange={handleChangeNoPip}
                className={`w-full border rounded-lg px-3 py-2 ${errors.stock_critico ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.stock_critico ? <p className="text-red-500 text-sm mt-1">{errors.stock_critico}</p> : null}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={handleCancelClick}>
              Cancelar
            </button>
            <button type="submit" className="bg-primary text-white px-6 py-2 rounded">
              Guardar
            </button>
          </div>
        </form>
      )}

      {showCancelModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow p-5 w-full max-w-md">
            <div className="text-lg font-semibold mb-2">Descartar cambios</div>
            <div className="text-sm text-gray-600 mb-4">Tienes cambios sin guardar. ¿Quieres salir igual?</div>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setShowCancelModal(false)}>
                Seguir editando
              </button>
              <button type="button" className="px-4 py-2 bg-primary text-white rounded-lg" onClick={() => navigate(`/Insumos/${id}`)}>
                Salir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
