export default function DatosPipTab({
  pipId,
  pipForm,
  setPipForm,
  onGuardarPip,
  unidadMedidaReadOnly = false,
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <div className="text-sm font-semibold text-gray-800">Datos del PIP</div>
      <div className="text-sm text-gray-600">Crea el PIP y luego define su receta.</div>

      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={pipForm.nombre}
          onChange={(e) => setPipForm((p) => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: PIP Yogurt Griego"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Unidad de medida *</label>
          {unidadMedidaReadOnly ? (
            <input
              className="w-full border rounded-lg px-3 py-2 bg-gray-50"
              value={pipForm.unidad_medida}
              disabled
              title="Campo inmutable"
            />
          ) : (
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={pipForm.unidad_medida}
              onChange={(e) => setPipForm((p) => ({ ...p, unidad_medida: e.target.value }))}
            >
              <option value="">Seleccionar</option>
              <option value="Kilogramos">Kilogramos</option>
              <option value="Litros">Litros</option>
              <option value="Unidades">Unidades</option>
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stock crítico</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={pipForm.stock_critico}
            onChange={(e) => setPipForm((p) => ({ ...p, stock_critico: e.target.value }))}
          />
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Categoría: <span className="font-medium">PIP</span>
      </div>

      <div className="flex justify-end">
        <button type="button" className="bg-primary hover:bg-hover text-white px-6 py-2 rounded" onClick={onGuardarPip}>
          {pipId ? "Actualizar y continuar" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}
