// src/auth/RutaNoEncontrada.jsx
// Una dirección que no existe (un enlace viejo, un marcador, un error de tipeo) no deja a la
// persona en una página muerta: avisa con un toast y la lleva al inicio, o al login si no hay
// sesión. replace para que «atrás» no la devuelva a la ruta rota.
import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { toast } from "../lib/toast.js";

export default function RutaNoEncontrada() {
  const { isAuth, loading } = useAuth();
  const location = useLocation();
  const avisado = useRef(false);

  useEffect(() => {
    if (loading || avisado.current) return;
    avisado.current = true;
    toast.info(`La página ${location.pathname} no existe. Te llevamos al inicio.`);
  }, [loading, location.pathname]);

  if (loading) return null;
  return <Navigate to={isAuth ? "/Home" : "/login"} replace />;
}
