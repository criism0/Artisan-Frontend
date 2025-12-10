import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast"
import { validarRut, formatRutDisplay } from "../../services/formatHelpers";
import { COMUNAS_BY_REGION } from "../../data/comunas";
import { REGIONES } from "../../data/regiones";
import { BANCOS_CL, TIPO_CUENTA } from "../../data/datosBancarios";
import { TIPO_PROVEEDOR } from "../../data/proveedoresType";

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
  icon,
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
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={classInput(error)}
        />
        {icon && <span className="absolute right-3 top-2.5 text-lg">{icon}</span>}
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
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
});


export default function ProveedorEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [form, setForm] = useState({
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
  const [loading, setLoading] = useState(true);
  const [rutValido, setRutValido] = useState(true);

  const comunasOptions = useMemo(
    () => (form.region ? COMUNAS_BY_REGION[form.region] || [] : []),
    [form.region]
  );

  useEffect(() => {
    const fetchProveedor = async () => {
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/proveedores/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setForm({
          nombre_empresa: data.nombre_empresa ?? "",
          rut_empresa: data.rut_empresa ?? "",
          giro: data.giro ?? "",
          tipo_proveedor: data.tipo_proveedor ?? "",
          region: data.region ?? "",
          comuna: data.comuna ?? "",
          direccion: data.direccion ?? "",
          cuenta_corriente: data.cuenta_corriente ?? "",
          banco: data.banco ?? "",
          cuenta: data.cuenta ?? "",
          email_transferencia: data.email_transferencia ?? "",
          nombre_contacto: data.nombre_contacto ?? "",
          telefono: data.telefono ?? "",
        });
      } catch (e) {
        toast.error("Error cargando proveedor:" + e);
      } finally {
        setLoading(false);
      }
    };
    fetchProveedor();
  }, [id]);

  const handleChange = (key) => (val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleRutChange = (val) => {
    const formatted = formatRutDisplay(val);
    setForm((prev) => ({ ...prev, rut_empresa: formatted }));
    if (formatted.length >= 9) setRutValido(validarRut(formatted));
    else setRutValido(true);
    if (errors.rut_empresa) setErrors((prev) => ({ ...prev, rut_empresa: "" }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.nombre_empresa.trim())
      newErrors.nombre_empresa = "Debe ingresar la razón social";
    if (!form.rut_empresa) newErrors.rut_empresa = "Debe ingresar el RUT";


    if (!form.region) newErrors.region = "Seleccione la región";
    if (!form.comuna) newErrors.comuna = "Seleccione la comuna";
    if (!form.direccion.trim())
      newErrors.direccion = "Debe ingresar la dirección completa";

    if (!form.banco) newErrors.banco = "Seleccione el banco";
    if (!form.cuenta) newErrors.cuenta = "Seleccione el tipo de cuenta";
    if (!form.cuenta_corriente)
      newErrors.cuenta_corriente = "Ingrese número de cuenta";

    if (!form.email_transferencia)
      newErrors.email_transferencia = "Ingrese un email";
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email_transferencia))
        newErrors.email_transferencia = "Formato de email no válido";
    }

    if (!form.telefono) newErrors.telefono = "Ingrese número de teléfono";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/proveedores/${id}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Proveedor actualizado correctamente")
      navigate(`/Proveedores/${id}`);
    } catch (e) {
      toast.error("Error guardando:" + e);
    }
  };

  if (loading) return <div className="p-6">Cargando proveedor…</div>;

  return (
    <div className="p-6 bg-background min-h-screen">

      <div className="mb-4">
        <BackButton to={`/Proveedores/${id}`} />
      </div>

      <h1 className="text-2xl font-bold mb-4 text-gray-800">Editar Proveedor</h1>

      <form onSubmit={onSubmit} className="bg-white shadow p-6 rounded-lg max-w-3xl mx-auto">
        {/* Información General */}
        <Section title="Información General">
          <FieldRow
            id="nombre_empresa"
            label="Razón Social"
            value={form.nombre_empresa}
            placeholder="Ej: Lácteos del Sur SpA"
            error={errors.nombre_empresa}
            onChange={handleChange("nombre_empresa")}
            required
          />

          <FieldRow
            id="rut_empresa"
            label="RUT"
            value={form.rut_empresa}
            placeholder="Ej: 76.123.456-7"
            error={errors.rut_empresa}
            onChange={handleRutChange}
            required
            icon={
              form.rut_empresa && (
                rutValido ? (
                  <span className="text-green-500 font-bold">✓</span>
                ) : (
                  <span className="text-red-500 font-bold">✗</span>
                )
              )
            }
          />

          <FieldRow
            id="giro"
            label="Giro"
            value={form.giro}
            placeholder="Ej: Producción de alimentos"
            error={errors.giro}
            onChange={handleChange("giro")}
          />

          <FieldRow
            id="tipo_proveedor"
            label="Tipo de Proveedor"
            value={form.tipo_proveedor}
            placeholder="Ej: Empresa"
            error={errors.tipo_proveedor}
            onChange={handleChange("tipo_proveedor")}
          />
        </Section>

        <Section title="Ubicación">

          <SimpleSelectRow
            id="region"
            label="Región"
            value={form.region}
            options={REGIONES}
            error={errors.region}
            onChange={(val) => {
              setForm((prev) => ({ ...prev, region: val, comuna: "" })); 
              if (errors.region) setErrors((prev) => ({ ...prev, region: "" }));
              if (errors.comuna) setErrors((prev) => ({ ...prev, comuna: "" }));
            }}
          />
          <SimpleSelectRow
            id="comuna"
            label="Comuna"
            value={form.comuna}
            options={comunasOptions}
            error={errors.comuna}
            onChange={handleChange("comuna")}
          />
          <FieldRow
            id="direccion"
            label="Dirección"
            value={form.direccion}
            placeholder="Ej: Av. Macul 1234, oficina 56"
            error={errors.direccion}
            onChange={handleChange("direccion")}
          />
        </Section>

        <Section title="Información de Pago">
          <FieldRow
            id="cuenta_corriente"
            label="Nº de Cuenta"
            value={form.cuenta_corriente}
            placeholder="Ej: 12345678"
            error={errors.cuenta_corriente}
            onChange={handleChange("cuenta_corriente")}
            numeric
          />
          <SimpleSelectRow
            id="banco"
            label="Banco"
            value={form.banco}
            options={BANCOS_CL}
            error={errors.banco}
            onChange={handleChange("banco")}
          />
          <SimpleSelectRow
            id="cuenta"
            label="Tipo de Cuenta"
            value={form.cuenta}
            options={TIPO_CUENTA}
            error={errors.cuenta}
            onChange={handleChange("cuenta")}
          />
          <FieldRow
            id="email_transferencia"
            label="Email para Transferencias"
            type="email"
            value={form.email_transferencia}
            placeholder="Ej: pagos@empresa.cl"
            error={errors.email_transferencia}
            onChange={handleChange("email_transferencia")}
          />
        </Section>

        <Section title="Contacto Comercial">
          <FieldRow
            id="nombre_contacto"
            label="Nombre Contacto Comercial"
            value={form.nombre_contacto}
            placeholder="Ej: María Pérez"
            error={errors.nombre_contacto}
            onChange={handleChange("nombre_contacto")}
          />
          <FieldRow
            id="telefono"
            label="Teléfono de Contacto"
            value={form.telefono}
            placeholder="Ej: +56987654321"
            error={errors.telefono}
            onChange={handleChange("telefono")}
            numeric
          />
        </Section>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate(`/Proveedores/${id}`)}
            className="px-5 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded hover:bg-hover"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}
