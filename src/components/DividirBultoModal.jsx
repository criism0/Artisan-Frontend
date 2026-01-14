import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { toast } from "../lib/toast";

export default function DividirBultoModal({ bulto, onClose, onSuccess }) {
  const [divisiones, setDivisiones] = useState(['']);
  const [loading, setLoading] = useState(false);

  const unidadLabel = useMemo(() => {
    const u =
      bulto?.materiaPrima?.unidad_medida ??
      bulto?.loteProductoFinal?.productoBase?.unidad_medida ??
      bulto?.ProductoBase?.unidad_medida;
    return u ? String(u) : "un.";
  }, [bulto]);

  const pesoUnitario = useMemo(() => {
    const n = Number(bulto?.peso_unitario ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [bulto]);

  const unidadesDisponibles = useMemo(() => {
    const n = Number(bulto?.unidades_disponibles ?? bulto?.cantidad_unidades ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [bulto]);

  const cantidadesIngresadas = useMemo(() => {
    return (divisiones || []).map((v) => {
      const n = Number(String(v ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : NaN;
    });
  }, [divisiones]);

  const totalAsignado = useMemo(() => {
    return cantidadesIngresadas
      .filter((n) => Number.isFinite(n) && n > 0)
      .reduce((a, b) => a + b, 0);
  }, [cantidadesIngresadas]);

  const saldoRestante = useMemo(() => {
    return unidadesDisponibles - totalAsignado;
  }, [unidadesDisponibles, totalAsignado]);

  const excedeDisponible = saldoRestante < 0;

  const equivalenteDisponible = useMemo(() => {
    return pesoUnitario > 0 ? unidadesDisponibles * pesoUnitario : unidadesDisponibles;
  }, [unidadesDisponibles, pesoUnitario]);

  const equivalenteAsignado = useMemo(() => {
    return pesoUnitario > 0 ? totalAsignado * pesoUnitario : totalAsignado;
  }, [totalAsignado, pesoUnitario]);

  const equivalenteSaldo = useMemo(() => {
    return pesoUnitario > 0 ? saldoRestante * pesoUnitario : saldoRestante;
  }, [saldoRestante, pesoUnitario]);

  const resumenDivisiones = useMemo(() => {
    const validas = cantidadesIngresadas.filter((n) => Number.isFinite(n) && n > 0);
    if (validas.length === 0) return "—";
    return validas.join(" + ");
  }, [cantidadesIngresadas]);

  const handleAddDivision = () => {
    setDivisiones([...divisiones, '']);
  };

  const handleRemoveDivision = (index) => {
    const newDivisiones = [...divisiones];
    newDivisiones.splice(index, 1);
    setDivisiones(newDivisiones);
  };

  const handleChange = (index, value) => {
    const newDivisiones = [...divisiones];
    newDivisiones[index] = value;
    setDivisiones(newDivisiones);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cantidades = divisiones
      .map((v) => Number(String(v ?? "").replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0);
    
    if (cantidades.length === 0) {
      toast.error("Debe ingresar al menos una cantidad válida.");
      setLoading(false);
      return;
    }

    const total = cantidades.reduce((a, b) => a + b, 0);
    if (total > unidadesDisponibles) {
      toast.error(
        `La suma (${total}) excede las unidades disponibles (${unidadesDisponibles}).`
      );
      setLoading(false);
      return;
    }

    try {
      const res = await api(`/bultos/${bulto.id}/dividir`, {
        method: "POST",
        body: JSON.stringify({ divisiones: cantidades }),
      });
      
      if (res?.mensaje) {
        toast.success(`Éxito: ${res.mensaje}`);
      } else {
        toast.success("Bulto dividido exitosamente.");
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Error al dividir el bulto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Dividir Bulto {bulto.identificador}</h2>
        <div className="mb-4 text-sm text-gray-700 space-y-1">
          <div>
            Disponible: <span className="font-bold">{unidadesDisponibles}</span>
          </div>
          <div className={excedeDisponible ? "text-red-600" : "text-gray-700"}>
            Total asignado: <span className="font-bold">{totalAsignado}</span>

          </div>
          <div className={excedeDisponible ? "text-red-600" : "text-gray-700"}>
            Saldo restante : <span className="font-bold">{saldoRestante}</span>
          </div>
          <div className="text-xs text-gray-500">
            Cada campo representa la <span className="font-semibold">cantidad en unidades base</span> que irá dentro de <span className="font-semibold">cada bulto nuevo</span>.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
            {divisiones.map((div, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="text-xs text-gray-600 w-20 shrink-0">División {index + 1}</div>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="Cantidad (un.)"
                  className="border rounded px-3 py-2 w-full"
                  value={div}
                  onChange={(e) => handleChange(index, e.target.value)}
                  required
                />
                <div className="text-xs text-gray-500 w-16 shrink-0">
                  {(() => {
                    const n = Number(String(div ?? "").replace(",", "."));
                    if (!Number.isFinite(n) || n <= 0) return "un.";
                    if (pesoUnitario > 0) return `${(n * pesoUnitario).toFixed(2)} ${unidadLabel}`;
                    return "un.";
                  })()}
                </div>
                {divisiones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDivision(index)}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                    title="Quitar división"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {excedeDisponible ? (
            <div className="text-sm text-red-600 mb-4">
              La suma de las divisiones excede lo disponible. Reduce alguna cantidad para continuar.
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleAddDivision}
            className="text-sm text-primary hover:underline mb-4 block"
          >
            + Agregar otra división (nuevo bulto)
          </button>

          <div>
            Se crearán <span className="font-bold">{divisiones.length}</span> bulto{divisiones.length === 1 ? "" : "s"} nuevo{divisiones.length === 1 ? "" : "s"}.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover disabled:opacity-50"
              disabled={loading || excedeDisponible}
            >
              {loading ? 'Procesando...' : 'Dividir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
