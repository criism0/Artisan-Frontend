import { useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";

export default function NextStepButton({ id, estado }) {
  const navigate = useNavigate();

  const handleClick = () => {
    switch (estado) {
      case "Creada":
        navigate(`/Ordenes/validar/${id}`);
        break;
      case "Validada":
        navigate(`/Ordenes/enviar/${id}`);
        break;
      case "Enviada":
        navigate(`/Ordenes/recepcionar/${id}`);
        break;
      // Aquí se pueden agregar más casos según los estados
      default:
        console.log("Estado no manejado:", estado);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="p-2 text-primary transition-colors"
      title="Siguiente paso"
    >
      <FiArrowRight className="w-6 h-6" />
    </button>
  );
} 