import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import TabButton from "../../components/Wizard/TabButton";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { insumoToSearchText } from "../../services/fuzzyMatch";
import { toNumber } from "../../utils/toNumber";

import DatosProductoComercialTab from "../../components/WizardTabs/DatosProductoComercialTab";
import RecetaTab from "../../components/WizardTabs/RecetaTab";
import CostosSecosTab from "../../components/WizardTabs/CostosSecosTab";
import PautaTab from "../../components/WizardTabs/PautaTab";
import CostosIndirectosTab from "../../components/WizardTabs/CostosIndirectosTab";

export default function ProductoEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("datos");

  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [costosCatalogo, setCostosCatalogo] = useState([]);

  const [productoId, setProductoId] = useState(null);
  const [recetaId, setRecetaId] = useState(null);

  const [productoForm, setProductoForm] = useState({
    nombre: "",
    descripcion: "",
    peso_unitario: "",
    unidad_medida: "",
    unidades_por_caja: "",
    codigo_ean: "",
    codigo_sap: "",
  });

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
    const productoBaseId = Number(id);
    if (!Number.isFinite(productoBaseId) || productoBaseId <= 0) {
      toast.error("ID de producto inválido");
      navigate("/Productos");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);

        const [mps, pautasRes, costosRes, productoRes, recetasRes] = await Promise.all([
          api("/materias-primas"),
          api("/pautas-elaboracion"),
          api("/costos-indirectos?is_active=true"),
          api(`/productos-base/${productoBaseId}`),
          api(`/recetas/buscar-por-id-producto-base?id_producto_base=${productoBaseId}`),
        ]);

        setMateriasPrimas(Array.isArray(mps) ? mps : []);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);
        setCostosCatalogo(Array.isArray(costosRes) ? costosRes : []);

        setProductoId(productoBaseId);
        setProductoForm({
          nombre: productoRes?.nombre || "",
          descripcion: productoRes?.descripcion || "",
          peso_unitario: productoRes?.peso_unitario != null ? String(productoRes.peso_unitario) : "",
          unidad_medida: productoRes?.unidad_medida || "",
          unidades_por_caja: productoRes?.unidades_por_caja != null ? String(productoRes.unidades_por_caja) : "",
          codigo_ean: productoRes?.codigo_ean || "",
          codigo_sap: productoRes?.codigo_sap || "",
        });

        const recetasList = Array.isArray(recetasRes) ? recetasRes : [];
        const recetaBase = recetasList[0] || null;

        if (recetaBase?.id) {
          const rid = recetaBase.id;
          setRecetaId(rid);

          const recetaFull = await api(`/recetas/${rid}`);
          setRecetaForm({
            nombre: recetaFull?.nombre || recetaBase?.nombre || "",
            descripcion: recetaFull?.descripcion || recetaBase?.descripcion || "",
            peso:
              recetaFull?.peso != null
                ? String(recetaFull.peso)
                : recetaBase?.peso != null
                  ? String(recetaBase.peso)
                  : "",
            unidad_medida: productoRes?.unidad_medida || recetaFull?.unidad_medida || "",
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

          setRecetaForm((prev) => ({
            ...prev,
            nombre: prev.nombre || (productoRes?.nombre || ""),
            descripcion: prev.descripcion || "",
            unidad_medida: productoRes?.unidad_medida || prev.unidad_medida,
            peso: prev.peso || (productoRes?.peso_unitario != null ? String(productoRes.peso_unitario) : ""),
          }));
        }
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar los datos del producto");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [api, id, navigate]);

  useEffect(() => {
    // La unidad de la receta debe coincidir con la del Producto Comercial.
    const u = String(productoForm.unidad_medida || "");
    if (!u) return;
    setRecetaForm((prev) => ({ ...prev, unidad_medida: u }));
  }, [productoForm.unidad_medida]);

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

  const handleGuardarProducto = async () => {
    if (!productoId) return;
    if (!productoForm.nombre.trim()) return toast.error("Nombre es obligatorio");
    if (!productoForm.descripcion.trim()) return toast.error("Descripción es obligatoria");
    if (!productoForm.codigo_ean.trim()) return toast.error("Código EAN es obligatorio");
    if (!productoForm.codigo_sap.trim()) return toast.error("Código SAP es obligatorio");

    const peso = toNumber(productoForm.peso_unitario);
    const upc = Number(productoForm.unidades_por_caja);
    if (peso <= 0) return toast.error("Cantidad por unidad debe ser mayor a 0");
    if (!productoForm.unidad_medida) return toast.error("Unidad de medida es obligatoria");
    if (!Number.isFinite(upc) || upc <= 0) return toast.error("Unidades por caja debe ser mayor a 0");

    try {
      const payload = {
        nombre: productoForm.nombre.trim(),
        descripcion: productoForm.descripcion.trim(),
        peso_unitario: peso,
        unidad_medida: productoForm.unidad_medida,
        unidades_por_caja: upc,
        codigo_ean: productoForm.codigo_ean.trim(),
        codigo_sap: productoForm.codigo_sap.trim(),
      };

      await api(`/productos-base/${productoId}`, { method: "PUT", body: JSON.stringify(payload) });
      toast.success("Producto Comercial actualizado");
      setTab("receta");
    } catch (e) {
      console.error(e);
      toast.error(`Error actualizando producto: ${e?.message || e}`);
    }
  };

  const buildRecetaPayload = () => {
    return {
      id_producto_base: Number(productoId),
      nombre: recetaForm.nombre.trim(),
      descripcion: recetaForm.descripcion || "",
      peso: toNumber(recetaForm.peso),
      unidad_medida: recetaForm.unidad_medida,
      costo_referencial_produccion: toNumber(recetaForm.costo_referencial_produccion),
      id_pauta_elaboracion: selectedPautaId ? Number(selectedPautaId) : null,
    };
  };

  const handleGuardarReceta = async () => {
    if (!productoId) return toast.error("Primero debes guardar el Producto Comercial");
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

      setTab("costos-secos");
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
          id_pauta_elaboracion: Number(selectedPautaId),
          id_materia_prima: recetaActual.id_materia_prima ?? null,
          id_producto_base: recetaActual.id_producto_base ?? null,
        }),
      });
      toast.success("Pauta asignada");
      setTab("costos");
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

  const canGoReceta = !!productoId;
  const canGoRest = !!recetaId;

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="mb-4">
          <BackButton to="/Productos" />
        </div>
        <div className="text-sm text-gray-600">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Productos" />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Editar Producto Comercial</h1>
          <div className="text-sm text-gray-600">Edita producto, receta y sus configuraciones.</div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {recetaId ? (
            <button
              type="button"
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => navigate(`/Recetas/${recetaId}`)}
            >
              Abrir receta
            </button>
          ) : null}

          <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>
            Datos
          </TabButton>
          <TabButton active={tab === "receta"} disabled={!canGoReceta} onClick={() => setTab("receta")}>
            Receta
          </TabButton>
          <TabButton active={tab === "costos-secos"} disabled={!canGoRest} onClick={() => setTab("costos-secos")}>
            Costos Secos
          </TabButton>
          <TabButton active={tab === "pauta"} disabled={!canGoRest} onClick={() => setTab("pauta")}>
            Pauta
          </TabButton>
          <TabButton active={tab === "costos"} disabled={!canGoRest} onClick={() => setTab("costos")}>
            Costos indirectos
          </TabButton>
        </div>
      </div>

      {tab === "datos" ? (
        <DatosProductoComercialTab
          productoId={productoId}
          productoForm={productoForm}
          setProductoForm={setProductoForm}
          onGuardarProducto={handleGuardarProducto}
        />
      ) : null}

      {tab === "receta" ? (
        <RecetaTab
          titulo="Receta del Producto Comercial"
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
        <CostosSecosTab recetaId={recetaId} opcionesMateriaPrima={opcionesMateriaPrima} onNext={() => setTab("pauta")} />
      ) : null}

      {tab === "pauta" ? (
        <PautaTab
          api={api}
          pautas={pautas}
          setPautas={setPautas}
          selectedPautaId={selectedPautaId}
          setSelectedPautaId={setSelectedPautaId}
          onOmitir={() => setTab("costos")}
          onGuardar={handleGuardarPauta}
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
          onClick={() => navigate("/Productos")}
        >
          Volver a Productos
        </button>
      </div>
    </div>
  );
}
