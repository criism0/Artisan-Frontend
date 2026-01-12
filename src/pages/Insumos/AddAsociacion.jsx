import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useState, useEffect } from "react";

export default function AddAsociacion() {
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
  const [error, setError] = useState(null);

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
            setBaseNivel({
              formato: base.nombre, // Nombre por defecto, usuario puede cambiarlo a "Botella"
              unidad: base.unidad_medida || "Unidad",
              peso_unitario: "",
              precio_unitario: 0,
              esBase: true,
            });
            setFormData((prev) => ({ ...prev, id_materia_prima: id }));
          }
        }
      } catch (error) {
        toast.error("Error al cargar datos: " + error);
      }
    };
    fetchData();
  }, [id]);

  // Si el usuario selecciona manualmente un insumo
  useEffect(() => {
    if (!formData.id_materia_prima) return;
    const selected = insumos.find((i) => i.id === parseInt(formData.id_materia_prima));
    if (selected) {
      setBaseNivel({
        formato: selected.nombre,
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
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
      if (baseNivel.isExisting) {
        idHijoAnterior = extendFrom?.id ?? baseNivel.id;
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

      let precioAcumulado = baseNivel.isExisting
        ? (Number(extendFrom?.precio_unitario) || Number(baseNivel?.precio_unitario) || 0)
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
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={id ? `/Insumos/${id}` : "/Insumos"} />
      <h1 className="text-2xl font-bold text-text mb-6">Asociar Insumo con Proveedor</h1>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Proveedor *</label>
          <select
            name="id_proveedor"
            value={formData.id_proveedor}
            onChange={handleChange}
            disabled={!!(searchParams.get("proveedor") || searchParams.get("id_proveedor") || searchParams.get("proveedorId"))}
            className={`w-full border rounded-lg px-3 py-2 ${errors.id_proveedor ? "border-red-500" : "border-gray-300"}`}
          >
            <option value="">Seleccionar proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_empresa}</option>
            ))}
          </select>
          {errors.id_proveedor && <p className="text-red-500 text-sm mt-1">{errors.id_proveedor}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Insumo *</label>
            <select
              name="id_materia_prima"
              value={formData.id_materia_prima}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${errors.id_materia_prima ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">Seleccionar insumo</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre}</option>
              ))}
            </select>
            {errors.id_materia_prima && <p className="text-red-500 text-sm mt-1">{errors.id_materia_prima}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Moneda/Divisa *</label>
            <select
              name="moneda"
              value={formData.moneda}
              onChange={handleChange}
              disabled={!!baseNivel?.isExisting}
              className={`w-full border rounded-lg px-3 py-2 ${errors.moneda ? "border-red-500" : "border-gray-300"}`}
            >
              <option value="">Seleccionar</option>
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UF">UF</option>
            </select>
            {errors.moneda && <p className="text-red-500 text-sm mt-1">{errors.moneda}</p>}
          </div>
        </div>

        {/* === ASOCIACIONES EXISTENTES === */}
        {asociacionesExistentes?.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-700 mb-2">Asociaciones existentes</h3>
            <p className="text-sm text-gray-500 mb-3">
              Puedes editar una asociación existente. Para extender la cadena, agrega nuevos formatos más abajo.
            </p>

            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">FORMATO</th>
                  <th className="px-3 py-2 text-left">CONTENIDO</th>
                  <th className="px-3 py-2 text-left">COSTO</th>
                  <th className="px-3 py-2 text-left">MONEDA</th>
                  <th className="px-3 py-2 text-left">BASE</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {[...asociacionesExistentes]
                  .sort((a, b) => (a.cantidad_por_formato || 0) - (b.cantidad_por_formato || 0))
                  .map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 font-medium capitalize">{a.formato}</td>
                      <td className="px-3 py-2">{a.cantidad_por_formato} {a.unidad_medida}</td>
                      <td className="px-3 py-2">{a.precio_unitario}</td>
                      <td className="px-3 py-2">{a.moneda}</td>
                      <td className="px-3 py-2">{a.es_unidad_consumo ? 'Sí' : 'No'}</td>
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
              </tbody>
            </table>
          </div>
        )}
 
        {/* === PASO 1: FORMATO BASE (UNIDAD DE COSTEO) === */}
        {baseNivel && (
          <div className="mt-6">
            <h3 className="font-semibold text-gray-700 mb-2">Paso 1</h3>
            <p className="text-sm text-gray-500 mb-3">Define la unidad de costeo (formato base). El costo se edita en la tabla resumen.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre formato base</label>
                <input
                  type="text"
                  className="border px-3 py-2 rounded w-full"
                  placeholder="Formato (ej: caja, pallet...)"
                  value={baseNivel.formato}
                  disabled={!!baseNivel.isExisting}
                  onChange={(e) => setBaseNivel({ ...baseNivel, formato: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contenido Formato Base</label>
                <input
                  type="number"
                  step="0.0001"
                  className="border px-3 py-2 rounded w-full"
                  placeholder={`Cantidad de ${baseNivel.unidad} del formato (ej: 0.5, 1, 5...)`}
                  value={baseNivel.peso_unitario}
                  disabled={!!baseNivel.isExisting}
                  onChange={(e) => setBaseNivel({ ...baseNivel, peso_unitario: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* === PASOS 2+: FORMATOS SUPERIORES === */}
        <div id="pasos-formatos" className="mt-6">
          {niveles.map((nivel, idx) => {
            const anterior = idx === 0 ? baseNivel : niveles[idx - 1];
            const anteriorNombre = anterior?.formato || "el insumo";

            return (
              <div key={idx} className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Paso {idx + 2}</h3>

                {nivel.formato ? (
                  <p className="text-sm text-gray-500 mb-2">
                    Cuántas <strong>{anteriorNombre}</strong> vienen por{" "}
                    <strong>{nivel.formato}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mb-2">
                    Indique si <strong>{anteriorNombre}</strong> se vende en un
                    empaque secundario (bolsa, caja, saco, rollo, etc.). De un nombre
                    a este formato.
                  </p>
                )}

                <div className="flex gap-3">
                  <input
                    placeholder="Formato (ej: caja, pallet...)"
                    value={nivel.formato}
                    disabled={!!nivel.isExisting}
                    onChange={(e) => handleNivelChange(idx, "formato", e.target.value)}
                    className="border px-3 py-2 rounded w-1/2"
                  />
                  <input
                    type="number"
                    placeholder={`Cantidad de ${anteriorNombre} por ${nivel.formato || "formato"}`}
                    value={nivel.cantidad}
                    disabled={!!nivel.isExisting}
                    onChange={(e) => handleNivelChange(idx, "cantidad", e.target.value)}
                    className="border px-3 py-2 rounded w-1/2"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* === TABLA RESUMEN === */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">Tabla Resumen</h3>
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">NOMBRE FORMATO</th>
                <th className="px-3 py-2 text-left">RESUMEN DE VALOR POR FORMATO DE EMPAQUE</th>
                <th className="px-3 py-2 text-left">CONTENIDO FORMATO</th>
                <th className="px-3 py-2 text-left">UNIDAD DE MEDIDA FORMATO</th>
                <th className="px-3 py-2 text-left">COSTO FORMATO</th>
              </tr>
            </thead>

            <tbody>
              {/* === Nivel base (insumo) === */}
              {baseNivel && (
                <tr className="border-t bg-gray-50">
                  <td className="px-3 py-2 font-medium">{baseNivel.formato}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">Unidad de Costeo</td>
                  <td className="px-3 py-2 text-center">
                    {baseNivel.peso_unitario ? Number(baseNivel.peso_unitario).toFixed(2) : ""}
                  </td>
                  <td className="px-3 py-2 text-center">{baseNivel.unidad}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      className="border rounded px-2 py-1 w-28 text-right"
                      placeholder="0"
                      value={baseNivelInputValue}
                      disabled={!!baseNivel.isExisting}
                      onChange={(e) => {
                        let inputValue = e.target.value;
                        inputValue = inputValue.replace(/[^0-9,.]/g, '');
                        inputValue = inputValue.replace(/\./g, ',');
                        const parts = inputValue.split(',');
                        if (parts.length > 2) {
                          inputValue = parts[0] + ',' + parts.slice(1).join('');
                        }

                        setBaseNivelInputValue(inputValue);

                        const valorConPunto = inputValue.replace(',', '.');
                        const nuevoPrecio = inputValue === '' || inputValue.endsWith(',')
                          ? (baseNivel?.precio_unitario || 0)
                          : (parseFloat(valorConPunto) || 0);

                        setBaseNivel({ ...baseNivel, precio_unitario: nuevoPrecio });
                      }}
                    />
                  </td>
                </tr>
              )}

              {/* === Niveles dinámicos === */}
              {niveles
                .filter((n) => n.formato && n.cantidad)
                .map((n, i) => {
                  const baseCantidad = parseFloat(baseNivel?.peso_unitario) || 0;
                  const basePrecio = parseFloat(baseNivel?.precio_unitario) || 0;

                  // factorTotal = producto de cantidades desde el primer nivel hasta i
                  const factorTotal = (() => {
                    let total = 1;
                    for (let j = 0; j <= i; j++) {
                      total *= parseFloat(niveles[j].cantidad) || 1;
                    }
                    return total;
                  })();

                  const contenido = baseCantidad * factorTotal;
                  const costo = basePrecio * factorTotal;

                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium capitalize">{n.formato}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        Cada <strong>{n.formato}</strong> contiene {n.cantidad}{" "}
                        <strong>{i === 0 ? baseNivel?.formato : niveles[i - 1]?.formato}</strong>
                      </td>
                      <td className="px-3 py-2 text-center">{contenido ? contenido.toFixed(2) : ""}</td>
                      <td className="px-3 py-2 text-center">{n.unidad}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">
                        {costo ? String(costo).replace('.', ',') : ""}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded">
            Crear Asociación
          </button>
        </div>
      </form>
    </div>
  );
}
