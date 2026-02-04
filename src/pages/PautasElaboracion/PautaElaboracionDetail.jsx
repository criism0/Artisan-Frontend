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
  const [camposAnalisisSensorial, setCamposAnalisisSensorial] = useState([]);

  useEffect(() => {
    const fetchPauta = async () => {
      try {
        setLoading(true);

        const [pautaRes, pasosRes, recetasRes] = await Promise.all([
          api(`/pautas-elaboracion/${id}`),
          api(`/pasos-pauta-elaboracion/pauta/${id}`),
          api(`/pautas-elaboracion/${id}/recetas`),
        ]);

        // Análisis sensorial: es opcional, un 404 no debe romper el detalle.
        try {
          const analisisRes = await api(`/analisis-sensorial/definicion/pauta/${id}`);
          setCamposAnalisisSensorial(
            Array.isArray(analisisRes?.campos_definicion) ? analisisRes.campos_definicion : []
          );
        } catch (err) {
          if (err?.status !== 404) {
            console.error('Error cargando análisis sensorial:', err);
          }
          setCamposAnalisisSensorial([]);
        }

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

  const tieneAnalisisSensorial = Array.isArray(camposAnalisisSensorial) && camposAnalisisSensorial.length > 0;
  const tipoCampoLabel = (tipo) => {
    const t = String(tipo || '').toLowerCase();
    switch (t) {
      case 'text':
        return 'Texto';
      case 'number':
        return 'Número';
      case 'select':
        return 'Selección';
      case 'textarea':
        return 'Área de texto';
      case 'boolean':
        return 'Sí/No';
      default:
        return tipo || '—';
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton to="/PautasElaboracion" />
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">Pauta de Elaboración: {pauta.name}</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs border ${
                pauta.is_active
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {pauta.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
            <ModifyButton onClick={() => navigate(`/PautasElaboracion/${id}/edit`)} />
            <DeleteButton
              onConfirmDelete={handleDelete}
              tooltipText="Eliminar pauta"
              entityName="pauta de elaboración"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
            <div className="text-xs text-gray-500 font-medium">ESTADO</div>
            <div className="text-lg font-bold text-text mt-1">
              {pauta.is_active ? 'Activa' : 'Inactiva'}
            </div>
            <div className="text-xs text-gray-600 mt-2">Actualizada: {formatDateTime(pauta.updatedAt)}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium">PASOS</div>
            <div className="text-lg font-bold text-text mt-1">{(pasos || []).length}</div>
            <div className="text-xs text-gray-600 mt-2">Creada: {formatDateTime(pauta.createdAt)}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 font-medium">RECETAS VINCULADAS</div>
            <div className="text-lg font-bold text-text mt-1">{(recetas || []).length}</div>
            <div className="text-xs text-gray-600 mt-2">Usan esta pauta</div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-xs text-gray-500 font-medium">ANÁLISIS SENSORIAL</div>
            <div className="text-lg font-bold text-text mt-1">
              {tieneAnalisisSensorial ? `Configurado (${camposAnalisisSensorial.length})` : 'No configurado'}
            </div>
            <div className="text-xs text-gray-600 mt-2">
              {tieneAnalisisSensorial ? 'Campos listos para evaluación' : 'Sin campos definidos'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-base font-semibold text-text">Descripción</h2>
          <div className="mt-2 text-sm text-gray-700">
            {pauta.description ? pauta.description : <span className="text-gray-500">Sin descripción.</span>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-base font-semibold text-text">Análisis Sensorial</h2>

          {!tieneAnalisisSensorial ? (
            <div className="mt-2 text-sm text-gray-600">
              No hay campos configurados para esta pauta.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border text-left">Etiqueta</th>
                    <th className="p-2 border text-left">Tipo</th>
                    <th className="p-2 border text-center">Obligatorio</th>
                    <th className="p-2 border text-left">Opciones</th>
                    <th className="p-2 border text-left">Clave</th>
                  </tr>
                </thead>
                <tbody>
                  {(camposAnalisisSensorial || []).map((c, idx) => {
                    const etiqueta = c?.etiqueta ?? '—';
                    const tipo = tipoCampoLabel(c?.tipo);
                    const obligatorio = !!c?.obligatorio;
                    const opciones = Array.isArray(c?.opciones) ? c.opciones : [];
                    const opcionesTxt = opciones.length ? opciones.join(', ') : '—';
                    const nombre = c?.nombre ?? '—';

                    return (
                      <tr key={`${nombre}-${idx}`} className="hover:bg-gray-50">
                        <td className="p-2 border font-medium text-text">{etiqueta}</td>
                        <td className="p-2 border text-gray-700">{tipo}</td>
                        <td className="p-2 border text-center">
                          <span
                            className={`px-2 py-1 rounded text-xs border ${
                              obligatorio
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-gray-200 bg-gray-50 text-gray-700'
                            }`}
                          >
                            {obligatorio ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="p-2 border text-gray-700" title={opcionesTxt}>{opcionesTxt}</td>
                        <td className="p-2 border text-gray-600">{nombre}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-base font-semibold text-text">Pasos de elaboración</h2>

          {pasos.length > 0 ? (
            <div className="mt-3 space-y-3">
              {pasos.map((paso) => (
                <div key={paso.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-semibold text-text">Paso {paso.orden}</div>
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
                  <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{paso.descripcion}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-600">No se registraron pasos.</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-base font-semibold text-text">Recetas que usan esta pauta</h2>

          {recetas.length > 0 ? (
            <div className="mt-3">
              <Table
                columns={[
                  { header: 'ID', accessor: 'id' },
                  {
                    header: 'Receta',
                    accessor: 'nombre',
                    Cell: ({ row, value }) => (
                      <button
                        onClick={() => navigate(`/Recetas/${row.id}`)}
                        className="text-primary hover:text-primary-dark underline"
                        title={value || ''}
                      >
                        {value || '—'}
                      </button>
                    ),
                  },
                  { header: 'Tipo', accessor: 'tipo' },
                  { header: 'Unidad', accessor: 'unidad_medida' },
                ]}
                data={recetas}
              />
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-600">No hay recetas que usen esta pauta.</div>
          )}
        </div>
      </div>
    </div>
  );
}
