import React from 'react';

export default function OrderItemsEditor({
  orderItems,
  products,
  onAddRow,
  onUpdateItem,
  onRemoveRow
}) {
  // Compute selected product ids to disable options
  const selectedIds = orderItems.map(it => it.id_producto);

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Productos</h2>
        <button
          type="button"
          onClick={onAddRow}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Añadir Producto
        </button>
      </div>
      <table className="w-full table-auto bg-white rounded shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Cantidad</th>
            <th className="px-4 py-2">Precio Unitario</th>
            <th className="px-4 py-2">Subtotal</th>
            <th className="px-4 py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map(item => (
            <tr key={item.rowId} className="border-t">
              <td className="px-4 py-2">
                <select
                  className="border px-2 py-1 w-full"
                  value={item.id_producto || ''}
                  onChange={e => onUpdateItem(item.rowId, 'id_producto', e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {products.map(p => (
                    <option
                      key={p.value}
                      value={p.value}
                      disabled={p.value !== item.id_producto && selectedIds.includes(p.value)}
                    >
                      {p.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  min="1"
                  className="border px-2 py-1 w-20"
                  value={item.cantidad}
                  onChange={e => onUpdateItem(item.rowId, 'cantidad', Number(e.target.value))}
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  min="0"
                  className="border px-2 py-1 w-28"
                  value={item.precio_venta}
                  onChange={e => onUpdateItem(item.rowId, 'precio_venta', Number(e.target.value))}
                />
              </td>
              <td className="px-4 py-2">
                ${(item.cantidad * item.precio_venta).toLocaleString('es-CL')}
              </td>
              <td className="px-4 py-2 text-center">
                <button
                  type="button"
                  onClick={() => onRemoveRow(item.rowId)}
                  className="text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
