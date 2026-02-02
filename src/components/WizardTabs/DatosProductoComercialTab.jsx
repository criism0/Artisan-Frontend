import FormField from "../FormField";

export default function DatosProductoComercialTab({ productoId, productoForm, setProductoForm, onGuardarProducto }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <div className="text-sm font-semibold text-gray-800">Datos del Producto Comercial</div>
      <div className="text-sm text-gray-600">Crea el producto base. Luego pasarás a definir la receta.</div>

      <FormField
        label="Nombre"
        type="text"
        placeholder="Ej: Yogurt Natural"
        value={productoForm.nombre}
        onChange={(e) => setProductoForm((p) => ({ ...p, nombre: e.target.value }))}
        required
      />

      <FormField
        label="Descripción"
        type="textarea"
        placeholder="Describe el producto..."
        value={productoForm.descripcion}
        onChange={(e) => setProductoForm((p) => ({ ...p, descripcion: e.target.value }))}
        required
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FormField
          label="Cantidad por unidad"
          type="number"
          placeholder="10"
          value={productoForm.peso_unitario}
          onChange={(e) => setProductoForm((p) => ({ ...p, peso_unitario: e.target.value }))}
          required
        />
        <FormField
          label="Unidad de medida"
          type="select"
          value={productoForm.unidad_medida}
          onChange={(e) => setProductoForm((p) => ({ ...p, unidad_medida: e.target.value }))}
          options={[
            { value: "Kilogramos", label: "Kilogramos" },
            { value: "Litros", label: "Litros" },
            { value: "Unidades", label: "Unidades" },
          ]}
          required
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FormField
          label="Unidades por caja"
          type="number"
          placeholder="6"
          value={productoForm.unidades_por_caja}
          onChange={(e) => setProductoForm((p) => ({ ...p, unidades_por_caja: e.target.value }))}
          required
        />
        <FormField
          label="Código EAN"
          type="text"
          placeholder="1234567890123"
          value={productoForm.codigo_ean}
          onChange={(e) => setProductoForm((p) => ({ ...p, codigo_ean: e.target.value }))}
          required
        />
        <FormField
          label="Código SAP"
          type="text"
          placeholder="SAP123"
          value={productoForm.codigo_sap}
          onChange={(e) => setProductoForm((p) => ({ ...p, codigo_sap: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FormField
          label="Código DUN14"
          type="text"
          placeholder="DUN14123"
          value={productoForm.codigo_dun14}
          onChange={(e) => setProductoForm((p) => ({ ...p, codigo_dun14: e.target.value }))}
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="bg-primary hover:bg-hover text-white px-6 py-2 rounded font-medium"
          onClick={onGuardarProducto}
        >
          {productoId ? "Actualizar y continuar" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}
