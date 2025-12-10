import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function RegistrarSubproductos() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    id_materia_prima: "",
    peso: "",
    fecha_vencimiento: "",
  });

  const [subproductos, setSubproductos] = useState([]);
  const [ordenData, setOrdenData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load manufacturing order data
        const ordenData = await api(`/ordenes_manufactura/${id}`);
        setOrdenData(ordenData);

        if (ordenData?.receta?.posiblesSubproductos) {
          setSubproductos(ordenData.receta.posiblesSubproductos);
        }
      } catch (err) {
        toast.error(err.message || "Error al cargar los datos.");
      }
    };

    loadData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const peso = Number(form.peso);

    if (!form.id_materia_prima) return setError("Selecciona un subproducto.");
    if (Number.isNaN(peso) || peso <= 0)
      return setError("El peso debe ser mayor a 0.");
    if (!form.fecha_vencimiento)
      return setError("Ingresa la fecha de vencimiento.");
    if (!ordenData?.bodega?.id)
      return setError("No se encontró la bodega asociada a la orden.");

    const payload = {
      id_orden_manufactura: Number(id),
      id_materia_prima: Number(form.id_materia_prima),
      peso: peso,
      fecha_vencimiento: form.fecha_vencimiento,
      id_bodega: Number(ordenData.bodega?.id),
    };

    try {
      setLoading(true);
      await api("/registro-subproductos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (subproductos.length > 1) {
        toast.success(
          "Subproducto registrado exitosamente. Recargando página para registrar otro subproducto..."
        );
        setTimeout(() => {
          navigate(`/Orden_de_Manufactura/${id}/registrar-subproductos`);
          window.location.reload();
        }, 3000);
      } else {
        toast.success("Subproducto registrado exitosamente.");
        navigate(`/Orden_de_Manufactura/${id}/produccion-final`);
      }
    } catch (err) {
      toast.error(err.message || "Error al registrar el subproducto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Registrar Subproducto</h1>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Subproducto</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={form.id_materia_prima}
            onChange={(e) => setField("id_materia_prima", e.target.value)}
            required
          >
            <option value="">Selecciona un subproducto</option>
            {subproductos.map((subproducto) => (
              <option key={subproducto.id} value={subproducto.id}>
                {subproducto.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Peso (kg)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full border rounded px-3 py-2"
            value={form.peso}
            onChange={(e) => setField("peso", e.target.value)}
            placeholder="25.5"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Fecha de vencimiento
          </label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={form.fecha_vencimiento}
            onChange={(e) => setField("fecha_vencimiento", e.target.value)}
            required
          />
        </div>

        {ordenData?.bodega && (
          <div>
            <label className="block text-sm font-medium mb-1">Bodega</label>
            <div className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-700">
              {ordenData.bodega.nombre}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Bodega asociada a la orden de manufactura
            </p>
          </div>
        )}

        <div className="flex justify-between gap-6">
          <div className="flex gap-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() =>
                navigate(`/Orden_de_Manufactura/${id}/produccion-final`)
              }
            >
              Continuar a Producción Final
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Registrar Subproducto"}
          </button>
        </div>
      </form>
    </div>
  );
}
