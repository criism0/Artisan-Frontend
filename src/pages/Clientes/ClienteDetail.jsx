import { useParams, useNavigate } from "react-router-dom";
import {
  BackButton,
  EditButton,
  TrashButton
} from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import DireccionesManager from "../../components/Direcciones/DireccionesManager";
import { api } from "../../lib/api.js";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";


export default function ClienteDetail() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [direcciones, setDirecciones] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);

  const canReadClients = checkScope(ModelType.CLIENTE, ScopeType.READ);
  const canDeleteClients = checkScope(ModelType.CLIENTE, ScopeType.DELETE);

  useEffect(() => {
    if (!canReadClients) {
      toast.permissionError([ModelType.CLIENTE, ScopeType.READ]);
      return;
    }
    api(`/clientes/${clienteId}`)
      .then((data) => setCliente(data))
      .catch(() => toast.error("Error al cargar datos del cliente"));
  }, [clienteId, canReadClients]);

  useEffect(() => {
    api(`/lista-precio`)
      .then((data) => setListasPrecio(data))
      .catch(() => toast.error("Error al cargar listas de precio"));

    api(`/direcciones/cliente/${clienteId}`)
      .then((data) => setDirecciones(data))
      .catch(() => {
        api(`/direcciones?clienteId=${clienteId}`)
          .then((data) => setDirecciones(data))
          .catch(() => toast.error("Error al cargar direcciones"));
      });

  }, [clienteId]);

  const handleDeleteCliente = async () => {
    if (!canDeleteClients) {
      toast.permissionError([ModelType.CLIENTE, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/clientes/${clienteId}`, { method: "DELETE" });
      toast.success("Cliente eliminado correctamente");
      navigate("/clientes");
    } catch (err) {
      toast.error("Error al eliminar cliente: " + (err?.message || ""));
    }
  };

  if (!cliente) return <PageLoader message="Cargando cliente" />;

  const listaPrecioNombre = (() => {
    const idLista = cliente.id_lista_precio;
    if (!idLista) return "-";
    const encontrada = listasPrecio.find((l) => l.id === idLista);
    return encontrada?.nombre || `Lista #${idLista}`;
  })();

  const formatoCompra = (
    cliente.formato_compra_predeterminado ||
    cliente.tipo_precio ||
    cliente.tipoPrecio ||
    cliente.formato_compra ||
    cliente.formatoCompra ||
    "-"
  );

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/clientes" />
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle del Cliente</h1>
        <div className="flex gap-2">
          <EditButton
            onClick={() => navigate(`/clientes/${clienteId}/edit`)}
            tooltipText="Editar Cliente"
          />
          <TrashButton
            onConfirmDelete={handleDeleteCliente}
            tooltipText="Eliminar Cliente"
            entityName={`cliente ${cliente.nombre_empresa || ""}`}
          />
        </div>
      </div>

      {/* Sección 1: Clasificación Comercial */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
          Clasificación Comercial
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Canal</p>
            <p className="font-medium">{cliente.canalInfo?.nombre || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Lista de Precios Asignada</p>
            <p className="font-medium">{listaPrecioNombre}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Formato de Compra Predeterminado</p>
            <p className="font-medium">{formatoCompra}</p>
          </div>
        </div>
      </div>

      {/* Sección 2: Información Fiscal y de Facturación */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
          Información Fiscal y de Facturación
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Nombre Comercial</p>
            <p className="font-medium">{cliente.nombre_empresa || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Razón Social</p>
            <p className="font-medium">{cliente.razon_social || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">RUT</p>
            <p className="font-medium">{cliente.rut || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Giro</p>
            <p className="font-medium">{cliente.giro || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Condición de Pago</p>
            <p className="font-medium">{cliente.condicion_pago || "-"}</p>
          </div>
        </div>
      </div>

      {/* Sección 3: Puntos de Contacto */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
          Puntos de Contacto
        </h2>
        <div className="space-y-6">
          <div className="border-l-4 border-primary/60 pl-4">
            <h3 className="text-base font-semibold text-text mb-3">Contacto Comercial</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Nombre</p>
                <p className="font-medium">{cliente.contacto_comercial || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Teléfono</p>
                <p className="font-medium">{cliente.telefono_comercial || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">E-mail</p>
                <p className="font-medium">{cliente.email_comercial || "-"}</p>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary/30 pl-4">
            <h3 className="text-base font-semibold text-text mb-3">Contacto Finanzas (Opcional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Nombre</p>
                <p className="font-medium">{cliente.contacto_finanzas || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Teléfono</p>
                <p className="font-medium">{cliente.telefono_finanzas || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">E-mail</p>
                <p className="font-medium">{cliente.email_finanzas || "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 4: Direcciones */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
          Direcciones
        </h2>
        <DireccionesManager
          clienteId={clienteId}
          direcciones={direcciones}
          onDireccionesChange={setDirecciones}
          isEditing={false}
        />
      </div>

    </div>
  );
}
