import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import Table from "../../components/Table";
import { useApi } from "../../lib/api";

export default function SolicitudDetail() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [guiaDespacho, setGuiaDespacho] = useState("");
  const [medioTransporte, setMedioTransporte] = useState("");
  const [mostrarFormularioEnvio, setMostrarFormularioEnvio] = useState(false);

  const api = useApi();

  const fetchSolicitud = async () => {
    try {
      const res = await api(`/solicitudes-mercaderia/${solicitudId}`);
      setSolicitud(res);
    } catch (err) {
      console.error("Error fetching solicitud:", err);
      setError("Error cargando la solicitud");
    }
  };

  useEffect(() => {
    fetchSolicitud();
  }, [solicitudId]);

  const handleCancelarSolicitud = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/solicitudes-mercaderia/${solicitudId}/cancelar`, { method: 'PUT' });
      setSuccess("Solicitud cancelada exitosamente");
      navigate("/Solicitudes");
    } catch (err) {
      console.error("Error al cancelar solicitud:", err);
      setError("Error al cancelar solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarSolicitud = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/solicitudes-mercaderia/${solicitudId}/enviar`, {
        method: "PUT",
        body: JSON.stringify({
          numero_guia_despacho: guiaDespacho,
          medio_transporte: medioTransporte,
        }),
      });
      setSuccess("Solicitud enviada exitosamente");
      navigate("/Solicitudes");
      setMostrarFormularioEnvio(false);
    } catch (err) {
      console.error("Error al enviar solicitud:", err);
      setError("Error al enviar solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handleValidarSolicitud = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/solicitudes-mercaderia/${solicitudId}/validar`, { method: "PUT" });
      setSuccess("Solicitud validada exitosamente");
      navigate(`/Solicitudes`);
    } catch (err) {
      console.error("Error al validar solicitud:", err);
      setError("Error al validar solicitud");
    } finally {
      setLoading(false);
    }
  };

  const handlePrepararPedido = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/solicitudes-mercaderia/${solicitudId}/preparar`, { method: "PUT" });
      setSuccess("Solicitud preparada exitosamente");
      navigate(`/Solicitudes/${solicitudId}/preparar-pedido`);
    } catch (err) {
      console.error("Error al preparar solicitud:", err);
      setError("Error al preparar solicitud");
    } finally {
      setLoading(false);
    }
  };

  if (!solicitud) return <div>Cargando...</div>;

  const solicitudInfo = {
    ID: solicitud.id,
    "Bodega Proveedora": solicitud.bodegaProveedora?.nombre,
    "Bodega Solicitante": solicitud.bodegaSolicitante?.nombre,
    Estado: solicitud.estado,
    "Fecha de Creación": new Date(solicitud.createdAt).toLocaleString(),
    "Última Actualización": new Date(solicitud.updatedAt).toLocaleString(),
    "Fecha de Envío": solicitud.fecha_envio
      ? new Date(solicitud.fecha_envio).toLocaleString()
      : "Pendiente",
    "Fecha de Recepción": solicitud.fecha_recepcion
      ? new Date(solicitud.fecha_recepcion).toLocaleString()
      : "Pendiente",
    "N° Guía Despacho": solicitud.numero_guia_despacho,
    "Medio de Transporte": solicitud.medio_transporte,
  };

  const detalles = solicitud?.detalles ?? [];
  const insumosData = detalles.map((detalle) => ({
    nombre: detalle?.materiaPrima?.nombre ?? "—",
    cantidad_solicitada: detalle?.cantidad_solicitada ?? 0,
    unidad_medida: detalle?.materiaPrima?.unidad_medida ?? "—",
    comentario: detalle?.comentario ?? "",
  }));

  const insumosColumns = [
    { header: "Insumo", accessor: "nombre" },
    { header: "Cantidad Solicitada", accessor: "cantidad_solicitada" },
    { header: "Unidad de Medida", accessor: "unidad_medida" },
  ];

  const puedeCancelar = [
    "Creada",
    "Validada",
    "En preparación",
    "Lista para despacho",
  ].includes(solicitud.estado);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Solicitudes" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">
        Detalle de la Solicitud
      </h1>

      <div className="bg-gray-200 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Información Principal</h2>
        <table className="w-full bg-white rounded-lg shadow">
          <tbody>
            {Object.entries(solicitudInfo).map(([key, value]) => (
              <tr key={key} className="border-b border-border">
                <td className="px-6 py-4 font-medium">{key}</td>
                <td className="px-6 py-4">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Insumos Solicitados</h2>
        <Table data={insumosData} columns={insumosColumns} />
      </div>

      {error && <div className="text-red-500 mb-2">{error}</div>}
      {success && <div className="text-green-600 mb-2">{success}</div>}

      {/* Acciones por estado */}
      <div className="flex flex-wrap gap-4 justify-between">
        {puedeCancelar && (
          <button
            onClick={handleCancelarSolicitud}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Cancelar Solicitud
          </button>
        )}
        {solicitud.estado === "Creada" && (
          <>
            <button
              onClick={handleValidarSolicitud}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700"
            >
              Validar Solicitud
            </button>
          </>
        )}
        {solicitud.estado === "En tránsito" && (
          <button
            onClick={() => navigate(`/Solicitudes/${solicitudId}/recepcionar-solicitud`)}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700"
          >
            Recepcionar Solicitud
          </button>
        )}

        {solicitud.estado === "Lista para despacho" && (
          <div className="flex flex-col gap-4 max-w-md">
            {!mostrarFormularioEnvio ? (
              <button
                onClick={() => setMostrarFormularioEnvio(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700"
              >
                Enviar Solicitud
              </button>
            ) : (
              <div className="bg-white rounded shadow p-4">
                <h3 className="text-lg font-bold mb-2">Datos de Envío</h3>
                <input
                  type="text"
                  placeholder="Número de Guía de Despacho"
                  value={guiaDespacho}
                  onChange={(e) => setGuiaDespacho(e.target.value)}
                  className="w-full mb-2 p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Medio de Transporte"
                  value={medioTransporte}
                  onChange={(e) => setMedioTransporte(e.target.value)}
                  className="w-full mb-2 p-2 border rounded"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEnviarSolicitud}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Confirmar Envío
                  </button>
                  <button
                    onClick={() => setMostrarFormularioEnvio(false)}
                    className="bg-gray-300 px-4 py-2 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TODO: REVISAR SI TIENE QUE ESTAR EN FRONT, O SOLO EN MOBILE */}
        {/* {(solicitud.estado === "Validada" || solicitud.estado === "En preparación") && (
          <>
            <button
              onClick={() => {
                if (solicitud.estado === "Validada") {
                  handlePrepararPedido();
                } else if (solicitud.estado === "En preparación") {
                  navigate(`/Solicitudes/${solicitudId}/preparar-pedido`);
                }
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            >
              Preparar pedido
            </button>
            <button
              onClick={handleCancelarSolicitud}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Cancelar Solicitud
            </button>
          </>
        )} */}
      </div>
    </div>
  );
}
