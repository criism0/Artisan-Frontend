import React, { useState } from 'react';
import axiosInstance from '../axiosInstance';
import { toast } from '../lib/toast';

export default function DividirBultoModal({ bulto, onClose, onSuccess }) {
  const [divisiones, setDivisiones] = useState(['']);
  const [loading, setLoading] = useState(false);

  const handleAddDivision = () => {
    setDivisiones([...divisiones, '']);
  };

  const handleRemoveDivision = (index) => {
    const newDivisiones = [...divisiones];
    newDivisiones.splice(index, 1);
    setDivisiones(newDivisiones);
  };

  const handleChange = (index, value) => {
    const newDivisiones = [...divisiones];
    newDivisiones[index] = value;
    setDivisiones(newDivisiones);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cantidades = divisiones.map(Number).filter(n => n > 0);
    
    if (cantidades.length === 0) {
      toast.error('Debe ingresar al menos una cantidad válida.');
      setLoading(false);
      return;
    }

    const total = cantidades.reduce((a, b) => a + b, 0);
    if (total > bulto.unidades_disponibles) {
      toast.error(`La suma (${total}) excede las unidades disponibles (${bulto.unidades_disponibles}).`);
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.post(`/bultos/${bulto.id}/dividir`, {
        divisiones: cantidades
      });
      
      if (res.data.mensaje) {
        toast.success(`Éxito: ${res.data.mensaje}`);
      } else {
        toast.success('Bulto dividido exitosamente.');
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al dividir el bulto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Dividir Bulto {bulto.identificador}</h2>
        <p className="mb-4 text-sm text-gray-600">
          Unidades disponibles: <span className="font-bold">{bulto.unidades_disponibles}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
            {divisiones.map((div, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  placeholder="Cantidad"
                  className="border rounded px-3 py-2 w-full"
                  value={div}
                  onChange={(e) => handleChange(index, e.target.value)}
                  required
                />
                {divisiones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDivision(index)}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddDivision}
            className="text-sm text-blue-600 hover:underline mb-4 block"
          >
            + Agregar otra división
          </button>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Dividir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
