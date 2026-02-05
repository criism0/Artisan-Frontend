import FormField from "../FormField";
import Selector from "../Selector";
import SubproductoAdder from "../Recetas/SubproductoAdder";

export default function RecetaTab({
  titulo,
  recetaId,
  recetaForm,
  setRecetaForm,
  onGuardarReceta,

  unidadMedidaReadOnly = false,

  mpById,
  opcionesIngredientes,
  opcionesMateriaPrima,

  selectedIngredientId,
  setSelectedIngredientId,
  ingredientPeso,
  setIngredientPeso,
  ingredientUnidad,
  setIngredientUnidad,
  selectedEquivalenteId,
  setSelectedEquivalenteId,
  equivalentesIds,
  setEquivalentesIds,
  editingIngredienteId,
  onSubmitIngrediente,
  onCancelEditIngrediente,

  ingredientes,
  onStartEditIngrediente,
  onRemoveIngrediente,

  opcionesSubproductos,
  selectedSubproductId,
  setSelectedSubproductId,
  onAddSubproducto,
  subproductos,
  onRemoveSubproducto,

  onNext,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="text-sm font-semibold text-gray-800">{titulo}</div>
        <div className="text-sm text-gray-600">
          Define los datos de la receta y selecciona los ingredientes/subproductos permitidos.
        </div>

        <FormField
          label="Nombre receta"
          type="text"
          placeholder="Ej: Receta Yogurt Natural"
          value={recetaForm.nombre}
          onChange={(e) => setRecetaForm((r) => ({ ...r, nombre: e.target.value }))}
          required
        />

        <FormField
          label="Descripción"
          type="textarea"
          placeholder="Describe la receta..."
          value={recetaForm.descripcion}
          onChange={(e) => setRecetaForm((r) => ({ ...r, descripcion: e.target.value }))}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FormField
            label="Peso"
            type="number"
            placeholder="1"
            value={recetaForm.peso ?? ""}
            onChange={(e) => setRecetaForm((r) => ({ ...r, peso: e.target.value }))}
            required
          />

          <FormField
            label="Unidad de medida"
            type="text"
            value={recetaForm.unidad_medida}
            onChange={(e) =>
              unidadMedidaReadOnly
                ? undefined
                : setRecetaForm((r) => ({ ...r, unidad_medida: e.target.value }))
            }
            disabled={unidadMedidaReadOnly}
            readOnly={unidadMedidaReadOnly}
            required
          />

          <FormField
            label="Costo Directo Producción Referencial"
            type="number"
            placeholder="0"
            value={recetaForm.costo_referencial_produccion ?? ""}
            onChange={(e) =>
              setRecetaForm((r) => ({ ...r, costo_referencial_produccion: e.target.value }))
            }
          />
        </div>

        <FormField
          label="Días de vida útil"
          type="number"
          placeholder="Ej: 30"
          value={recetaForm.dias_vida_util ?? ""}
          onChange={(e) => setRecetaForm((r) => ({ ...r, dias_vida_util: e.target.value }))}
          helperText="Se utilizará para calcular automáticamente la fecha de vencimiento al cerrar la orden"
          required
        />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            className="bg-primary hover:bg-hover text-white px-6 py-2 rounded font-medium"
            onClick={onGuardarReceta}
          >
            {recetaId ? "Actualizar receta y continuar" : "Crear receta y continuar"}
          </button>
        </div>
      </div>

      {!recetaId ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600">
            Primero crea/actualiza la receta para poder asociar ingredientes, subproductos y costos.
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-1">Ingredientes (con alternativas)</div>
            <div className="text-sm text-gray-600 mb-4">
              Puedes definir materias primas equivalentes para que en producción se use cualquiera de ellas (o
              combinación) según disponibilidad.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">Seleccionar y agregar</div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Materia prima principal</label>
                    <Selector
                      options={opcionesIngredientes}
                      selectedValue={selectedIngredientId}
                      onSelect={(value) => {
                        setSelectedIngredientId(value);
                        const mp = mpById.get(String(value));
                        setIngredientUnidad(mp?.unidad_medida ? String(mp.unidad_medida) : "");
                        setSelectedEquivalenteId("");
                        setEquivalentesIds([]);
                      }}
                      useFuzzy
                      groupBy="category"
                      disabled={!!editingIngredienteId}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Peso/Cantidad</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2"
                        value={ingredientPeso}
                        onChange={(e) => setIngredientPeso(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unidad</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                        value={ingredientUnidad}
                        readOnly
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Alternativas (opcionales)</label>
                    <div className="flex gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Selector
                          options={(opcionesMateriaPrima || []).filter((opt) => {
                            if (!selectedIngredientId) return false;
                            if (opt.value === String(selectedIngredientId)) return false;
                            if ((equivalentesIds || []).includes(opt.value)) return false;
                            const unidadBase = String(ingredientUnidad || "").trim();
                            const unidadOpt = String(opt.unidad || "").trim();
                            return !unidadBase || !unidadOpt ? true : unidadBase === unidadOpt;
                          })}
                          selectedValue={selectedEquivalenteId}
                          onSelect={(value) => setSelectedEquivalenteId(value)}
                          useFuzzy
                          groupBy="category"
                          disabled={!selectedIngredientId}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                      <button
                        type="button"
                        className="px-3 py-2 border rounded-lg hover:bg-gray-50 shrink-0"
                        onClick={() => {
                          if (!selectedEquivalenteId) return;
                          setEquivalentesIds((prev) =>
                            Array.from(new Set([...(prev || []), selectedEquivalenteId]))
                          );
                          setSelectedEquivalenteId("");
                        }}
                        disabled={!selectedEquivalenteId}
                      >
                        Agregar
                      </button>
                    </div>

                    {equivalentesIds.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {equivalentesIds.map((idEq) => {
                          const mp = mpById.get(String(idEq));
                          return (
                            <button
                              key={idEq}
                              type="button"
                              className="px-2 py-1 text-sm border rounded-lg hover:bg-gray-50"
                              onClick={() =>
                                setEquivalentesIds((prev) => (prev || []).filter((x) => x !== idEq))
                              }
                              title="Quitar alternativa"
                            >
                              {mp?.nombre || `#${idEq}`} ×
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-600">Sin alternativas.</div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium"
                    onClick={onSubmitIngrediente}
                  >
                    {editingIngredienteId ? "Guardar cambios" : "Agregar ingrediente"}
                  </button>

                  {editingIngredienteId ? (
                    <button
                      type="button"
                      className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
                      onClick={onCancelEditIngrediente}
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">Ingredientes seleccionados</div>
                {ingredientes.length === 0 ? (
                  <div className="text-sm text-gray-600">Sin ingredientes por ahora.</div>
                ) : (
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Principal</th>
                        <th className="px-3 py-2 text-left">Alternativas</th>
                        <th className="px-3 py-2 text-left">Peso</th>
                        <th className="px-3 py-2 text-left">Unidad</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientes.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="px-3 py-2">{i?.materiaPrima?.nombre || "—"}</td>
                          <td className="px-3 py-2">
                            {(i?.materiasPrimasEquivalentes || []).length
                              ? (i.materiasPrimasEquivalentes || []).map((x) => x.nombre).join(", ")
                              : "—"}
                          </td>
                          <td className="px-3 py-2">{i.peso}</td>
                          <td className="px-3 py-2">{i.unidad_medida}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-blue-600 hover:underline mr-3"
                              onClick={() => onStartEditIngrediente?.(i)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => onRemoveIngrediente?.(i.id)}
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
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm font-semibold text-gray-800 mb-1">Subproductos posibles</div>
            <div className="text-sm text-gray-600 mb-4">
              Define qué subproductos podrían generarse en esta receta.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">Seleccionar y agregar</div>
                <SubproductoAdder
                  conContenedor={false}
                  conTitulo={false}
                  opcionesSubproductos={opcionesSubproductos}
                  selectedSubproductId={selectedSubproductId}
                  onSelectSubproducto={(value) => setSelectedSubproductId(value)}
                  onAddSubproducto={onAddSubproducto}
                />
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">Subproductos seleccionados</div>
                {subproductos.length === 0 ? (
                  <div className="text-sm text-gray-600">Sin subproductos por ahora.</div>
                ) : (
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Materia prima</th>
                        <th className="px-3 py-2 text-left">Unidad</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {subproductos.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-3 py-2">{s.nombre}</td>
                          <td className="px-3 py-2">{s.unidad_medida}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => onRemoveSubproducto?.(s.id)}
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
                className="bg-primary hover:bg-hover text-white px-6 py-2 rounded font-medium"
                onClick={onNext}
              >
                Continuar a Costos Secos
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
