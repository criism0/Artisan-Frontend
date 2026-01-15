import Selector from "../Selector";

export default function IngredienteAdder({
  opcionesIngredientes,
  selectedIngredientId,
  onSelectIngredient,
  ingredientPeso,
  onChangeIngredientPeso,
  ingredientUnidad,
  onChangeIngredientUnidad,
  unidadEditable = true,
  onAddIngrediente,
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="text-sm font-semibold text-gray-800 mb-3">Agregar ingrediente</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Materia prima</label>
          <Selector
            options={opcionesIngredientes}
            selectedValue={selectedIngredientId}
            onSelect={onSelectIngredient}
            useFuzzy
            groupBy="category"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <div>
          <label className="block text-sm font-medium mb-1">Peso *</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={ingredientPeso}
            onChange={(e) => onChangeIngredientPeso?.(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unidad</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={ingredientUnidad}
            onChange={unidadEditable ? (e) => onChangeIngredientUnidad?.(e.target.value) : undefined}
            readOnly={!unidadEditable}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            onClick={onAddIngrediente}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
