import React, { useState, useEffect } from 'react';
import { FiTrash, FiPlus, FiCheck, FiEdit2, FiPrinter } from 'react-icons/fi';
import Selector from './Selector';
import axios from 'axios';

export default function PalletTable({ palletNumber, onPalletClose }) {
  const [items, setItems] = useState([]);
  const [isClosed, setIsClosed] = useState(false);
  const [opcionesInsumos, setOpcionesInsumos] = useState([]);

  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/materias-primas`);
        const insumosData = response.data.map(insumo => ({
          value: insumo.id.toString(),
          label: insumo.nombre
        }));
        setOpcionesInsumos(insumosData);
      } catch (error) {
        console.error("Error fetching insumos:", error);
      }
    };

    fetchInsumos();
  }, []);

  const handleAddItem = () => {
    if (isClosed) return;
    setItems([...items, { id: Date.now(), insumo: '', cantidad: '', comentario: '' }]);
  };

  const handleRemoveItem = (id) => {
    if (isClosed) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    if (isClosed) return;
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleClosePallet = () => {
    if (items.length === 0) return;
    setIsClosed(true);
    if (onPalletClose) {
      onPalletClose(items);
    }
  };

  const handleEditPallet = () => {
    setIsClosed(false);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-border flex justify-between items-center">
        <h2 className="text-lg font-semibold text-text">Pallet {palletNumber}</h2>
        {isClosed ? (
          <div className="flex gap-2">
            <button
              onClick={handleEditPallet}
              className="px-3 py-1 rounded-md flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600"
            >
              <FiEdit2 />
              Editar Pallet
            </button>
            <button
              onClick={() => {}}
              className="px-3 py-1 rounded-md flex items-center gap-2 bg-gray-500 text-white hover:bg-gray-600"
            >
              <FiPrinter />
              Generar Etiquetas
            </button>
          </div>
        ) : (
          <button
            onClick={handleClosePallet}
            disabled={items.length === 0}
            className={`px-3 py-1 rounded-md flex items-center gap-2 ${
              items.length === 0
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <FiCheck />
            Cerrar Pallet
          </button>
        )}
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 items-start">
              <div className="flex-1">
                {isClosed ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500">
                    {opcionesInsumos.find(opt => opt.value === item.insumo)?.label || 'Sin insumo seleccionado'}
                  </div>
                ) : (
                  <Selector
                    options={opcionesInsumos}
                    selectedValue={item.insumo}
                    onSelect={(value) => handleItemChange(item.id, 'insumo', value)}
                    placeholder="Seleccionar insumo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                )}
              </div>
              <input
                type="number"
                value={item.cantidad}
                onChange={(e) => handleItemChange(item.id, 'cantidad', e.target.value)}
                placeholder="Cantidad"
                disabled={isClosed}
                className={`w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  isClosed ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              <input
                type="text"
                value={item.comentario}
                onChange={(e) => handleItemChange(item.id, 'comentario', e.target.value)}
                placeholder="Comentario"
                disabled={isClosed}
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  isClosed ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              <button
                onClick={() => handleRemoveItem(item.id)}
                disabled={isClosed}
                className={`p-2 rounded-md ${
                  isClosed
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-red-500 hover:bg-red-50'
                }`}
              >
                <FiTrash />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button
            onClick={handleAddItem}
            disabled={isClosed}
            className={`px-4 py-2 rounded-md flex items-center gap-2 ${
              isClosed
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-hover'
            }`}
          >
            <FiPlus />
            Agregar Insumo
          </button>
        </div>
      </div>
    </div>
  );
} 