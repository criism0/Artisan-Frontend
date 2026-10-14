import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/UI/PageHeader";
import FormField from "../../components/Forms/FormField";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useState, useEffect } from "react";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function AddAsociacion() {
  const normalizeFormatoBaseFromUnidad = (unidadMedidaRaw) => {
    const raw = (unidadMedidaRaw ?? "").toString().trim();
    if (!raw) return "Unidad";

    const normalized = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Kilogramo
    if (
      normalized === "kg" ||
      normalized === "kgs" ||
      normalized.includes("kilogram") ||
      normalized.includes("kilogr") ||
      normalized.includes("kilo")
    ) {
      return "Kilogramo";
    }

    // Litro
    if (
      normalized === "l" ||
      normalized === "lt" ||
      normalized === "lts" ||
      normalized.includes("litro") ||
      normalized.includes("litros")
    ) {
      return "Litro";
    }

    // Default
    return "Unidad";
  };

  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const api = useApi();
  const [formData, setFormData] = useState({
    id_proveedor: "",
    id_materia_prima: id || "",
    moneda: "CLP",
  });
  const [baseNivel, setBaseNivel] = useState(null); // insumo original
  const [niveles, setNiveles] = useState([]);       // los pasos nuevos (caja, pallet, etc.)
  const [baseNivelInputValue, setBaseNivelInputValue] = useState('');
  const [asociacionesExistentes, setAsociacionesExistentes] = useState([]);
  const [extendFromId, setExtendFromId] = useState(null);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWriteRawMaterialProvider = checkScope(ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE);
  const canReadProvider = checkScope(ModelType.PROVEEDOR, ScopeType.READ);

  // Permite entrar desde Detalle de Proveedor con proveedor preseleccionado
  useEffect(() => {
    const fromQuery =
      searchParams.get("proveedor") ||
      searchParams.get("id_proveedor") ||
      searchParams.get("proveedorId");
    if (!fromQuery) return;
    setFormData((prev) => ({ ...prev, id_proveedor: String(fromQuery) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadProvider) {
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const [provRes, insRes] = await Promise.all([
          api(`/proveedores`),
          api(`/materias-primas`)
        ]);

        const proveedoresData = Array.isArray(provRes?.data) ? provRes.data : provRes;
        const proveedoresActivos = proveedoresData.filter((p) => p.activo === true);
        const insumosData = Array.isArray(insRes?.data) ? insRes.data : insRes;
        const insumosActivos = insumosData.filter((i) => i.activo === true);

        setProveedores(proveedoresActivos);
        setInsumos(insumosActivos);

        if (id) {
          const base = insumosActivos.find((i) => i.id === parseInt(id));
          if (base) {
            // Esta carga (todos los proveedores e insumos) suele terminar DESPUÉS de la consulta de
            // formatos existentes. Si ya llegó, su base real no se pisa con una en blanco: eso hacía
            // que el submit intentara crear de nuevo el formato base («Litro»).
            setBaseNivel((prev) =>
              prev?.isExisting
                ? prev
                : {
                    formato: normalizeFormatoBaseFromUnidad(base.unidad_medida) || "Unidad",
                    unidad: base.unidad_medida || "Unidad",
                    peso_unitario: "",
                    precio_unitario: 0,
                    esBase: true,
                  }
            );
            setFormData((prev) => ({ ...prev, id_materia_prima: id }));
          }
        }
      } catch (error) {
        toast.error("Error al cargar datos: " + error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, canReadProvider]);

  // Si el usuario selecciona manualmente un insumo
  useEffect(() => {
    if (!formData.id_materia_prima) return;
    const selected = insumos.find((i) => i.id === parseInt(formData.id_materia_prima));
    if (selected) {
      setBaseNivel({
        formato: normalizeFormatoBaseFromUnidad(selected.unidad_medida) || "Unidad",
        unidad: selected.unidad_medida || "Unidad",
        peso_unitario: "",
        precio_unitario: 0,
        esBase: true,
      });
      setBaseNivelInputValue('');
    }
  }, [formData.id_materia_prima]);

  // Buscar formatos existentes para permitir extender la cadena
  useEffect(() => {
    const checkExistingFormats = async () => {
      if (!formData.id_proveedor || !formData.id_materia_prima) return;

      try {
        const res = await api(`/proveedor-materia-prima?id_proveedor=${formData.id_proveedor}&id_materia_prima=${formData.id_materia_prima}`, { method: "GET" });
        const formats = Array.isArray(res) ? res : res.data || [];

        setAsociacionesExistentes(formats);

        // Reset selector de extensión si no hay formatos
        if (!formats || formats.length === 0) {
          setExtendFromId(null);
          return;
        }

        if (formats.length > 0) {
          // Base: unidad de consumo
          const unidadConsumo = formats.find((f) => f.es_unidad_consumo);
          const baseExistente = unidadConsumo ||
            [...formats].sort((a, b) => a.cantidad_por_formato - b.cantidad_por_formato)[0];

          // Tops: formatos que NO son hijo de nadie (para extender hacia arriba)
          const childIds = new Set(
            formats
              .map((f) => f.id_formato_hijo)
              .filter((v) => v !== null && v !== undefined)
              .map((v) => Number(v))
          );

          const tops = formats
            .filter((f) => !childIds.has(Number(f.id)))
            .sort((a, b) => (b.cantidad_por_formato || 0) - (a.cantidad_por_formato || 0));

          const defaultExtendFrom = tops[0] || baseExistente;
          setExtendFromId(defaultExtendFrom?.id ?? null);

          setBaseNivel({
            id: baseExistente.id,
            formato: baseExistente.formato,
            unidad: baseExistente.unidad_medida,
            peso_unitario: baseExistente.cantidad_por_formato,
            precio_unitario: baseExistente.precio_unitario,
            esBase: true,
            isExisting: true // Flag para indicar que ya existe y no se debe crear
          });
          setBaseNivelInputValue(baseExistente?.precio_unitario ? String(baseExistente.precio_unitario).replace('.', ',') : '');
          setFormData((prev) => ({ ...prev, moneda: baseExistente.moneda || prev.moneda }));

          // Precargar la cadena existente dentro de los pasos/resumen (como si fuera la primera vez)
          const construirNivelesDesdeTop = (topId) => {
            if (!topId) return [{ formato: "", cantidad: "", unidad: baseExistente.unidad_medida || "Unidad" }];
            const byId = new Map(formats.map((f) => [Number(f.id), f]));

            const seen = new Set();
            const chainDown = [];
            let node = byId.get(Number(topId)) || null;
            while (node && node.id_formato_hijo != null && !seen.has(Number(node.id))) {
              seen.add(Number(node.id));
              chainDown.push(node);
              node = byId.get(Number(node.id_formato_hijo)) || null;
            }

            // chainDown = [top, ..., immediateParentOfBase]; invertimos para base->top
            const chainUp = [...chainDown].reverse();
            const existentes = chainUp.map((n) => ({
              id: n.id,
              formato: n.formato || "",
              cantidad: (n.cantidad_hijos ?? "")?.toString(),
              unidad: n.unidad_medida || (baseExistente.unidad_medida || "Unidad"),
              isExisting: true,
            }));

            return [...existentes, { formato: "", cantidad: "", unidad: baseExistente.unidad_medida || "Unidad" }];
          };

          setNiveles(construirNivelesDesdeTop(defaultExtendFrom?.id ?? null));
        }
      } catch (err) {
        console.error("Error checking existing formats:", err);
      }
    };

    checkExistingFormats();
  }, [formData.id_proveedor, formData.id_materia_prima, api]);

  // Si el usuario cambia el "extender desde", reconstruimos los pasos/resumen con la cadena existente
  useEffect(() => {
    if (!baseNivel?.isExisting) return;
    if (!asociacionesExistentes?.length) return;
    if (!extendFromId) return;

    const byId = new Map(asociacionesExistentes.map((f) => [Number(f.id), f]));
    const seen = new Set();
    const chainDown = [];
    let node = byId.get(Number(extendFromId)) || null;
    while (node && node.id_formato_hijo != null && !seen.has(Number(node.id))) {
      seen.add(Number(node.id));
      chainDown.push(node);
      node = byId.get(Number(node.id_formato_hijo)) || null;
    }

    const chainUp = [...chainDown].reverse();
    const existentes = chainUp.map((n) => ({
      id: n.id,
      formato: n.formato || "",
      cantidad: (n.cantidad_hijos ?? "")?.toString(),
      unidad: n.unidad_medida || (baseNivel?.unidad || "Unidad"),
      isExisting: true,
    }));

    setNiveles((prev) => {
      // Si el usuario ya empezó a escribir nuevos niveles, los preservamos pegándolos al final.
      const nuevos = (prev || []).filter((n) => !n?.isExisting);
      const baseUnidad = baseNivel?.unidad || "Unidad";
      const nuevoFilaVacia = { formato: "", cantidad: "", unidad: baseUnidad };
      const nuevosConDatos = nuevos
        .filter((n) => n && (String(n.formato || "").trim() !== "" || String(n.cantidad || "").trim() !== ""))
        .map((n) => ({ ...n, unidad: n.unidad || baseUnidad }));

      return [...existentes, ...nuevosConDatos, nuevoFilaVacia];
    });
  }, [extendFromId, baseNivel?.isExisting, baseNivel?.unidad, asociacionesExistentes]);

  // Resetear input value cuando cambia baseNivel desde fuera
  useEffect(() => {
    if (baseNivel && baseNivelInputValue === '') {
      setBaseNivelInputValue(baseNivel?.precio_unitario ? String(baseNivel.precio_unitario).replace('.', ',') : '');
    }
  }, [baseNivel?.precio_unitario]);
  
  // Si ya existe el insumo base y no hay pasos creados, iniciamos el Paso 1 vacío
  useEffect(() => {
    if (baseNivel && niveles.length === 0 && !baseNivel.isExisting) {
      setNiveles([{ formato: "", cantidad: "", unidad: baseNivel.unidad }]);
    }
  }, [baseNivel]);

  const handleNivelChange = (index, field, value) => {
    const nuevos = [...niveles];
    nuevos[index][field] = value;

    if (
      nuevos[index].formato &&
      nuevos[index].cantidad &&
      !niveles[index + 1]
    ) {
      nuevos.push({
        formato: "",
        cantidad: "",
        unidad: baseNivel?.unidad || "Unidad",
      });
    }

    setNiveles(nuevos);
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.id_proveedor) newErrors.id_proveedor = "Debe seleccionar un proveedor.";
    if (!formData.id_materia_prima) newErrors.id_materia_prima = "Debe seleccionar un insumo.";
    if (!formData.moneda) newErrors.moneda = "Debe seleccionar una moneda.";
    //if (!formData.lead_time) newErrors.lead_time = "Debe ingresar el lead time en días.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!canWriteRawMaterialProvider) {
      toast.permissionError([ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE]);
      setIsSubmitting(false);
      return;
    }

    try {
      setIsSubmitting(true);
      if (!baseNivel || !baseNivel.formato || baseNivel.formato.trim() === '') {
        toast.error("Debe ingresar un nombre para el formato base.");
        return;
      }
      if (!baseNivel.peso_unitario || parseFloat(baseNivel.peso_unitario) <= 0) {
        toast.error("Debe ingresar el contenido (peso unitario) del formato base.");
        return;
      }
      if (!baseNivel.precio_unitario || parseFloat(baseNivel.precio_unitario) <= 0) {
        toast.error("Debe ingresar el costo del formato base.");
        return;
      }

      const materiaPrimaId = parseInt(formData.id_materia_prima);

      // Crear cada asociación
      // Modificación: Ahora se crean secuencialmente y se enlazan con id_formato_hijo
      let idHijoAnterior = null;

      const extendFrom = asociacionesExistentes?.find((a) => Number(a.id) === Number(extendFromId)) || null;

      // 1. Crear la unidad de consumo (base) O usar existente
      // Si el proveedor ya tiene un formato con ese nombre, se reutiliza en vez de crearlo otra vez
      // (el backend lo rechaza), aunque la pantalla no lo haya marcado como existente.
      const nombreBase = String(baseNivel.formato || "").trim().toLowerCase();
      const baseYaRegistrada = baseNivel.isExisting
        ? null
        : asociacionesExistentes?.find((a) => String(a.formato || "").trim().toLowerCase() === nombreBase);
      if (baseNivel.isExisting) {
        idHijoAnterior = extendFrom?.id ?? baseNivel.id;
      } else if (baseYaRegistrada) {
        idHijoAnterior = extendFrom?.id ?? baseYaRegistrada.id;
      } else {
        const basePayload = {
          id_proveedor: parseInt(formData.id_proveedor),
          id_materia_prima: materiaPrimaId,
          formato: baseNivel.formato,
          peso_unitario: parseFloat(baseNivel.peso_unitario),
          precio_unitario: parseFloat(baseNivel.precio_unitario) || 0,
          moneda: formData.moneda,
          unidad_medida: baseNivel.unidad,
          es_unidad_consumo: true,
          cantidad_hijos: 1,
          id_formato_hijo: null
        };

        const baseResponse = await api(`/proveedor-materia-prima`, {
          method: "POST",
          body: JSON.stringify(basePayload),
        });
        
        if (baseResponse && baseResponse.id) {
          idHijoAnterior = baseResponse.id;
        } else {
          throw new Error("Error al crear la unidad base");
        }
      }

      // 2. Crear los niveles superiores (solo los nuevos)
      const nivelesValidos = niveles
        .filter((n) => n.formato && n.cantidad)
        .filter((n) => !n.isExisting);

      let precioAcumulado = baseNivel.isExisting || baseYaRegistrada
        ? (Number(extendFrom?.precio_unitario) || Number(baseYaRegistrada?.precio_unitario) || Number(baseNivel?.precio_unitario) || 0)
        : (parseFloat(baseNivel.precio_unitario) || 0);
      
      for (const nivel of nivelesValidos) {
        const cantidadHijos = parseFloat(nivel.cantidad);
        precioAcumulado = precioAcumulado * cantidadHijos;
        const precioNivel = precioAcumulado;

        const nivelPayload = {
          id_proveedor: parseInt(formData.id_proveedor),
          id_materia_prima: materiaPrimaId,
          formato: nivel.formato,
          precio_unitario: precioNivel,
          moneda: formData.moneda,
          unidad_medida: nivel.unidad,
          es_unidad_consumo: false,
          cantidad_hijos: cantidadHijos,
          id_formato_hijo: idHijoAnterior
        };

        const nivelResponse = await api(`/proveedor-materia-prima`, {
          method: "POST",
          body: JSON.stringify(nivelPayload),
        });

        if (nivelResponse && nivelResponse.id) {
          idHijoAnterior = nivelResponse.id;
        } else {
           throw new Error(`Error al crear el formato ${nivel.formato}`);
        }
      }

      toast.success("Asociaciones creadas correctamente");
      navigate(`/Insumos/${formData.id_materia_prima}`);
    } catch (error) {
      toast.error("Error al crear las asociaciones: " + error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fmt = (n) =>
    Number(n).toLocaleString("es-CL", { maximumFractionDigits: 4 });

  const onSelect = (name) => (e) => setFormData((prev) => ({ ...prev, [name]: e.target.value }));

  const onCostoBase = (e) => {
    let inputValue = e.target.value;
    inputValue = inputValue.replace(/[^0-9,.]/g, "");
    inputValue = inputValue.replace(/\./g, ",");
    const parts = inputValue.split(",");
    if (parts.length > 2) {
      inputValue = parts[0] + "," + parts.slice(1).join("");
    }

    setBaseNivelInputValue(inputValue);

    const valorConPunto = inputValue.replace(",", ".");
    const nuevoPrecio =
      inputValue === "" || inputValue.endsWith(",")
        ? baseNivel?.precio_unitario || 0
        : parseFloat(valorConPunto) || 0;

    setBaseNivel({ ...baseNivel, precio_unitario: nuevoPrecio });
  };

  if (isLoading) return <PageLoader message="Cargando datos" />;

  const bloqueadoProveedor = !!(
    searchParams.get("proveedor") ||
    searchParams.get("id_proveedor") ||
    searchParams.get("proveedorId")
  );
  const baseNueva = !!baseNivel && !baseNivel.isExisting;
  const existentes = [...asociacionesExistentes].sort(
    (a, b) => (a.cantidad_por_formato || 0) - (b.cantidad_por_formato || 0)
  );
  const nombreDe = (idFormato) =>
    asociacionesExistentes.find((a) => Number(a.id) === Number(idFormato))?.formato || "";

  // Contenido y costo de cada fila nueva: se acumulan desde la base por la cadena de niveles
  // (los existentes cuentan en el factor, pero se muestran arriba, en su propia fila).
  const baseCantidad = parseFloat(baseNivel?.peso_unitario) || 0;
  const basePrecio = parseFloat(baseNivel?.precio_unitario) || 0;
  let factor = 1;
  const filasNuevas = niveles
    .map((n, idx) => {
      factor *= parseFloat(n.cantidad) || 1;
      return {
        n,
        idx,
        anterior: (idx === 0 ? baseNivel?.formato : niveles[idx - 1]?.formato) || "el insumo",
        contenido: baseCantidad * factor,
        costo: basePrecio * factor,
      };
    })
    .filter(({ n }) => !n.isExisting);

  const ultimoFormato =
    [...niveles].reverse().find((n) => n.formato)?.formato || baseNivel?.formato || "el formato base";
  const ayuda = existentes.length
    ? `Para agregar un formato, escribe su nombre y cuántos ${ultimoFormato} contiene. El contenido y el costo se calculan solos.`
    : "Define el formato base (la unidad de costeo) y, si se vende en empaques mayores, agrégalos en la fila de abajo.";

  const inputCelda =
    "border border-gray-300 rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-primary transition-colors";

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}

      <PageHeader
        volverA={id ? `/Insumos/${id}` : "/Insumos"}
        titulo="Asociar Insumo con Proveedor"
        subtitulo="El formato base es la unidad de costeo y de consumo; los formatos superiores (caja, bidón, pallet…) lo contienen."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800">Proveedor e insumo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField
              label="Proveedor"
              required
              type="select"
              value={formData.id_proveedor}
              onChange={onSelect("id_proveedor")}
              disabled={bloqueadoProveedor}
              error={errors.id_proveedor}
              options={proveedores.map((p) => ({ value: p.id, label: p.nombre_empresa }))}
            />
            <FormField
              label="Insumo"
              required
              type="select"
              value={formData.id_materia_prima}
              onChange={onSelect("id_materia_prima")}
              error={errors.id_materia_prima}
              options={insumos.map((i) => ({ value: i.id, label: i.nombre }))}
            />
            <FormField
              label="Moneda"
              required
              type="select"
              value={formData.moneda}
              onChange={onSelect("moneda")}
              disabled={!!baseNivel?.isExisting}
              error={errors.moneda}
              options={["CLP", "USD", "EUR", "UF"].map((m) => ({ value: m, label: m }))}
            />
          </div>
        </section>

        {baseNivel && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800">Formatos de compra</h2>
            <p className="text-sm text-gray-500 mt-0.5">{ayuda}</p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Formato</th>
                    <th className="px-3 py-2 text-left font-medium">Contiene</th>
                    <th className="px-3 py-2 text-left font-medium">Contenido total</th>
                    <th className="px-3 py-2 text-left font-medium">Costo{formData.moneda ? ` (${formData.moneda})` : ""}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {existentes.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 font-medium capitalize">
                        {a.formato}
                        {a.es_unidad_consumo && (
                          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Base
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {a.es_unidad_consumo
                          ? "Unidad de costeo"
                          : `${fmt(a.cantidad_hijos)} ${nombreDe(a.id_formato_hijo)}`}
                      </td>
                      <td className="px-3 py-2">
                        {fmt(a.cantidad_por_formato)} {a.unidad_medida}
                      </td>
                      <td className="px-3 py-2">{fmt(a.precio_unitario)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => navigate(`/Insumos/asociar/edit/${a.id}`)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {baseNueva && (
                    <tr className="border-t bg-gray-50/60">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className={inputCelda}
                          placeholder="Formato base (ej: Litro)"
                          value={baseNivel.formato}
                          onChange={(e) => setBaseNivel({ ...baseNivel, formato: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-600">Unidad de costeo</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.0001"
                            className={`${inputCelda} w-28`}
                            placeholder="Ej: 1"
                            value={baseNivel.peso_unitario}
                            onChange={(e) => setBaseNivel({ ...baseNivel, peso_unitario: e.target.value })}
                          />
                          <span className="text-gray-500">{baseNivel.unidad}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className={`${inputCelda} w-32 text-right`}
                          placeholder="0"
                          value={baseNivelInputValue}
                          onChange={onCostoBase}
                        />
                      </td>
                      <td></td>
                    </tr>
                  )}

                  {filasNuevas.map(({ n, idx, anterior, contenido, costo }) => {
                    const completa = n.formato && n.cantidad;
                    return (
                      <tr key={idx} className="border-t bg-gray-50/60">
                        <td className="px-3 py-2">
                          <input
                            className={inputCelda}
                            placeholder="Nuevo formato (ej: Bidón)"
                            value={n.formato}
                            onChange={(e) => handleNivelChange(idx, "formato", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className={`${inputCelda} w-24`}
                              placeholder="Cant."
                              value={n.cantidad}
                              onChange={(e) => handleNivelChange(idx, "cantidad", e.target.value)}
                            />
                            <span className="text-gray-500 capitalize">{anterior}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {completa && contenido ? `${fmt(contenido)} ${n.unidad}` : ""}
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-medium">
                          {completa && costo ? fmt(costo) : ""}
                        </td>
                        <td></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(id ? `/Insumos/${id}` : "/Insumos")}
            className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {isSubmitting ? "Creando..." : "Crear Asociación"}
          </button>
        </div>
      </form>
    </div>
  );
}
