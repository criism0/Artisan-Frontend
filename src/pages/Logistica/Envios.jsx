import React, { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../axiosInstance";
import Table from "../../components/Table";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { useNavigate } from "react-router-dom";
import { Eye, Code2 } from "lucide-react";

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

export default function Envios() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estado, setEstado] = useState("");
  const navigate = useNavigate();

  const fetchSolicitudes = async () => {
    setLoading(true);
    try {
      const urls = [
        `${import.meta.env.VITE_BACKEND_URL}/solicitudes-mercaderia/lista-para-despacho`,
        `${import.meta.env.VITE_BACKEND_URL}/solicitudes-mercaderia/validada`,
        `${import.meta.env.VITE_BACKEND_URL}/solicitudes-mercaderia/en-transito`,
      ];

      const responses = await Promise.all(urls.map((url) => axiosInstance.get(url)));
      const all = responses.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
      setSolicitudes(all);
    } catch (err) {
      setError(err.message || "Error al cargar los envíos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
  }, []);

  const generarEtiqueta = async (s) => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 100],
    });

    const textoQR = `SM${s.id} - ${s.bodegaProveedora?.nombre || "-"} → ${
      s.bodegaSolicitante?.nombre || "-"
    }`;

    const qrData = await QRCode.toDataURL(textoQR, { width: 100 });

    pdf.addImage(qrData, "PNG", 20, 10, 40, 40);
    pdf.setFontSize(14);
    pdf.text(`SM${s.id}`, 40, 60, { align: "center" });
    pdf.setFontSize(12);
    pdf.text(s.bodegaProveedora?.nombre || "-", 40, 70, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(s.bodegaSolicitante?.nombre || "-", 40, 80, { align: "center" });
    pdf.save(`Etiqueta_SM${s.id}.pdf`);
  };

  const getEstadoChip = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold inline-block";

    const normalizeEstadoSolicitud = (raw) => {
      if (!raw) return raw;
      switch (raw) {
        case "Recepcionada Completa":
          return "Recepción Completa";
        case "Recepcionada Parcial Falta Stock":
          return "Recepción Parcial";
        case "Recepcionada Parcial Perdida":
          return "Recepción Parcial con Pérdida";
        default:
          return raw;
      }
    };

    const normalized = normalizeEstadoSolicitud(estado);

    switch ((normalized || "").toLowerCase()) {
      case "lista para despacho":
        return <span className={`${base} bg-yellow-100 text-yellow-800`}>Lista para despacho</span>;
      case "validada":
        return <span className={`${base} bg-blue-100 text-blue-800`}>Validada</span>;
      case "en transito":
        return <span className={`${base} bg-indigo-100 text-indigo-800`}>En tránsito</span>;
      case "recepción completa":
      case "recepcionada completa":
      case "completada":
      case "recepcionada":
        return <span className={`${base} bg-green-200 text-green-900`}>Recepción Completa</span>;
      case "recepción completa con pérdida":
        return <span className={`${base} bg-amber-100 text-amber-900`}>Recepción Completa con Pérdida</span>;
      case "recepción parcial":
        return <span className={`${base} bg-yellow-100 text-yellow-900`}>Recepción Parcial</span>;
      case "recepción parcial con pérdida":
      case "recepcionada parcial perdida":
        return <span className={`${base} bg-orange-100 text-orange-900`}>Recepción Parcial con Pérdida</span>;
      case "recepcionada parcial falta stock":
        return <span className={`${base} bg-yellow-100 text-yellow-900`}>Recepción Parcial</span>;
      default:
        return <span className={`${base} bg-gray-200 text-gray-700`}>{normalized || "-"}</span>;
    }
  };

  const filtered = useMemo(() => {
    if (!estado) return solicitudes;
    return solicitudes.filter(
      (s) => {
        const raw = s.estado;
        const normalized =
          raw === "Recepcionada Completa"
            ? "Recepción Completa"
            : raw === "Recepcionada Parcial Falta Stock"
              ? "Recepción Parcial"
              : raw === "Recepcionada Parcial Perdida"
                ? "Recepción Parcial con Pérdida"
                : raw;
        return (normalized || "").toLowerCase() === estado.toLowerCase();
      }
    );
  }, [solicitudes, estado]);

  const rows = useMemo(
    () =>
      filtered.map((s) => ({
        id: s.id,
        identificador:
          s.Pallets?.map((p) => p.identificador).join(", ") || "—",
        origen: s.bodegaProveedora?.nombre || "-",
        destino: s.bodegaSolicitante?.nombre || "-",
        fecha_envio: formatDate(s.fecha_envio),
        estado: getEstadoChip(s.estado),
        bultos: s.Pallets?.reduce(
          (acc, p) => acc + (p.Bultos?.length || 0),
          0
        ),
        acciones: (
          <div className="flex gap-2 justify-center items-center">
            <button
              onClick={() => navigate(`/envios/${s.id}`)}
              className="p-1 text-gray-600 hover:text-blue-600 transition"
              title="Ver detalle"
            >
              <Eye size={17} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => generarEtiqueta(s)}
              className="p-1 text-gray-600 hover:text-green-600 transition"
              title="Descargar etiqueta QR"
            >
              <Code2 size={17} strokeWidth={1.5} />
            </button>
          </div>
        ),
      })),
    [filtered, navigate]
  );

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Identificador", accessor: "identificador" },
    { header: "Origen", accessor: "origen" },
    { header: "Destino", accessor: "destino" },
    { header: "Fecha envío", accessor: "fecha_envio" },
    { header: "Estado", accessor: "estado" },
    { header: "Bultos", accessor: "bultos" },
    { header: "Acciones", accessor: "acciones" },
  ];

  const inputClass  = "w-full h-10 bg-white text-black border rounded px-3";
  const selectClass = `${inputClass} appearance-none pr-9`;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Envíos (Solicitudes de Mercadería)</h1>
      </div>

      <div className="mb-4">
        <label className="block text-sm mb-1">Estado</label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="w-64 h-10 bg-white text-black border rounded px-3"
        >
          <option value="">Todos</option>
          <option value="Lista para despacho">Lista para despacho</option>
          <option value="Validada">Validada</option>
          <option value="En transito">En tránsito</option>
          <option value="Recepción Completa">Recepción Completa</option>
          <option value="Recepción Completa con Pérdida">Recepción Completa con Pérdida</option>
          <option value="Recepción Parcial">Recepción Parcial</option>
          <option value="Recepción Parcial con Pérdida">Recepción Parcial con Pérdida</option>
        </select>
      </div>

      {loading ? (
        <div className="py-10 text-sm opacity-80">Cargando envíos...</div>
      ) : error ? (
        <div className="py-10 text-red-600">Error: {error}</div>
      ) : (
        <Table columns={columns} data={rows} />
      )}
    </div>
  );
}
