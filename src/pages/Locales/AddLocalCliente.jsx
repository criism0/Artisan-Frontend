import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DynamicForm from "../../components/Forms/DynamicForm";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function AddLocalCliente() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWriteLocalClient = checkScope(ModelType.LOCAL_CLIENTE, ScopeType.WRITE);

  const schema = {
    data: {
      nombre: "",
      region: "",
      comuna: "",
      direccion: "",
      email: "",
      contacto_local: "",
      telefono_local: "",
      contacto_recepcion: "",
      telefono_recepcion: ""
    },
    labels: {
      nombre: "Nombre",
      region: "Región",
      comuna: "Comuna",
      direccion: "Dirección",
      email: "E-mail",
      contacto_local: "Contacto Local",
      telefono_local: "Teléfono Local",
      contacto_recepcion: "Contacto Recepción",
      telefono_recepcion: "Teléfono Recepción"
    }
  };

  const handleSubmit = async (data) => {
    if (!canWriteLocalClient) {
      toast.permissionError([ModelType.LOCAL_CLIENTE, ScopeType.WRITE]);
      setIsSubmitting(false);
      return;
    }
    try {
      setIsSubmitting(true);
      await api(`/locales-cliente`, { method: "POST", body: { id_cliente: Number(clienteId), ...data } });
      navigate(`/clientes/${clienteId}`);
    } catch (err) {
      console.error("Error al añadir local:", err.message);
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
      <BackButton to={`/clientes/${clienteId}`} />
      <h1 className="text-2xl font-bold mb-4">Añadir Local</h1>

      {errorMsg && (
        <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">
          {errorMsg}
        </div>
      )}

      <DynamicForm entity={schema} onSubmit={handleSubmit} />
    </div>
  );
}
