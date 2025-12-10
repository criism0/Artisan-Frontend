import React from 'react';

export default function SolicitudInsumosTable() {
  // Datos hardcodeados de ejemplo
  const insumos = [
    { id: 1, nombre: "Harina", cantidad: 50, formato: "kg" },
    { id: 2, nombre: "Azúcar", cantidad: 25, formato: "kg" },
    { id: 3, nombre: "Huevos", cantidad: 100, formato: "unidades" },
    { id: 4, nombre: "Mantequilla", cantidad: 10, formato: "kg" },
    { id: 5, nombre: "Leche", cantidad: 20, formato: "L" },
  ];

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "nombre" },
    { header: "Cantidad", accessor: "cantidad" },
    { header: "Formato", accessor: "formato" }
  ];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-border">
        <h2 className="text-lg font-semibold text-text">Insumos de la Solicitud</h2>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th key={index} className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-border">
          {insumos.map((insumo) => (
            <tr key={insumo.id}>
              {columns.map((column, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-text">
                  {insumo[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 