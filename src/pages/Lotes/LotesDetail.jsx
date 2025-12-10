import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../axiosInstance";

function Row({ label, value }) {
  return (
    <tr className="border-b last:border-0">
      <td className="w-1/3 py-3 px-4 text-gray-600 font-semibold">{label}</td>
      <td className="py-3 px-4">{value ?? "—"}</td>
    </tr>
  );
}

export default function LoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const base = import.meta.env.VITE_BACKEND_URL;
        const url = `${base}/lotes-producto-en-proceso/${id}`;
        const { data } = await axiosInstance.get(url);
        setLote(data);
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar el lote");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDelete = async () => {
    const confirm = window.confirm("¿Estás seguro de que deseas eliminar este lote?");
    if (!confirm) return;

    try {
      setDeleting(true);
      const base = import.meta.env.VITE_BACKEND_URL;
      await axiosInstance.delete(`${base}/lotes-producto-en-proceso/${id}`);
      alert("Lote eliminado correctamente.");
      navigate("/lotes-producto-en-proceso");
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el lote. Intenta nuevamente.");
    } finally {
      setDeleting(false);
    }
  };

  const computed = useMemo(() => {
    if (!lote) return {};

    const bultos = Array.isArray(lote.LoteProductoEnProcesoBultos)
      ? lote.LoteProductoEnProcesoBultos
      : [];

    const cantidadElaborada = bultos.reduce(
      (acc, b) => acc + (Number(b.cantidad_unidades) || 0),
      0
    );
    const cantidadActual = bultos.reduce(
      (acc, b) => acc + (Number(b.unidades_disponibles) || 0),
      0
    );
    const cantidadEnviada = Math.max(0, cantidadElaborada - cantidadActual);

    const precioUnitarioProm = (() => {
      if (bultos.length === 0) return null;
      const sum = bultos.reduce(
        (acc, b) => acc + (Number(b.precio_unitario) || 0),
        0
      );
      return sum / bultos.length;
    })();

    const numeroLote =
      lote.numero_lote ||
      lote.codigo ||
      bultos[0]?.identificador ||
      `LOTE-${lote.id}`;

    const producto =
      lote.producto?.nombre || lote.materiaPrima?.nombre || "";

    const fechaElab =
      lote.fecha_elaboracion || lote.fecha || lote.createdAt;

    return {
      numeroLote,
      producto,
      fechaElab,
      cantidadElaborada,
      cantidadActual,
      cantidadEnviada,
      precioUnitarioProm,
      estado:
        lote.estado || lote.ordenManufactura?.estado || "Inicial",
      fechaVencimiento: lote.fecha_vencimiento || null,
      peso: lote.peso ?? null,
      bodegaId: bultos[0]?.id_bodega ?? null,
      elaboradorId:
        lote.ordenManufactura?.id_elaborador_encargado ?? null,
    };
  }, [lote]);

  if (loading) return <div className="p-6">Cargando...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!lote) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Detalle de Lote</h1>
        <button
          onClick={() => navigate("/lotes-producto-en-proceso")}
          className="btn btn-secondary px-4 py-2 rounded-lg shadow"
        >
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border">
        <div className="px-4 py-3 border-b font-semibold text-gray-700">
          Información Lote
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-gray-50">
              <th className="w-1/3 py-2 px-4 text-gray-500">INFORMACIÓN</th>
              <th className="py-2 px-4 text-gray-500">DATO</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Fecha de elaboración"
              value={
                computed.fechaElab
                  ? new Date(computed.fechaElab).toLocaleString("es-CL")
                  : "—"
              }
            />
            <Row label="Código de Lote" value={computed.numeroLote} />
            <Row label="Estado" value={computed.estado} />
            <Row label="Producto" value={computed.producto} />
            <Row
              label="Costo de Producción Unitario"
              value={
                computed.precioUnitarioProm != null
                  ? `$${computed.precioUnitarioProm.toLocaleString("es-CL")}`
                  : "—"
              }
            />
            <Row
              label="Cantidad Elaborada"
              value={computed.cantidadElaborada}
            />
            <Row
              label="Cantidad Enviada"
              value={computed.cantidadEnviada}
            />
            <Row
              label="Cantidad Actual"
              value={computed.cantidadActual}
            />
            {computed.peso != null && (
              <Row label="Peso Lote" value={`${computed.peso} kg`} />
            )}
            {computed.fechaVencimiento && (
              <Row
                label="Fecha de vencimiento"
                value={new Date(
                  computed.fechaVencimiento
                ).toLocaleDateString("es-CL")}
              />
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow border">
        <div className="px-4 py-3 border-b font-semibold text-gray-700">
          Historial
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="py-2 px-4">ESTADO - LUGAR</th>
                <th className="py-2 px-4">FECHA</th>
                <th className="py-2 px-4">EMPLEADO</th>
                <th className="py-2 px-4">PESO</th>
                <th className="py-2 px-4">MERMA</th>
                <th className="py-2 px-4">OPCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b last:border-0">
                <td className="py-3 px-4">
                  {computed.estado} -{" "}
                  {lote.bodega?.nombre ||
                    (computed.bodegaId
                      ? `Bodega ${computed.bodegaId}`
                      : "—")}
                </td>
                <td className="py-3 px-4">
                  {computed.fechaElab
                    ? new Date(computed.fechaElab).toLocaleString("es-CL")
                    : "—"}
                </td>
                <td className="py-3 px-4">
                  {lote.elaborador?.nombre ||
                    (computed.elaboradorId
                      ? `ID ${computed.elaboradorId}`
                      : "Sin Encargado")}
                </td>
                <td className="py-3 px-4">
                  {computed.peso != null
                    ? `${computed.peso} kg`
                    : "No Aplica"}
                </td>
                <td className="py-3 px-4">NC: 0 | FF: 0 | C: 0</td>
                <td className="py-3 px-4">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {deleting ? "Eliminando..." : "Borrar"}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
