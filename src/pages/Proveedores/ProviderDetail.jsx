import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatRutDisplay, toTitle, formatPhone, formatEmail, fmt } from "../../services/formatHelpers";
import axios from "axios";
import { DeleteButton, BackButton, ToggleActiveButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast"

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function DisplayRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
      <div className="flex items-center md:justify-end">
        <div className="text-sm font-medium text-gray-700">{label}</div>
      </div>
      <div className="text-gray-900">{value}</div>
    </div>
  );
}

function EstadoPill({ activo }) {
  const isActive = activo === true;
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
      title={isActive ? "Proveedor activo" : "Proveedor inactivo"}
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}

export default function ProveedorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prov, setProv] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    const fetchOne = async () => {
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/proveedores/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setProv(data);
      } catch (e) {
        toast.error("Error cargando proveedor:" + e);
      } finally {
        setLoading(false);
      }
    };
    fetchOne();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!prov) return;
    try {
      const nuevoEstado = !(prov.activo === true);
      await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/proveedores/${id}/toggle-activo`,
        { activo: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProv({ ...prov, activo: nuevoEstado });
      toast.success(`Proveedor ${nuevoEstado ? "activado" : "desactivado"} correctamente`);
    } catch (e) {
      toast.error(`Error ${prov.activo === true ? "desactivando" : "activando"} proveedor: ${e}`);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!prov) return <div className="p-6">Proveedor no encontrado.</div>;

  const activo = prov.activo === true;
  const razon = toTitle(prov.nombre_empresa);
  const rut = formatRutDisplay(prov.rut_empresa);
  const giro = toTitle(prov.giro);
  const region = toTitle(prov.region);
  const comuna = toTitle(prov.comuna);
  const direccion = fmt(prov.direccion);
  const banco = toTitle(prov.banco);
  const tipoCuenta = toTitle(prov.cuenta);
  const cuentaNumero = fmt(prov.cuenta_corriente);
  const emailPago = formatEmail(prov.email_transferencia);
  const telefono = formatPhone(prov.telefono);
  const tipoProveedor = toTitle(prov.tipo_proveedor);
  const nombreContacto = toTitle(prov.nombre_contacto);
  const creado = prov.createdAt ? new Date(prov.createdAt).toLocaleString() : "—";
  const actualizado = prov.updatedAt ? new Date(prov.updatedAt).toLocaleString() : "—";

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800">Detalle de Proveedor</h1>
        <div className="flex gap-2">
          <BackButton
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            to="/Proveedores"
          >
            Volver
          </BackButton>
          <button
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            onClick={() => navigate(`/Proveedores/${id}/edit`)}
          >
            Modificar
          </button>
          <ToggleActiveButton
            isActive={activo}
            entityName={"proveedor " + razon}
            onToggleActive={handleToggleStatus}
          />


        </div>
      </div>
    
      <div className="bg-white p-6 rounded-lg shadow max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">ID:</span>{" "}
            {prov.id ?? "—"}
          </div>
          {"activo" in prov && <EstadoPill activo={prov.activo} />}
        </div>

        <Section title="Información General">
          <DisplayRow label="Razón Social" value={razon} />
          <DisplayRow label="RUT" value={rut} />
          <DisplayRow label="Giro" value={giro} />
          <DisplayRow label="Tipo de Proveedor" value={tipoProveedor || "—"} />
        </Section>

        <Section title="Ubicación">
          <DisplayRow label="Región" value={region} />
          <DisplayRow label="Comuna" value={comuna} />
          <DisplayRow label="Dirección" value={direccion} />
        </Section>

        <Section title="Información de Pago">
          <DisplayRow label="Banco" value={banco} />
          <DisplayRow label="Tipo de Cuenta" value={tipoCuenta} />
          <DisplayRow label="Nº de Cuenta" value={cuentaNumero} />
          <DisplayRow label="Email para Transferencias" value={emailPago} />
        </Section>

        <Section title="Contacto Comercial">
          <DisplayRow label="Nombre Contacto Comercial" value={nombreContacto} />
          <DisplayRow label="Teléfono" value={telefono} />
        </Section>

        <Section title="Metadatos">
          <DisplayRow label="Creado" value={creado} />
          <DisplayRow label="Actualizado" value={actualizado} />
        </Section>
      </div>
    </div>
  );
}