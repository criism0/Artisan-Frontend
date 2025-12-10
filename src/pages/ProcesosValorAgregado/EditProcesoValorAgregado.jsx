import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function EditProcesoValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [formData, setFormData] = useState({
    descripcion: "",
    costo_estimado: "",
    tiempo_estimado: "",
    unidad_tiempo: "",
    tiene_pasos: false,
    utiliza_insumos: false,
    genera_bultos_nuevos: false,
  });

  const [pasos, setPasos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api(`/procesos-de-valor-agregado/${id}`, { method: "GET" });
        setFormData({
          descripcion: res.descripcion || "",
          costo_estimado: res.costo_estimado || "",
          tiempo_estimado: res.tiempo_estimado || "",
          unidad_tiempo: res.unidad_tiempo || "",
          tiene_pasos: res.tiene_pasos || false,
          utiliza_insumos: res.utiliza_insumos || false,
          genera_bultos_nuevos: res.genera_bultos_nuevos || false,
        });

        const pasosSorted = (res.pasos || []).sort((a, b) => a.orden - b.orden);
        setPasos(pasosSorted.map((p) => ({ id: p.id, descripcion: p.descripcion, orden: p.orden })));
      } catch {
        toast.error("Error al cargar el proceso.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
        ...prev, 
        [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);
  };

  const handleAddPaso = () => {
    setPasos([...pasos, { id: null, descripcion: "", orden: pasos.length + 1 }]);
  };

  const handleRemovePaso = async (index) => {
    const paso = pasos[index];
    if (paso.id) {
      try {
        await api(`/pasos-valor-agregado/${paso.id}`, { method: "DELETE" });
        toast.success("Paso eliminado.");
      } catch {
        toast.error("Error al eliminar paso.");
      }
    }
    setPasos(pasos.filter((_, i) => i !== index));
  };


  const handleSubmit = async () => {
    try {
      await api(`/procesos-de-valor-agregado/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          costo_estimado: parseFloat(formData.costo_estimado || 0),
          tiempo_estimado: parseFloat(formData.tiempo_estimado || 0),
          unidad_tiempo: formData.unidad_tiempo,
          
          tiene_pasos: formData.tiene_pasos, 
          utiliza_insumos: formData.utiliza_insumos,
          genera_bultos_nuevos: formData.genera_bultos_nuevos,

        }),
      });

      if (formData.tiene_pasos) {
          for (let i = 0; i < pasos.length; i++) {
              const paso = pasos[i];
              const pasoBody = { orden: i + 1, descripcion: paso.descripcion.trim() };

              if (paso.id) {
                  await api(`/pasos-valor-agregado/${paso.id}`, {
                      method: "PUT",
                      body: JSON.stringify(pasoBody),
                  });
              } else if (paso.descripcion.trim()) {
                  await api(`/pasos-valor-agregado`, {
                      method: "POST",
                      body: JSON.stringify({
                          id_proceso: parseInt(id),
                          descripcion: paso.descripcion.trim(),
                      }),
                  });
              }
          }
      }

      toast.success("Proceso actualizado correctamente.");
      navigate(`/ProcesosValorAgregado/${id}`);
    } catch (error) {
        console.error("Error al enviar el formulario:", error);
      toast.error("Error al actualizar el proceso.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
        <span className="ml-3 text-purple-500">Cargando proceso...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/ProcesosValorAgregado/${id}`} />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Editar Proceso de Valor Agregado</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <input
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            disabled
            className="w-full border rounded-lg px-3 py-2 bg-gray-100 border-gray-300"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Costo estimado</label>
            <input
              name="costo_estimado"
              type="number"
              value={formData.costo_estimado}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 border-gray-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Tiempo estimado</label>
            <div className="grid grid-cols-2 gap-4">
                <input
                  name="tiempo_estimado"
                  type="number"
                  value={formData.tiempo_estimado}
                  onChange={handleChange}
                  placeholder="Tiempo"
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                />
                <select
                  name="unidad_tiempo"
                  value={formData.unidad_tiempo}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 border-gray-300"
                >
                  <option value="">Seleccionar Unidad...</option>
                  <option value="Minutos">Minutos</option>
                  <option value="Horas">Horas</option>
                  <option value="Días">Días</option>
                  <option value="Semanas">Semanas</option>
                </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white mt-8 p-6 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Configuración del Proceso</h2>

          <div className="space-y-3">
              <label className="flex items-center space-x-3">
                  <input
                      type="checkbox"
                      name="tiene_pasos"
                      checked={formData.tiene_pasos}
                      onChange={handleChange}
                      className="form-checkbox h-5 w-5 text-primary rounded"
                  />
                  <span className="text-gray-700">El proceso requiere una secuencia de pasos.</span>
              </label>

              <label className="flex items-center space-x-3">
                  <input
                      type="checkbox"
                      name="utiliza_insumos"
                      checked={formData.utiliza_insumos}
                      onChange={handleChange}
                      className="form-checkbox h-5 w-5 text-primary rounded"
                  />
                  <span className="text-gray-700">El proceso utiliza insumos (Plantilla).</span>
              </label>
              
              <label className="flex items-center space-x-3">
                  <input
                      type="checkbox"
                      name="genera_bultos_nuevos"
                      checked={formData.genera_bultos_nuevos}
                      onChange={handleChange}
                      className="form-checkbox h-5 w-5 text-primary rounded"
                  />
                  <span className="text-gray-700">El proceso genera bultos nuevos al completarse.</span>
              </label>
          </div>
      </div>

      {formData.tiene_pasos && (
        <div className="bg-white mt-8 p-6 rounded-lg shadow space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Pasos del Proceso</h2>
            <button
              onClick={handleAddPaso}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Agregar Paso
            </button>
          </div>

          {pasos.map((p, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-700">Paso {i + 1}</h3>
                <button
                  onClick={() => handleRemovePaso(i)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Eliminar
                </button>
              </div>
              <textarea
                value={p.descripcion}
                onChange={(e) => handlePasoChange(i, "descripcion", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 border-gray-300"
                rows={2}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-8">
        <button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}