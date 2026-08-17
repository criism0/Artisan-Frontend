import { useState } from "react";
import { MapPin, MessageSquare, Pencil } from "lucide-react";
import { formatCLP } from "../../services/formatHelpers";
import { lineaEnCajas, esFormatoCajas, unidadesPorCajaDeLinea } from "../../utils/formatoCantidad";
import {
  cantidadFacturable,
  tieneDiferenciaDePicking,
  hayPickingRegistrado,
} from "../../utils/cantidadFacturable";
import Selector from "../Forms/Selector";

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
  // Dirección de despacho: editable en cualquier estado anterior a Entregada, no sólo al
  // facturar. Ver OrdenVentaDetail.jsx — `abrirEdicionDireccion`/`guardarDireccionDespacho`.
  direccionesDespacho = [],
  editandoDireccion = false,
  loadingDirecciones = false,
  guardandoDireccion = false,
  puedeEditarDireccion = true,
  onEmpezarEdicionDireccion,
  onCancelarEdicionDireccion,
  onGuardarDireccion,
  // Lo que el cliente escribió al pedir — instrucciones de despacho, horario, contacto.
  comentarioCliente = null,
}) {
  const cliente = orden?.cliente ?? direccion?.cliente ?? null;
  const enCajas = esFormatoCajas(orden?.formato_cantidad);
  // La columna de pickeado sólo aparece si alguna línea se pickeó. En una orden sin picking
  // registrado —el caso normal— la tabla queda exactamente como estaba.
  const conPicking = hayPickingRegistrado(lineas);
  const columnas = conPicking ? 6 : 5;

  const [seleccion, setSeleccion] = useState("");

  // Las direcciones de DESPACHO del cliente primero —es lo que este selector decide—; si no
  // tiene ninguna registrada como tal, se ofrecen todas antes que dejar el selector vacío.
  const opcionesDireccion = (() => {
    const despacho = direccionesDespacho.filter((d) => d.tipo_direccion === "Despacho");
    const base = despacho.length > 0 ? despacho : direccionesDespacho;
    return base.map((d) => ({
      value: String(d.id),
      label: [d.nombre_sucursal || d.tipo_direccion, [d.calle, d.numero, d.info_adicional].filter(Boolean).join(" "), d.comuna]
        .filter(Boolean)
        .join(" — "),
    }));
  })();

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

          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-3 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Dirección de despacho
          </div>
          {editandoDireccion ? (
            <div className="mt-1 flex flex-col gap-1.5 max-w-sm">
              {loadingDirecciones ? (
                <span className="text-xs text-gray-400">Cargando direcciones del cliente…</span>
              ) : opcionesDireccion.length === 0 ? (
                <span className="text-xs text-amber-700">
                  Este cliente no tiene direcciones registradas. Se agregan desde su ficha.
                </span>
              ) : (
                <Selector
                  options={opcionesDireccion}
                  selectedValue={seleccion || (direccion ? String(direccion.id) : "")}
                  onSelect={setSeleccion}
                  className="border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onGuardarDireccion?.(seleccion)}
                  disabled={guardandoDireccion || !seleccion}
                  className="text-xs bg-primary text-white px-2.5 py-1 rounded-md hover:bg-hover disabled:opacity-50"
                >
                  {guardandoDireccion ? "Guardando…" : "Guardar"}
                </button>
                <button
                  onClick={onCancelarEdicionDireccion}
                  disabled={guardandoDireccion}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 mt-0.5">
              {direccion ? (
                <div className="text-xs text-gray-600">
                  {[direccion.nombre_sucursal || direccion.tipo_direccion].filter(Boolean).join(" — ")}
                  {direccion.calle ? ` · ${direccion.calle} ${direccion.numero || ""}` : ""}
                  {direccion.info_adicional ? ` (${direccion.info_adicional})` : ""}
                  {direccion.comuna ? `, ${direccion.comuna}` : ""}
                </div>
              ) : (
                <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  Sin asignar — se confirma al facturar si no se elige antes
                </span>
              )}
              {puedeEditarDireccion && onEmpezarEdicionDireccion && (
                <button
                  onClick={onEmpezarEdicionDireccion}
                  className="text-gray-400 hover:text-primary shrink-0"
                  title={direccion ? "Cambiar dirección" : "Asignar dirección"}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Horario/metodología DE ESA DIRECCIÓN (Direcciones.comentarios) — distinto del
              comentario del cliente sobre el pedido, que va abajo. */}
          {!editandoDireccion && direccion?.comentarios && (
            <div className="text-xs text-gray-500 mt-0.5 italic">{direccion.comentarios}</div>
          )}

          {/* Lo que el cliente escribió al pedir. Reporte de Hernán, 2026-08-17: un pedido web
              declaraba a qué LOCAL iba —de 3 posibles bajo el mismo RUT— y esta era la única
              parte del sistema que lo tenía, sin mostrarlo. */}
          {comentarioCliente && (
            <>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-3 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Comentario del cliente
              </div>
              <div className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comentarioCliente}</div>
            </>
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
              // 🔴 SIEMPRE en cajas si la orden es por cajas, difiera o no de lo pedido. La
              // primera versión sólo convertía cuando había diferencia, así que una línea
              // pickeada completa mostraba «Pedido: 20 cajas · Pickeado: 320» — el mismo número
              // en dos unidades distintas, una al lado de la otra. WalMart pickea en cajas.
              const cajaPickeada = enCajas
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
