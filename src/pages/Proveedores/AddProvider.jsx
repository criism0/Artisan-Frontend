import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/UI/PageHeader";
import CamposProveedor from "../../components/Proveedores/CamposProveedor";
import {
  FORM_PROVEEDOR_VACIO,
  aplicarMedioDePago,
  payloadProveedor,
  validarProveedor,
} from "../../components/Proveedores/formularioProveedor";
import { formatRutDisplay } from "../../services/formatHelpers";
import { toast } from "../../lib/toast";
import { ApiError, useApi } from "../../lib/api";
import SimilarNameConfirmModal from "../../components/Modals/SimilarNameConfirmModal";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

const MODAL_CERRADO = { open: false, inputName: "", matches: [] };

export default function AddProvider() {
  const navigate = useNavigate();
  const api = useApi();

  const [similarModal, setSimilarModal] = useState(MODAL_CERRADO);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(FORM_PROVEEDOR_VACIO);
  const [errors, setErrors] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");

  const canWriteProvider = checkScope(ModelType.PROVEEDOR, ScopeType.WRITE);

  const limpiarError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));

  const onField = (key) => (value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    limpiarError(key);
  };
  const onRut = (value) => {
    setFormData((prev) => ({ ...prev, rut_empresa: formatRutDisplay(value) }));
    limpiarError("rut_empresa");
  };
  const onRegion = (value) => setFormData((prev) => ({ ...prev, region: value, comuna: "" }));
  const onBanco = (value) => {
    setFormData((prev) => aplicarMedioDePago(prev, value));
    setErrors((prev) => ({ ...prev, banco: "", cuenta_corriente: "", cuenta: "", email_transferencia: "", sitio_web: "" }));
  };

  const crear = async (payload, confirmarSimilar = false) => {
    await api("/proveedores", {
      method: "POST",
      body: JSON.stringify(confirmarSimilar ? { ...payload, confirmSimilarName: true } : payload),
    });
    toast.success("Proveedor creado correctamente");
    navigate("/Proveedores");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral("");
    const nuevos = validarProveedor(formData, { rutEstricto: true });
    setErrors(nuevos);
    if (Object.keys(nuevos).length) {
      toast.error("Revisa los campos marcados en rojo");
      return;
    }
    if (!canWriteProvider) {
      toast.permissionError([ModelType.PROVEEDOR, ScopeType.WRITE]);
      return;
    }

    const payload = payloadProveedor(formData);
    try {
      setIsSubmitting(true);
      await crear(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.code === "SIMILAR_NAME") {
        setPendingPayload(payload);
        setSimilarModal({
          open: true,
          inputName: err.data?.input || payload.nombre_empresa,
          matches: err.data?.matches || [],
        });
        return;
      }
      setErrorGeneral(err?.message || "Error creando proveedor");
      toast.error("Error creando proveedor: " + (err?.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCreateAnyway = async () => {
    if (!pendingPayload) return;
    if (!canWriteProvider) {
      toast.permissionError([ModelType.PROVEEDOR, ScopeType.WRITE]);
      return;
    }
    try {
      setIsSubmitting(true);
      await crear(pendingPayload, true);
      setSimilarModal(MODAL_CERRADO);
      setPendingPayload(null);
    } catch (err) {
      setSimilarModal(MODAL_CERRADO);
      setPendingPayload(null);
      setErrorGeneral(err?.message || "Error creando proveedor");
      toast.error("Error creando proveedor: " + (err?.message || ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}

      <PageHeader
        volverA="/Proveedores"
        titulo="Añadir Proveedor"
        subtitulo={
          <>
            Los campos marcados con <span className="text-red-500 font-medium">*</span> son obligatorios.
          </>
        }
      />

      {errorGeneral && <div className="p-3 bg-red-100 text-red-700 rounded-lg mb-4 text-sm">{errorGeneral}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <CamposProveedor
          form={formData}
          errors={errors}
          onField={onField}
          onRut={onRut}
          onRegion={onRegion}
          onBanco={onBanco}
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => navigate("/Proveedores")}
            className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="proveedor"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        onCancel={() => {
          setSimilarModal(MODAL_CERRADO);
          setPendingPayload(null);
        }}
        onConfirm={confirmCreateAnyway}
        confirmText="Crear proveedor igualmente"
      />
    </div>
  );
}
