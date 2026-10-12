import { useMemo } from "react";
import FormField from "../Forms/FormField";
import { COMUNAS_BY_REGION } from "../../data/comunas";
import { REGIONES } from "../../data/regiones";
import { BANCOS_CL, TIPO_CUENTA } from "../../data/datosBancarios";
import { esWebpay } from "./formularioProveedor";

/**
 * El formulario de un proveedor, compartido por «Añadir» y «Editar».
 *
 * Eran dos copias del mismo formulario, con la etiqueta a la izquierda y un asterisco que no decía
 * la verdad: el formulario exigía casi todos los campos y sólo marcaba tres. Ahora hay UNA lista
 * de obligatorios (`validarProveedor`) y es la misma que dibuja los asteriscos.
 *
 * Obligatorios: razón social, RUT y el medio de pago con sus datos —cuenta, tipo de cuenta y correo,
 * o, si se compra por la web (Webpay), el sitio—. Todo lo demás es opcional.
 */

function Tarjeta({ titulo, descripcion, children }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800">{titulo}</h2>
      {descripcion && <p className="text-sm text-gray-500 mt-0.5">{descripcion}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{children}</div>
    </section>
  );
}

/** `FormField` con la etiqueta arriba, como el resto de la app, y `onChange` que recibe el valor. */
function Campo({ onChange, ancho = false, soloDigitos = false, opciones, ...resto }) {
  return (
    <FormField
      {...resto}
      type={opciones ? "select" : resto.type}
      options={opciones?.map((o) => ({ value: o, label: o }))}
      containerClassName={ancho ? "md:col-span-2" : ""}
      onChange={(ev) => {
        const v = ev.target.value;
        onChange(soloDigitos ? v.replace(/\D/g, "") : v);
      }}
    />
  );
}

export default function CamposProveedor({ form, errors, onField, onRut, onRegion, onBanco, rutValido = true }) {
  const web = esWebpay(form.banco);
  const comunas = useMemo(() => (form.region ? COMUNAS_BY_REGION[form.region] || [] : []), [form.region]);

  return (
    <div className="space-y-6">
      <Tarjeta titulo="Información General">
        <Campo
          ancho
          label="Razón social"
          required
          value={form.nombre_empresa}
          placeholder="Ej: Lácteos del Sur SpA"
          error={errors.nombre_empresa}
          onChange={onField("nombre_empresa")}
        />
        <Campo
          label="RUT"
          required
          value={form.rut_empresa}
          placeholder="Ej: 76.123.456-7"
          error={errors.rut_empresa}
          helperText={!rutValido && form.rut_empresa ? "El dígito verificador no calza con el RUT." : undefined}
          onChange={onRut}
        />
        <Campo
          label="Tipo de proveedor"
          value={form.tipo_proveedor}
          placeholder="Ej: Empresa (si lo dejas vacío, queda como Empresa)"
          error={errors.tipo_proveedor}
          onChange={onField("tipo_proveedor")}
        />
        <Campo
          ancho
          label="Giro"
          value={form.giro}
          placeholder="Ej: Producción de alimentos"
          error={errors.giro}
          onChange={onField("giro")}
        />
      </Tarjeta>

      <Tarjeta titulo="Ubicación">
        <Campo label="Región" value={form.region} opciones={REGIONES} error={errors.region} onChange={onRegion} />
        <Campo
          label="Comuna"
          value={form.comuna}
          opciones={comunas}
          disabled={!form.region}
          error={errors.comuna}
          onChange={onField("comuna")}
        />
        <Campo
          ancho
          label="Dirección"
          value={form.direccion}
          placeholder="Ej: Av. Macul 1234, oficina 56"
          error={errors.direccion}
          onChange={onField("direccion")}
        />
      </Tarjeta>

      <Tarjeta
        titulo="Información de Pago"
        descripcion={web ? "Compra por la web: no hay cuenta de destino, indica dónde se compra." : "Cómo se le paga a este proveedor."}
      >
        <Campo
          ancho={web === false}
          label="Banco o medio de pago"
          required
          value={form.banco}
          opciones={BANCOS_CL}
          error={errors.banco}
          onChange={onBanco}
        />
        {web ? (
          <>
            <Campo
              label="Sitio web de compra"
              required
              value={form.sitio_web}
              placeholder="Ej: https://www.tienda.cl"
              error={errors.sitio_web}
              onChange={onField("sitio_web")}
            />
            <Campo
              label="Usuario"
              value={form.usuario_web}
              placeholder="Con el que se ingresa, si existe"
              error={errors.usuario_web}
              helperText="Opcional. La contraseña no se guarda en el sistema."
              onChange={onField("usuario_web")}
            />
          </>
        ) : (
          <>
            <Campo
              label="N° de cuenta"
              required
              soloDigitos
              value={form.cuenta_corriente}
              placeholder="Ej: 12345678"
              error={errors.cuenta_corriente}
              onChange={onField("cuenta_corriente")}
            />
            <Campo
              label="Tipo de cuenta"
              required
              value={form.cuenta}
              opciones={TIPO_CUENTA}
              error={errors.cuenta}
              onChange={onField("cuenta")}
            />
            <Campo
              ancho
              label="Email para transferencias"
              required
              type="email"
              value={form.email_transferencia}
              placeholder="Ej: pagos@empresa.cl"
              error={errors.email_transferencia}
              onChange={onField("email_transferencia")}
            />
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo="Contacto Comercial" descripcion="Opcional.">
        <Campo
          label="Nombre del contacto"
          value={form.nombre_contacto}
          placeholder="Ej: María Pérez"
          error={errors.nombre_contacto}
          onChange={onField("nombre_contacto")}
        />
        <Campo
          label="Teléfono"
          soloDigitos
          value={form.telefono}
          placeholder="Ej: 56987654321"
          error={errors.telefono}
          onChange={onField("telefono")}
        />
      </Tarjeta>
    </div>
  );
}
