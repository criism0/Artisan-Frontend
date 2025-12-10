import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "../../lib/toast";

export default function EditPautaValorAgregado() {
  const api = useApi();
  const navigate = useNavigate();
  const { id } = useParams();

  const [lotesProceso, setLotesProceso] = useState([]);
  const [pvaProductos, setPvaProductos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [formData, setFormData] = useState({
    id_proceso: "",
    id_lote_producto_en_proceso: "",
    id_bodega: "",
    estado: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pautaRes, lotesRes, pvaProdRes, procRes] = await Promise.all([
          api(`/pautas-valor-agregado/${id}`, { method: "GET" }),
          api(`/lotes-producto-en-proceso/`, { method: "GET" }),
          api(`/pva-por-producto/`, { method: "GET" }),
          api(`/procesos-de-valor-agregado`, { method: "GET" }),
        ]);

        setLotesProceso(lotesRes);
        setPvaProductos(pvaProdRes);
        setProcesos(procRes);
        setFormData({
          id_proceso: pautaRes.id_proceso,
          id_lote_producto_en_proceso: pautaRes.id_lote_producto_en_proceso,
          id_bodega: pautaRes.id_bodega,
          estado: pautaRes.estado,
        });
      } catch {
        toast.error("No se pudieron cargar los datos de la pauta.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [api, id]);

  const getProcesoDescripcion = (id) => {
    const p = procesos.find((x) => x.id === id);
    return p ? p.descripcion : `#${id}`;
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.id_proceso) newErrors.id_proceso = "Debe seleccionar un proceso.";
    if (!formData.id_lote_producto_en_proceso)
      newErrors.id_lote_producto_en_proceso = "Debe seleccionar un lote en proceso.";
    if (!formData.id_bodega) newErrors.id_bodega = "Debe ingresar un ID de bodega.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const body = {
        id_proceso: parseInt(formData.id_proceso),
        id_lote_producto_en_proceso: parseInt(formData.id_lote_producto_en_proceso),
        id_bodega: parseInt(formData.id_bodega),
        estado: formData.estado,
      };

      await api(`/pautas-valor-agregado/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Pauta actualizada correctamente.");
      navigate("/Orden_de_Manufactura");
    } catch {
      toast.error("Error al actualizar la pauta.");
    }
  };

  if (isLoading)
    return <div className="p-6 text-center text-gray-600">Cargando pauta...</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={() => navigate("/Orden_de_Manufactura")}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded"
        >
          ← Volver a Órdenes de Manufactura
        </button>
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Editar Pauta de Valor Agregado</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Proceso de Valor Agregado
          </label>
          <select
            name="id_proceso"
            value={formData.id_proceso}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_proceso ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar proceso...</option>
            {pvaProductos.map((rel) => (
              <option key={rel.id} value={rel.id_proceso}>
                {getProcesoDescripcion(rel.id_proceso)}
              </option>
            ))}
          </select>
          {errors.id_proceso && (
            <p className="text-red-500 text-sm mt-1">{errors.id_proceso}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Lote de Producto en Proceso
          </label>
          <select
            name="id_lote_producto_en_proceso"
            value={formData.id_lote_producto_en_proceso}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_lote_producto_en_proceso ? "border-red-500" : "border-gray-300"
            }`}
          >
            <option value="">Seleccionar lote...</option>
            {lotesProceso.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.materiaPrima?.nombre || "Sin nombre"} — {lote.peso}{" "}
                {lote.materiaPrima?.unidad_medida}
              </option>
            ))}
          </select>
          {errors.id_lote_producto_en_proceso && (
            <p className="text-red-500 text-sm mt-1">
              {errors.id_lote_producto_en_proceso}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ID Bodega</label>
          <input
            name="id_bodega"
            value={formData.id_bodega}
            onChange={handleChange}
            className={`w-full border rounded-lg px-3 py-2 ${
              errors.id_bodega ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.id_bodega && (
            <p className="text-red-500 text-sm mt-1">{errors.id_bodega}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Estado</label>
          <select
            name="estado"
            value={formData.estado}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="Pendiente">Pendiente</option>
            <option value="En Proceso">En Proceso</option>
            <option value="Finalizada">Finalizada</option>
          </select>
        </div>
      </div>

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
