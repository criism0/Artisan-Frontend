export default function CostosSecosTab({
  recetaId,
  opcionesMateriaPrima,
  costosSecos,
  selectedCostoSecoId,
  setSelectedCostoSecoId,
  onAddCostoSeco,
  onRemoveCostoSeco,
  onNext,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-sm font-semibold text-gray-800 mb-1">Costos Secos</div>
        <div className="text-sm text-gray-600 mb-4">
          Define los insumos de empaque/almacenamiento (u otros costos variables) que podrían usarse. En
          producción se declarará qué se usó finalmente.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">Seleccionar y agregar</div>
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded-lg px-3 py-2 bg-white"
                value={selectedCostoSecoId}
                onChange={(e) => setSelectedCostoSecoId(e.target.value)}
                disabled={!recetaId}
              >
                <option value="">Seleccionar</option>
                {(opcionesMateriaPrima || [])
                  .filter((opt) => {
                    const selectedIds = new Set((costosSecos || []).map((x) => String(x?.id ?? "")));
                    return opt.value === String(selectedCostoSecoId || "") || !selectedIds.has(opt.value);
                  })
                  .map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                onClick={onAddCostoSeco}
                disabled={!recetaId || !selectedCostoSecoId}
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">Costos secos seleccionados</div>
            {costosSecos.length === 0 ? (
              <div className="text-sm text-gray-600">Sin costos secos por ahora.</div>
            ) : (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Insumo</th>
                    <th className="px-3 py-2 text-left">Unidad</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {costosSecos.map((mp) => (
                    <tr key={mp.id} className="border-t">
                      <td className="px-3 py-2">{mp.nombre}</td>
                      <td className="px-3 py-2">{mp.unidad_medida}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => onRemoveCostoSeco(mp.id)}
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
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            onClick={onNext}
            disabled={!recetaId}
          >
            Continuar a Pauta
          </button>
        </div>
      </div>
    </div>
  );
}
