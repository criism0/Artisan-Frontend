import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function EditPVAPorProducto() {
  const api = useApi();
  const navigate = useNavigate();
  const { id } = useParams();

  const [procesos, setProcesos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [formData, setFormData] = useState({
    id_proceso: "",
    id_materia_prima: "",
    id_producto_base: "",
    orden: "",
  });
  const [insumos, setInsumos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [procRes, matRes, prodRes, relRes] = await Promise.all([
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
          api(`/materias-primas`, { method: "GET" }),
          api(`/productos-base`, { method: "GET" }),
          api(`/pva-por-producto/${id}`, { method: "GET" }),
        ]);

        setProcesos(procRes || []);
        setMateriasPrimas(matRes || []);
        setProductosBase(prodRes || []);

        const pva = relRes.PvaPorProducto;

        setFormData({
          id_proceso: pva.id_proceso,
          id_materia_prima: pva.id_materia_prima || "",
          id_producto_base: pva.id_producto_base || "",
          orden: pva.orden,
        });

        setInsumos(relRes.Insumos || []);
      } catch {
        toast.error("Error al cargar los datos.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);

  const validate = () => {
    const newErrors = {};
    if (!formData.id_proceso) newErrors.id_proceso = "Debe seleccionar un proceso.";
    if (!formData.id_materia_prima && !formData.id_producto_base)
      newErrors.producto = "Debe seleccionar un producto base o una materia prima.";
    if (!formData.orden) newErrors.orden = "Debe ingresar un orden.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const body = {
        id_proceso: parseInt(formData.id_proceso),
        id_materia_prima: formData.id_materia_prima
          ? parseInt(formData.id_materia_prima)
          : null,
        id_producto_base: formData.id_producto_base
          ? parseInt(formData.id_producto_base)
          : null,
        orden: parseInt(formData.orden),
      };

      await api(`/pva-por-producto/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Relación PVA-Producto actualizada correctamente.");
      navigate(`/PVAPorProducto/${id}`);
    } catch {
      toast.error("Error al actualizar la relación PVA-Producto.");
    }
  };

  const handleInsumoChange = (index, field, value) => {
    const updated = [...insumos];
    updated[index][field] = value;
    setInsumos(updated);
  };

  const refreshInsumos = async () => {
    const updated = await api(`/pva-por-producto/${id}`, { method: "GET" });
    setInsumos(updated.Insumos || []);
  };

  const utilizaInsumos = procesos.find(
    (p) => p.id === parseInt(formData.id_proceso)
  )?.utiliza_insumos;

  const handleSaveInsumo = async (insumo) => {
    try {
      if (!insumo.id) {
        const body = {
          id_pva_por_producto: parseInt(id),
          id_materia_prima: parseInt(insumo.id_materia_prima),
          cantidad_por_bulto: parseFloat(insumo.cantidad_por_bulto),
        };

        await api(`/insumo-pva-producto`, {
          method: "POST",
          body: JSON.stringify(body),
        });

        toast.success("Nuevo insumo agregado correctamente.");
      } else {
        const body = {
          id_materia_prima: parseInt(insumo.id_materia_prima),
          cantidad_por_bulto: parseFloat(insumo.cantidad_por_bulto),
        };

        await api(`/insumo-pva-producto/${insumo.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });

        toast.success(`Insumo #${insumo.id} actualizado correctamente.`);
      }

      await refreshInsumos();
    } catch {
      toast.error("Error al guardar el insumo.");
    }
  };

  const handleDeleteInsumo = async (insumo) => {
    try {
      if (!insumo.id) {
        setInsumos((prev) => prev.filter((x) => x !== insumo));
        return;
      }

      await api(`/insumo-pva-producto/${insumo.id}`, {
        method: "DELETE",
      });

      toast.success("Insumo eliminado.");
      await refreshInsumos();
    } catch {
      toast.error("No se pudo eliminar el insumo.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-600">
        Cargando información del PVA por producto...
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/PVAPorProducto/${id}`} />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">
        Editar Relación PVA por Producto
      </h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Proceso de Valor Agregado
          </label>
          <select
            value={formData.id_proceso}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, id_proceso: e.target.value }))
            }
            className={`w-full border rounded-lg px-3 py-2 ${errors.id_proceso ? "border-red-500" : "border-gray-300"
              }`}
          >
            <option value="">Seleccionar...</option>
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.descripcion}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Materia Prima</label>
          <select
            disabled={formData.id_producto_base !== ""}
            value={formData.id_materia_prima}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                id_materia_prima: e.target.value,
                id_producto_base: "",
              }))
            }
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Seleccionar...</option>
            {materiasPrimas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} — {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Producto Base</label>
          <select
            disabled={formData.id_materia_prima !== ""}
            value={formData.id_producto_base}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                id_producto_base: e.target.value,
                id_materia_prima: "",
              }))
            }
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Seleccionar...</option>
            {productosBase.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.nombre}
              </option>
            ))}
          </select>
          {errors.producto && (
            <p className="text-red-500 text-sm mt-1">{errors.producto}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Orden</label>
          <input
            value={formData.orden}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, orden: e.target.value }))
            }
            type="number"
            min="1"
            className={`w-full border rounded-lg px-3 py-2 ${errors.orden ? "border-red-500" : "border-gray-300"
              }`}
          />
        </div>
      </div>

      {utilizaInsumos && (
        <div className="bg-white p-6 rounded-lg shadow mt-8">
          <h2 className="text-lg font-semibold mb-4">Editar Insumos Asociados</h2>

          <button
            onClick={() =>
              setInsumos((prev) => [
                ...prev,
                { id: null, id_materia_prima: "", cantidad_por_bulto: "" },
              ])
            }
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded mb-4"
          >
            + Añadir Insumo
          </button>

          {insumos.length === 0 ? (
            <p className="text-gray-600 text-sm">No hay insumos registrados.</p>
          ) : (
            insumos.map((insumo, index) => (
              <div
                key={index}
                className="border rounded-md p-4 mb-4 flex flex-col md:flex-row items-center gap-4"
              >
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Materia Prima
                  </label>
                  <select
                    value={insumo.id_materia_prima}
                    onChange={(e) =>
                      handleInsumoChange(
                        index,
                        "id_materia_prima",
                        e.target.value
                      )
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Seleccionar...</option>
                    {materiasPrimas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} — {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Cantidad por Bulto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={insumo.cantidad_por_bulto}
                    onChange={(e) =>
                      handleInsumoChange(
                        index,
                        "cantidad_por_bulto",
                        e.target.value
                      )
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleSaveInsumo(insumo)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Guardar
                  </button>

                  <button
                    onClick={() => handleDeleteInsumo(insumo)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )
      }

      < div className="flex justify-end mt-8" >
        <button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Guardar Cambios Generales
        </button>
      </div >
    </div >
  );
}
