import React, { useState } from 'react';
import PalletTable from './PalletTable';
import { FiPlus, FiTrash } from 'react-icons/fi';

export default function Palets() {
  const [palets, setPalets] = useState([1]); // Iniciamos con un pallet

  const handleAddPallet = () => {
    setPalets([...palets, palets.length + 1]);
  };

  const handleRemovePallet = (index) => {
    setPalets(palets.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-text">Detalles de la Carga</h2>
        <button
          onClick={handleAddPallet}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Agregar Pallet
        </button>
      </div>

      <div className="space-y-6">
        {palets.map((palletNumber, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 relative">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => handleRemovePallet(index)}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Eliminar pallet"
              >
                <FiTrash className="w-5 h-5" />
              </button>
            </div>
            <PalletTable palletNumber={palletNumber} />
          </div>
        ))}
      </div>
    </div>
  );
} 