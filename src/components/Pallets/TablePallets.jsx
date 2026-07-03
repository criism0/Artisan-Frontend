// components/TablePallets.jsx
import React from "react";

export default function TablePallets({ columns, data }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="px-6 py-3 text-left text-xs font-medium text-text uppercase">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-border">
          {data.map(row => (
            <tr key={row.id}>
              {columns.map((col, ci) => (
                <td key={ci} className="px-6 py-4 text-sm">
                  {col.renderCell ? col.renderCell(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
