import React from "react";
import logo from "../assets/logo.png";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <img src={logo} alt="Artisan Logo" className="w-48 mb-6" />
      <h1 className="text-4xl font-bold text-primary mb-2">ARTISAN ERP</h1>
      <p className="text-lg text-text">
        {user ? `Hola, ${user.nombre || user.email}` : "Pasión por los Alimentos"}
      </p>
    </div>
  );
}
