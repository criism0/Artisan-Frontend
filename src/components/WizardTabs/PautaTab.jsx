import PautaSelectorConCreacion from "../Pautas/PautaSelectorConCreacion";

export default function PautaTab({
  api,
  pautas,
  setPautas,
  selectedPautaId,
  setSelectedPautaId,
  onOmitir,
  onGuardar,
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <div className="text-sm font-semibold text-gray-800">Asignar pauta de elaboración</div>
      <div className="text-sm text-gray-600">Selecciona una pauta para definir los pasos del proceso (opcional).</div>

      <PautaSelectorConCreacion
        api={api}
        pautas={pautas}
        setPautas={setPautas}
        selectedPautaId={selectedPautaId}
        setSelectedPautaId={setSelectedPautaId}
      />

      <div className="flex justify-end gap-2">
        <button type="button" className="px-4 py-2 border rounded-lg hover:bg-gray-50" onClick={onOmitir}>
          Omitir
        </button>
        <button type="button" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover" onClick={onGuardar}>
          Guardar pauta
        </button>
      </div>
    </div>
  );
}
