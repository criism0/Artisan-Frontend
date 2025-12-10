import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { ModifyButton, DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";

export default function PautaElaboracionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [pauta, setPauta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [recetas, setRecetas] = useState([]);

  useEffect(() => {
    const fetchPauta = async () => {
      try {
        setLoading(true);

        const [pautaRes, pasosRes, recetasRes] = await Promise.all([
          api(`/pautas-elaboracion/${id}`),
          api(`/pasos-pauta-elaboracion/pauta/${id}`),
          api(`/pautas-elaboracion/${id}/recetas`),
        ]);

        setPauta(pautaRes);
        setPasos(pasosRes.sort((a, b) => a.orden - b.orden));
        setRecetas(recetasRes);
        setError(null);
      } catch (err) {
        console.error("Error cargando pauta:", err);
        setError("No se pudo cargar la pauta de elaboración. Intenta nuevamente.");
      } finally {
        setLoading(false);
      }
    };
    fetchPauta();
  }, [id, api]);

  const handleDelete = async () => {
    try {
      await api(`/pautas-elaboracion/${id}`, { method: "DELETE" });
      toast.success("Pauta de elaboración eliminada correctamente.");
      navigate("/PautasElaboracion");
    } catch (err) {
      console.error("Error eliminando pauta:", err);
      toast.error("No se pudo eliminar la pauta de elaboración.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-primary">Cargando pauta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!pauta) return null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <BackButton to="/PautasElaboracion" />
        <div className="flex gap-2">
          <ModifyButton onClick={() => navigate(`/PautasElaboracion/${id}/edit`)} />
          <DeleteButton
            onConfirmDelete={handleDelete}
            tooltipText="Eliminar pauta"
            entityName="pauta de elaboración"
          />
        </div>
      </div>

      {/* ─────────────── DATOS PRINCIPALES ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6 mb-8">
        <h1 className="text-2xl font-bold text-center text-text mb-4">
          {pauta.name}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <span className="font-semibold">Estado:</span>{" "}
            <span className={`px-2 py-1 rounded-full text-xs ${
              pauta.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {pauta.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div>
            <span className="font-semibold">Fecha de Creación:</span>{" "}
            {new Date(pauta.createdAt).toLocaleString()}
          </div>
          <div className="md:col-span-2">
            <span className="font-semibold">Descripción:</span>
            <p className="mt-1 text-gray-600">{pauta.description}</p>
          </div>
        </div>
      </div>

      {/* ─────────────── PASOS DE ELABORACIÓN ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-gray-800">Pasos de Elaboración</h2>
        {pasos.length > 0 ? (
          <div className="space-y-4">
            {pasos.map((paso) => (
              <div key={paso.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-700">Paso {paso.orden}</h3>
                  <div className="flex gap-2">
                    {paso.requires_ph && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Requiere pH
                      </span>
                    )}
                    {paso.requires_temperature && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                        Requiere temperatura
                      </span>
                    )}
                    {paso.requires_obtained_quantity && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Requiere cantidad
                      </span>
                    )}
                    {(() => {
                      const defs = paso.extra_input_data || paso.extra_input_defs || [];
                      return defs && defs.length > 0 ? defs.map((def, i) => (
                        <div key={def.id ?? def.name ?? i} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                          {def.name ?? def.nombre ?? String(def)}
                        </div>
                      )) : null;
                    })()}
                  </div>
                </div>
                <p className="text-gray-600">{paso.descripcion}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No se registraron pasos.</p>
        )}
      </div>

      {/* ─────────────── RECETAS QUE USAN ESTA PAUTA ─────────────── */}
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Recetas que usan esta Pauta</h2>
        {recetas.length > 0 ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Unidad</th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((receta) => (
                <tr key={receta.id} className="border-t">
                  <td className="p-2">{receta.id}</td>
                  <td className="p-2">
                    <button
                      onClick={() => navigate(`/Recetas/${receta.id}`)}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {receta.nombre}
                    </button>
                  </td>
                  <td className="p-2">{receta.tipo || "—"}</td>
                  <td className="p-2">{receta.unidad_medida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">No hay recetas que usen esta pauta.</p>
        )}
      </div>
    </div>
  );
}
