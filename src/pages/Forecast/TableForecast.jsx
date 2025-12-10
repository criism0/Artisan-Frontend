import { useEffect, useState } from "react";
import { useApi } from "../../lib/api";

export default function TableForecast() {
  const [data, setData] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [predicciones, setPredicciones] = useState([]);
  const [importYear, setImportYear] = useState(""); // Estado para el año de importación
  const [importFile, setImportFile] = useState(null); // Estado para el archivo CSV

  // Verificar si el usuario es admin
  
  const apiFetch = useApi();
  useEffect(() => {
    // TODO: ELIMINAR TODO ESTO
    const verifyUser = async () => {
      try {
        const response = await apiFetch(`/auth/login`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          }
        });

        if (response.ok) {
          // TODO: Check this!
          const data = await response.json();
          // setUserRole(data.user.rol);
        }
      } catch (error) {
        console.error('Error verificando usuario:', error);
      }
    };
    verifyUser();
  }, []);

  // TODO: (DANKO O TOM): CAMMBIAR ESTE CHECK
  const isAdmin = true;

  useEffect(() => {
    apiFetch(`/forecasts_all`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        const productosUnicos = [...new Set(json.map((row) => row.producto))];
        setProductos(productosUnicos);
        if (productosUnicos.length > 0) {
          setProductoSeleccionado(productosUnicos[0]);
        }
      });
  }, []);

  useEffect(() => {
    const filtradas = data.filter((row) => row.producto === productoSeleccionado);
    setPredicciones(filtradas);
  }, [productoSeleccionado, data]);

  // Extraer fechas únicas ordenadas
  const fechas = [...new Set(predicciones.map((row) => row.fecha))].sort();

  // Extraer predicciones por fecha
  const predMap = Object.fromEntries(fechas.map((f) => [f, 0]));
  let modelo = "";
  let r2 = null;

  predicciones.forEach((row) => {
    predMap[row.fecha] = row.prediccion;
    modelo = row.modelo;
    r2 = row.r2;
  });

  const total = Object.values(predMap).reduce((a, b) => a + b, 0);

  const columns = [
    {
      header: "Total",
      accessor: "total"
    }
  ];

  // Función para manejar la importación de CSV
  const handleImportCsv = async () => {
    if (!importFile) {
      alert('Selecciona un archivo CSV para importar.');
      return;
    }
    if (!importYear || isNaN(importYear)) {
      alert('Ingresa un año válido para la importación.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('ano_ordenes', importYear);
      const response = await apiFetch(`/ordenes-venta/import-csv`, {
        method: 'POST',
        body: formData,
      });
      alert(response.data?.message || 'Importación completada');
    } catch (err) {
      console.error('Error al importar CSV:', err);
      alert('Error al importar CSV');
    }
  };

  // Función para manejar la exportación de CSV
  // Exportar CSV
  const handleExportCsv = async () => {
    try {
      const response = await apiFetch(`/ordenes-venta/export-csv`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json', 
        },
      });

      if (!response.ok) {
        throw new Error('Error al exportar CSV');
      }

      // Crear URL del archivo CSV desde el blob recibido
      const url = window.URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ordenes_venta.csv'); // nombre del archivo descargado
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Error al exportar CSV:', err);
      alert('Error al exportar CSV');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Predicción de ventas</h1>

      {isAdmin && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Año de ordenes"
              value={importYear}
              onChange={(e) => setImportYear(e.target.value)}
              className="border px-2 py-1 w-32"
            />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files[0])}
              className="border px-2 py-1"
            />
            <button
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
              onClick={handleImportCsv}
            >
              Importar CSV
            </button>
            <button
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
              onClick={handleExportCsv}
            >
              Exportar CSV
            </button>
          </div>
        </>
      )}

      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium">Selecciona un producto:</label>
        <select
          className="border border-gray-300 px-3 py-1 rounded w-full sm:w-1/2"
          value={productoSeleccionado}
          onChange={(e) => setProductoSeleccionado(e.target.value)}
        >
          {productos.map((prod, i) => (
            <option key={i} value={prod}>
              {prod}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Producto: {productoSeleccionado}</h2>
        <p className="text-sm text-gray-600">
          Modelo: <span className="font-medium">{modelo}</span> | R²:{" "}
          <span className={`${r2 < 0 ? "text-red-500" : r2 > 0.9 ? "text-green-600" : ""}`}>
            {r2?.toFixed(3)}
          </span>
        </p>
      </div>

      {predicciones.length > 0 ? (
        <div className="overflow-auto bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {fechas.map((fecha, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    {fecha}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-border">
              <tr className="hover:bg-gray-50">
                {fechas.map((fecha, i) => (
                  <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-right text-text">
                    {predMap[fecha]?.toFixed(2)} cajas
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-text">
                  {total.toFixed(2)} cajas
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No hay predicciones disponibles para este producto.</p>
      )}
    </div>
  );
}

