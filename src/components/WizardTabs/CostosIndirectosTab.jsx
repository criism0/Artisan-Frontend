import FormField from "../FormField";

export default function CostosIndirectosTab({
  costosCatalogo,
  recetaCostos,
  selectedCostoId,
  setSelectedCostoId,
  costoPorKg,
  setCostoPorKg,
  nuevoCosto,
  setNuevoCosto,
  onCrearCosto,
  onAddCostoReceta,
  onUpdateCostoReceta,
  onRemoveCostoReceta,
}) {
  const costosOptions = Array.isArray(costosCatalogo)
    ? costosCatalogo.map((c) => ({ value: String(c.id), label: c.nombre }))
    : [];

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-3">Asociar costo indirecto a receta (por kg)</div>
        <div className="text-sm text-gray-600 mb-4">Estos costos se suman como referencia por kg a la receta.</div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FormField
            label="Costo indirecto"
            type="select"
            value={selectedCostoId}
            onChange={(e) => setSelectedCostoId(e.target.value)}
            options={costosOptions}
          />
          <FormField
            label="Costo $/kg"
            type="number"
            placeholder="0"
            value={costoPorKg}
            onChange={(e) => setCostoPorKg(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium"
              onClick={onAddCostoReceta}
            >
              Asociar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-3">Costos indirectos asociados</div>
        {recetaCostos.length === 0 ? (
          <div className="text-sm text-gray-600">Sin costos indirectos asociados.</div>
        ) : (
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Costo $/kg</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recetaCostos.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{c.nombre}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="border rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-primary"
                      defaultValue={
                        c?.RecetaCostoIndirecto?.costo_por_kg ?? c?.recetaCostoIndirecto?.costo_por_kg ?? 0
                      }
                      onBlur={(e) => onUpdateCostoReceta(c.id, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-red-600 hover:underline font-medium"
                      onClick={() => onRemoveCostoReceta(c.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-3">Crear nuevo costo indirecto</div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <FormField
            label="Nombre"
            type="text"
            placeholder="Ej: Laboratorio"
            value={nuevoCosto.nombre}
            onChange={(e) => setNuevoCosto((p) => ({ ...p, nombre: e.target.value }))}
          />
          <div className="lg:col-span-2">
            <FormField
              label="Descripción"
              type="text"
              placeholder="Describe el costo..."
              value={nuevoCosto.descripcion}
              onChange={(e) => setNuevoCosto((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium"
            onClick={onCrearCosto}
          >
            Crear costo
          </button>
        </div>
      </div>
    </div>
  );
}
