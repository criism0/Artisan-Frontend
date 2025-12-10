import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";

export default function EnviosDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔹 Obtener detalles de la solicitud
        const resSolicitud = await axiosInstance.get(`/solicitudes-mercaderia/${id}`);
        setSolicitud(resSolicitud.data);

        // 🔹 Obtener bultos asociados
        const resBultos = await axiosInstance.get(`/solicitudes-mercaderia/${id}/bultos`);
        setBultos(resBultos.data);
      } catch (err) {
        console.error("Error al cargar detalle:", err);
        setError("Error al cargar los datos del envío");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const generarPDF = async () => {
    if (!solicitud) return;
    const doc = new jsPDF();
    const textoQR = `SM${solicitud.id} - ${solicitud.bodegaProveedora?.nombre} → ${solicitud.bodegaSolicitante?.nombre}`;
    const qrData = await QRCode.toDataURL(textoQR);

    doc.addImage(qrData, "PNG", 160, 10, 40, 40);
    doc.setFontSize(16);
    doc.text(`Solicitud de Mercadería #${solicitud.id}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Origen: ${solicitud.bodegaProveedora?.nombre || "-"}`, 14, 30);
    doc.text(`Destino: ${solicitud.bodegaSolicitante?.nombre || "-"}`, 14, 37);
    doc.text(`Estado: ${solicitud.estado}`, 14, 44);
    doc.text(`Fecha envío: ${new Date(solicitud.fecha_envio).toLocaleDateString("es-CL")}`, 14, 51);

    doc.text("Bultos asociados:", 14, 65);
    let y = 72;
    bultos.forEach((b) => {
      doc.text(
        `• ${b.identificador} | ${b.materiaPrima?.nombre || "-"} | ${b.unidades_disponibles} u. | ${b.peso_unitario} ${b.materiaPrima?.unidad_medida || ""}`,
        14,
        y
      );
      y += 7;
    });

    doc.save(`Solicitud_${solicitud.id}.pdf`);
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!solicitud) return <div className="p-6 text-gray-500">No se encontró la solicitud</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate("/envios")}
          className="flex items-center text-gray-700 hover:text-blue-600"
        >
          <ArrowLeft size={18} className="mr-2" />
          Volver a Envíos
        </button>
        <button
          onClick={generarPDF}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Descargar PDF
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-6">
        Detalle de Solicitud #{solicitud.id}
      </h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Información general</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <p><strong>Origen:</strong> {solicitud.bodegaProveedora?.nombre || "-"}</p>
          <p><strong>Destino:</strong> {solicitud.bodegaSolicitante?.nombre || "-"}</p>
          <p><strong>Estado:</strong> {solicitud.estado}</p>
          <p>
            <strong>Fecha de envío:</strong>{" "}
            {solicitud.fecha_envio
              ? new Date(solicitud.fecha_envio).toLocaleDateString("es-CL")
              : "-"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Bultos asociados</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border-b">Identificador</th>
              <th className="p-2 border-b">Materia Prima</th>
              <th className="p-2 border-b">Cantidad</th>
              <th className="p-2 border-b">Peso Unitario</th>
              <th className="p-2 border-b">Pallet</th>
              <th className="p-2 border-b">Precio Unitario</th>
            </tr>
          </thead>
          <tbody>
            {bultos.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="p-2 border-b">{b.identificador}</td>
                <td className="p-2 border-b">{b.materiaPrima?.nombre || "-"}</td>
                <td className="p-2 border-b">{b.unidades_disponibles}</td>
                <td className="p-2 border-b">{b.peso_unitario}</td>
                <td className="p-2 border-b">{b.pallet?.identificador || "-"}</td>
                <td className="p-2 border-b">${b.precio_unitario?.toLocaleString() || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
