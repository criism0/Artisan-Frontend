import { CheckCircle2 } from 'lucide-react';
import axiosInstance from "../../axiosInstance";
import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

export default function RecepcionarSolicitud() {
  const { solicitudId } = useParams();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [solicitud, setSolicitud] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        setError(null);

        const [resSolicitud, resBultos] = await Promise.all([
          axiosInstance.get(`/solicitudes-mercaderia/${solicitudId}`),
          axiosInstance.get(`/solicitudes-mercaderia/${solicitudId}/bultos`),
        ]);

        setSolicitud(resSolicitud.data);
        setBultos(resBultos.data);
      } catch {
        setError('Error al cargar información de la solicitud');
      } finally {
        setLoadingData(false);
      }
    };

    const preloadCantidades = () => {
      // Default: si hay datos previos en backend, los respetamos; si no, dejamos vacío.
      // No llenamos automático para evitar recepciones accidentales.
      setCantidades({});
    };

    fetchData();
    preloadCantidades();
  }, [solicitudId]);

  const handleChange = (id, value) => {
    setCantidades({ ...cantidades, [id]: Number(value) });
  };

  const getMateriaPrima = (row) => row?.materiaPrima ?? row?.MateriaPrima ?? null;
  const getUnidadMedida = (row) => {
    const mp = getMateriaPrima(row);
    const u = mp?.unidad_medida;
    return u ? String(u).toUpperCase() : "—";
  };
  const getUnidadesDespachadas = (row) =>
    row?.unidades_disponibles ?? row?.cantidad_unidades ?? "—";

  const handleRecepcionar = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const totalRecepcionada = Object.values(cantidades).reduce((a, b) => a + b, 0);
      await axiosInstance.put(`/solicitudes-mercaderia/${solicitudId}/recepcionar`, {
        cantidades,
        totalRecepcionada,
      });
      setSuccess('Solicitud recepcionada correctamente');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al recepcionar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { accessor: 'identificador', header: 'Identificador' },
    {
        header: 'Insumo',
        accessor: 'MateriaPrima.nombre',
        Cell: ({ row }) => getMateriaPrima(row)?.nombre || '—',
    },
    {
      header: 'Unidades Despachadas',
      accessor: 'unidades_despachadas',
      Cell: ({ row }) => (
        <span className="whitespace-nowrap">{getUnidadesDespachadas(row)}</span>
      ),
    },
    {
      header: 'Peso Unitario',
      accessor: 'peso_unitario',
      Cell: ({ row }) => {
        const unidad = getUnidadMedida(row);
        const peso = row?.peso_unitario;
        if (peso == null || peso === '') return <span className="whitespace-nowrap">—</span>;
        return (
          <span className="whitespace-nowrap">
            {peso} {unidad === '—' ? '' : unidad}
          </span>
        );
      },
    },
    {
      accessor: 'cantidad_recepcionada',
      header: 'Cantidad Recepcionada',
      Cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <input
            type="number"
            min="0"
            step="1"
            max={Number(getUnidadesDespachadas(row)) || undefined}
            value={cantidades[row.id] || ''}
            onChange={(e) => handleChange(row.id, e.target.value)}
            placeholder="Ej: 0"
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
          <span className="text-xs text-gray-500">
            Máx: {getUnidadesDespachadas(row)} unidades
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Solicitudes" />
      </div>

      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-text">Recepcionar Solicitud</h1>
          <p className="text-sm text-gray-600 mt-1">
            Ingresa la cantidad recepcionada por bulto según lo despachado.
          </p>
        </div>

        {(loadingData || (!solicitud && !error)) && (
          <div className="bg-white rounded-lg shadow p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-text">Cargando información...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 rounded-lg p-4">{error}</div>
        )}

        {solicitud && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "ID", value: solicitud.id },
                { label: "Estado", value: solicitud.estado },
                { label: "Bodega Proveedora", value: solicitud?.bodegaProveedora?.nombre },
                { label: "Bodega Solicitante", value: solicitud?.bodegaSolicitante?.nombre },
                { label: "N° Guía Despacho", value: solicitud?.numero_guia_despacho },
                { label: "Medio de Transporte", value: solicitud?.medio_transporte },
                { label: "Fecha de envío", value: formatDateTime(solicitud?.fecha_envio) },
              ].map((field) => (
                <div className="flex items-center" key={field.label}>
                  <label className="block text-sm font-medium text-gray-700 w-1/3">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={field.value ?? "—"}
                    disabled
                    className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg text-primary font-medium mb-4">Bultos</h2>

          {bultos.length > 0 ? (
            <Table columns={columns} data={bultos} />
          ) : (
            <p className="text-gray-600">No hay bultos disponibles para recepcionar.</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleRecepcionar}
              disabled={loading || loadingData || bultos.length === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-60"
            >
              {loading ? 'Procesando...' : 'Recepcionar'}
            </button>
          </div>

          {success && (
            <div className="text-green-700 flex items-center gap-2 mt-4">
              <CheckCircle2 className="w-5 h-5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}