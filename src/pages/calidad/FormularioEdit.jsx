import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import FormularioBuilder from "./FormularioBuilder";
import { obtenerFormulario } from "../../services/calidad";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

export default function FormularioEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState(null);
  const [loading, setLoading] = useState(true);

  const canReadForms = checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ);

  useEffect(() => {
    if (!canReadForms) {
      toast.permissionError([ModelType.FORMULARIO_CALIDAD, ScopeType.READ]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    obtenerFormulario(id)
      .then((data) => {
        if (!cancelled) setFormulario(data);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.message || "El formulario no existe.");
        navigate("/calidad/formularios");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div>
        <BackButton to="/calidad/formularios" />
        <PageLoader message="Cargando Formulario"/>
      </div>
    );
  }

  if (!formulario) return null;

  return <FormularioBuilder initialData={formulario} />;
}
