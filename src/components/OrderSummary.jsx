import Table from "./Table";

export default function OrderSummary() {
  const data = [
    { concepto: "Total Neto", monto: 0 },
    { concepto: "IVA", monto: 0 },
    { concepto: "Total", monto: 0 }
  ];

  return (
    <div className="mt-6 bg-gray-50 rounded-lg shadow overflow-hidden w-1/3 ml-auto">
      <div className="px-6 py-4">
        <h2 className="text-lg font-medium text-text mb-4">Resumen de Totales</h2>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm font-medium text-text">
                {item.concepto}
              </span>
              <span className={`text-sm ${index === data.length - 1 ? 'font-bold' : ''} text-text`}>
                ${item.monto.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 