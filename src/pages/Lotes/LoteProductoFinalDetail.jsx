import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

function Row({ label, value }) {
  return (
    <tr className="border-b last:border-0">
      <td className="w-1/3 py-3 px-4 text-gray-600 font-semibold">{label}</td>
      <td className="py-3 px-4">{value ?? "—"}</td>
    </tr>
  );
}

export default function LoteProductoFinalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const api = useApi();

  const canReadFinishedLot = checkScope(ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ);
  const canDeleteFinishedLot = checkScope(ModelType.LOTE_PRODUCTO_FINAL, ScopeType.DELETE);

  useEffect(() => {
    if (!canReadFinishedLot) {
      toast.permissionError([ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const data = await api(`/lotes-producto-final/${id}`);
        setLote(data);
      } catch (e) {
        console.error(e);
        setError("No se pudo cargar el lote");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, canReadFinishedLot]);

  const handleDelete = async () => {
    if (!canDeleteFinishedLot){
      toast.permissionError([ModelType.LOTE_PRODUCTO_FINAL, ScopeType.DELETE]);
      setDeleting(false);
      return;
    }
    const confirm = window.confirm(
      "¿Estás seguro de que deseas eliminar este lote?"
    );
    if (!confirm) return;

    try {
      setDeleting(true);
      await api(`/lotes-producto-final/${id}`, { method: "DELETE" });
      toast.success("Lote eliminado correctamente.");
      navigate("/lotes-producto-en-proceso");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el lote. Intenta nuevamente.");
    } finally {
      setDeleting(false);
    }
  };

  const computed = useMemo(() => {
    if (!lote) return {};

    const bultos = Array.isArray(lote.LoteProductoFinalBultos)
      ? lote.LoteProductoFinalBultos
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

    const costoUnitarioProm = (() => {
      if (bultos.length === 0) return null;
      const sum = bultos.reduce(
        (acc, b) => acc + (Number(b.costo_unitario) || Number(b.precio_unitario) || 0),
        0
      );
      return sum / bultos.length;
    })();

    const numeroLote =
      lote.numero_lote ||
      lote.codigo ||
      bultos[0]?.identificador ||
      `LOTE-${lote.id}`;

    const producto = lote.productoBase?.nombre || "";

    const fechaElab = lote.fecha_elaboracion || lote.createdAt;

    return {
      numeroLote,
      producto,
      fechaElab,
      cantidadElaborada,
      cantidadActual,
      cantidadEnviada,
      costoUnitarioProm,
      estado: lote.estado || lote.ordenManufactura?.estado || "Inicial",
      fechaVencimiento: lote.fecha_vencimiento || null,
      peso: lote.peso ?? null,
      bodegaId: bultos[0]?.id_bodega ?? null,
    };
  }, [lote]);

  if (loading) return <PageLoader message="Cargando lote" />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!lote) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Detalle de Lote (Producto Final)</h1>
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
              label="Costo Unitario Promedio"
              value={
                computed.costoUnitarioProm != null
                  ? `$${computed.costoUnitarioProm.toLocaleString("es-CL")}`
                  : "—"
              }
            />
            <Row label="Cantidad Elaborada" value={computed.cantidadElaborada} />
            <Row label="Cantidad Enviada" value={computed.cantidadEnviada} />
            <Row label="Cantidad Actual" value={computed.cantidadActual} />
            {computed.peso != null && <Row label="Peso Lote" value={`${computed.peso} kg`} />}
            {computed.fechaVencimiento && (
              <Row
                label="Fecha de vencimiento"
                value={new Date(computed.fechaVencimiento).toLocaleDateString(
                  "es-CL"
                )}
              />
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow border">
        <div className="px-4 py-3 border-b font-semibold text-gray-700">
          Bultos del Lote
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="py-2 px-4">Identificador</th>
                <th className="py-2 px-4">Cantidad</th>
                <th className="py-2 px-4">Disponibles</th>
                <th className="py-2 px-4">Costo Unitario</th>
              </tr>
            </thead>
            <tbody>
              {(lote.LoteProductoFinalBultos || []).map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-3 px-4">{b.identificador || `#${b.id}`}</td>
                  <td className="py-3 px-4">{b.cantidad_unidades}</td>
                  <td className="py-3 px-4">{b.unidades_disponibles}</td>
                  <td className="py-3 px-4">{b.costo_unitario ?? b.precio_unitario ?? "—"}</td>
                </tr>
              ))}
              {(!lote.LoteProductoFinalBultos || lote.LoteProductoFinalBultos.length === 0) && (
                <tr>
                  <td className="py-3 px-4" colSpan={4}>
                    Sin bultos asociados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
          >
            {deleting ? "Eliminando..." : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
