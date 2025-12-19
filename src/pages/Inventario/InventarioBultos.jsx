import React, { useEffect, useState } from "react";
import axiosInstance from "../../axiosInstance";
import DividirBultoModal from "../../components/DividirBultoModal";
import { toast } from "../../lib/toast";

export default function InventarioBultos() {
  const [bodegas, setBodegas] = useState([]);
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("");
  const [bultos, setBultos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [bultoADividir, setBultoADividir] = useState(null);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await axiosInstance.get("/bodegas");
        if (res.data && Array.isArray(res.data.bodegas)) {
          //const bodegasActivos = res.data.bodegas.filter((b) => b.nombre !== "En tránsito"); // Aparece en transito
          setBodegas(res.data.bodegas);
        }
      } catch (error) {
        console.error("Error al obtener bodegas:", error);
      }
    };
    fetchBodegas();
  }, []);

  const fetchBultos = async () => {
    if (!bodegaSeleccionada) return;
    setCargando(true);
    try {
      const res = await axiosInstance.get(`/inventario/${bodegaSeleccionada}/bultos`);
      setBultos(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error al obtener bultos:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchBultos();
  }, [bodegaSeleccionada]);

  const bultosFiltrados = bultos.filter((b) => {
    const q = busqueda.toLowerCase();
    return (
      b.identificador?.toLowerCase().includes(q) ||
      b.materiaPrima?.nombre?.toLowerCase().includes(q)
    );
  });

  const generarEtiqueta = async (bulto) => {
    try {
      const response = await axiosInstance.post(
        "/bultos/etiquetas",
        { ids_bultos: [bulto.id] },
        { responseType: "blob" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiqueta_${bulto.identificador || bulto.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar etiqueta:", error);
      toast.error("No se pudo descargar la etiqueta. Revisa la consola.");
    }
  };



  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Inventario de Bultos</h1>

      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div>
          <label className="font-semibold mr-2">Seleccionar Bodega:</label>
          <select
            className="border rounded px-3 py-2"
            value={bodegaSeleccionada}
            onChange={(e) => setBodegaSeleccionada(e.target.value)}
          >
            <option value="">Seleccione bodega...</option>
            {bodegas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} — {b.comuna}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Buscar por materia prima o identificador..."
          className="border rounded px-3 py-2 flex-1"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          disabled={!bodegaSeleccionada}
        />
      </div>

      {!bodegaSeleccionada ? (
        <p className="text-gray-600">Seleccione una bodega para ver su inventario.</p>
      ) : cargando ? (
        <p className="text-gray-600">Cargando bultos...</p>
      ) : bultosFiltrados.length === 0 ? (
        <p className="text-gray-600">No hay bultos registrados para esta bodega.</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded">
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Identificador</th>
                <th className="p-2 border">Item</th>
                <th className="p-2 border">Peso Formato</th>
                <th className="p-2 border">Disponible</th>
                <th className="p-2 border">Costo</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bultosFiltrados.map((b) => {
                const unidad = b.materiaPrima?.unidad_medida || b.loteProductoFinal?.productoBase?.unidad_medida || "";
                const nombre = b.materiaPrima?.nombre || b.loteProductoFinal?.productoBase?.nombre || "Desconocido";
                const cantidadTotal = (b.cantidad_unidades * b.peso_unitario).toFixed(2);
                const cantidadDisponible = (b.unidades_disponibles * b.peso_unitario).toFixed(2);
                const costoTotal = b.costo_unitario * b.unidades_disponibles;
                
                return (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{b.id}</td>
                  <td className="p-2 border">{b.identificador}</td>
                  <td className="p-2 border">{nombre}</td>

                  <td className="p-2 border">{b.peso_unitario} {unidad}</td>
                  <td className="p-2 border">
                     <div className="font-medium">{cantidadDisponible} {unidad}</div>
                     <div className="text-xs text-gray-500">({b.unidades_disponibles}/{b.cantidad_unidades} un.)</div>
                  </td>
                  <td className="p-2 border">
                    <div className="font-medium">Total: {costoTotal ? `$${costoTotal}` : '-'}</div>
                  </td>
                  <td className="p-2 border text-center space-x-2">
                    <button
                      onClick={() => generarEtiqueta(b)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Descargar Etiqueta
                    </button>
                    <button
                      onClick={() => setBultoADividir(b)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Dividir
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {bultoADividir && (
        <DividirBultoModal
          bulto={bultoADividir}
          onClose={() => setBultoADividir(null)}
          onSuccess={fetchBultos}
        />
      )}
    </div>
  );
}