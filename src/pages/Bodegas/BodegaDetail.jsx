import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";

export default function BodegaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [bodega, setBodega] = useState(null);
  const [encargados, setEncargados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBodega = async () => {
      try {
        const bodegaData = await apiFetch(`/bodegas/${id}`);
        setBodega(bodegaData);
      } catch (error) {
        console.error("Error al obtener bodega:", error);
        setError("No se pudo cargar la información de la bodega.");
      } finally {
        setLoading(false);
      }
    };

    const fetchEncargados = async () => {
      try {
        const encargadosData = await apiFetch(`/bodegas/${id}/encargados`);
        setEncargados(encargadosData.encargados || []);
      } catch (error) {
        console.error("Error al obtener encargados:", error);
      }
    };

    fetchBodega();
    fetchEncargados();
  }, [id, apiFetch]);

  const handleDeleteBodega = async () => {
    try {
      await apiFetch(`/bodegas/${id}`, { method: "DELETE" });
      navigate("/Bodegas");
    } catch (error) {
      console.error("Error eliminando bodega:", error);
      setError("Error al eliminar la bodega.");
    }
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex justify-center items-center">
        <span className="text-primary">Cargando información...</span>
      </div>
    );

  if (!bodega)
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          No se encontró la bodega.
        </div>
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Bodegas" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de la Bodega</h1>
        <button
          onClick={handleDeleteBodega}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Eliminar Bodega
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* INFORMACIÓN DE LA BODEGA */}
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text mb-4">Información de la Bodega</h2>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700 w-1/3">ID</td>
                  <td className="py-2">{bodega.id}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700">Nombre</td>
                  <td className="py-2">{bodega.nombre}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700">Región</td>
                  <td className="py-2">{bodega.region}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700">Comuna</td>
                  <td className="py-2">{bodega.comuna}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-700">Dirección</td>
                  <td className="py-2">{bodega.direccion}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <button
              onClick={() => navigate(`/Bodegas/${id}/edit`)}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded w-full"
            >
              Modificar Información Bodega
            </button>
          </div>
        </div>

        {/* ENCARGADOS */}
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text mb-4">Encargados de la Bodega</h2>
            {encargados.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left py-2 px-3">ID</th>
                    <th className="text-left py-2 px-3">Nombre</th>
                    <th className="text-left py-2 px-3">Correo</th>
                    <th className="text-left py-2 px-3">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {encargados.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 px-3">{e.usuario?.id}</td>
                      <td className="py-2 px-3">{e.usuario?.nombre}</td>
                      <td className="py-2 px-3">{e.usuario?.email}</td>
                      <td className="py-2 px-3 capitalize">{e.usuario?.rol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">No hay encargados asignados.</p>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={() => navigate(`/Bodegas/${id}/encargados`)}
              className="bg-secondary hover:bg-secondary-dark text-white px-4 py-2 rounded w-full"
            >
              Modificar Encargados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
