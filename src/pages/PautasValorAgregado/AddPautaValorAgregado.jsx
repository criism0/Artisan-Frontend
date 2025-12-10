import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function AddPautaValorAgregado() {
  const navigate = useNavigate();
  const api = useApi();

  const [procesos, setProcesos] = useState([]);
  const [lotesFinales, setLotesFinales] = useState([]);
  const [formData, setFormData] = useState({
    id_proceso: "",
    tipo_pauta: "pip",
    id_lote_producto_en_proceso: "",
    id_lote_producto_final: "",
    id_bodega: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resProcesos = await api(`/procesos-de-valor-agregado`, { method: "GET" });
        setProcesos(resProcesos);

        const resLotes = await api(`/lotes-producto-final/`, { method: "GET" });
        setLotesFinales(resLotes);
      } catch {
        toast.error("No se pudieron cargar los procesos o lotes.");
      }
    };
    fetchData();
  }, [api]);

  const validate = () => {
    const newErrors = {};
    if (!formData.id_proceso) newErrors.id_proceso = "Debe seleccionar un proceso.";
    if (!formData.id_bodega) newErrors.id_bodega = "Debe ingresar un ID de bodega.";
    if (formData.tipo_pauta === "pip" && !formData.id_lote_producto_en_proceso)
      newErrors.id_lote_producto_en_proceso = "Debe ingresar un lote en proceso.";
    if (formData.tipo_pauta === "final" && !formData.id_lote_producto_final)
      newErrors.id_lote_producto_final = "Debe seleccionar un lote final.";
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
        id_bodega: parseInt(formData.id_bodega),
      };

      if (formData.tipo_pauta === "pip")
        body.id_lote_producto_en_proceso = parseInt(formData.id_lote_producto_en_proceso);
      if (formData.tipo_pauta === "final")
        body.id_lote_producto_final = parseInt(formData.id_lote_producto_final);

      const pauta = await api(`/pautas-valor-agregado`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success("Pauta creada correctamente.");
      navigate(`/PautasValorAgregado/${pauta.id}`);
    } catch {
      toast.error("Error al crear la pauta.");
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/PautasValorAgregado" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-6">Añadir Pauta de Valor Agregado</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Proceso de Valor Agregado</label>
          <select
            name="id_proceso"
            value={formData.id_proceso}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="">Seleccionar...</option>
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.descripcion}
              </option>
            ))}
          </select>
          {errors.id_proceso && <p className="text-red-500 text-sm mt-1">{errors.id_proceso}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de Pauta</label>
          <select
            name="tipo_pauta"
            value={formData.tipo_pauta}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 border-gray-300"
          >
            <option value="pip">Producto en Proceso</option>
            <option value="final">Producto Final</option>
          </select>
        </div>

        {formData.tipo_pauta === "pip" && (
          <div>
            <label className="block text-sm font-medium mb-1">ID Lote Producto en Proceso</label>
            <input
              name="id_lote_producto_en_proceso"
              value={formData.id_lote_producto_en_proceso}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.id_lote_producto_en_proceso ? "border-red-500" : "border-gray-300"
              }`}
            />
          </div>
        )}

        {formData.tipo_pauta === "final" && (
          <div>
            <label className="block text-sm font-medium mb-1">Seleccionar Lote Final</label>
            <select
              name="id_lote_producto_final"
              value={formData.id_lote_producto_final}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${
                errors.id_lote_producto_final ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Seleccionar lote...</option>
              {lotesFinales.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {lote.id} — {lote.nombre || `Lote #${lote.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

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
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={handleSubmit}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
        >
          Crear Pauta
        </button>
      </div>
    </div>
  );
}

