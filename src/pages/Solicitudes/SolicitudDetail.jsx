import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import Table from "../../components/Table";
import { useApi } from "../../lib/api";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL");
}

function normalizeEstadoSolicitud(estado) {
  if (!estado) return estado;
  switch (estado) {
    case "Recepcionada Completa":
      return "Recepción Completa";
    case "Recepcionada Parcial Falta Stock":
      return "Recepción Parcial";
    case "Recepcionada Parcial Perdida":
      return "Recepción Parcial con Pérdida";
    default:
      return estado;
  }
}

function getEstadoBadgeClasses(estado) {
  switch (normalizeEstadoSolicitud(estado)) {
    case "Creada":
      return "border-gray-200 bg-gray-50 text-gray-800";
    case "Validada":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "En preparación":
    case "Lista para despacho":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "En tránsito":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "Recepción Completa":
      return "border-green-200 bg-green-50 text-green-800";
    case "Recepción Completa con Pérdida":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Recepción Parcial":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    case "Recepción Parcial con Pérdida":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "Recepcionada Completa":
      return "border-green-200 bg-green-50 text-green-800";
    case "Recepcionada Parcial Falta Stock":
      return "border-yellow-200 bg-yellow-50 text-yellow-900";
    case "Recepcionada Parcial Perdida":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "Recepcionada":
      return "border-green-200 bg-green-50 text-green-800";
    case "Cancelada":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

function safeNumber(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

export default function SolicitudDetail() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [expandedPalletIds, setExpandedPalletIds] = useState(() => new Set());

  const [guiaDespacho, setGuiaDespacho] = useState("");
  const [medioTransporte, setMedioTransporte] = useState("");
  const [mostrarFormularioEnvio, setMostrarFormularioEnvio] = useState(false);

  const api = useApi();

  const fetchSolicitud = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api(`/solicitudes-mercaderia/${solicitudId}`);
      setSolicitud(res);
    } catch (err) {
      console.error("Error fetching solicitud:", err);
      setError("Error cargando la solicitud");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolicitud();
  }, [solicitudId, api]);

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

  if (loading && !solicitud) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <span className="ml-3 text-primary">Cargando solicitud...</span>
      </div>
    );
  }

  if (error && !solicitud) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!solicitud) return null;

  const detalles = Array.isArray(solicitud?.detalles) ? solicitud.detalles : [];
  const pallets = Array.isArray(solicitud?.pallets) ? solicitud.pallets : [];
  const bultos = pallets.flatMap((p) =>
    Array.isArray(p?.Bultos) ? p.Bultos : Array.isArray(p?.bultos) ? p.bultos : []
  );

  const solicitanteNombre =
    solicitud?.Usuario?.nombre ??
    solicitud?.usuario?.nombre ??
    solicitud?.usuarioSolicitante?.nombre ??
    "—";

  const solicitudInfo = {
    ID: solicitud.id ?? "—",
    Estado: solicitud.estado ?? "—",
    Solicitante: solicitanteNombre,
    "Bodega Proveedora": solicitud.bodegaProveedora?.nombre ?? "—",
    "Bodega Solicitante": solicitud.bodegaSolicitante?.nombre ?? "—",
    "Fecha de Creación": formatDateTime(solicitud.createdAt),
    "Última Actualización": formatDateTime(solicitud.updatedAt),
    "Fecha de Envío": solicitud.fecha_envio ? formatDateTime(solicitud.fecha_envio) : "Pendiente",
    "Fecha de Recepción": solicitud.fecha_recepcion ? formatDateTime(solicitud.fecha_recepcion) : "Pendiente",
    "N° Guía Despacho": solicitud.numero_guia_despacho ?? "—",
    "Medio de Transporte": solicitud.medio_transporte ?? "—",
  };

  const insumosData = detalles.map((detalle) => ({
    id: detalle?.id,
    nombre: detalle?.materiaPrima?.nombre ?? "—",
    cantidad_solicitada: detalle?.cantidad_solicitada ?? 0,
    cantidad_recepcionada:
      detalle?.cantidad_recepcionada == null ? "—" : detalle.cantidad_recepcionada,
    unidad_medida: detalle?.materiaPrima?.unidad_medida ?? "—",
    comentario: detalle?.comentario ?? "",
  }));

  const insumosColumns = [
    { header: "Insumo", accessor: "nombre" },
    { header: "Solicitada", accessor: "cantidad_solicitada" },
    { header: "Recepcionada", accessor: "cantidad_recepcionada" },
    { header: "Unidad", accessor: "unidad_medida" },
    {
      header: "Comentario",
      accessor: "comentario",
      Cell: ({ value }) => (value ? value : "—"),
    },
  ];

  const palletsData = pallets.map((pallet) => {
    const palletBultos = Array.isArray(pallet?.Bultos)
      ? pallet.Bultos
      : Array.isArray(pallet?.bultos)
        ? pallet.bultos
        : [];
    return {
      id: pallet?.id,
      identificador: pallet?.identificador ?? "—",
      estado: pallet?.estado ?? "—",
      bultos_count: palletBultos.length,
      _raw: pallet,
    };
  });

  const palletsColumns = [
    { header: "Pallet", accessor: "identificador" },
    { header: "Estado", accessor: "estado" },
    { header: "Bultos", accessor: "bultos_count" },
  ];

  const bultosColumns = [
    { header: "BULTO", accessor: "identificador" },
    { header: "INSUMO", accessor: "materia_prima" },
    { header: "UNIDADES", accessor: "unidades_disponibles" },
    { header: "CANTIDAD UN.", accessor: "cantidad_un" },
  ];

  const toggleExpandedPallet = (palletId) => {
    if (palletId == null) return;
    setExpandedPalletIds((prev) => {
      const next = new Set(prev);
      if (next.has(palletId)) next.delete(palletId);
      else next.add(palletId);
      return next;
    });
  };

  const puedeCancelar = [
    "Creada",
    "Validada",
    "En preparación",
    "Lista para despacho",
  ].includes(solicitud.estado);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <BackButton to="/Solicitudes" />
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">
              Solicitud #{solicitud.id}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(
                solicitud.estado
              )}`}
            >
              {normalizeEstadoSolicitud(solicitud.estado) ?? "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar / Resumen */}
          <div className="lg:col-span-1 lg:order-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Resumen</h2>

              <div className="space-y-3 text-sm">
                {Object.entries(solicitudInfo).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4"
                  >
                    <span className="text-gray-500">{key}</span>
                    <span className="text-text font-medium text-right">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Acciones</h2>

              <div className="flex flex-row flex-wrap items-center gap-3">
                {puedeCancelar && (
                  <button
                    onClick={handleCancelarSolicitud}
                    disabled={loading}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                )}

                {solicitud.estado === "Creada" && (
                  <button
                    onClick={handleValidarSolicitud}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
                  >
                    Validar
                  </button>
                )}

                {solicitud.estado === "En tránsito" && (
                  <button
                    onClick={() =>
                      navigate(
                        `/Solicitudes/${solicitudId}/recepcionar-solicitud`
                      )
                    }
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
                  >
                    Recepcionar
                  </button>
                )}

                {solicitud.estado === "Lista para despacho" && (
                  <>
                    {!mostrarFormularioEnvio ? (
                      <button
                        onClick={() => setMostrarFormularioEnvio(true)}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
                      >
                        Enviar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleEnviarSolicitud}
                          disabled={loading}
                          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
                        >
                          Confirmar Envío
                        </button>
                        <button
                          onClick={() => setMostrarFormularioEnvio(false)}
                          disabled={loading}
                          className="bg-gray-300 px-4 py-2 rounded disabled:opacity-60"
                        >
                          Cerrar
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {solicitud.estado === "Lista para despacho" && mostrarFormularioEnvio && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-text">Datos de envío</h3>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Número de Guía de Despacho"
                      value={guiaDespacho}
                      onChange={(e) => setGuiaDespacho(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Medio de Transporte"
                      value={medioTransporte}
                      onChange={(e) => setMedioTransporte(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {(error || success) && (
              <div className="space-y-2">
                {error && (
                  <div className="p-3 text-red-700 bg-red-100 rounded-lg">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 text-green-700 bg-green-100 rounded-lg">
                    {success}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contenido principal */}
          <div className="lg:col-span-2 lg:order-1 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Insumos</h2>
              {insumosData.length > 0 ? (
                <Table data={insumosData} columns={insumosColumns} />
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-500 text-sm">No hay insumos registrados.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-semibold text-text">Pallets</h2>
              {palletsData.length > 0 ? (
                <Table
                  data={palletsData}
                  columns={palletsColumns}
                  renderActions={(row) => (
                    <button
                      onClick={() => toggleExpandedPallet(row.id)}
                      className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      {expandedPalletIds.has(row.id) ? "Ocultar bultos" : "Ver bultos"}
                    </button>
                  )}
                  renderExpandedRow={(row) => {
                    if (!expandedPalletIds.has(row.id)) return null;
                    const palletRaw = row?._raw;
                    const palletBultos = Array.isArray(palletRaw?.Bultos)
                      ? palletRaw.Bultos
                      : Array.isArray(palletRaw?.bultos)
                        ? palletRaw.bultos
                        : [];

                    const bultosData = palletBultos.map((b) => {
                      const unidad =
                        b?.MateriaPrima?.unidad_medida ??
                        b?.materiaPrima?.unidad_medida ??
                        "";

                      const cantidadUn = (() => {
                        if (b?.peso_unitario == null || b?.peso_unitario === "") return "—";
                        if (!unidad) return String(b.peso_unitario);
                        return `${b.peso_unitario} ${String(unidad).toUpperCase()}`;
                      })();

                      return {
                        id: b?.id,
                        identificador: b?.identificador ?? "—",
                        materia_prima:
                          b?.MateriaPrima?.nombre ??
                          b?.materiaPrima?.nombre ??
                          "—",
                        unidades_disponibles:
                          b?.unidades_disponibles ?? "—",
                        cantidad_un: cantidadUn,
                      };
                    });

                    return (
                      <tr>
                        <td
                          colSpan={palletsColumns.length + 1}
                          className="px-6 py-4"
                        >
                          {bultosData.length > 0 ? (
                            <div className="bg-gray-50 rounded-lg p-4 max-w-full">
                              <div className="text-sm font-medium text-text mb-3">
                                Bultos del pallet {row.identificador}
                              </div>

                              {/* Tabla simple para evitar que el expand re-dimensione la tabla de pallets */}
                              <div className="w-full max-w-full overflow-x-auto">
                                <table className="min-w-full w-full">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      {bultosColumns.map((col) => (
                                        <th
                                          key={col.accessor}
                                          className="px-4 py-2 text-left text-xs font-medium text-text uppercase tracking-wider whitespace-nowrap"
                                        >
                                          {col.header}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-border">
                                    {bultosData.map((b) => (
                                      <tr key={b.id ?? b.identificador}>
                                        <td className="px-4 py-2 text-sm text-text whitespace-nowrap">
                                          {b.identificador}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-text">
                                          {b.materia_prima}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-text whitespace-nowrap">
                                          {b.unidades_disponibles}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-text whitespace-nowrap">
                                          {b.cantidad_un}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                              No hay bultos asociados a este pallet.
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }}
                />
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-500 text-sm">No hay pallets asociados.</p>
                </div>
              )}
            </div>
          </div>
        </div>

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
