import { useParams, useNavigate } from "react-router-dom";
import {
  BackButton,
  EditButton,
  DeleteButton
} from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import DireccionesManager from "../../components/DireccionesManager";
import { api } from "../../lib/api.js";

export default function ClienteDetail() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [direcciones, setDirecciones] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);

  useEffect(() => {
    api(`/clientes/${clienteId}`)
      .then((data) => setCliente(data))
      .catch(() => {});
  }, [clienteId]);

  useEffect(() => {
    api("/lista-precio")
      .then((data) => setListasPrecio(data))
      .catch(() => {});

    api(`/direcciones/cliente/${clienteId}`)
      .then((data) => setDirecciones(data))
      .catch(() => {
        api(`/direcciones?clienteId=${clienteId}`)
          .then((data) => setDirecciones(data))
          .catch(() => {});
      });
  }, [clienteId]);

  const handleDeleteCliente = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar este cliente?")) return;
    try {
      await api(`/clientes/${clienteId}`, { method: "DELETE" });
      navigate("/clientes");
    } catch {
      alert("Error al eliminar cliente");
    }
  };

  if (!cliente) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  const listaPrecioNombre = (() => {
    if (!cliente.id_lista_precio) return "—";
    return listasPrecio.find((l) => l.id === cliente.id_lista_precio)?.nombre || `Lista #${cliente.id_lista_precio}`;
  })();

  const formatoCompra =
    cliente.formato_compra_predeterminado ||
    cliente.tipo_precio ||
    cliente.tipoPrecio ||
    "—";

  const InfoRow = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium text-right">{value || "—"}</span>
    </div>
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-6">
          <BackButton to="/clientes" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre_empresa}</h1>
            {(cliente.rut || cliente.giro) && (
              <p className="text-sm text-gray-500 mt-1">
                {[cliente.rut, cliente.giro].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <EditButton
              onClick={() => navigate(`/clientes/${clienteId}/edit`)}
              tooltipText="Editar Cliente"
            />
            <DeleteButton
              onConfirmDelete={handleDeleteCliente}
              tooltipText="Eliminar Cliente"
              entityName="cliente"
            />
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Canal</div>
            <div className="font-semibold text-gray-900 mt-1 text-sm truncate">
              {cliente.canalInfo?.nombre || "—"}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Lista de Precios</div>
            <div className="font-semibold text-gray-900 mt-1 text-sm truncate">{listaPrecioNombre}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Formato Compra</div>
            <div className="font-semibold text-gray-900 mt-1 text-sm">{formatoCompra}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Condición Pago</div>
            <div className="font-semibold text-gray-900 mt-1 text-sm">{cliente.condicion_pago || "—"}</div>
          </div>
        </div>

        {/* ── Información Fiscal ── */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Información Fiscal y de Facturación</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Nombre Comercial" value={cliente.nombre_empresa} />
              <InfoRow label="Razón Social" value={cliente.razon_social} />
              <InfoRow label="RUT" value={cliente.rut} />
              <InfoRow label="Giro" value={cliente.giro} />
              <InfoRow label="Condición de Pago" value={cliente.condicion_pago} />
            </div>
          </div>
        </div>

        {/* ── Puntos de Contacto ── */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Puntos de Contacto</h2>
            <div className="space-y-5">

              <div className="border-l-4 border-primary/60 pl-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Contacto Comercial</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
                  <InfoRow label="Nombre" value={cliente.contacto_comercial} />
                  <InfoRow label="Teléfono" value={cliente.telefono_comercial} />
                  <InfoRow label="E-mail" value={cliente.email_comercial} />
                </div>
              </div>

              {(cliente.contacto_finanzas || cliente.telefono_finanzas || cliente.email_finanzas) && (
                <div className="border-l-4 border-primary/30 pl-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Contacto Finanzas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
                    <InfoRow label="Nombre" value={cliente.contacto_finanzas} />
                    <InfoRow label="Teléfono" value={cliente.telefono_finanzas} />
                    <InfoRow label="E-mail" value={cliente.email_finanzas} />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Direcciones ── */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6">
            <DireccionesManager
              clienteId={clienteId}
              direcciones={direcciones}
              onDireccionesChange={setDirecciones}
              isEditing={false}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
