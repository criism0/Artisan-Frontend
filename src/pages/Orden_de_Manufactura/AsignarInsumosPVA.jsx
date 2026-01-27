import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function AsignarInsumosPVA() {
  const { idPauta } = useParams();
  const id = idPauta;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pva, setPva] = useState(null);
  const [bultosPorInsumo, setBultosPorInsumo] = useState({});
  const [nombreInsumoByKey, setNombreInsumoByKey] = useState({});

  const formatDisponible = (b) => {
    const rawQty =
      b?.unidades_disponibles ??
      b?.peso_disponible ??
      b?.peso ??
      b?.cantidad_disponible;

    const qty = Number(rawQty);
    const hasQty = Number.isFinite(qty);

    const um =
      b?.unidad_medida ||
      b?.materiaPrima?.unidad_medida ||
      b?.productoBase?.unidad_medida ||
      b?.ProductoBase?.unidad_medida ||
      "";

    if (!hasQty) return "Disponible: —";
    return `Disponible: ${qty.toFixed(2)}${um ? ` ${um}` : ""}`;
  };

  const loadData = async () => {
    try {
      if (!id) {
        toast.error("ID de pauta inválido");
        setPva([]);
        return;
      }

      const pauta = await api(`/pautas-valor-agregado/${id}`);
      const insumos = pauta?.pvaPorProducto?.insumosPVAProductos || [];

      setPva(insumos);

      if (insumos.length > 0) {
        const nombres = {};
        await Promise.all(
          insumos.map(async (ins) => {
            const idMateriaPrima = ins?.id_materia_prima || null;
            const idProductoBase = ins?.id_producto_base || null;
            const key = idMateriaPrima || idProductoBase;
            if (!key) return;
            try {
              if (idMateriaPrima) {
                const mp = await api(`/materias-primas/${idMateriaPrima}`);
                nombres[key] = mp?.nombre || mp?.materia_prima?.nombre || `Materia prima #${idMateriaPrima}`;
              } else if (idProductoBase) {
                const pb = await api(`/productos-base/${idProductoBase}`);
                nombres[key] = pb?.nombre || pb?.producto_base?.nombre || `Producto #${idProductoBase}`;
              }
            } catch {
              if (idMateriaPrima) nombres[key] = `Materia prima #${idMateriaPrima}`;
              if (idProductoBase) nombres[key] = `Producto #${idProductoBase}`;
            }
          })
        );
        setNombreInsumoByKey(nombres);
      } else {
        setNombreInsumoByKey({});
      }

      if (insumos.length > 0) {
        let disponibilidad = {};
        for (const ins of insumos) {
          const idInsumo = ins.id_materia_prima || ins.id_producto_base;
          if (!idInsumo) continue;
          disponibilidad[idInsumo] = await api(`/bultos-disponibles-insumo/${idInsumo}`);
        }

        setBultosPorInsumo(disponibilidad);
      } else {
        setBultosPorInsumo({});
      }

    } catch {
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const asignar = async () => {
    try {
      if (!id) {
        toast.error("ID de pauta inválido");
        return;
      }

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

      {Array.isArray(pva) && pva.length === 0 ? (
        <div className="text-sm text-gray-600">
          Esta pauta no utiliza insumos.
          <div className="mt-3">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-border rounded hover:bg-gray-100"
              onClick={() => navigate(-1)}
            >
              Volver
            </button>
          </div>
        </div>
      ) : null}

      {(Array.isArray(pva) ? pva : []).map((ins) => {
        const key = ins.id_materia_prima || ins.id_producto_base;
        const bultos = bultosPorInsumo[key] || [];
        const insumoNombre = nombreInsumoByKey?.[key] || `Insumo #${key}`;

        return (
          <div key={key} className="mb-4 p-4 border rounded">
            <p><strong>Insumo:</strong> {insumoNombre}</p>

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
                  {(b.identificador || b.codigo || "")
                    ? `${b.identificador || b.codigo} · `
                    : ""}
                  Bulto #{b.id} · {formatDisponible(b)}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      <button
        onClick={asignar}
        className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        disabled={!Array.isArray(pva) || pva.length === 0}
      >
        Guardar Asignaciones
      </button>
    </div>
  );
}
