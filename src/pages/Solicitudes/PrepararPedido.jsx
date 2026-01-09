import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import axiosInstance from "../../axiosInstance";
import TablePallets from "../../components/TablePallets";
import { toast } from "react-toastify";

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function PrepararPedido() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBultosFor, setShowBultosFor] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [selects, setSelects] = useState({ id_materia_prima: "" });
  const [pesosAsignados, setPesosAsignados] = useState({});

  useEffect(() => {
    fetchSolicitud();
  }, [solicitudId]);

  const fetchSolicitud = async () => {
    try {
      const res = await axiosInstance.get(`/solicitudes-mercaderia/${solicitudId}`);
      setSolicitud(res.data);
    } catch {
      toast.error("Error al cargar los datos");
    }
  };

  const handleShowBultos = (palletId) => {
    setShowBultosFor(palletId);
    setBultos([]);
    setDisponibles([]);
    setSelects({ id_materia_prima: "" });
    setPesosAsignados({});
    fetchBultos(palletId);
  };

  const fetchBultos = async (palletId) => {
    try {
      const res = await axiosInstance.get(`/pallets/${palletId}`);
      setBultos(res.data.bultos || []);
    } catch {
      toast.error("Error al cargar bultos");
    }
  };

  const handleBuscarDisponibles = async () => {
    if (!selects.id_materia_prima) {
      toast.error("Selecciona una materia prima");
      return;
    }
    try {
      const params = {
        id_bodega: solicitud.bodegaProveedora.id,
        id_materia_prima: selects.id_materia_prima,
      };
      const res = await axiosInstance.get("/bultos/disponibles", { params });
      setDisponibles(res.data);
    } catch {
      toast.error("Error buscando bultos disponibles");
    }
  };

  const handlePesoChange = (bultoId, pesoKg) => {
    setPesosAsignados((prev) => ({ ...prev, [bultoId]: pesoKg }));
  };

  const handleAddBulto = async (bulto) => {
    const pesoKg = Number(pesosAsignados[bulto.id]);
    if (!pesoKg || pesoKg <= 0) {
      toast.error("Ingresa un peso válido");
      return;
    }

    setLoading(true);
    try {
      let bultoAAsignar = bulto.id;

      if (pesoKg < bulto.unidades_disponibles) {
        const res = await axiosInstance.post(`/bultos/${bulto.id}/dividir`, {
          divisiones: [pesoKg, bulto.unidades_disponibles - pesoKg],
        });
        const nuevos = res.data?.nuevos_bultos ?? res.data?.bultos ?? [];
        bultoAAsignar = nuevos[0].id;
      }

      await axiosInstance.post(`/pallets/${showBultosFor}/asociar-bulto`, {
        id_bulto: bultoAAsignar,
      });
      toast.success("Bulto asignado correctamente");
      fetchBultos(showBultosFor);
    } catch (err) {
      console.error("asociar-bulto error:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Error asignando bulto");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulto = async (bultoId) => {
    setLoading(true);
    try {
      await axiosInstance.delete(`/pallets/bulto/${bultoId}`);
      toast.success("Bulto eliminado");
      fetchBultos(showBultosFor);
    } catch {
      toast.error("Error eliminando bulto");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePallet = async (palletId) => {
    setLoading(true);
    try {
      await axiosInstance.post(`/pallets/${palletId}/liberar-bultos`);
      await axiosInstance.delete(`/pallets/${palletId}`);
      toast.success("Pallet eliminado");
      fetchSolicitud();
    } catch {
      toast.error("Error eliminando pallet");
    } finally {
      setLoading(false);
    }
  };

  const handleListaParaDespacho = async (solicitudId) => {
    try {
      await axiosInstance.put(`/solicitudes-mercaderia/${solicitudId}/lista-para-despacho`);
      toast.success("Solicitud lista para despacho");
      setTimeout(() => navigate("/Solicitudes"), 1500);
    } catch (err) {
      console.error("Error al marcar como listo para despacho:", err.response?.data || err);
      toast.error(err.response?.data?.error || "Error modificando estado");
    }
  };

  const handleCreatePallet = async () => {
    setLoading(true);
    try {
      if (solicitud.estado !== "En preparación") {
        await axiosInstance.put(`/solicitudes-mercaderia/${solicitudId}/preparar`);
      }
      await axiosInstance.post(`/pallets`, { id_solicitud_mercaderia: Number(solicitudId) });
      toast.success("Pallet creado exitosamente");
      fetchSolicitud();
    } catch {
      toast.error("Error creando pallet");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadEtiquetasPallets = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.put(
        `/solicitudes-mercaderia/${solicitudId}/obtener_etiquetas`,
        {},
        { responseType: "blob" }
      );
      
      // Detectar tipo de archivo por Content-Type
      const contentType = res.headers["content-type"];
      const extension = contentType?.includes("zip") ? "zip" : "pdf";
      
      downloadBlob(res.data, `pallets-solicitud-${solicitudId}.${extension}`);
      toast.success("Etiquetas descargadas");
    } catch (err) {
      console.error("Error descargando etiquetas pallets:", err);
      toast.error(err.response?.data?.error || "Error descargando etiquetas");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQrPallet = async (palletId, palletIdentificador) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/pallets/${palletId}/qr`, {
        responseType: "blob",
      });
      const safeName = palletIdentificador ? `pallet-${palletIdentificador}.png` : `pallet-${palletId}.png`;
      downloadBlob(res.data, safeName);
      toast.success("QR descargado");
    } catch (err) {
      console.error("Error descargando QR pallet:", err);
      toast.error(err.response?.data?.error || "Error descargando QR");
    } finally {
      setLoading(false);
    }
  };

  const handleClosePallet = async (palletId) => {
    setLoading(true);
    try {
      await axiosInstance.put(`/pallets/${palletId}/cerrar`);
      toast.success("Pallet cerrado");
      setShowBultosFor(null);
      fetchSolicitud();
    } catch {
      toast.error("Error al cerrar pallet (¿faltan bultos?)");
    } finally {
      setLoading(false);
    }
  };

  if (!solicitud) return <div className="p-6">Cargando...</div>;

  const materiasPrimas = solicitud.detalles.map((d) => ({
    id: d.materiaPrima.id,
    nombre: d.materiaPrima.nombre,
  }));

  const pallets = solicitud.pallets || [];
  const palletsData = pallets.map((p) => ({
    id: p.id,
    identificador: p.identificador,
    estado: p.estado,
  }));
  const palletActivo = pallets.find((p) => p.id === showBultosFor)?.estado !== "Completado";

  const palletsColumns = [
    { header: "ID", accessor: "id" },
    { header: "Identificador", accessor: "identificador" },
    { header: "Estado", accessor: "estado" },
    {
      header: "Acciones",
      accessor: "acciones",
      renderCell: ({ id, identificador }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleShowBultos(id)}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
          >
            Bultos
          </button>
          <button
            onClick={() => handleDownloadQrPallet(id, identificador)}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800"
          >
            Descargar QR
          </button>
          <button
            onClick={() => handleClosePallet(id)}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Cerrar
          </button>
          <button
            onClick={() => handleDeletePallet(id)}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  const bultosData = bultos.map((r) => ({
    identificador: r.identificador,
    cantidad: `${r.unidades_disponibles.toFixed(2)}`,
    acciones: palletActivo ? (
      <button
        onClick={() => handleDeleteBulto(r.id)}
        className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
      >
        Eliminar
      </button>
    ) : null,
  }));

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Solicitudes/${solicitudId}`} />
      <h1 className="mt-4 text-3xl font-bold mb-6">Preparar Pedido #{solicitudId}</h1>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Pallets en Preparación</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadEtiquetasPallets}
            disabled={loading || pallets.length === 0}
            className="bg-slate-700 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-60"
          >
            Descargar Etiquetas (PDF)
          </button>
          <button
            onClick={handleCreatePallet}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
          >
            Crear Pallet
          </button>
        </div>
      </div>

      <TablePallets data={palletsData} columns={palletsColumns} />

      {showBultosFor && (
        <div className="mt-8 p-6 bg-white shadow rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Bultos del Pallet #{showBultosFor}</h2>

          {palletActivo && (
            <>
              <h3 className="text-lg font-semibold mb-2">Asignar Nuevos Bultos</h3>
              <div className="flex gap-4 mb-4">
                <select
                  value={selects.id_materia_prima}
                  onChange={(e) =>
                    setSelects({ ...selects, id_materia_prima: e.target.value })
                  }
                  className="border px-4 py-2 rounded-md w-full"
                >
                  <option value="">Selecciona Materia Prima</option>
                  {materiasPrimas.map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.nombre}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBuscarDisponibles}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                >
                  Buscar
                </button>
              </div>

              {disponibles.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b py-3"
                >
                  <div className="flex-1 font-medium">
                    Bulto {b.identificador} –{" "}
                    {b.unidades_disponibles.toFixed(2)} {b.materiaPrima.unidad_medida} disponibles
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Cantidad a usar"
                    onChange={(e) =>
                      handlePesoChange(b.id, parseFloat(e.target.value))
                    }
                    className="p-2 border rounded-md w-40"
                  />
                  <button
                    onClick={() => handleAddBulto(b)}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </>
          )}

          <h4 className="mt-6 mb-2 font-semibold">Bultos Asignados:</h4>
          <TablePallets
            data={bultosData}
            columns={[
              { header: "Identificador", accessor: "identificador" },
              { header: "Cantidad", accessor: "cantidad" },
              { header: "Acciones", accessor: "acciones" },
            ]}
          />
        </div>
      )}

      {pallets.length > 0 && pallets.every((p) => p.estado === "Completado") && (
        <button
          onClick={() => handleListaParaDespacho(solicitudId)}
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Marcar Listo para Despacho
        </button>
      )}
    </div>
  );
}
