import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const LandingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleAction = () => {
    if (user) logout();
    else navigate("/login");
  };

  React.useEffect(() => {
    if (user) navigate("/inicio");
  }, [user, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Bienvenido a la Fábrica</h1>
      <p className="mb-8 text-lg">Por favor, inicia sesión para continuar.</p>
      <button
        onClick={handleAction}
        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-hover"
      >
        {user ? "Cerrar Sesión" : "Iniciar Sesión"}
      </button>
    </div>
  );
};

export default LandingPage;
