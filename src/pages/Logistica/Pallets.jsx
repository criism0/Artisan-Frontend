import React, { useEffect, useState, useMemo } from "react";
import Table from "../../components/Tables/Table";
import { useApi } from "../../lib/api";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { Download, Plus, FileText, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { dteService } from "../../services/dteService.js";
import { toast } from "../../lib/toast.js";

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
  const [gdsPorPallet, setGdsPorPallet] = useState({});
  const [gdLoadingId, setGdLoadingId] = useState(null);
  const api = useApi();

  useEffect(() => {
    const fetchPallets = async () => {
      setLoading(true);
      try {
        const  data  = await api(
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
            solicitudId: sol.id,
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

  const handleEmitirGDPallet = async (pallet) => {
    setGdLoadingId(pallet.id);
    try {
      const gd = await dteService.emitirGuiaDespacho(
        pallet.solicitudId, 5,
        {
          montoTotal: null,
          items: [{ nombre: 'Insumos varios', cantidad: 1, precioUnitario: 0, unidad: 'Un.' }],
          referencia: `Solicitud N° ${pallet.solicitudId ?? '—'} — Pallet ${pallet.identificador}`,
        }
      );
      setGdsPorPallet((prev) => ({ ...prev, [pallet.id]: gd }));
      toast.success(`GD N° ${gd.folio} generada para pallet ${pallet.identificador}`);
    } catch (err) {
      toast.error('Error al generar la GD: ' + (err?.message ?? err));
    } finally {
      setGdLoadingId(null);
    }
  };

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

  const rows = filtered.map((p) => {
    const gd = gdsPorPallet[p.id];
    const isLoadingGd = gdLoadingId === p.id;

    return {
      id: p.id,
      identificador: p.identificador,
      estado: p.estado,
      origen: p.origen,
      destino: p.destino,
      fecha_envio: formatDate(p.fecha_envio),
      bultos: p.bultos,
      guia_despacho: gd ? (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FileText size={11} />
            GD #{gd.folio}
          </span>
          <button
            onClick={() => dteService.descargarPDF(gd, { id: p.solicitudId, materiasPrimas: [] })}
            className="p-1 text-gray-400 hover:text-blue-600 transition"
            title="Descargar PDF"
          >
            <FileText size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => handleEmitirGDPallet(p)}
          disabled={isLoadingGd}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 transition"
          title="Emitir Guía de Despacho interna"
        >
          {isLoadingGd ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          {isLoadingGd ? 'Generando…' : 'Emitir GD'}
        </button>
      ),
      acciones: (
        <button
          onClick={() => generarEtiqueta(p)}
          className="p-1 text-gray-600 hover:text-green-600 transition"
          title="Descargar etiqueta QR"
        >
          <Download size={17} strokeWidth={1.5} />
        </button>
      ),
    };
  });

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Identificador", accessor: "identificador" },
    { header: "Estado", accessor: "estado" },
    { header: "Origen", accessor: "origen" },
    { header: "Destino", accessor: "destino" },
    { header: "Fecha Envío", accessor: "fecha_envio" },
    { header: "Bultos", accessor: "bultos" },
    { header: "Guía de Despacho", accessor: "guia_despacho" },
    { header: "Acciones", accessor: "acciones" },
  ];

  return (
    <div>
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
