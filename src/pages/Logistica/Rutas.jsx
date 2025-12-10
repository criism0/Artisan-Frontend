import React from "react";
import Table from "../../components/Table";

export default function Rutas() {
    const data = [
      { id: 1, ruta: "Ruta Norte", vehiculo: "Camión 12", conductor: "Pedro Rojas", estado: "Activa" },
      { id: 2, ruta: "Ruta Sur", vehiculo: "Camión 7", conductor: "Luis Fernández", estado: "Programada" },
      { id: 3, ruta: "Ruta Centro", vehiculo: "Camión 4", conductor: "María López", estado: "Finalizada" },
    ];
  
    const columns = [
      { header: "ID", accessor: "id" },
      { header: "Ruta", accessor: "ruta" },
      { header: "Vehículo", accessor: "vehiculo" },
      { header: "Conductor", accessor: "conductor" },
      { header: "Estado", accessor: "estado" },
    ];
  
    return (
      <div className="p-6 bg-background min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Rutas de Transporte</h1>
        <Table columns={columns} data={data} />
      </div>
    );
  }