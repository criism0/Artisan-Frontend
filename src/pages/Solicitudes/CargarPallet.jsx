import React from 'react';
import SolicitudInsumosTable from '../../components/SolicitudInsumosTable';
import Palets from '../../components/Palets';

export default function CargarPallets() {
  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Cargar Pallets</h1>
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col gap-6">
        <div className="w-full">
          <SolicitudInsumosTable />
        </div>
        <div className="w-full">
          <Palets />
        </div>
      </div>
    </div>
  );
} 