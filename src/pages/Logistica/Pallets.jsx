import React, { useEffect, useState, useMemo } from "react";
import Table from "../../components/Table";
import axiosInstance from "../../axiosInstance";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";

function formatDate(value) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Santiago",
    }).format(d);
  } catch {
    return value;
  }
}

export default function Pallets() {
  const [pallets, setPallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPallets = async () => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.get(
          "/solicitudes-mercaderia/lista-para-despacho"
        );

        // Transformamos cada solicitud y su pallet en una sola lista
        const list = data.flatMap((sol) =>
          sol.pallets.map((p) => ({
            id: p.id,
            identificador: p.identificador,
            estado: p.estado,
            origen: sol.bodegaProveedora?.nombre || "-",
            destino: sol.bodegaSolicitante?.nombre || "-",
            fecha_envio: sol.fecha_envio,
            medio_transporte: sol.medio_transporte,
            bultos: Array.isArray(p.bultos) ? p.bultos.length : "-",
          }))
        );
        setPallets(list);
      } catch (err) {
        console.error(err);
        setError("Error al obtener pallets listos para despacho");
      } finally {
        setLoading(false);
      }
    };
    fetchPallets();
  }, []);

  const generarEtiqueta = async (pallet) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 100],
    });

    const qrData = await QRCode.toDataURL(`${pallet.identificador}`, { width: 100 });
    pdf.addImage(qrData, "PNG", 20, 10, 40, 40);
    pdf.setFontSize(14);
    pdf.text(`${pallet.identificador}`, 40, 60, { align: "center" });
    pdf.setFontSize(12);
    pdf.text(`ID: ${pallet.id}`, 40, 70, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`${pallet.origen} → ${pallet.destino}`, 40, 80, { align: "center" });
    pdf.save(`Etiqueta_${pallet.identificador}.pdf`);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pallets.filter(
      (p) =>
        p.identificador?.toLowerCase().includes(q) ||
        p.origen?.toLowerCase().includes(q) ||
        p.destino?.toLowerCase().includes(q)
    );
  }, [search, pallets]);

  const rows = filtered.map((p) => ({
    id: p.id,
    identificador: p.identificador,
    estado: p.estado,
    origen: p.origen,
    destino: p.destino,
    fecha_envio: formatDate(p.fecha_envio),
    bultos: p.bultos,
    acciones: (
      <button
        onClick={() => generarEtiqueta(p)}
        className="p-1 text-gray-600 hover:text-green-600 transition"
        title="Descargar etiqueta QR"
      >
        <Download size={17} strokeWidth={1.5} />
      </button>
    ),
  }));

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Identificador", accessor: "identificador" },
    { header: "Estado", accessor: "estado" },
    { header: "Origen", accessor: "origen" },
    { header: "Destino", accessor: "destino" },
    { header: "Fecha Envío", accessor: "fecha_envio" },
    { header: "Bultos", accessor: "bultos" },
    { header: "Acciones", accessor: "acciones" },
  ];

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pallets Listos para Despacho</h1>
        <Link
          to="/Pallets/dashboard"
          className="px-3 py-2 bg-primary text-white rounded hover:bg-hover text-sm"
        >
          Ir a Pallets Dashboard
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por identificador, origen o destino..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {loading ? (
        <div className="py-10 text-sm opacity-80">Cargando pallets…</div>
      ) : error ? (
        <div className="py-10 text-red-600">{error}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-sm opacity-80">No hay pallets listos para despacho.</div>
      ) : (
        <Table columns={columns} data={rows} />
      )}
    </div>
  );
}
