import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function SubproductosDecision() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ordenData, setOrdenData] = useState(null);
  const [hasSubproductos, setHasSubproductos] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const ordenData = await api(`/ordenes_manufactura/${id}`);
        setOrdenData(ordenData);
        
        // Check if the recipe has possible subproducts
        const hasPosiblesSubproductos = ordenData?.receta?.posiblesSubproductos?.length > 0;
        setHasSubproductos(hasPosiblesSubproductos);
        
        // If no possible subproducts, automatically redirect to production final
        if (!hasPosiblesSubproductos) {
          console.log('No subproducts, redirecting to produccion-final');
          navigate(`/Orden_de_Manufactura/${id}/produccion-final`);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error(err.message || "Error al cargar los datos.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  const handleSubproductosYes = () => {
    navigate(`/Orden_de_Manufactura/${id}/registrar-subproductos`);
  };

  const handleSubproductosNo = () => {
    navigate(`/Orden_de_Manufactura/${id}/produccion-final`);
  };


  if (loading || !ordenData) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
        <div className="flex justify-center items-center h-32">
          <div className="text-gray-500">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">¿Se produjeron subproductos?</h1>
      
      <div className="mb-6">
        <p className="text-gray-700 mb-4">
          Durante el proceso de manufactura, ¿se generaron subproductos que necesitan ser registrados?
        </p>
        
        {hasSubproductos && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <h3 className="font-medium text-blue-900 mb-2">Subproductos posibles:</h3>
            <ul className="text-sm text-blue-800">
              {ordenData.receta.posiblesSubproductos.map((subproducto) => (
                <li key={subproducto.id}>• {subproducto.nombre}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <button
          onClick={handleSubproductosYes}
          className="w-full px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
        >
          Sí, registrar subproductos
        </button>
        
        <button
          onClick={handleSubproductosNo}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          No, continuar con producción final
        </button>
        
      </div>

      <div className="mt-6 pt-4 border-t">
        <button
          onClick={() => navigate(`/Orden_de_Manufactura/${id}`)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          ← Volver a la orden
        </button>
      </div>
    </div>
  );
}
