import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";

export default function AddOM() {
  const apiFetch = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recetas, setRecetas] = useState([]);
  const [bodegas, setBodegas] = useState([]);

  const [form, setForm] = useState({
    id_receta: "",
    id_bodega: "",
    peso_objetivo: "",
  });

  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const idElaborador = useMemo(() => {
    if (user?.id) return Number(user.id);
    try {
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) return undefined;
      const decoded = jwtDecode(token);
      return Number(decoded?.id ?? decoded?.sub);
    } catch {
      return undefined;
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const [rec, bod] = await Promise.all([
          apiFetch(`/recetas?incluirPasos=true&incluirIngredientes=true`),
          apiFetch(`/bodegas`),
        ]);
        const recetasList = Array.isArray(rec) ? rec : rec?.recetas ?? [];
        const bodegasList = Array.isArray(bod) ? bod : bod?.bodegas ?? [];
        setRecetas(recetasList);
        setBodegas(bodegasList.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      } catch {
        toast.error("Error cargando datos iniciales.");
      }
    })();
  }, [apiFetch]);

  const checkAvailability = async () => {
    setError(null);
    setDisponibilidad(null);

    if (!form.id_receta || !form.id_bodega || !form.peso_objetivo) {
      toast.error("Selecciona receta, bodega y peso objetivo.");
      return;
    }

    setCheckingAvailability(true);
    try {
      const qs = new URLSearchParams({
        id_bodega: String(form.id_bodega),
        id_receta: String(form.id_receta),
        peso_objetivo: String(Number(form.peso_objetivo)),
      }).toString();

      const res = await apiFetch(`/ordenes_manufactura/disponibilidad?${qs}`, {
        method: "GET",
      });
      const disponibilidadData = res?.disponibilidad ?? res;
      console.log('Disponibilidad recibida:', disponibilidadData);
      setDisponibilidad(disponibilidadData);
    } catch (e) {
      toast.error(
        e?.body?.error || e?.message || "Error al consultar disponibilidad."
      );
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!idElaborador) {
        toast.error(
          "No se pudo identificar al elaborador. Inicia sesión nuevamente."
        );
        return;
      }

      const selectedRecipe = recetas.find(
        (r) => r.id === Number(form.id_receta)
      );
      if (!selectedRecipe) {
        toast.error("Receta no encontrada.");
        return;
      }

      const ingredientes = selectedRecipe.ingredientesReceta || [];
      if (ingredientes.length === 0) {
        toast.error(
          `La receta "${selectedRecipe.nombre}" no tiene ingredientes definidos.`
        );
        return;
      }

      const payload = {
        id_receta: Number(form.id_receta),
        id_elaborador_encargado: Number(idElaborador),
        id_bodega: Number(form.id_bodega),
        peso_objetivo: Number(form.peso_objetivo),
      };

      const nuevaOM = await apiFetch(`/ordenes_manufactura`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      toast.success("Orden de Manufactura creada con éxito.");

      if (nuevaOM?.id) {
        navigate(`/Orden_de_Manufactura/${nuevaOM.id}`);
      } else {
        navigate("/Orden_de_Manufactura");
      }
    } catch (e) {
      toast.error(e?.body?.error || e?.message || "Error al crear la OM.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Crear Orden de Manufactura</h1>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-3 text-sm text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Receta</label>
          <select
            value={form.id_receta}
            onChange={(e) => setField("id_receta", e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Selecciona una receta</option>
            {recetas.map((r) => {
              const ingredientes = r.ingredientesReceta || [];
              const hasIngredients = ingredientes.length > 0;
              return (
                <option
                  key={r.id}
                  value={r.id}
                  disabled={!hasIngredients}
                  style={{ color: hasIngredients ? "black" : "gray" }}
                >
                  {r.nombre ?? `Receta ${r.id}`}{" "}
                  {!hasIngredients ? "(Sin ingredientes)" : ""}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Solo se pueden seleccionar recetas que tengan ingredientes definidos.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bodega</label>
          <select
            value={form.id_bodega}
            onChange={(e) => setField("id_bodega", e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Selecciona una bodega</option>
            {bodegas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre ?? `Bodega ${b.id}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Peso Objetivo (kg)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.peso_objetivo}
            onChange={(e) => setField("peso_objetivo", e.target.value)}
            className="w-full border rounded-md px-3 py-2"
            placeholder="Ej: 1000"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={checkAvailability}
            disabled={checkingAvailability}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
          >
            {checkingAvailability ? "Consultando…" : "Ver Disponibilidad"}
          </button>

          <button
            type="submit"
            disabled={loading || !idElaborador}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear Orden de Manufactura"}
          </button>
        </div>
      </form>

      {disponibilidad && (
        <div className="mt-6 border rounded-md p-4 bg-white">
          <h2 className="font-semibold mb-4 text-lg">Disponibilidad de Insumos</h2>
          
          {(() => {
            let items = [];
            
            if (Array.isArray(disponibilidad)) {
              items = disponibilidad;
            } else if (typeof disponibilidad === 'object' && disponibilidad !== null) {
              if (disponibilidad.insumos || disponibilidad.ingredientes || disponibilidad.registros) {
                items = disponibilidad.insumos || disponibilidad.ingredientes || disponibilidad.registros || [];
              } else {
                items = Object.entries(disponibilidad).map(([key, value]) => ({
                  key,
                  ...(typeof value === 'object' ? value : { valor: value })
                }));
              }
            }
            
            if (items.length > 0) {
              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Insumo</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Necesaria</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Cantidad Disponible</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const cantidadNecesaria = item.peso_necesario ?? item.cantidad_necesaria ?? item.cantidadNecesaria ?? item.necesario ?? item.pesoNecesario ?? 0;
                        const cantidadDisponible = item.peso_disponible ?? item.cantidad_disponible ?? item.cantidadDisponible ?? item.disponible ?? item.pesoDisponible ?? 0;
                        
                        let nombreInsumo = 
                          item.materiaPrima?.nombre ?? 
                          item.ingredienteReceta?.materiaPrima?.nombre ?? 
                          item.ingrediente?.materiaPrima?.nombre ??
                          item.ingrediente?.materia_prima?.nombre ??
                          item.materia_prima?.nombre ?? 
                          item.nombre ?? 
                          item.ingrediente?.nombre ??
                          item.descripcion ??
                          item.key;
                        
                        if (!nombreInsumo) {
                          console.log('Item sin nombre encontrado:', item);
                          nombreInsumo = `Insumo ${index + 1}`;
                        }
                        
                        const disponible = Number(cantidadDisponible) >= Number(cantidadNecesaria);
                        
                        return (
                          <tr key={index} className={disponible ? "bg-green-50" : "bg-red-50"}>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{nombreInsumo}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{Number(cantidadNecesaria || 0).toFixed(2)} kg</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">{Number(cantidadDisponible || 0).toFixed(2)} kg</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                disponible 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {disponible ? "✓ Disponible" : "✗ Insuficiente"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
            
            return (
              <div>
                <div className="mb-4">
                  <pre className="text-sm overflow-auto bg-gray-50 p-4 rounded border">
                    {JSON.stringify(disponibilidad, null, 2)}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
