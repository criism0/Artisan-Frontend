import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useState, useEffect, useMemo } from "react";
import PageHeader from "../../components/UI/PageHeader";
import FormField from "../../components/Forms/FormField";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

const fmt = (n) => Number(n).toLocaleString("es-CL", { maximumFractionDigits: 4 });
const cambio = (a, b) => Math.abs(Number(a) - Number(b)) > 1e-6;

/**
 * Edita UN formato de compra de un proveedor.
 *
 * Reglas (las mismas que aplica el backend):
 *  - El único formato con costo propio es la unidad de consumo (base). Los demás lo derivan de lo que
 *    contienen: costo del hijo × cantidad contenida.
 *  - Al guardar, todos los formatos que contienen a este se recalculan en cadena (el siguiente, y el
 *    siguiente…). La tabla «Cadena de formatos» lo muestra antes de confirmar.
 *  - Un formato no cambia de proveedor, de insumo ni de rol (base / superior).
 */
export default function EditAsociacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [todosFormatos, setTodosFormatos] = useState([]);

  const [formData, setFormData] = useState({
    id_proveedor: "",
    id_materia_prima: "",
    peso_unitario: "",
    precio_unitario: "",
    moneda: "",
    formato: "",
    es_unidad_consumo: false,
    id_formato_hijo: null,
    cantidad_hijos: 1,
  });
  const [unidadMedida, setUnidadMedida] = useState("");

  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [precioInputValue, setPrecioInputValue] = useState("");
  const [monedaBase, setMonedaBase] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWriteRawMaterialProvider = checkScope(ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE);
  const canReadProvider = checkScope(ModelType.PROVEEDOR, ScopeType.READ);

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadProvider) {
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const [provRes, insRes, asocRes] = await Promise.all([
          api(`/proveedores`),
          api(`/materias-primas`),
          api(`/proveedor-materia-prima/${id}`),
        ]);

        const proveedoresData = Array.isArray(provRes?.data) ? provRes.data : provRes;
        const insumosData = Array.isArray(insRes?.data) ? insRes.data : insRes;
        setProveedores(proveedoresData || []);
        setInsumos(insumosData || []);

        const asociacion = asocRes?.data || asocRes;

        const precioUnitario = asociacion.precio_unitario?.toString() || "";
        setFormData({
          id_proveedor: asociacion.id_proveedor?.toString() || "",
          id_materia_prima: asociacion.id_materia_prima?.toString() || "",
          peso_unitario: (asociacion.cantidad_por_formato ?? asociacion.peso_unitario ?? "")?.toString() || "",
          precio_unitario: precioUnitario,
          moneda: asociacion.moneda || "CLP",
          formato: asociacion.formato || "",
          es_unidad_consumo: asociacion.es_unidad_consumo || false,
          id_formato_hijo: asociacion.id_formato_hijo || null,
          cantidad_hijos: asociacion.cantidad_hijos || 1,
        });
        setUnidadMedida(asociacion.unidad_medida || "");
        setPrecioInputValue(precioUnitario ? precioUnitario.replace(".", ",") : "");

        // Toda la cadena del mismo proveedor + insumo: para elegir qué contiene este formato,
        // heredar la moneda y mostrar qué otros formatos cambian al guardar.
        if (asociacion.id_proveedor && asociacion.id_materia_prima) {
          const relRes = await api(
            `/proveedor-materia-prima?id_proveedor=${asociacion.id_proveedor}&id_materia_prima=${asociacion.id_materia_prima}`
          );
          const relData = (Array.isArray(relRes?.data) ? relRes.data : relRes) || [];
          setTodosFormatos(relData);

          const base = relData.find((a) => a.es_unidad_consumo);
          const baseMoneda = base?.moneda || asociacion.moneda || "CLP";
          setMonedaBase(baseMoneda);
          if (!asociacion.es_unidad_consumo) {
            setFormData((prev) => ({ ...prev, moneda: baseMoneda }));
          }
        }
      } catch (e) {
        console.error("Error al cargar datos:", e);
        setError("No se pudieron cargar los datos.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, canReadProvider, api]);

  // Los formatos que contienen a este (directa o indirectamente) no pueden ser su contenido: cerraría un ciclo.
  const formatosHijos = useMemo(() => {
    const ancestros = new Set();
    let frontera = [Number(id)];
    while (frontera.length) {
      const siguiente = [];
      for (const f of todosFormatos) {
        if (frontera.includes(Number(f.id_formato_hijo)) && !ancestros.has(Number(f.id))) {
          ancestros.add(Number(f.id));
          siguiente.push(Number(f.id));
        }
      }
      frontera = siguiente;
    }
    return todosFormatos.filter((h) => Number(h.id) !== Number(id) && !ancestros.has(Number(h.id)));
  }, [todosFormatos, id]);

  const hijoElegido = useMemo(
    () => (formData.id_formato_hijo ? todosFormatos.find((h) => Number(h.id) === Number(formData.id_formato_hijo)) : null),
    [todosFormatos, formData.id_formato_hijo]
  );

  // Contenido y costo de este formato con lo que hay en pantalla, y en cascada los de los que lo contienen.
  const proyeccion = useMemo(() => {
    const mapa = new Map();
    let cantidad;
    let precio;
    let moneda;
    if (formData.es_unidad_consumo) {
      cantidad = parseFloat(formData.peso_unitario);
      precio = parseFloat(String(formData.precio_unitario).replace(",", "."));
      moneda = formData.moneda;
    } else {
      const n = parseFloat(formData.cantidad_hijos);
      if (hijoElegido && n > 0) {
        cantidad = Number(hijoElegido.cantidad_por_formato) * n;
        precio = Number(hijoElegido.precio_unitario) * n;
        moneda = monedaBase || hijoElegido.moneda;
      }
    }
    if (!(cantidad > 0) || !(precio > 0)) return mapa;

    mapa.set(Number(id), { cantidad, precio, moneda });
    const propagar = (idNodo, c, p, visitados) => {
      for (const padre of todosFormatos.filter((f) => Number(f.id_formato_hijo) === idNodo)) {
        if (visitados.has(Number(padre.id))) continue;
        visitados.add(Number(padre.id));
        const nc = c * Number(padre.cantidad_hijos);
        const np = p * Number(padre.cantidad_hijos);
        mapa.set(Number(padre.id), { cantidad: nc, precio: np, moneda });
        propagar(Number(padre.id), nc, np, visitados);
      }
    };
    propagar(Number(id), cantidad, precio, new Set([Number(id)]));
    return mapa;
  }, [formData, hijoElegido, monedaBase, todosFormatos, id]);

  const propio = proyeccion.get(Number(id));
  const filasCadena = useMemo(() => {
    const nombreDe = (idf) => todosFormatos.find((a) => Number(a.id) === Number(idf))?.formato || "";
    return [...todosFormatos]
      .sort((a, b) => (a.cantidad_por_formato || 0) - (b.cantidad_por_formato || 0))
      .map((a) => {
        const nuevo = proyeccion.get(Number(a.id));
        const cantidad = nuevo?.cantidad ?? a.cantidad_por_formato;
        const precio = nuevo?.precio ?? a.precio_unitario;
        const esEste = Number(a.id) === Number(id);
        const hijoNombre = esEste ? hijoElegido?.formato || "" : nombreDe(a.id_formato_hijo);
        const cantHijos = esEste ? formData.cantidad_hijos : a.cantidad_hijos;
        return {
          a,
          esEste,
          nombre: esEste ? formData.formato || a.formato : a.formato,
          contiene: a.es_unidad_consumo ? "Unidad de costeo" : `${fmt(cantHijos || 0)} ${hijoNombre}`,
          cantidad,
          precio,
          cambiaCantidad: !!nuevo && cambio(nuevo.cantidad, a.cantidad_por_formato),
          cambiaPrecio: !!nuevo && cambio(nuevo.precio, a.precio_unitario),
        };
      });
  }, [todosFormatos, proyeccion, id, hijoElegido, formData.cantidad_hijos, formData.formato]);
  const hayCambiosEnCadena = filasCadena.some((f) => f.cambiaCantidad || f.cambiaPrecio);

  const validate = () => {
    const newErrors = {};
    if (!formData.formato.trim()) newErrors.formato = "Debe ingresar un formato.";
    if (formData.es_unidad_consumo) {
      if (!(parseFloat(formData.peso_unitario) > 0)) newErrors.peso_unitario = "Debe ingresar el contenido del formato.";
      if (!(parseFloat(String(formData.precio_unitario).replace(",", ".")) > 0)) newErrors.precio_unitario = "Debe ingresar un costo.";
      if (!formData.moneda) newErrors.moneda = "Debe seleccionar una moneda.";
    } else {
      if (!formData.id_formato_hijo) newErrors.id_formato_hijo = "Debe seleccionar un formato contenido.";
      if (!(parseFloat(formData.cantidad_hijos) > 0)) newErrors.cantidad_hijos = "Debe ingresar la cantidad contenida.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onField = (name) => (e) => {
    setFormData((prev) => ({ ...prev, [name]: e.target.value }));
    setHasChanges(true);
  };

  const onCosto = (e) => {
    let inputValue = e.target.value.replace(/[^0-9,.]/g, "").replace(/\./g, ",");
    const parts = inputValue.split(",");
    if (parts.length > 2) inputValue = parts[0] + "," + parts.slice(1).join("");
    setPrecioInputValue(inputValue);
    const nuevoValor = inputValue === "" || inputValue.endsWith(",") ? formData.precio_unitario : inputValue.replace(",", ".");
    setFormData((prev) => ({ ...prev, precio_unitario: nuevoValor }));
    setHasChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (!canWriteRawMaterialProvider) {
      toast.permissionError([ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE]);
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedInsumo = insumos.find((i) => i.id === parseInt(formData.id_materia_prima));
      const base = formData.es_unidad_consumo;

      const body = {
        id_proveedor: parseInt(formData.id_proveedor),
        id_materia_prima: parseInt(formData.id_materia_prima),
        ...(base ? { peso_unitario: parseFloat(formData.peso_unitario) } : {}),
        // Un formato superior no fija su costo: el backend lo calcula desde lo que contiene.
        precio_unitario: base ? parseFloat(String(formData.precio_unitario).replace(",", ".")) : propio?.precio,
        moneda: base ? formData.moneda : monedaBase || formData.moneda,
        formato: formData.formato.trim(),
        unidad_medida: unidadMedida || selectedInsumo?.unidad_medida || "Unidad",
        es_unidad_consumo: base,
        id_formato_hijo: base ? null : parseInt(formData.id_formato_hijo),
        cantidad_hijos: base ? 1 : parseFloat(formData.cantidad_hijos),
      };

      await api(`/proveedor-materia-prima/por-materia-prima/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Asociación actualizada correctamente");
      navigate(`/Insumos/${formData.id_materia_prima}`);
    } catch (err) {
      toast.error(err?.message || "Error al actualizar la asociación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const salir = () => navigate(`/Insumos/${formData.id_materia_prima}`);
  const handleCancelClick = () => (hasChanges ? setShowCancelModal(true) : salir());

  if (isLoading) return <PageLoader message="Cargando asociación" />;

  const nombreProveedor = proveedores.find((p) => String(p.id) === formData.id_proveedor)?.nombre_empresa || `#${formData.id_proveedor}`;
  const nombreInsumo = insumos.find((i) => String(i.id) === formData.id_materia_prima)?.nombre || `#${formData.id_materia_prima}`;
  const base = formData.es_unidad_consumo;

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}

      <PageHeader
        volverA={`/Insumos/${formData.id_materia_prima}`}
        titulo="Editar Formato"
        subtitulo={
          base
            ? "Es la unidad de costeo: aquí se define el costo y, al guardar, se recalculan los formatos que la contienen."
            : "Su costo se calcula desde el formato que contiene; para cambiarlo, edita la unidad de consumo."
        }
        acciones={
          formData.id_materia_prima && formData.id_proveedor ? (
            <button
              type="button"
              onClick={() => navigate(`/Insumos/asociar/${formData.id_materia_prima}?proveedor=${formData.id_proveedor}`)}
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 font-medium"
            >
              + Agregar formato
            </button>
          ) : null
        }
      />

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">Formato</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                base ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-600"
              }`}
            >
              {base ? "Unidad de consumo (base)" : "Formato superior"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField label="Proveedor" value={nombreProveedor} disabled onChange={() => {}} />
            <FormField label="Insumo" value={nombreInsumo} disabled onChange={() => {}} />
            <FormField
              label="Nombre del formato"
              required
              value={formData.formato}
              placeholder="Ej: Caja, Bidón, Saco…"
              error={errors.formato}
              onChange={onField("formato")}
              containerClassName="md:col-span-2"
            />

            {base ? (
              <>
                <FormField
                  label={`Contenido por formato (${unidadMedida || "unidad"})`}
                  required
                  type="number"
                  step="0.0001"
                  value={formData.peso_unitario}
                  error={errors.peso_unitario}
                  onChange={onField("peso_unitario")}
                />
                <FormField
                  label="Moneda"
                  required
                  type="select"
                  value={formData.moneda}
                  options={["CLP", "USD", "EUR", "UF"].map((m) => ({ value: m, label: m }))}
                  error={errors.moneda}
                  onChange={onField("moneda")}
                />
                <FormField
                  label="Costo del formato"
                  required
                  value={precioInputValue}
                  placeholder="0"
                  error={errors.precio_unitario}
                  helperText="Es el único costo que se edita a mano; los formatos que la contienen se actualizan solos."
                  onChange={onCosto}
                  containerClassName="md:col-span-2"
                />
              </>
            ) : (
              <>
                <FormField
                  label="Contiene el formato"
                  required
                  type="select"
                  value={formData.id_formato_hijo || ""}
                  options={formatosHijos.map((h) => ({
                    value: h.id,
                    label: `${h.formato} (${fmt(h.cantidad_por_formato)} ${h.unidad_medida})`,
                  }))}
                  error={errors.id_formato_hijo}
                  onChange={onField("id_formato_hijo")}
                />
                <FormField
                  label="Cantidad contenida"
                  required
                  type="number"
                  step="0.01"
                  value={formData.cantidad_hijos}
                  error={errors.cantidad_hijos}
                  onChange={onField("cantidad_hijos")}
                />
                <FormField
                  label="Contenido total"
                  value={propio ? `${fmt(propio.cantidad)} ${unidadMedida}` : ""}
                  disabled
                  onChange={() => {}}
                />
                <FormField
                  label={`Costo (calculado, ${monedaBase || formData.moneda})`}
                  value={propio ? fmt(propio.precio) : ""}
                  disabled
                  onChange={() => {}}
                />
              </>
            )}
          </div>
        </section>

        {filasCadena.length > 1 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800">Cadena de formatos</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {hayCambiosEnCadena
                ? "Al guardar se recalculan los formatos marcados, uno tras otro."
                : "Formatos de este proveedor para el mismo insumo."}
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Formato</th>
                    <th className="px-3 py-2 text-left font-medium">Contiene</th>
                    <th className="px-3 py-2 text-left font-medium">Contenido total</th>
                    <th className="px-3 py-2 text-left font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {filasCadena.map((f) => (
                    <tr key={f.a.id} className={`border-t ${f.esEste ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2 font-medium capitalize">
                        {f.nombre}
                        {f.a.es_unidad_consumo && (
                          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Base</span>
                        )}
                        {f.esEste && <span className="ml-2 text-xs font-normal text-primary">Este formato</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{f.contiene}</td>
                      <td className="px-3 py-2">
                        {f.cambiaCantidad && (
                          <span className="text-gray-400 line-through mr-2">{fmt(f.a.cantidad_por_formato)}</span>
                        )}
                        <span className={f.cambiaCantidad ? "font-medium text-amber-700" : ""}>{fmt(f.cantidad)}</span>{" "}
                        {f.a.unidad_medida}
                      </td>
                      <td className="px-3 py-2">
                        {f.cambiaPrecio && <span className="text-gray-400 line-through mr-2">{fmt(f.a.precio_unitario)}</span>}
                        <span className={f.cambiaPrecio ? "font-medium text-amber-700" : ""}>{fmt(f.precio)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>

      {showCancelModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Cambios sin guardar</h2>
            <p className="text-gray-600 text-sm mb-6">
              Tienes cambios sin guardar. Si sales ahora, se perderán todos los cambios realizados.
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  salir();
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
