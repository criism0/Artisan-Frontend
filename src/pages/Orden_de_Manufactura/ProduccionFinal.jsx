import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function ProduccionFinal() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    peso_obtenido: "",
    unidades_obtenidas: "",
    fecha_vencimiento: "",
  });

  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pesoTotal = Number(form.peso_obtenido);
    const unidades = Number(form.unidades_obtenidas);

    if (!unidades || unidades < 1)
      return toast.error("Indica al menos 1 unidad.");
    if (Number.isNaN(pesoTotal) || pesoTotal <= 0)
      return toast.error("Peso obtenido inválido.");
    if (!form.fecha_vencimiento)
      return toast.error("Ingresa la fecha de vencimiento.");

    const pesoPromedio = pesoTotal / unidades;
    const pesosCalculados = Array(unidades).fill(pesoPromedio);

    const payload = {
      peso_obtenido: pesoTotal,
      unidades_obtenidas: unidades,
      fecha_vencimiento: form.fecha_vencimiento,
      pesos: pesosCalculados,
    };

    try {
      setLoading(true);
      await api(`/ordenes_manufactura/${id}/registrar`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/Orden_de_Manufactura/${id}`);
    } catch (err) {
      toast.error(err.message || "Error al registrar la producción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to={`/Orden_de_Manufactura/${id}`} />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Producción final · OM #{id}</h1>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg">
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">
            Peso obtenido (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={form.peso_obtenido}
            onChange={(e) => setField("peso_obtenido", e.target.value)}
            placeholder="500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Unidades obtenidas
          </label>
          <input
            type="number"
            min="1"
            step="1"
            className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={form.unidades_obtenidas}
            onChange={(e) => setField("unidades_obtenidas", e.target.value)}
            placeholder="5"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Se asignará automáticamente el peso promedio a cada unidad.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Fecha de vencimiento
          </label>
          <input
            type="date"
            className="w-full border border-border rounded-lg px-3 py-2 bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={form.fecha_vencimiento}
            onChange={(e) => setField("fecha_vencimiento", e.target.value)}
            required
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-hover disabled:opacity-60"
          >
            {loading ? "Guardando…" : "Registrar Producción"}
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  );
}