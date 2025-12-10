import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";
import OrderSummary from "../../components/OrderSummary";
import { FiDownload } from "react-icons/fi";
import axios from "axios";
import { API_BASE } from "../../lib/api";

export default function EnviarOrden() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [ordenData, setOrdenData] = useState(null);
  const [_isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const fetchOrden = async () => {
      try {
        const response = await axios.get(`${API_BASE}/ordenes/${id}`);
        setOrdenData(response.data);
      } catch (error) {
        console.error("Error al cargar la orden:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrden();
  }, [id]);

  const handleDescargar = () => {
    // Aquí irá la lógica para generar y descargar el PDF
    console.log("Descargando orden:", ordenData);
  };

  const handleEnviar = () => {
    // Aquí irá la lógica para enviar la orden
    console.log("Enviando orden:", ordenData);
    navigate("/Ordenes");
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

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">Enviar Orden de Compra</h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 w-1/3">
              Fecha de emisión
            </label>
            <input
              type="date"
              value={ordenData.fecha_emision}
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
        <Table
          columns={columns}
          data={ordenData.insumos}
        />
        <OrderSummary />
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={handleDescargar}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <FiDownload className="w-5 h-5" />
          <span>Descargar OC</span>
        </button>
        <button
          onClick={handleEnviar}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          Enviar Orden
        </button>
      </div>
    </div>
  );
} 