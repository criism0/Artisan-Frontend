import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../../components/UI/PageHeader";
import CamposProveedor from "../../components/Proveedores/CamposProveedor";
import {
  FORM_PROVEEDOR_VACIO,
  aplicarMedioDePago,
  payloadProveedor,
  validarProveedor,
} from "../../components/Proveedores/formularioProveedor";
import { toast } from "../../lib/toast";
import { validarRut, formatRutDisplay } from "../../services/formatHelpers";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { api } from "../../lib/api.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function ProveedorEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(FORM_PROVEEDOR_VACIO);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [rutValido, setRutValido] = useState(true);

  const canWriteProvider = checkScope(ModelType.PROVEEDOR, ScopeType.WRITE);
  const canReadProvider = checkScope(ModelType.PROVEEDOR, ScopeType.READ);

  useEffect(() => {
    const fetchProveedor = async () => {
      if (!canReadProvider) {
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        setLoading(false);
        return;
      }
      try {
        const data = await api(`/proveedores/${id}`, { auth: true });
        // Lo que la API devuelve como null se muestra vacío; el formulario no maneja nulls.
        setForm(Object.fromEntries(Object.keys(FORM_PROVEEDOR_VACIO).map((k) => [k, data[k] ?? ""])));
      } catch (e) {
        toast.error("Error cargando proveedor:" + e);
      } finally {
        setLoading(false);
      }
    };
    fetchProveedor();
  }, [id, canReadProvider]);

  const limpiarError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  const onField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    limpiarError(key);
  };
  const onRut = (value) => {
    const formateado = formatRutDisplay(value);
    setForm((prev) => ({ ...prev, rut_empresa: formateado }));
    setRutValido(formateado.length < 9 ? true : validarRut(formateado));
    limpiarError("rut_empresa");
  };
  const onRegion = (value) => setForm((prev) => ({ ...prev, region: value, comuna: "" }));
  const onBanco = (value) => {
    setForm((prev) => aplicarMedioDePago(prev, value));
    setErrors((prev) => ({ ...prev, banco: "", cuenta_corriente: "", cuenta: "", email_transferencia: "", sitio_web: "" }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nuevos = validarProveedor(form);
    setErrors(nuevos);
    if (Object.keys(nuevos).length) {
      toast.error("Revisa los campos marcados en rojo");
      return;
    }
    if (!canWriteProvider) {
      toast.permissionError([ModelType.PROVEEDOR, ScopeType.WRITE]);
      return;
    }

    try {
      setGuardando(true);
      await api(`/proveedores/${id}`, { method: "PUT", body: payloadProveedor(form), auth: true });
      toast.success("Proveedor actualizado correctamente");
      navigate(`/Proveedores/${id}`);
    } catch (err) {
      toast.error("Error guardando:" + err);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <PageLoader message="Cargando proveedor" />;

  return (
    <div>
      <PageHeader
        volverA={`/Proveedores/${id}`}
        titulo="Editar Proveedor"
        subtitulo={
          <>
            Los campos marcados con <span className="text-red-500 font-medium">*</span> son obligatorios.
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <CamposProveedor
          form={form}
          errors={errors}
          onField={onField}
          onRut={onRut}
          onRegion={onRegion}
          onBanco={onBanco}
          rutValido={rutValido}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => navigate(`/Proveedores/${id}`)}
            className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
