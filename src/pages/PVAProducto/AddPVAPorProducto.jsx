import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function AddPVAPorProducto() {
  const api = useApi();
  const navigate = useNavigate();

  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [procesoSeleccionado, setProcesoSeleccionado] = useState(null);

  const [formData, setFormData] = useState({
    id_proceso: "",
    id_materia_prima: "",
    id_producto_base: "",
  });

  const [nuevoPvaId, setNuevoPvaId] = useState(null);
  const [insumos, setInsumos] = useState([
    { id_materia_prima: "", cantidad_por_bulto: "" },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [procRes, matRes] = await Promise.all([
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
          api(`/materias-primas`, { method: "GET" }),
        ]);

        setProcesos(procRes || []);
        setMateriasPrimas(matRes || []);

        const prodRes = await api(`/productos-base`, { method: "GET" });
        setProductosBase(prodRes || []);
      } catch {
        toast.error("Error al cargar los datos iniciales.");
      }
    };

    fetchData();
  }, [api]);

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "id_proceso" && value) {
      try {
        const proceso = await api(`/procesos-de-valor-agregado/${value}`, { method: "GET" });
        setProcesoSeleccionado(proceso);
      } catch {
        setProcesoSeleccionado(null);
      }
    }
  };

  const handleInsumoChange = (index, field, value) => {
    const updated = [...insumos];
    updated[index][field] = value;
    setInsumos(updated);
  };

  const addInsumo = () => {
    setInsumos([...insumos, { id_materia_prima: "", cantidad_por_bulto: "" }]);
  };

  const removeInsumo = (index) => {
    setInsumos(insumos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      const res = await api(`/pva-por-producto/`, {
        method: "POST",
        body: JSON.stringify({
          id_proceso: parseInt(formData.id_proceso),
          id_materia_prima: formData.id_materia_prima
            ? parseInt(formData.id_materia_prima)
            : null,
          id_producto_base: formData.id_producto_base
            ? parseInt(formData.id_producto_base)
            : null,
        }),
      });

      if (!res?.id) {
        toast.error("No se pudo crear el PVA por producto.");
        return;
      }

      setNuevoPvaId(res.id);

      if (procesoSeleccionado?.utiliza_insumos) {
        toast.success("PVA por producto creado correctamente. Agrega los insumos.");
      } else {
        toast.success("PVA por producto creado correctamente.");
        navigate("/PVAPorProducto");
      }
    } catch {
      toast.error("Error al crear PVA por producto.");
    }
  };

  const handleSaveInsumos = async () => {
    try {
      if (!nuevoPvaId) {
        toast.error("Crea primero el PVA por producto.");
        return;
      }

      for (const insumo of insumos) {
        if (!insumo.id_materia_prima || !insumo.cantidad_por_bulto) continue;

        await api(`/insumo-pva-producto`, {
          method: "POST",
          body: JSON.stringify({
            id_pva_por_producto: nuevoPvaId,
            id_materia_prima: parseInt(insumo.id_materia_prima),
            cantidad_por_bulto: parseFloat(insumo.cantidad_por_bulto),
          }),
        });
      }

      toast.success("Insumos agregados correctamente.");
      navigate("/PVAPorProducto");
    } catch {
      toast.error("Error al agregar insumos.");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/PVAPorProducto" />
      <h1 className="text-2xl font-bold mb-6">Asociar PVA con Producto</h1>

      {!nuevoPvaId && (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <select
            name="id_proceso"
            value={formData.id_proceso}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seleccionar Proceso...</option>
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.descripcion}
              </option>
            ))}
          </select>

          <div className="space-y-4">
            <select
              disabled={formData.id_producto_base !== ""}
              name="id_materia_prima"
              value={formData.id_materia_prima}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  id_materia_prima: e.target.value,
                  id_producto_base: "",
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar Materia Prima...</option>
              {materiasPrimas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>

            <select
              disabled={formData.id_materia_prima !== ""}
              name="id_producto_base"
              value={formData.id_producto_base}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  id_producto_base: e.target.value,
                  id_materia_prima: "",
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar Producto Base...</option>
              {productosBase.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
          >
            Crear Asociación
          </button>
        </div>
      )}

      {nuevoPvaId && procesoSeleccionado?.utiliza_insumos && (
        <div className="bg-white p-6 rounded-lg shadow space-y-6 mt-6">
          <h2 className="text-xl font-semibold mb-2">
            Agregar Insumos al PVA #{nuevoPvaId}
          </h2>

          {insumos.map((insumo, index) => (
            <div
              key={index}
              className="border rounded-md p-4 flex flex-col md:flex-row gap-4 items-center"
            >
              <select
                value={insumo.id_materia_prima}
                onChange={(e) =>
                  handleInsumoChange(index, "id_materia_prima", e.target.value)
                }
                className="w-full md:w-1/2 border rounded px-3 py-2"
              >
                <option value="">Seleccionar Insumo...</option>
                {materiasPrimas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Cantidad por bulto"
                value={insumo.cantidad_por_bulto}
                onChange={(e) =>
                  handleInsumoChange(index, "cantidad_por_bulto", e.target.value)
                }
                className="w-full md:w-1/3 border rounded px-3 py-2"
              />

              <button
                onClick={() => removeInsumo(index)}
                className="text-red-600 hover:underline text-sm"
              >
                Eliminar
              </button>
            </div>
          ))}

          <div className="flex justify-between items-center">
            <button
              onClick={addInsumo}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded"
            >
              + Agregar otro insumo
            </button>

            <button
              onClick={handleSaveInsumos}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
            >
              Guardar Insumos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
