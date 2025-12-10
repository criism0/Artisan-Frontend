import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DynamicForm from "../../components/DynamicForm";
import axiosInstance from "../../axiosInstance";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function EditLocalCliente() {
  const { clienteId, id } = useParams();
  const navigate = useNavigate();
  const [schema, setSchema] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    axiosInstance.get(`/locales-cliente/${id}`)
      .then(({ data }) => {
        setSchema({
          data: {
            nombre: data.nombre,
            region: data.region,
            comuna: data.comuna,
            direccion: data.direccion,
            email: data.email,
            contacto_local: data.contacto_local,
            telefono_local: data.telefono_local,
            contacto_recepcion: data.contacto_recepcion,
            telefono_recepcion: data.telefono_recepcion || ""
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
        });
      })
      .catch(err => {
        console.error("Error cargando local:", err);
        setErrorMsg("No se pudo cargar información del local.");
      });
  }, [id]);

  if (!schema) return <div>Loading...</div>;

  const handleSubmit = async (data) => {
    try {
      await axiosInstance.put(`/locales-cliente/${id}`, data);
      navigate(`/clientes/${clienteId}`);
    } catch (err) {
      console.error("Error al editar local:", err.response?.data || err.message);
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
      <h1 className="text-2xl font-bold mb-4">Editar Local</h1>

      {errorMsg && (
        <div className="mb-4 p-2 bg-red-100 text-red-800 rounded">
          {errorMsg}
        </div>
      )}

      <DynamicForm entity={schema} onSubmit={handleSubmit} />
    </div>
  );
}