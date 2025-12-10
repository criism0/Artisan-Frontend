import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";
import axios from "axios";
import { API_BASE } from "../../lib/api";

export default function ValidarOrden() {
  const navigate = useNavigate();
  const { ordenId } = useParams();
  const [ordenData, setOrdenData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const fetchOrden = async () => {
      try {
        const response = await axios.get(`${API_BASE}/proceso-compra/ordenes/${ordenId}`);
        const raw = response.data;

        const insumos = raw.materiasPrimas.map(mp => ({
          id: mp.id,
          nombre: mp.proveedorMateriaPrima?.MateriaPrima?.nombre || "—",
          cantidad: mp.cantidad,
          precio_unitario: mp.precio_unitario,
        }));

        setOrdenData({
          ...raw,
          proveedor: raw.Proveedor?.nombre_empresa || raw.id_proveedor,
          lugar: raw.BodegaDestino?.nombre || "—",
          numero: `OC-${String(raw.id).padStart(3, "0")}`,
          fecha_emision: raw.fecha,
          insumos,
        });
      } catch (error) {
        console.error("Error al cargar la orden:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (ordenId) fetchOrden();
  }, [ordenId]);

  const handleValidar = async () => {
    try {
      await axios.put(`${API_BASE}/proceso-compra/ordenes/${ordenId}/validar`);
      setShowConfirmation(true);
    } catch (error) {
      console.error("Error al validar la orden:", error);
    }
  };

  const columns = [
    {
      header: "Insumo",
      accessor: "nombre",
    },
    {
      header: "Cantidad",
      accessor: "cantidad",
    },
    {
      header: "Precio Unitario",
      accessor: "precio_unitario",
      Cell: ({ value }) => `$${value.toLocaleString()}`,
    },
    {
      header: "Total",
      accessor: "total",
      Cell: ({ row }) => `$${(row.cantidad * row.precio_unitario).toLocaleString()}`,
    }
  ];

  if (isLoading || !ordenData) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex justify-center items-center h-64">
          <span className="text-text">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">Validar Orden de Compra</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Fecha de emisión
            </label>
            <input
              type="date"
              value={ordenData.fecha_emision?.substring(0, 10)}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Proveedor
            </label>
            <input
              type="text"
              value={ordenData.proveedor}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Lugar
            </label>
            <input
              type="text"
              value={ordenData.lugar}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Número
            </label>
            <input
              type="text"
              value={ordenData.numero}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Estado
            </label>
            <input
              type="text"
              value={ordenData.estado}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>

          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Condiciones
            </label>
            <input
              type="text"
              value={ordenData.condiciones}
              disabled
              className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg text-primary font-medium mb-4">Insumos</h2>
        <Table columns={columns} data={ordenData.insumos} />
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={handleValidar}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          Validar Orden
        </button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Orden Validada</h3>
            <p className="text-sm text-gray-700 mb-4">La orden ha sido validada correctamente.</p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() => navigate("/Ordenes")}
              >
                Volver al Listado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}