import FormField from "../FormField";

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

      <FormField
        label="Nombre"
        type="text"
        placeholder="Ej: PIP Yogurt Griego"
        value={pipForm.nombre}
        onChange={(e) => setPipForm((p) => ({ ...p, nombre: e.target.value }))}
        required
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FormField
          label="Unidad de medida"
          type="select"
          value={pipForm.unidad_medida}
          onChange={(e) => setPipForm((p) => ({ ...p, unidad_medida: e.target.value }))}
          options={[
            { value: "Kilogramos", label: "Kilogramos" },
            { value: "Litros", label: "Litros" },
            { value: "Unidades", label: "Unidades" },
          ]}
          disabled={unidadMedidaReadOnly}
          readOnly={unidadMedidaReadOnly}
          required
        />
        <FormField
          label="Stock crítico"
          type="number"
          placeholder="100"
          value={pipForm.stock_critico}
          onChange={(e) => setPipForm((p) => ({ ...p, stock_critico: e.target.value }))}
        />
      </div>

      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
        Categoría: <span className="font-medium">PIP</span>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="bg-primary hover:bg-hover text-white px-6 py-2 rounded font-medium"
          onClick={onGuardarPip}
        >
          {pipId ? "Actualizar y continuar" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}
