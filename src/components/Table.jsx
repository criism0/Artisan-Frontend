import React from "react";

export default function Table({ columns, data, actions, renderActions, renderExpandedRow }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="min-w-max w-full">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider ${column?.headerClassName || ""}`}
              >
                {column.header}
              </th>
            ))}
            {actions && <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">OPCIONES</th>}
            {renderActions && <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">ACCIONES</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-border">
          {data.map((row, rowIndex) => {
            const keyId = (row?.lote ?? row?.id ?? row?.id_lote ?? rowIndex);
            const tipo = row?.tipo ?? '';
            const key = `${keyId}-${tipo}`;
            return (
              <React.Fragment key={key}>
                <tr key={key}>
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-6 py-4 whitespace-nowrap text-sm text-text ${column?.cellClassName || ""}`}
                    >
                      {column.Cell ? column.Cell({ row, value: row[column.accessor] }) : row[column.accessor]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {actions(row)}
                    </td>
                  )}
                  {renderActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {renderActions(row)}
                    </td>
                  )}
                </tr>
                {renderExpandedRow && renderExpandedRow(row)}
              </React.Fragment>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}

