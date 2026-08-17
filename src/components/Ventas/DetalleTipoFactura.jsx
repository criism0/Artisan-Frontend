import { formatCLP } from "../../services/formatHelpers";
import { lineaEnCajas, esFormatoCajas, unidadesPorCajaDeLinea } from "../../utils/formatoCantidad";
import {
  cantidadFacturable,
  tieneDiferenciaDePicking,
  hayPickingRegistrado,
} from "../../utils/cantidadFacturable";

/**
 * El detalle de una orden de venta con forma de documento tributario.
 *
 * 🔴 POR QUÉ ESTA FORMA Y NO UNA TABLA MÁS. Antes «Resumen» y «Productos» eran dos pestañas: los
 * datos del receptor en una, las líneas en otra, y los totales REPETIDOS en las dos (la tarjeta
 * TOTAL de arriba y una línea al pie del resumen). Para cuadrar un monto había que saltar de
 * pestaña, y si los dos números alguna vez difieren nadie sabe cuál creer.
 *
 * Una factura resuelve eso hace siglos: receptor arriba, líneas al medio, totales abajo a la
 * derecha, una sola vez. Además es la forma en que el operario va a ver el documento emitido, así
 * que mirar la orden y mirar la factura dejan de ser dos lecturas distintas.
 */
export default function DetalleTipoFactura({
  orden,
  lineas,
  direccion,
  totalNeto,
  iva,
  total,
  costoEnvio,
  formatDate,
  netoPedido,
}) {
  const cliente = orden?.cliente ?? direccion?.cliente ?? null;
  const enCajas = esFormatoCajas(orden?.formato_cantidad);
  // La columna de pickeado sólo aparece si alguna línea se pickeó. En una orden sin picking
  // registrado —el caso normal— la tabla queda exactamente como estaba.
  const conPicking = hayPickingRegistrado(lineas);
  const columnas = conPicking ? 6 : 5;

  return (
    <div className="bg-white rounded-lg shadow border border-border overflow-hidden">
      {/* ── Cabecera del documento: quién y cuándo ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border">
        <div className="md:col-span-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cliente</div>
          <div className="font-semibold text-text mt-0.5">
            {cliente?.razon_social || cliente?.nombre_empresa || (
              <span className="text-gray-400 italic">Sin cliente asignado</span>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {cliente?.rut ? `RUT ${cliente.rut}` : ""}
            {cliente?.giro ? ` · ${cliente.giro}` : ""}
          </div>

          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-3">
            Dirección de entrega
          </div>
          {direccion ? (
            <div className="text-xs text-gray-600 mt-0.5">
              {[direccion.tipo_direccion, direccion.nombre_sucursal].filter(Boolean).join(" — ")}
              {direccion.calle ? ` · ${direccion.calle} ${direccion.numero || ""}` : ""}
              {direccion.comuna ? `, ${direccion.comuna}` : ""}
            </div>
          ) : (
            <span className="inline-block mt-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Por asignar — se confirma al facturar
            </span>
          )}
        </div>

        <div className="text-sm md:text-right">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Fechas</div>
          <div className="text-xs text-gray-600 mt-0.5">Emisión: {formatDate(orden?.fecha_orden)}</div>
          <div className="text-xs text-gray-600">Despacho: {formatDate(orden?.fecha_envio)}</div>
          <div className="text-xs text-gray-600">Facturación: {formatDate(orden?.fecha_facturacion)}</div>
          {orden?.numero_oc && (
            <>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-3">
                OC del cliente
              </div>
              <div className="text-xs font-mono text-gray-700 mt-0.5">{orden.numero_oc}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Líneas ───────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Descripción</th>
              <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                {enCajas ? "Cajas" : "Pedido"}
              </th>
              {conPicking && (
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Pickeado</th>
              )}
              <th className="px-4 py-2 text-right font-medium whitespace-nowrap">
                {enCajas ? "Precio caja" : "Precio unit."}
              </th>
              <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Desc.</th>
              <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineas.length === 0 && (
              <tr>
                <td colSpan={columnas} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                  La orden no tiene líneas
                </td>
              </tr>
            )}
            {lineas.map((it) => {
              const cantidad = Number(it?.cantidad || 0);
              const precio = Number(it?.precio_venta || 0);
              const descuento = Number(it?.porcentaje_descuento || 0);
              // 🔴 El subtotal es el que va a salir en la factura, o sea el de lo PICKEADO.
              // Mostrar el del pedido es cómo el sobrecobro de la OV 778 pasó desapercibido.
              const facturable = cantidadFacturable(it);
              const subtotal = facturable * precio * (1 - descuento / 100);
              const difiere = tieneDiferenciaDePicking(it);
              const nombre =
                it?.NombreFacturacion?.nombre ||
                it?.ProductoBase?.nombre ||
                `Producto #${it?.id_producto ?? "—"}`;

              // En una orden por cajas se muestran cajas y precio por caja. El total NO cambia:
              // es la misma plata expresada en otra unidad.
              const caja = enCajas
                ? lineaEnCajas(cantidad, precio, unidadesPorCajaDeLinea(it))
                : null;
              const mostrarCajas = caja?.cajas != null;
              const cajaPickeada =
                enCajas && difiere
                  ? lineaEnCajas(facturable, precio, unidadesPorCajaDeLinea(it))
                  : null;

              return (
                <tr key={it?.id} className={difiere ? "bg-amber-50" : undefined}>
                  <td className="px-4 py-2 text-text break-words">
                    {nombre}
                    {mostrarCajas && (
                      <span className="block text-xs text-gray-500">
                        {cantidad.toLocaleString("es-CL")} unidades · caja de {caja.unidades_por_caja}
                        {caja.unidades_sueltas > 0 && ` · ${caja.unidades_sueltas} sueltas`}
                      </span>
                    )}
                    {enCajas && !mostrarCajas && (
                      <span className="block text-xs text-amber-700">
                        Sin unidades por caja definidas — se muestra en unidades
                      </span>
                    )}
                    {facturable <= 0 && it?.cantidad_pickeada != null && (
                      <span className="block text-xs font-medium text-amber-800">
                        No se pickeó nada — esta línea no va en el documento
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2 text-right whitespace-nowrap tabular-nums ${
                      difiere ? "text-gray-500 line-through" : ""
                    }`}
                  >
                    {mostrarCajas
                      ? `${caja.cajas.toLocaleString("es-CL")}${caja.unidades_sueltas > 0 ? " + " + caja.unidades_sueltas : ""}`
                      : cantidad.toLocaleString("es-CL")}
                  </td>
                  {conPicking && (
                    <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                      {it?.cantidad_pickeada == null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className={difiere ? "font-semibold text-amber-800" : ""}>
                          {cajaPickeada?.cajas != null
                            ? `${cajaPickeada.cajas.toLocaleString("es-CL")}${cajaPickeada.unidades_sueltas > 0 ? " + " + cajaPickeada.unidades_sueltas : ""}`
                            : facturable.toLocaleString("es-CL")}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                    {formatCLP(mostrarCajas ? caja.precio_caja : precio, 0)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums text-gray-500">
                    {descuento > 0 ? `${descuento}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular-nums font-medium">
                    {formatCLP(subtotal, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Totales: abajo a la derecha, UNA sola vez en toda la pantalla ────── */}
      <div className="flex justify-end border-t border-border bg-gray-50 px-4 py-3">
        <dl className="w-full max-w-xs text-sm space-y-1">
          {/* 🔴 Los DOS netos cuando el picking los separa. El pedido es lo que el cliente
              acordó y sigue siendo un dato útil —dice qué quedó pendiente—; el de abajo es el
              que va a salir en el documento. Mostrar sólo uno pierde información en cualquiera
              de las dos direcciones. */}
          {netoPedido != null && Math.round(netoPedido) !== Math.round(totalNeto) && (
            <div className="flex justify-between text-gray-500">
              <dt>Neto pedido</dt>
              <dd className="tabular-nums line-through">{formatCLP(netoPedido, 0)}</dd>
            </div>
          )}
          {Number(costoEnvio) > 0 && (
            <div className="flex justify-between text-gray-600">
              <dt>Costo de envío</dt>
              <dd className="tabular-nums">{formatCLP(costoEnvio, 0)}</dd>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <dt>
              {netoPedido != null && Math.round(netoPedido) !== Math.round(totalNeto)
                ? "Neto a facturar"
                : "Neto"}
            </dt>
            <dd className="tabular-nums">{formatCLP(totalNeto, 0)}</dd>
          </div>
          <div className="flex justify-between text-gray-600">
            <dt>IVA 19%</dt>
            <dd className="tabular-nums">{formatCLP(iva, 0)}</dd>
          </div>
          <div className="flex justify-between pt-1 border-t border-border font-semibold text-text">
            <dt>Total</dt>
            <dd className="tabular-nums text-primary">{formatCLP(total, 0)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
