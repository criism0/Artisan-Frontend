import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { formatRutDisplay } from "../../services/formatHelpers";
import { COMUNAS_BY_REGION } from "../../data/comunas";
import { REGIONES } from "../../data/regiones";
import { BANCOS_CL, TIPO_CUENTA } from "../../data/datosBancarios";
import { TIPO_PROVEEDOR } from "../../data/proveedoresType";
import { toast } from "../../lib/toast";
import { useApi } from "../../lib/api";

const classInput = (hasError) =>
  `border rounded px-3 py-2 w-full placeholder-gray-400 ${
    hasError ? "border-red-500" : "border-gray-300"
  }`;

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

const FieldRow = React.memo(function FieldRow({
  id,
  label,
  type = "text",
  value,
  placeholder,
  error,
  onChange,
  required = false,
  numeric = false,
}) {
  const handleChange = (e) => {
    let val = e.target.value;
    if (numeric) val = val.replace(/\D/g, "");
    onChange(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
      <div className="flex items-center md:justify-end">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      </div>
      <div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={classInput(error)}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
});

const SimpleSelectRow = React.memo(function SimpleSelectRow({
  id,
  label,
  value,
  options,
  error,
  onChange,
  required = false,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
      <div className="flex items-center md:justify-end">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      </div>
      <div>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={classInput(error)}
        >
          <option value="">Selecciona…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
});

export default function AddProvider() {
  const navigate = useNavigate();
  const api = useApi()

  const [formData, setFormData] = useState({
    nombre_empresa: "",
    rut_empresa: "",
    giro: "",
    tipo_proveedor: "",
    region: "",
    comuna: "",
    direccion: "",
    cuenta_corriente: "",
    banco: "",
    cuenta: "",
    email_transferencia: "",
    nombre_contacto: "",
    telefono: "",
  });

  const [errors, setErrors] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");

  const labels = {
    nombre_empresa: "Razón Social",
    rut_empresa: "RUT",
    giro: "Giro",
    tipo_proveedor: "Tipo de Proveedor",
    region: "Región",
    comuna: "Comuna",
    direccion: "Dirección",
    cuenta_corriente: "Nº de Cuenta",
    banco: "Banco",
    cuenta: "Tipo de Cuenta",
    email_transferencia: "Email para Transferencias",
    nombre_contacto: "Nombre Contacto Comercial",
    telefono: "Teléfono de Contacto",
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre_empresa.trim())
      newErrors.nombre_empresa = "Debe ingresar la razón social";
    const rutRegex = /^[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]$/;
    if (!formData.rut_empresa) newErrors.rut_empresa = "Debe ingresar el RUT";
    else if (!rutRegex.test(formData.rut_empresa))
      newErrors.rut_empresa = "Formato inválido (Ej: 76.123.456-7)";

    if (!formData.giro.trim()) newErrors.giro = "Debe ingresar el giro";
    if (!formData.tipo_proveedor) newErrors.tipo_proveedor = "Seleccione el tipo de proveedor";
    if (!formData.region) newErrors.region = "Seleccione la región";
    if (!formData.comuna) newErrors.comuna = "Seleccione la comuna";
    if (!formData.direccion.trim())
      newErrors.direccion = "Debe ingresar la dirección completa";

    if (!formData.cuenta_corriente)
      newErrors.cuenta_corriente = "Debe ingresar el número de cuenta";
    if (!formData.banco) newErrors.banco = "Seleccione el banco";
    if (!formData.cuenta) newErrors.cuenta = "Seleccione el tipo de cuenta";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email_transferencia)
      newErrors.email_transferencia = "Debe ingresar el email";
    else if (!emailRegex.test(formData.email_transferencia))
      newErrors.email_transferencia = "Formato de email no válido";

    if (!formData.nombre_contacto.trim())
      newErrors.nombre_contacto = "Debe ingresar el nombre del contacto";

    if (!formData.telefono)
      newErrors.telefono = "Debe ingresar el teléfono";
    else if (formData.telefono.length < 9)
      newErrors.telefono = "El teléfono debe tener al menos 9 dígitos";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const setField = (key) => (value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleRutChange = (value) => {
    setFormData((prev) => ({ ...prev, rut_empresa: formatRutDisplay(value) }));
    if (errors.rut_empresa) setErrors((prev) => ({ ...prev, rut_empresa: "" }));
  };

  const comunasOptions = useMemo(
    () => (formData.region ? COMUNAS_BY_REGION[formData.region] || [] : []),
    [formData.region]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral("");
    if (!validate()) return;

    try {
      await api("/proveedores", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      toast.success("Proveedor creado correctamente");
      navigate("/Proveedores");
    } catch (err) {
      toast.error("Error creando proveedor:" + err);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Proveedores" />
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">Añadir Proveedor</h1>

      {errorGeneral && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
          {errorGeneral}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow p-6 rounded-lg">
        <Section title="Información General">
          <FieldRow
            id="nombre_empresa"
            label={labels.nombre_empresa}
            value={formData.nombre_empresa}
            placeholder="Ej: Lácteos del Sur SpA"
            error={errors.nombre_empresa}
            onChange={setField("nombre_empresa")}
            required
          />
          <FieldRow
            id="rut_empresa"
            label={labels.rut_empresa}
            value={formData.rut_empresa}
            placeholder="Ej: 76.123.456-7"
            error={errors.rut_empresa}
            onChange={handleRutChange}
            required
          />
          <FieldRow
            id="giro"
            label={labels.giro}
            value={formData.giro}
            placeholder="Ej: Producción de alimentos"
            error={errors.giro}
            onChange={setField("giro")}
          />
          <FieldRow
            id="tipo_proveedor"
            label={labels.tipo_proveedor}
            value={formData.tipo_proveedor}
            placeholder="Ej: Empresa"
            error={errors.tipo_proveedor}
            onChange={setField("tipo_proveedor")}
          />
        </Section>

        <Section title="Ubicación">
          <SimpleSelectRow
            id="region"
            label={labels.region}
            value={formData.region}
            options={REGIONES}
            error={errors.region}
            onChange={(val) => setFormData((p) => ({ ...p, region: val, comuna: "" }))}
          />
          <SimpleSelectRow
            id="comuna"
            label={labels.comuna}
            value={formData.comuna}
            options={comunasOptions}
            error={errors.comuna}
            onChange={setField("comuna")}
          />
          <FieldRow
            id="direccion"
            label={labels.direccion}
            value={formData.direccion}
            placeholder="Ej: Av. Macul 1234, oficina 56"
            error={errors.direccion}
            onChange={setField("direccion")}
          />
        </Section>

        <Section title="Información de Pago">
          <FieldRow
            id="cuenta_corriente"
            label={labels.cuenta_corriente}
            value={formData.cuenta_corriente}
            placeholder="Ej: 12345678"
            error={errors.cuenta_corriente}
            onChange={setField("cuenta_corriente")}
            numeric
          />
          <SimpleSelectRow
            id="banco"
            label={labels.banco}
            value={formData.banco}
            options={BANCOS_CL}
            error={errors.banco}
            onChange={setField("banco")}
          />
          <SimpleSelectRow
            id="cuenta"
            label={labels.cuenta}
            value={formData.cuenta}
            options={TIPO_CUENTA}
            error={errors.cuenta}
            onChange={setField("cuenta")}
          />
          <FieldRow
            id="email_transferencia"
            label={labels.email_transferencia}
            type="email"
            value={formData.email_transferencia}
            placeholder="Ej: pagos@empresa.cl"
            error={errors.email_transferencia}
            onChange={setField("email_transferencia")}
          />
        </Section>

        <Section title="Contacto Comercial">
          <FieldRow
            id="nombre_contacto"
            label={labels.nombre_contacto}
            value={formData.nombre_contacto}
            placeholder="Ej: María Pérez"
            error={errors.nombre_contacto}
            onChange={setField("nombre_contacto")}
          />
          <FieldRow
            id="telefono"
            label={labels.telefono}
            value={formData.telefono}
            placeholder="Ej: +56987654321"
            error={errors.telefono}
            onChange={setField("telefono")}
            numeric
          />
        </Section>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate("/Proveedores")}
            className="px-5 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded hover:bg-hover"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
