import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useState, useEffect } from "react";

export default function AddAsociacion() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const api = useApi();
  const [formData, setFormData] = useState({
    id_proveedor: "",
    id_materia_prima: id || "",
    peso_unitario: "",
    precio_unitario: "",
    moneda: "CLP",
    formato: ""
  });
  const [baseNivel, setBaseNivel] = useState(null); // insumo original
  const [niveles, setNiveles] = useState([]);       // los pasos nuevos (caja, pallet, etc.)
  const [baseNivelInputValue, setBaseNivelInputValue] = useState('');
  const [nivelesInputValues, setNivelesInputValues] = useState({});

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [filteredInsumos, setFilteredInsumos] = useState([]);

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
        setFilteredInsumos(insumosActivos);

        if (id) {
          const base = insumosActivos.find((i) => i.id === parseInt(id));
          if (base) {
            setBaseNivel({
              formato: base.nombre,
              cantidad: 1,
              unidad: base.unidad_medida || "Unidad",
              valor_formato: 0,
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
        cantidad: 1,
        unidad: selected.unidad_medida || "Unidad",
        valor_formato: 0,
        esBase: true,
      });
      setBaseNivelInputValue('');
    }
  }, [formData.id_materia_prima]);

  // Resetear input value cuando cambia baseNivel desde fuera
  useEffect(() => {
    if (baseNivel && baseNivelInputValue === '') {
      setBaseNivelInputValue(baseNivel.valor_formato ? String(baseNivel.valor_formato).replace('.', ',') : '');
    }
  }, [baseNivel?.valor_formato]);
  
  // Si ya existe el insumo base y no hay pasos creados, iniciamos el Paso 1 vacío
  useEffect(() => {
    if (baseNivel && niveles.length === 0) {
      setNiveles([{ formato: "", cantidad: "", unidad: baseNivel.unidad, valor_formato: 0 }]);
    }
  }, [baseNivel]);

  const handleNivelChange = (index, field, value) => {
    const nuevos = [...niveles];
    nuevos[index][field] = value;

    const prevValue =
      index === 0
        ? baseNivel?.valor_formato || 0
        : nuevos[index - 1]?.valor_formato || 0;

    if (field === "cantidad" && nuevos[index].cantidad && prevValue) {
      nuevos[index].valor_formato =
        parseFloat(nuevos[index].cantidad) * prevValue;
    }

    if (
      nuevos[index].formato &&
      nuevos[index].cantidad &&
      !niveles[index + 1]
    ) {
      nuevos.push({
        formato: "",
        cantidad: "",
        unidad: baseNivel?.unidad || "Unidad",
        valor_formato: 0,
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
      const selectedInsumo = insumos.find(
        (i) => i.id === parseInt(formData.id_materia_prima)
      );

      if (!baseNivel || baseNivel.valor_formato <= 0) {
        toast.error("Debe ingresar un valor para el insumo base.");
        return;
      }

      // Obtener asociaciones existentes (misma ruta que InsumoDetail.jsx)
      const materiaPrimaId = parseInt(formData.id_materia_prima);
      const asociaciones = [
        {
          id_proveedor: parseInt(formData.id_proveedor),
          id_materia_prima: materiaPrimaId,
          formato: baseNivel.formato,
          cantidad_por_formato: 1,
          peso_unitario: 1,
          unidad_medida: baseNivel.unidad,
          precio_unitario: parseFloat(baseNivel.valor_formato),
          moneda: formData.moneda,
        },
          ...niveles
            .filter((n) => n.formato && n.cantidad)
            .map((n, i) => {
              // Calculamos la cantidad total acumulada
              let peso_unitario = parseFloat(n.cantidad) || 0;
              for (let j = i - 1; j >= 0; j--) {
                peso_unitario *= parseFloat(niveles[j].cantidad) || 1;
              }
              // incluye base
              if (baseNivel?.cantidad) peso_unitario *= baseNivel.cantidad || 1;

              return {
                id_proveedor: parseInt(formData.id_proveedor),
                id_materia_prima: materiaPrimaId,
                formato: n.formato,
                peso_unitario, // valor acumulado (recursivo)
                unidad_medida: n.unidad,
                precio_unitario: parseFloat(n.valor_formato) || 0,
                moneda: formData.moneda,
              };
            }),
        ];

      // Crear cada asociación
      for (const asociacion of asociaciones) {
        await api(`/proveedor-materia-prima`, {
          method: "POST",
          body: JSON.stringify(asociacion),
        });
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
 
        {/* === PASOS DE FORMATO === */}
        <div className="mt-6">
          {niveles.map((nivel, idx) => {
            const anterior = idx === 0 ? baseNivel : niveles[idx - 1];
            const anteriorNombre = anterior?.formato || "el insumo";
            const anteriorUnidad = anterior?.unidad || "unidad";

            return (
              <div key={idx} className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Paso {idx + 1}
                </h3>

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
                    onChange={(e) => handleNivelChange(idx, "formato", e.target.value)}
                    className="border px-3 py-2 rounded w-1/2"
                  />
                  <input
                    type="number"
                    placeholder={`Cantidad de ${anteriorNombre} por ${nivel.formato || "formato"}`}
                    value={nivel.cantidad}
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
                <th className="px-3 py-2 text-left">{baseNivel?.unidad || "Unidad"}</th>
                <th className="px-3 py-2 text-left">UNIDAD DE CONSUMO</th>
                <th className="px-3 py-2 text-left">VALOR FORMATO</th>
              </tr>
            </thead>

            <tbody>
              {/* === Nivel base (insumo) === */}
              {baseNivel && (
                <tr className="border-t bg-gray-50">
                  <td className="px-3 py-2 font-medium">{baseNivel.formato}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">Unidad de Costeo</td>
                  <td className="px-3 py-2 text-center">1</td>
                  <td className="px-3 py-2 text-center">{baseNivel.unidad}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      placeholder="0"
                      className="border rounded px-2 py-1 w-28 text-right"
                      value={baseNivelInputValue !== '' ? baseNivelInputValue : (baseNivel?.valor_formato ? String(baseNivel.valor_formato).replace('.', ',') : '')}
                      onChange={(e) => {
                        let inputValue = e.target.value;
                        // Permitir solo números, comas y puntos
                        inputValue = inputValue.replace(/[^0-9,.]/g, '');
                        // Reemplazar punto por coma para consistencia
                        inputValue = inputValue.replace(/\./g, ',');
                        // Permitir solo una coma
                        const parts = inputValue.split(',');
                        if (parts.length > 2) {
                          inputValue = parts[0] + ',' + parts.slice(1).join('');
                        }
                        
                        setBaseNivelInputValue(inputValue);
                        
                        // Convertir a número para cálculos (reemplazar coma por punto)
                        const valorConPunto = inputValue.replace(',', '.');
                        const nuevoValor = inputValue === '' || inputValue.endsWith(',') ? (baseNivel?.valor_formato || 0) : (parseFloat(valorConPunto) || 0);
                        
                        // actualiza base
                        setBaseNivel({ ...baseNivel, valor_formato: nuevoValor });
                        // recalcula todos los siguientes niveles
                        setNiveles((prev) => {
                          const actualizados = prev.map((n, i) => {
                            const anterior =
                              i === 0
                                ? { valor_formato: nuevoValor }
                                : prev[i - 1] || {};
                            return {
                              ...n,
                              valor_formato:
                                (anterior.valor_formato || 0) *
                                (parseFloat(n.cantidad) || 0),
                            };
                          });
                          // Resetear valores de input para niveles recalculados
                          setNivelesInputValues({});
                          return actualizados;
                        });
                      }}
                    />
                  </td>
                </tr>
              )}

              {/* === Niveles dinámicos === */}
              {niveles
                .filter((n) => n.formato && n.cantidad)
                .map((n, i) => {
                  const anterior = i === 0 ? baseNivel : niveles[i - 1];
                  const valorCalculado =
                    (anterior?.valor_formato || 0) * (parseFloat(n.cantidad) || 0);

                  // si no fue editado manualmente, recalculamos
                  if (!n.manual && n.valor_formato !== valorCalculado) {
                    n.valor_formato = valorCalculado;
                  }

                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 font-medium capitalize">{n.formato}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {i === 0 ? (
                          <>
                            El insumo <strong>{anterior?.formato}</strong> viene en{" "}
                            <strong>{n.formato}</strong> de {n.cantidad}{" "}
                            {anterior?.unidad || "unidades"}
                          </>
                        ) : (
                          <>
                            Cada <strong>{n.formato}</strong> contiene {n.cantidad}{" "}
                            <strong>{niveles[i - 1]?.formato || "formato anterior"}</strong> 
                          </>
                        )}
                      </td>
                      
                      {/* COLUMNA CANTIDAD ACUMULADA */}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          // calculamos el total multiplicando hacia atrás
                          let total = parseFloat(n.cantidad) || 0;
                          for (let j = i - 1; j >= 0; j--) {
                            total *= parseFloat(niveles[j].cantidad) || 1;
                          }
                          if (baseNivel?.cantidad) total *= parseFloat(baseNivel.cantidad) || 1;

                          return total.toLocaleString("es-CL");
                        })()}
                      </td>

                      <td className="px-3 py-2 text-center">{n.unidad}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">
                        <input
                          type="text"
                          className="border rounded px-2 py-1 w-28 text-right"
                          value={nivelesInputValues[i] !== undefined ? nivelesInputValues[i] : (n.valor_formato ? String(n.valor_formato).replace('.', ',') : '')}
                          onChange={(e) => {
                            let inputValue = e.target.value;
                            // Permitir solo números, comas y puntos
                            inputValue = inputValue.replace(/[^0-9,.]/g, '');
                            // Reemplazar punto por coma para consistencia
                            inputValue = inputValue.replace(/\./g, ',');
                            // Permitir solo una coma
                            const parts = inputValue.split(',');
                            if (parts.length > 2) {
                              inputValue = parts[0] + ',' + parts.slice(1).join('');
                            }
                            
                            setNivelesInputValues(prev => ({ ...prev, [i]: inputValue }));
                            
                            // Convertir a número para cálculos (reemplazar coma por punto)
                            const valorConPunto = inputValue.replace(',', '.');
                            const nuevoValor = inputValue === '' || inputValue.endsWith(',') ? (n.valor_formato || 0) : (parseFloat(valorConPunto) || 0);
                            setNiveles((prev) => {
                              const actualizados = [...prev];

                              // actualiza el nivel editado
                              actualizados[i] = {
                                ...actualizados[i],
                                valor_formato: nuevoValor,
                                manual: true,
                              };

                              // recalcula los siguientes niveles automáticamente
                              for (let j = i + 1; j < actualizados.length; j++) {
                                const anteriorNivel =
                                  j === 0 ? baseNivel : actualizados[j - 1];
                                actualizados[j].valor_formato =
                                  (anteriorNivel?.valor_formato || 0) *
                                  (parseFloat(actualizados[j].cantidad) || 0);
                                actualizados[j].manual = false; // vuelve a automático
                              }

                              return actualizados;
                            });
                          }}
                        />
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
