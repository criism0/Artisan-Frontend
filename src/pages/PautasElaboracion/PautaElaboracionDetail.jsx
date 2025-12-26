import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { ModifyButton, DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import Table from "../../components/Table";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

function getPasoBadges(paso) {
  const badges = [];
  if (paso?.requires_ph) badges.push("pH");
  if (paso?.requires_temperature) badges.push("Temperatura");
  if (paso?.requires_obtained_quantity) badges.push("Cantidad");

  const defs = paso?.extra_input_data || paso?.extra_input_defs || [];
  if (Array.isArray(defs) && defs.length > 0) {
    defs.forEach((def, i) => {
      const label = def?.name ?? def?.nombre ?? String(def);
      badges.push(label || `Extra ${i + 1}`);
    });
  }

  return badges;
}

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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <BackButton to={`/PautasElaboracion`} />
          <div className="flex gap-2">
            <ModifyButton onClick={() => navigate(`/PautasElaboracion/${id}/edit`)} />
            <DeleteButton
              onConfirmDelete={handleDelete}
              tooltipText="Eliminar pauta"
              entityName="pauta de elaboración"
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">{pauta.name}</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs border ${
                pauta.is_active
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {pauta.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
          {pauta.description ? (
            <p className="mt-2 text-sm text-gray-600">{pauta.description}</p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Sin descripción.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar / Resumen */}
          <div className="lg:col-span-1 lg:order-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Resumen</h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Estado</span>
                  <span className="text-text font-medium text-right">
                    {pauta.is_active ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Pasos</span>
                  <span className="text-text font-medium text-right">
                    {Array.isArray(pasos) ? pasos.length : 0}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Recetas vinculadas</span>
                  <span className="text-text font-medium text-right">
                    {Array.isArray(recetas) ? recetas.length : 0}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Creación</span>
                  <span className="text-text font-medium text-right">
                    {formatDateTime(pauta.createdAt)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-500">Última actualización</span>
                  <span className="text-text font-medium text-right">
                    {formatDateTime(pauta.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          <div className="lg:col-span-2 lg:order-1 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Pasos de elaboración</h2>

              {pasos.length > 0 ? (
                <div className="space-y-4">
                  {pasos.map((paso) => (
                    <div
                      key={paso.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="font-medium text-gray-700">Paso {paso.orden}</h3>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {getPasoBadges(paso).map((label) => (
                            <span
                              key={`${paso.id}-${label}`}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-600">{paso.descripcion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-500 text-sm">No se registraron pasos.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Recetas que usan esta pauta</h2>

              {recetas.length > 0 ? (
                <Table
                  columns={[
                    { header: "ID", accessor: "id" },
                    {
                      header: "Receta",
                      accessor: "nombre",
                      Cell: ({ row, value }) => (
                        <button
                          onClick={() => navigate(`/Recetas/${row.id}`)}
                          className="text-primary hover:text-primary-dark underline"
                          title={value || ""}
                        >
                          {value || "—"}
                        </button>
                      ),
                    },
                    { header: "Tipo", accessor: "tipo" },
                    { header: "Unidad", accessor: "unidad_medida" },
                  ]}
                  data={recetas}
                />
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-500 text-sm">No hay recetas que usen esta pauta.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
