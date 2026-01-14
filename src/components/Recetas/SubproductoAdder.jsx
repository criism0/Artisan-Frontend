import Selector from "../Selector";

export default function SubproductoAdder({
  opcionesSubproductos,
  selectedSubproductId,
  onSelectSubproducto,
  onAddSubproducto,
  conContenedor = true,
  conTitulo = true,
}) {
  const body = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-1">Materia prima</label>
        <Selector
          options={opcionesSubproductos}
          selectedValue={selectedSubproductId}
          onSelect={onSelectSubproducto}
          useFuzzy
          groupBy="category"
        />
      </div>

      <div className="flex items-end">
        <button
          type="button"
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={onAddSubproducto}
        >
          Agregar
        </button>
      </div>
    </div>
  );

  if (!conContenedor) return body;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {conTitulo ? <div className="text-sm font-semibold text-gray-800 mb-3">Subproductos</div> : null}
      {body}
    </div>
  );
}
