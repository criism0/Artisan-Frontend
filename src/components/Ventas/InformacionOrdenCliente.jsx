import { useState } from "react";
import { MapPin, MessageSquare, Pencil } from "lucide-react";
import Selector from "../Forms/Selector";

/**
 * "Información de la orden" + "Cliente", como dos tarjetas separadas.
 *
 * Antes esto estaba repartido en tres lugares: la fila de 4 stat-cards arriba (Cliente / Orden
 * de compra / Total / Bodega) Y la cabecera de `DetalleTipoFactura` (Cliente otra vez,
 * direcciones, fechas, OC otra vez). El número de OC salía dos veces en la misma pantalla.
 * Reporte de Cristóbal, 2026-08-20.
 *
 * Ahora: una tarjeta por tema, cada dato UNA sola vez. `DetalleTipoFactura` queda sólo con las
 * líneas y los totales — ya no repite nada de esto.
 */
export default function InformacionOrdenCliente({
  orden,
  cliente,
  bodega,
  formatDate,
  // Dirección de despacho — editable en cualquier estado anterior a Entregada.
  direccion,
  direccionesDespacho = [],
  editandoDireccion = false,
  loadingDirecciones = false,
  guardandoDireccion = false,
  puedeEditarDireccion = true,
  onEmpezarEdicionDireccion,
  onCancelarEdicionDireccion,
  onGuardarDireccion,
  // Dirección de facturación — separada de la de despacho. Si no se elige, la factura sale
  // igual a la dirección de despacho (fallback del backend).
  direccionFacturacion = null,
  direccionesFacturacion = [],
  editandoDireccionFacturacion = false,
  guardandoDireccionFacturacion = false,
  puedeEditarDireccionFacturacion = true,
  onEmpezarEdicionDireccionFacturacion,
  onCancelarEdicionDireccionFacturacion,
  onGuardarDireccionFacturacion,
  comentarioCliente = null,
  // Fecha de entrega comprometida — editable en cualquier estado anterior a Entregada, igual
  // que las direcciones: se renegocia por teléfono más seguido de lo que se lee de un archivo.
  editandoFechaEntrega = false,
  guardandoFechaEntrega = false,
  puedeEditarFechaEntrega = true,
  onEmpezarEdicionFechaEntrega,
  onCancelarEdicionFechaEntrega,
  onGuardarFechaEntrega,
}) {
  const [seleccion, setSeleccion] = useState("");
  const [fechaEntregaBorrador, setFechaEntregaBorrador] = useState("");
  const [seleccionFacturacion, setSeleccionFacturacion] = useState("");

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

  const opcionesDireccionFacturacion = (() => {
    const facturacion = direccionesFacturacion.filter((d) => d.tipo_direccion === "Facturación");
    const base = facturacion.length > 0 ? facturacion : direccionesFacturacion;
    return base.map((d) => ({
      value: String(d.id),
      label: [d.nombre_sucursal || d.tipo_direccion, [d.calle, d.numero, d.info_adicional].filter(Boolean).join(" "), d.comuna]
        .filter(Boolean)
        .join(" — "),
    }));
  })();

  const DireccionBloque = ({
    titulo,
    valor,
    editando,
    opciones,
    seleccionActual,
    setSeleccionActual,
    guardando,
    puedeEditar,
    onEmpezar,
    onCancelar,
    onGuardar,
    placeholderVacio,
    exigeSeleccion,
  }) => (
    <div>
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {titulo}
      </div>
      {editando ? (
        <div className="mt-1 flex flex-col gap-1.5">
          {loadingDirecciones ? (
            <span className="text-xs text-gray-400">Cargando direcciones del cliente…</span>
          ) : opciones.length === 0 ? (
            <span className="text-xs text-amber-700">
              Este cliente no tiene direcciones registradas. Se agregan desde su ficha.
            </span>
          ) : (
            <Selector
              options={exigeSeleccion ? opciones : [{ value: "", label: placeholderVacio }, ...opciones]}
              selectedValue={seleccionActual || (valor ? String(valor.id) : "")}
              onSelect={setSeleccionActual}
              className="border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onGuardar?.(seleccionActual)}
              disabled={guardando || (exigeSeleccion && !seleccionActual)}
              className="text-xs bg-primary text-white px-2.5 py-1 rounded-md hover:bg-hover disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={onCancelar}
              disabled={guardando}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1.5 mt-0.5">
          {valor ? (
            <div className="text-xs text-gray-600">
              {[valor.nombre_sucursal || valor.tipo_direccion].filter(Boolean).join(" — ")}
              {valor.calle ? ` · ${valor.calle} ${valor.numero || ""}` : ""}
              {valor.info_adicional ? ` (${valor.info_adicional})` : ""}
              {valor.comuna ? `, ${valor.comuna}` : ""}
            </div>
          ) : exigeSeleccion ? (
            <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Sin asignar — se confirma al facturar si no se elige antes
            </span>
          ) : (
            <span className="text-xs text-gray-500 italic">{placeholderVacio}</span>
          )}
          {puedeEditar && onEmpezar && (
            <button
              onClick={onEmpezar}
              className="text-gray-400 hover:text-primary shrink-0"
              title={valor ? `Cambiar ${titulo.toLowerCase()}` : `Asignar ${titulo.toLowerCase()}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
      {!editando && valor?.comentarios && (
        <div className="text-xs text-gray-500 mt-0.5 italic">{valor.comentarios}</div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* ── Información de la orden ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow border border-border p-4">
        <h2 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
          Información de la orden
        </h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">OC del cliente</dt>
            <dd className="font-mono text-xs text-text text-right">{orden?.numero_oc || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Emisión</dt>
            <dd className="text-text">{formatDate(orden?.fecha_orden)}</dd>
          </div>
          {/* 🔴 ENTREGA COMPROMETIDA ≠ DESPACHO. Ésta es la fecha que se le prometió al
              cliente (la trae su documento o la pone el operario); la de abajo es cuándo
              se entregó de verdad, y se escribe recién al pasar a Entregada. */}
          <div className="flex justify-between gap-4 items-start">
            <dt className="text-gray-500">Entrega comprometida</dt>
            <dd className="text-right">
              {editandoFechaEntrega ? (
                <div className="flex items-center gap-1 justify-end">
                  <input
                    type="date"
                    value={fechaEntregaBorrador}
                    onChange={(e) => setFechaEntregaBorrador(e.target.value)}
                    disabled={guardandoFechaEntrega}
                    className="border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => onGuardarFechaEntrega?.(fechaEntregaBorrador || null)}
                    disabled={guardandoFechaEntrega}
                    className="text-xs px-2 py-0.5 rounded bg-primary text-white disabled:opacity-50"
                  >
                    {guardandoFechaEntrega ? "…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelarEdicionFechaEntrega}
                    disabled={guardandoFechaEntrega}
                    className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-end">
                  <span className={orden?.fecha_entrega ? "text-text" : "text-gray-400 italic"}>
                    {orden?.fecha_entrega ? formatDate(orden.fecha_entrega) : "Sin fecha comprometida"}
                  </span>
                  {puedeEditarFechaEntrega && (
                    <button
                      type="button"
                      onClick={() => {
                        setFechaEntregaBorrador(orden?.fecha_entrega?.slice(0, 10) || "");
                        onEmpezarEdicionFechaEntrega?.();
                      }}
                      className="text-gray-400 hover:text-primary shrink-0"
                      title={orden?.fecha_entrega ? "Cambiar la fecha de entrega" : "Asignar una fecha de entrega"}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Despacho</dt>
            <dd className="text-text">{formatDate(orden?.fecha_envio)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Facturación</dt>
            <dd className="text-text">{formatDate(orden?.fecha_facturacion)}</dd>
          </div>
          {/* La bodega de origen importa a logística, no a quien revisa el negocio de la orden
              — se muestra chica, no como una tarjeta propia. */}
          <div className="flex justify-between gap-4 pt-1.5 mt-1.5 border-t border-border text-xs text-gray-400">
            <dt>Bodega de origen</dt>
            <dd>{bodega?.nombre || "—"}</dd>
          </div>
        </dl>
      </div>

      {/* ── Cliente ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow border border-border p-4">
        <h2 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Cliente</h2>
        <div className="font-semibold text-text">
          {cliente?.razon_social || cliente?.nombre_empresa || (
            <span className="text-gray-400 italic">Sin cliente asignado</span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-0.5">
          {cliente?.rut ? `RUT ${cliente.rut}` : ""}
          {cliente?.giro ? ` · ${cliente.giro}` : ""}
        </div>
        {(cliente?.contacto_comercial || cliente?.telefono_comercial || cliente?.email_comercial) && (
          <div className="text-xs text-gray-500 mt-1">
            {[cliente?.contacto_comercial, cliente?.telefono_comercial, cliente?.email_comercial]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DireccionBloque
            titulo="Dirección de despacho"
            valor={direccion}
            editando={editandoDireccion}
            opciones={opcionesDireccion}
            seleccionActual={seleccion}
            setSeleccionActual={setSeleccion}
            guardando={guardandoDireccion}
            puedeEditar={puedeEditarDireccion}
            onEmpezar={onEmpezarEdicionDireccion}
            onCancelar={onCancelarEdicionDireccion}
            onGuardar={onGuardarDireccion}
            placeholderVacio="Se confirma al facturar si no se elige antes"
            exigeSeleccion
          />
          <DireccionBloque
            titulo="Dirección de facturación"
            valor={direccionFacturacion}
            editando={editandoDireccionFacturacion}
            opciones={opcionesDireccionFacturacion}
            seleccionActual={seleccionFacturacion}
            setSeleccionActual={setSeleccionFacturacion}
            guardando={guardandoDireccionFacturacion}
            puedeEditar={puedeEditarDireccionFacturacion}
            onEmpezar={onEmpezarEdicionDireccionFacturacion}
            onCancelar={onCancelarEdicionDireccionFacturacion}
            onGuardar={onGuardarDireccionFacturacion}
            placeholderVacio="Usa la dirección de despacho"
            exigeSeleccion={false}
          />
        </div>

        {comentarioCliente && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Comentario del cliente
            </div>
            <div className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{comentarioCliente}</div>
          </div>
        )}
      </div>
    </div>
  );
}
