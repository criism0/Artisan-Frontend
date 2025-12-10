import React, { useState } from 'react';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { TrashButton } from './Buttons/ActionButtons';

export default function EditableTable({ columns, data, onEdit, onDelete, onComplete }) {
  const [editingRow, setEditingRow] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (row) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onEdit(editedData);
      setEditingRow(null);
    } catch {
      alert('Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field, value, type) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                {col.header}
              </th>
            ))}
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
              ACCIONES
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map(row => (
            <tr key={row.id}>
              {columns.map((col, ci) => (
                <td key={ci} className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                  {editingRow === row.id && col.editable !== false ? (
                    col.type === 'select' ? (
                      <select
                        value={editedData[col.accessor] || ''}
                        onChange={e => handleChange(col.accessor, e.target.value, col.type)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Seleccione</option>
                        {col.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={col.type || 'text'}
                        value={editedData[col.accessor] || ''}
                        onChange={e => handleChange(col.accessor, e.target.value, col.type)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    )
                  ) : (
                    col.Cell ? col.Cell({ row, value: row[col.accessor] }) : row[col.accessor]
                  )}
                </td>
              ))}
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 flex gap-2">
                {editingRow === row.id ? (
                  <>
                    <button onClick={handleSave} disabled={isSaving} className="text-green-600"><FiCheck /></button>
                    <button onClick={() => setEditingRow(null)} className="text-red-600"><FiX /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEdit(row)} className="text-blue-600"><FiEdit2 /></button>
                    {onDelete && <TrashButton onConfirmDelete={() => onDelete(row)} tooltipText="Eliminar paso" />}
                  </>
                )}
                {onComplete && (
                  <button onClick={() => onComplete(row)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">
                    Listo
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
