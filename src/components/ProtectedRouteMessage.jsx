import React from 'react';


// TODO: USE SCOPES
export default function ProtectedRouteMessage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-text">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Acceso Denegado</h1>
        <p className="text-lg">No tienes permisos para acceder a esta página.</p>
        <p className="text-md mt-2">Si crees que esto es un error, contacta al administrador.</p>
      </div>
    </div>
  );
} 