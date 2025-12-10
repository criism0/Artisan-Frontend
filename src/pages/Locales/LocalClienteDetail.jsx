import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackButton, ModifyButton, DeleteButton } from "../../components/Buttons/ActionButtons";
import axiosInstance from "../../axiosInstance";

export default function LocalClienteDetail() {
  const { clienteId, id } = useParams();
  const navigate = useNavigate();
  const [local, setLocal] = useState(null);
  const [cliente, setCliente] = useState(null);

  useEffect(() => {
    Promise.all([
      axiosInstance.get(`/locales-cliente/${id}`),
      axiosInstance.get(`/clientes/${clienteId}`)
    ])
      .then(([locRes, cliRes]) => {
        setLocal(locRes.data);
        setCliente(cliRes.data);
      })
      .catch(err => console.error("Error cargando detalle:", err));
  }, [id, clienteId]);

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar este local?")) return;
    try {
      await axiosInstance.delete(`/locales-cliente/${id}`);
      navigate(`/clientes/${clienteId}`);
    } catch (err) {
      console.error(err);
      alert("Error al eliminar local");
    }
  };

  if (!local || !cliente) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/clientes/${clienteId}`} />
      <div className="flex justify-between items-center my-4">
        <h1 className="text-2xl font-bold">Detalle del Local</h1>
        <div className="flex gap-2">
          <ModifyButton
            onClick={() => navigate(`/clientes/${clienteId}/locales/${id}/edit`)}
            tooltipText="Editar Local"
          />
          <DeleteButton
            onConfirmDelete={handleDelete}
            tooltipText="Eliminar Local"
            entityName="local"
          />
        </div>
      </div>

      {/* Información del Local */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Información del Local</h2>
        <table className="w-full bg-white rounded shadow">
          <tbody>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Nombre</td>
              <td className="px-6 py-2">{local.nombre}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Región</td>
              <td className="px-6 py-2">{local.region}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Comuna</td>
              <td className="px-6 py-2">{local.comuna}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Dirección</td>
              <td className="px-6 py-2">{local.direccion}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">E-mail</td>
              <td className="px-6 py-2">{local.email}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Contacto Local</td>
              <td className="px-6 py-2">{local.contacto_local}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Teléfono Local</td>
              <td className="px-6 py-2">{local.telefono_local}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Contacto Recepción</td>
              <td className="px-6 py-2">{local.contacto_recepcion || '—'}</td>
            </tr>
            <tr>
              <td className="px-6 py-2 font-medium">Teléfono Recepción</td>
              <td className="px-6 py-2">{local.telefono_recepcion || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Información del Cliente */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">Información del Cliente</h2>
        <table className="w-full bg-white rounded shadow">
          <tbody>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Nombre Comercial</td>
              <td className="px-6 py-2">{cliente.nombre_empresa}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Canal</td>
              <td className="px-6 py-2">{cliente.canalInfo?.nombre}</td>
            </tr>
            <tr className="border-b">
              <td className="px-6 py-2 font-medium">Razón Social</td>
              <td className="px-6 py-2">{cliente.razon_social}</td>
            </tr>
            <tr>
              <td className="px-6 py-2 font-medium">RUT</td>
              <td className="px-6 py-2">{cliente.rut}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
