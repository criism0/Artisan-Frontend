import React, { useEffect, useState } from "react";
import axiosInstance from "../../axiosInstance";
import jsPDF from "jspdf";
import QRCode from "qrcode";

export default function InventarioBultos() {
  const [bodegas, setBodegas] = useState([]);
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState("");
  const [bultos, setBultos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);

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

  useEffect(() => {
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
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 100],
  });

  const qrData = await QRCode.toDataURL(bulto.identificador, { width: 120 });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("ETIQUETA DE BULTO", 40, 10, { align: "center" });
  pdf.line(10, 12, 70, 12);

  pdf.addImage(qrData, "PNG", 25, 18, 30, 30);

  pdf.setFontSize(14);
  pdf.text(bulto.identificador, 40, 55, { align: "center" });

  pdf.line(10, 58, 70, 58);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(`ID: ${bulto.id}`, 40, 68, { align: "center" });

  pdf.setFontSize(10);
  const nombreMateria = bulto.materiaPrima?.nombre
    ? bulto.materiaPrima.nombre
    : "Materia prima desconocida";
  pdf.text(nombreMateria, 40, 80, { align: "center", maxWidth: 60 });

  pdf.save(`Etiqueta_${bulto.identificador}.pdf`);
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
                <th className="p-2 border">Materia Prima</th>
                <th className="p-2 border">Cantidad</th>
                <th className="p-2 border">Peso Unitario</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bultosFiltrados.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{b.id}</td>
                  <td className="p-2 border">{b.identificador}</td>
                  <td className="p-2 border">{b.materiaPrima?.nombre}</td>
                  <td className="p-2 border">{b.cantidad_unidades}</td>
                  <td className="p-2 border">{b.peso_unitario}</td>
                  <td className="p-2 border text-center">
                    <button
                      onClick={() => generarEtiqueta(b)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Descargar Etiqueta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}