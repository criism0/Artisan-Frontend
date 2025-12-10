import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function AsignarInsumosPVA() {
  const { id } = useParams(); // id pauta
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pva, setPva] = useState(null);
  const [bultosPorInsumo, setBultosPorInsumo] = useState({});

  const loadData = async () => {
    try {
      const pauta = await api(`/pautas-valor-agregado/${id}`);
      const insumos = pauta.pvaPorProducto.insumosPVAProductos;

      setPva(insumos);

      let disponibilidad = {};
      for (const ins of insumos) {
        const idInsumo = ins.id_materia_prima || ins.id_producto_base;
        disponibilidad[idInsumo] = await api(`/bultos-disponibles-insumo/${idInsumo}`);
      }

      setBultosPorInsumo(disponibilidad);

    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const asignar = async () => {
    try {
      const body = {
        bultos: pva.map(ins => ({
          id_materia_prima: ins.id_materia_prima || null,
          id_producto_base: ins.id_producto_base || null,
          id_bulto: ins.id_bulto_asignado,
        })),
      };

      await api(`/pautas-valor-agregado/${id}/asignar-insumos`, {
        method: "PUT",
        body: JSON.stringify(body)
      });

      toast.success("Insumos asignados correctamente");
      navigate(`/PautasValorAgregado/ejecutar/${id}`);

    } catch {
      toast.error("Error al asignar insumos");
    }
  };

  if (loading) return "Cargando...";

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Asignar Insumos</h1>

      {pva.map((ins) => {
        const key = ins.id_materia_prima || ins.id_producto_base;
        const bultos = bultosPorInsumo[key] || [];

        return (
          <div key={key} className="mb-4 p-4 border rounded">
            <p><strong>Insumo:</strong> {key}</p>

            <select
              className="mt-2 p-2 border rounded"
              value={ins.id_bulto_asignado || ""}
              onChange={(e) => {
                ins.id_bulto_asignado = Number(e.target.value);
                setPva([...pva]);
              }}
            >
              <option value="">Selecciona un bulto...</option>
              {bultos.map((b) => (
                <option key={b.id} value={b.id}>
                  Bulto {b.id} — {b.peso} kg
                </option>
              ))}
            </select>
          </div>
        );
      })}

      <button
        onClick={asignar}
        className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Guardar Asignaciones
      </button>
    </div>
  );
}
