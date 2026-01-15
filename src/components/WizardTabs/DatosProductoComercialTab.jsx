export default function DatosProductoComercialTab({ productoId, productoForm, setProductoForm, onGuardarProducto }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <div className="text-sm font-semibold text-gray-800">Datos del Producto Comercial</div>
      <div className="text-sm text-gray-600">Crea el producto base (sin precio). Luego pasarás a definir la receta.</div>

      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={productoForm.nombre}
          onChange={(e) => setProductoForm((p) => ({ ...p, nombre: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descripción *</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          value={productoForm.descripcion}
          onChange={(e) => setProductoForm((p) => ({ ...p, descripcion: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Cantidad por unidad *</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={productoForm.peso_unitario}
            onChange={(e) => setProductoForm((p) => ({ ...p, peso_unitario: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Unidad de medida *</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={productoForm.unidad_medida}
            onChange={(e) => setProductoForm((p) => ({ ...p, unidad_medida: e.target.value }))}
          >
            <option value="">Seleccionar</option>
            <option value="Kilogramos">Kilogramos</option>
            <option value="Litros">Litros</option>
            <option value="Unidades">Unidades</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Unidades por caja *</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            value={productoForm.unidades_por_caja}
            onChange={(e) => setProductoForm((p) => ({ ...p, unidades_por_caja: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Código EAN *</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={productoForm.codigo_ean}
            onChange={(e) => setProductoForm((p) => ({ ...p, codigo_ean: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Código SAP *</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={productoForm.codigo_sap}
            onChange={(e) => setProductoForm((p) => ({ ...p, codigo_sap: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="bg-primary hover:bg-hover text-white px-6 py-2 rounded"
          onClick={onGuardarProducto}
        >
          {productoId ? "Actualizar y continuar" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}
