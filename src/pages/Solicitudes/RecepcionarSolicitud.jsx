import { CheckCircle2 } from 'lucide-react';
import axiosInstance from "../../axiosInstance";
import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function RecepcionarSolicitud() {
  const { solicitudId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [cantidades, setCantidades] = useState({});

  useEffect(() => {
    const fetchBultos = async () => {
      try {
        const res = await axiosInstance.get(`/solicitudes-mercaderia/${solicitudId}/bultos`);
        setBultos(res.data);
      } catch {
        setError('Error al cargar bultos de la solicitud');
      }
    };
    fetchBultos();
  }, [solicitudId]);

  const handleChange = (id, value) => {
    setCantidades({ ...cantidades, [id]: Number(value) });
  };

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
        Cell: ({ row }) => row.MateriaPrima?.nombre || '—',
    },
    { accessor: 'unidades_disponibles', header: 'Unidades Despachadas' },
    {
      accessor: 'cantidad_recepcionada',
      header: 'Cantidad Recepcionada',
      Cell: ({ row }) => (
        <input
          type="number"
          min="0"
          max={row.unidades_disponibles}
          value={cantidades[row.id] || ''}
          onChange={(e) => handleChange(row.id, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded"
        />
      ),
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Recepción de Solicitud</h3>
        <BackButton />
      </div>

      {bultos.length > 0 ? (
        <Table columns={columns} data={bultos} />
      ) : (
        <p className="text-gray-600">No hay bultos disponibles para recepcionar.</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleRecepcionar}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          {loading ? 'Procesando...' : 'Recepcionar'}
        </button>
      </div>

      {success && (
        <div className="text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
    </div>
  );
}