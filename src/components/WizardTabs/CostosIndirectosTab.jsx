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
  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-3">Asociar costo indirecto a receta (por kg)</div>
        <div className="text-sm text-gray-600 mb-4">Estos costos se suman como referencia por kg a la receta.</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Costo indirecto</label>
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedCostoId}
              onChange={(e) => setSelectedCostoId(e.target.value)}
            >
              <option value="">Seleccionar</option>
              {costosCatalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Costo $/kg</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2"
              value={costoPorKg}
              onChange={(e) => setCostoPorKg(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
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
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">{c.nombre}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="border rounded-lg px-2 py-1 w-32"
                      defaultValue={
                        c?.RecetaCostoIndirecto?.costo_por_kg ?? c?.recetaCostoIndirecto?.costo_por_kg ?? 0
                      }
                      onBlur={(e) => onUpdateCostoReceta(c.id, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={nuevoCosto.nombre}
              onChange={(e) => setNuevoCosto((p) => ({ ...p, nombre: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={nuevoCosto.descripcion}
              onChange={(e) => setNuevoCosto((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <button
            type="button"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            onClick={onCrearCosto}
          >
            Crear costo
          </button>
        </div>
      </div>
    </div>
  );
}
