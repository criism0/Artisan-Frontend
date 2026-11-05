import Ayuda from "../UI/Ayuda";

const formato = (n, unidad) => {
  const v = Math.round(n * 10) / 10;
  const txt = v.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  return unidad === "Kilogramos" ? `${txt} kg` : unidad === "Litros" ? `${txt} L` : txt;
};

/**
 * «Inventario de la semana» (Fase C): cada producto con lo que hay y lo que queda al cierre de cada
 * día que tiene pedidos. En rojo, el día en que no alcanza. Una fila sin nada en rojo alcanza para
 * toda la semana. Lo que se pide sale de los pedidos puestos en cada día (más la propuesta de la
 * planificación rápida, mientras no se confirme).
 */
export default function InventarioSemana({ filas, dias }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-2">
      <h2 className="text-base font-semibold text-gray-800 flex items-center gap-1.5">
        Inventario de la semana
        <Ayuda titulo="Inventario de la semana">
          <p>Disponible = bultos con QR + stock sin QR de la bodega.</p>
          <p>Cada día muestra lo que queda después de lo que piden ese día y los anteriores. En rojo, no alcanza.</p>
        </Ayuda>
      </h2>
      {filas.length === 0 ? (
        <p className="text-sm text-gray-500">Ningún pedido de la semana pide productos con nombre de facturación.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="text-left font-semibold py-1 pr-2">Producto</th>
                <th className="text-right font-semibold px-2">Disponible</th>
                {dias.map((d) => (
                  <th key={d.iso} className="text-right font-semibold px-2">{d.nombre} {Number(d.iso.slice(8, 10))}</th>
                ))}
                <th className="text-right font-semibold pl-2">Por planificar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_nombre_facturacion} className="border-t border-gray-100">
                  <td className="py-1 pr-2 text-gray-800">{f.nombre}</td>
                  <td
                    className="text-right px-2 tabular-nums"
                    title={`Con QR ${formato(f.qr, f.unidad_venta)} · sin QR ${formato(f.sin_qr, f.unidad_venta)}`}
                  >
                    {formato(f.disponible, f.unidad_venta)}
                  </td>
                  {f.celdas.map((c, i) =>
                    c.pide > 0 ? (
                      <td
                        key={dias[i].iso}
                        title={`Piden ${formato(c.pide, f.unidad_venta)}`}
                        className={`text-right px-2 tabular-nums ${c.falta ? "bg-red-50 text-red-700 font-bold" : ""}`}
                      >
                        {formato(c.queda, f.unidad_venta)}
                      </td>
                    ) : (
                      <td key={dias[i].iso} className="text-right px-2 text-gray-300">·</td>
                    ),
                  )}
                  <td className="text-right pl-2 tabular-nums text-gray-600">{f.porPlanificar > 0 ? formato(f.porPlanificar, f.unidad_venta) : "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
