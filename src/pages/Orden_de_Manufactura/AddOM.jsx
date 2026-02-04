import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import Selector from "../../components/Selector";
import { insumoToSearchText } from "../../services/fuzzyMatch";
import { formatNumberCL } from "../../services/formatHelpers";

export default function AddOM() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [productosBase, setProductosBase] = useState([]);
  const [pips, setPips] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [recetasIndex, setRecetasIndex] = useState({
    productos: new Set(),
    pips: new Set(),
  });

  const [form, setForm] = useState({
    tipo: "", // "producto" o "pip"
    id_seleccion: "", // id del producto base o materia prima
    id_bodega: "",
    peso_objetivo: "",
  });

  const seleccionActual = useMemo(() => {
    if (form.tipo === "producto" && form.id_seleccion) {
      return productosBase.find((p) => String(p.id) === String(form.id_seleccion)) || null;
    } else if (form.tipo === "pip" && form.id_seleccion) {
      return pips.find((p) => String(p.id) === String(form.id_seleccion)) || null;
    }
    return null;
  }, [form.tipo, form.id_seleccion, productosBase, pips]);

  const unidadObjetivo = seleccionActual?.unidad_medida || "";

  const [disponibilidad, setDisponibilidad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [missingModalOpen, setMissingModalOpen] = useState(false);
  const [missingDescription, setMissingDescription] = useState("");

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const idElaborador = useMemo(() => {
    if (user?.id) return Number(user.id);
    try {
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) return undefined;
      const decoded = jwtDecode(token);
      return Number(decoded?.id ?? decoded?.sub);
    } catch {
      return undefined;
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const [prodBase, pipsList, bod, recetasRes] = await Promise.all([
          apiFetch(`/productos-base`),
          apiFetch(`/materias-primas`),
          apiFetch(`/bodegas`),
          apiFetch(`/recetas`),
        ]);
        
        const productosBaseList = Array.isArray(prodBase) ? prodBase : prodBase?.productosBase ?? [];
        const pipsList2 = Array.isArray(pipsList) ? pipsList : pipsList?.materiasPrimas ?? [];
        const bodegasList = Array.isArray(bod) ? bod : bod?.bodegas ?? [];
        const recetasList = Array.isArray(recetasRes) ? recetasRes : recetasRes?.recetas ?? [];
        
        setProductosBase(productosBaseList);
        setPips(pipsList2);
        setBodegas(bodegasList.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));

        const productos = new Set();
        const pipsSet = new Set();

        recetasList.forEach((r) => {
          if (r?.id_producto_base != null) {
            productos.add(String(r.id_producto_base));
          }
          if (r?.id_materia_prima != null) {
            pipsSet.add(String(r.id_materia_prima));
          }
        });

        setRecetasIndex({ productos, pips: pipsSet });
      } catch {
        toast.error("Error cargando datos iniciales.");
      }
    })();
  }, [apiFetch]);

  const productoOptions = useMemo(() => {
    return (productosBase || [])
      .filter((p) => recetasIndex.productos.has(String(p.id)))
      .map((p) => ({
        value: String(p.id),
        label: p.nombre ?? `Producto ${p.id}`,
        searchText: insumoToSearchText(p),
      }));
  }, [productosBase, recetasIndex.productos]);

  const pipOptions = useMemo(() => {
    return (pips || [])
      .filter((p) => recetasIndex.pips.has(String(p.id)))
      .map((p) => ({
        value: String(p.id),
        label: p.nombre ?? `PIP ${p.id}`,
        category: p?.categoria?.nombre || "Sin categoría",
        searchText: insumoToSearchText(p),
      }));
  }, [pips, recetasIndex.pips]);

  const checkAvailability = async ({ silent = false } = {}) => {
    setError(null);
    setDisponibilidad(null);

    if (!form.tipo || !form.id_seleccion || !form.id_bodega || !form.peso_objetivo) {
      if (!silent) {
        toast.error("Selecciona tipo, producto/PIP, bodega y peso objetivo.");
      }
      return;
    }

    try {
      const params = {
        id_bodega: String(form.id_bodega),
        peso_objetivo: String(Number(form.peso_objetivo)),
      };

      if (form.tipo === "producto") {
        params.id_producto_base = String(form.id_seleccion);
      } else if (form.tipo === "pip") {
        params.id_materia_prima = String(form.id_seleccion);
      }

      const qs = new URLSearchParams(params).toString();

      const res = await apiFetch(`/ordenes_manufactura/disponibilidad?${qs}`, {
        method: "GET",
      });
      const disponibilidadData = res?.disponibilidad ?? res;
      setDisponibilidad(disponibilidadData);
      return disponibilidadData;
    } catch (e) {
      if (!silent) {
        toast.error(
          e?.body?.error || e?.message || "Error al consultar disponibilidad."
        );
      }
      return null;
    }
  };

  useEffect(() => {
    const ready = Boolean(
      form.tipo && form.id_seleccion && form.id_bodega && form.peso_objetivo
    );

    if (!ready) {
      setDisponibilidad(null);
      return;
    }

    const timer = setTimeout(() => {
      checkAvailability({ silent: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [form.tipo, form.id_seleccion, form.id_bodega, form.peso_objetivo]);

  const disponibilidadNormalizada = useMemo(() => {
    if (!disponibilidad) {
      return { ingredientes: [], costosSecos: null, fallback: null };
    }

    if (Array.isArray(disponibilidad)) {
      return { ingredientes: disponibilidad, costosSecos: null, fallback: null };
    }

    if (typeof disponibilidad === "object") {
      const ingredientesRaw =
        disponibilidad.ingredientes ||
        disponibilidad.insumos ||
        disponibilidad.registros ||
        [];
      const ingredientes = Array.isArray(ingredientesRaw) ? ingredientesRaw : [];
      const costosSecos =
        disponibilidad.costos_secos || disponibilidad.costosSecos || null;

      if (Array.isArray(ingredientesRaw)) {
        return { ingredientes, costosSecos, fallback: null };
      }

      return {
        ingredientes: [],
        costosSecos,
        fallback: disponibilidad,
      };
    }

    return { ingredientes: [], costosSecos: null, fallback: disponibilidad };
  }, [disponibilidad]);

  const buildMissingItems = (data) => {
    if (!data) return [];

    const ingredientes = Array.isArray(data.ingredientes)
      ? data.ingredientes
      : Array.isArray(data.insumos)
        ? data.insumos
        : Array.isArray(data.registros)
          ? data.registros
          : [];

    const costosSecos = data.costos_secos || data.costosSecos || null;
    const missing = [];

    ingredientes.forEach((item, index) => {
      const cantidadNecesaria =
        item.peso_necesario ??
        item.cantidad_necesaria ??
        item.cantidadNecesaria ??
        item.necesario ??
        item.pesoNecesario ??
        0;
      const cantidadDisponible =
        item.peso_disponible ??
        item.cantidad_disponible ??
        item.cantidadDisponible ??
        item.disponible ??
        item.pesoDisponible ??
        0;

      if (Number(cantidadDisponible) >= Number(cantidadNecesaria)) return;

      const unidadItem =
        item.unidad_medida ??
        item.ingrediente?.unidad_medida ??
        item.ingredienteReceta?.unidad_medida ??
        item.materiaPrima?.unidad_medida ??
        item.ingrediente?.materiaPrima?.unidad_medida ??
        "";

      let nombreInsumo =
        item.materiaPrima?.nombre ??
        item.ingredienteReceta?.materiaPrima?.nombre ??
        item.ingrediente?.materiaPrima?.nombre ??
        item.ingrediente?.materia_prima?.nombre ??
        item.materia_prima?.nombre ??
        item.nombre ??
        item.ingrediente?.nombre ??
        item.descripcion ??
        item.key;

      if (!nombreInsumo) {
        nombreInsumo = `Insumo ${index + 1}`;
      }

      missing.push({
        nombre: nombreInsumo,
        necesario: Number(cantidadNecesaria || 0),
        disponible: Number(cantidadDisponible || 0),
        unidad: unidadItem,
        origen: "Ingrediente",
      });
    });

    if (costosSecos && Array.isArray(costosSecos.formatos)) {
      costosSecos.formatos.forEach((formato) => {
        const insumos = Array.isArray(formato?.insumos) ? formato.insumos : [];
        insumos.forEach((insumo) => {
          if (insumo?.opcional) return;
          if (insumo?.suficiente !== false) return;

          const mp = insumo?.materia_prima || {};
          missing.push({
            nombre: mp?.nombre || "Insumo de empaque",
            necesario: Number(insumo?.cantidad_necesaria || 0),
            disponible: Number(insumo?.cantidad_disponible || 0),
            unidad: mp?.unidad_medida || "",
            origen: `Empaque: ${formato?.nombre || "Formato"}`,
          });
        });
      });
    }

    return missing;
  };

  const buildMissingDescription = (items) => {
    if (!Array.isArray(items) || items.length === 0) return "";
    const lines = items.map((i) => {
      const unidad = i.unidad ? ` ${i.unidad}` : "";
      return `• ${i.nombre} (${i.origen}) → Necesario: ${i.necesario}${unidad} | Disponible: ${i.disponible}${unidad}`;
    });

    return [
      "No hay disponibilidad completa para iniciar la OM.",
      "", 
      "Insumos faltantes:",
      ...lines,
    ].join("\n");
  };

  const submitOm = async ({ ignoreAvailability = false } = {}) => {
    setError(null);
    setSuccess(null);

    if (!idElaborador) {
      toast.error(
        "No se pudo identificar al elaborador. Inicia sesión nuevamente."
      );
      return;
    }

    if (!form.tipo || !form.id_seleccion) {
      toast.error("Debe seleccionar un Producto o PIP.");
      return;
    }

    if (!ignoreAvailability) {
      const data = disponibilidad || (await checkAvailability({ silent: true }));
      const missing = buildMissingItems(data || {});
      if (missing.length > 0) {
        setMissingDescription(buildMissingDescription(missing));
        setMissingModalOpen(true);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        id_elaborador_encargado: Number(idElaborador),
        id_bodega: Number(form.id_bodega),
        peso_objetivo: Number(form.peso_objetivo),
      };

      if (form.tipo === "producto") {
        payload.id_producto_base = Number(form.id_seleccion);
      } else if (form.tipo === "pip") {
        payload.id_materia_prima = Number(form.id_seleccion);
      }

      const nuevaOM = await apiFetch(`/ordenes_manufactura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success("Orden de Manufactura creada con éxito.");

      const omId = nuevaOM?.id ?? nuevaOM?.nuevaProduccion?.id;

      if (omId) {
        navigate(`/Orden_de_Manufactura/${omId}`);
      } else {
        navigate("/Orden_de_Manufactura");
      }
    } catch (e) {
      toast.error(e?.body?.error || e?.message || "Error al crear la OM.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitOm();
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Orden_de_Manufactura" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Crear Orden de Manufactura</h1>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-3 text-sm text-green-700">{success}</div>}

      <div className="bg-gray-200 p-4 rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow p-6">
          <div>
            <label className="block text-sm font-medium mb-1">¿Qué deseas producir?</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tipo"
                  value="producto"
                  checked={form.tipo === "producto"}
                  onChange={(e) => {
                    setField("tipo", e.target.value);
                    setField("id_seleccion", "");
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Producto Comercial</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tipo"
                  value="pip"
                  checked={form.tipo === "pip"}
                  onChange={(e) => {
                    setField("tipo", e.target.value);
                    setField("id_seleccion", "");
                  }}
                  className="mr-2"
                />
                <span className="text-sm">PIP (Producto en Proceso)</span>
              </label>
            </div>
          </div>

          {form.tipo === "producto" && (
            <div>
              <label className="block text-sm font-medium mb-1">Producto Comercial</label>
              <Selector
                options={productoOptions}
                selectedValue={form.id_seleccion}
                onSelect={(value) => setField("id_seleccion", value)}
                useFuzzy
                className="border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              {productoOptions.length === 0 ? (
                <p className="text-xs text-gray-500 mt-1">
                  No hay productos con receta asociada.
                </p>
              ) : null}
            </div>
          )}

          {form.tipo === "pip" && (
            <div>
              <label className="block text-sm font-medium mb-1">PIP (Producto en Proceso)</label>
              <Selector
                options={pipOptions}
                selectedValue={form.id_seleccion}
                onSelect={(value) => setField("id_seleccion", value)}
                useFuzzy
                groupBy="category"
                className="border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              {pipOptions.length === 0 ? (
                <p className="text-xs text-gray-500 mt-1">
                  No hay PIPs con receta asociada.
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Bodega</label>
            <select
              value={form.id_bodega}
              onChange={(e) => setField("id_bodega", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">Selecciona una bodega</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre ?? `Bodega ${b.id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Cantidad Objetivo{unidadObjetivo ? ` (${unidadObjetivo})` : ""}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.peso_objetivo}
              onChange={(e) => setField("peso_objetivo", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder={unidadObjetivo === "unidades" ? "Ej: 100" : "Ej: 1000"}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !idElaborador}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-hover disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear Orden de Manufactura"}
            </button>
          </div>
        </form>
      </div>

      {disponibilidad && (
        <div className="mt-6 bg-gray-200 p-4 rounded-lg">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-4 text-lg text-text">Disponibilidad de insumos</h2>

            {disponibilidadNormalizada.ingredientes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Insumo</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Necesaria</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Disponible</th>
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disponibilidadNormalizada.ingredientes.map((item, index) => {
                      const cantidadNecesaria =
                        item.peso_necesario ??
                        item.cantidad_necesaria ??
                        item.cantidadNecesaria ??
                        item.necesario ??
                        item.pesoNecesario ??
                        0;
                      const cantidadDisponible =
                        item.peso_disponible ??
                        item.cantidad_disponible ??
                        item.cantidadDisponible ??
                        item.disponible ??
                        item.pesoDisponible ??
                        0;

                      const unidadItem =
                        item.unidad_medida ??
                        item.ingrediente?.unidad_medida ??
                        item.ingredienteReceta?.unidad_medida ??
                        item.materiaPrima?.unidad_medida ??
                        item.ingrediente?.materiaPrima?.unidad_medida ??
                        "";

                      let nombreInsumo =
                        item.materiaPrima?.nombre ??
                        item.ingredienteReceta?.materiaPrima?.nombre ??
                        item.ingrediente?.materiaPrima?.nombre ??
                        item.ingrediente?.materia_prima?.nombre ??
                        item.materia_prima?.nombre ??
                        item.nombre ??
                        item.ingrediente?.nombre ??
                        item.descripcion ??
                        item.key;

                      if (!nombreInsumo) {
                        nombreInsumo = `Insumo ${index + 1}`;
                      }

                      const disponible =
                        Number(cantidadDisponible) >= Number(cantidadNecesaria);

                      return (
                        <tr key={index} className={disponible ? "bg-green-50" : "bg-red-50"}>
                          <td className="border border-gray-300 px-4 py-2 text-sm">{nombreInsumo}</td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            {formatNumberCL(Number(cantidadNecesaria || 0), 2)}
                            {unidadItem ? ` ${unidadItem}` : ""}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            {formatNumberCL(Number(cantidadDisponible || 0), 2)}
                            {unidadItem ? ` ${unidadItem}` : ""}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                disponible
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {disponible ? "✓ Disponible" : "✗ Insuficiente"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-600">No hay ingredientes para evaluar.</div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text">Costos secos (formatos de empaque)</h3>
                <span className="text-xs text-gray-500">
                  {disponibilidadNormalizada.costosSecos?.es_pt ? "PT" : "PIP"}
                </span>
              </div>

              {Array.isArray(disponibilidadNormalizada.costosSecos?.formatos) &&
              disponibilidadNormalizada.costosSecos.formatos.length > 0 ? (
                <div className="space-y-3">
                  {disponibilidadNormalizada.costosSecos.formatos.map((formato) => (
                    <div key={formato.id} className="border border-border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-text">{formato.nombre}</div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            formato.disponible
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {formato.disponible ? "✓ Disponible" : "✗ Insuficiente"}
                        </span>
                      </div>

                      {Array.isArray(formato.insumos) && formato.insumos.length > 0 ? (
                        <div className="overflow-x-auto mt-3">
                          <table className="min-w-full border-collapse border border-gray-300">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Insumo</th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Necesaria</th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Disponible</th>
                                <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formato.insumos.map((insumo, idx) => {
                                const mp = insumo?.materia_prima || {};
                                const necesario = Number(insumo?.cantidad_necesaria || 0);
                                const disponible = Number(insumo?.cantidad_disponible || 0);
                                const unidad = mp?.unidad_medida ? ` ${mp.unidad_medida}` : "";
                                const suficiente = insumo?.suficiente !== false;

                                return (
                                  <tr key={idx} className={suficiente ? "bg-green-50" : "bg-red-50"}>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      {mp?.nombre || "Insumo"}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      {formatNumberCL(necesario, 2)}{unidad}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      {formatNumberCL(disponible, 2)}{unidad}
                                    </td>
                                    <td className="border border-gray-300 px-4 py-2 text-sm">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          suficiente
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {suficiente ? "✓ Disponible" : "✗ Insuficiente"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 mt-2">
                          Este formato no tiene insumos configurados.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  La receta no tiene formatos de empaque configurados.
                </div>
              )}
            </div>

            {disponibilidadNormalizada.fallback ? (
              <div className="mt-4">
                <pre className="text-sm overflow-auto bg-gray-50 p-4 rounded border">
                  {JSON.stringify(disponibilidadNormalizada.fallback, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={missingModalOpen}
        onClose={() => setMissingModalOpen(false)}
        onConfirm={() => {
          setMissingModalOpen(false);
          submitOm({ ignoreAvailability: true });
        }}
        title="Disponibilidad insuficiente"
        description={missingDescription}
        confirmText="Crear igual"
        cancelText="Volver"
      />
    </div>
  );
}
