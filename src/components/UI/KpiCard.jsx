/**
 * Tarjeta de indicador que abre los dashboards de cada módulo.
 *
 * Estaba copiada byte a byte en los 6 dashboards (Adquisiciones, Inventario, Logística,
 * Producción, Ventas y Calidad). Como los dashboards son la referencia visual del resto
 * de la app, la referencia tiene que ser una sola: cualquier ajuste hecho en una copia
 * habría dejado los módulos desalineados entre sí sin que nadie lo notara.
 */
const BORDES_ACENTO = {
  red: "border-l-4 border-l-red-500",
  yellow: "border-l-4 border-l-yellow-500",
  blue: "border-l-4 border-l-blue-500",
  green: "border-l-4 border-l-green-500",
};

export default function KpiCard({ icon, label, value, subtitle, accent }) {
  const accentBorder = BORDES_ACENTO[accent] || BORDES_ACENTO.green;

  return (
    <div className={`bg-white p-5 rounded-lg shadow ${accentBorder}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
