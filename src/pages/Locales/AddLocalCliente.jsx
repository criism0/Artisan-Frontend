import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DynamicForm from "../../components/DynamicForm";
import axiosInstance from "../../axiosInstance";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function AddLocalCliente() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState("");

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
    try {
      await axiosInstance.post("/locales-cliente", {
        id_cliente: Number(clienteId),
        ...data
      });
      navigate(`/clientes/${clienteId}`);
    } catch (err) {
      console.error("Error al añadir local:", err.response?.data || err.message);
      const apiErr = err.response?.data;
      const msg = apiErr?.error
        ? apiErr.error + (apiErr.details ? `: ${JSON.stringify(apiErr.details)}` : "")
        : err.message;
      setErrorMsg(msg);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
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
