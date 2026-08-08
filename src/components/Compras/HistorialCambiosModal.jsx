import Modal from "../UI/Modal.jsx";
import { formatValorCambio } from "../../utils/formatValorCambio";
import { formatCLP } from "../../services/formatHelpers";

/**
 * Historial de cambios de una orden de compra.
 *
 * Antes se pintaba como una tabla de 7 columnas al final de la página: aparecía debajo de
 * todo sin avisar, incluía el id interno del registro de auditoría, mostraba los nombres de
 * columna crudos de la base (`id_bodega_destino`, `total_pago`) y repetía fecha, acción y
 * usuario en una fila por cada campo tocado — una edición de cinco campos se veía como cinco
 * cambios distintos.
 *
 * Acá es una línea de tiempo: un bloque por evento, con quién y cuándo arriba, y adentro
 * sólo los campos que ese evento cambió, con su nombre en castellano y el antes → después.
 */

/** Nombre legible de cada columna. Lo que no esté acá cae al nombre crudo, sin puntos ni guiones. */
const NOMBRES = {
  id_proveedor: "Proveedor",
  id_bodega_solicitante: "Bodega solicitante",
  id_bodega_destino: "Bodega destino",
  fecha: "Fecha de emisión",
  total_neto: "Total neto",
  iva: "IVA",
  total_pago: "Total a pagar",
  estado: "Estado",
  pagada: "Pagada",
  condiciones: "Condiciones comerciales",
  fecha_pago: "Fecha de pago",
  requiere_prepago: "Requiere prepago",
  fecha_recepcion: "Fecha de recepción",
  numero_factura: "N.º de factura",
  recepciones: "Recepciones",
  fecha_documento: "Fecha del documento",
  guia_despacho: "Guía de despacho",
  motivo_rechazo: "Motivo de rechazo",
};

/** Los de auditoría no le dicen nada a quien lee: quién editó ya va en la cabecera del evento. */
const OMITIDOS = new Set(["created_by", "updated_by", "archivos"]);

const ACCIONES = {
  CREAR: { texto: "Orden creada", clase: "bg-green-100 text-green-800" },
  ACTUALIZAR: { texto: "Modificada", clase: "bg-blue-100 text-blue-800" },
};

function nombreCampo(campo) {
  return NOMBRES[campo] ?? campo.replace(/_/g, " ");
}

/** Campos que son dinero: sin esto un cambio de total sale como `292740` pelado. */
const MONTOS = new Set(["total_neto", "iva", "total_pago"]);

/** Un booleano crudo se lee mal en una lista de cambios: `true` no dice qué pasó. */
function valorLegible(valor, campo) {
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  if (MONTOS.has(campo) && valor != null && Number.isFinite(Number(valor))) {
    return formatCLP(Number(valor), 0);
  }
  const texto = formatValorCambio(valor);
  return texto === "" || texto == null ? "—" : texto;
}

export default function HistorialCambiosModal({ abierto, onCerrar, historial, formatFecha }) {
  const eventos = Array.isArray(historial) ? historial : [];

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Historial de cambios"
      descripcion="Cada bloque es una edición de la orden, de la más reciente a la más antigua."
      ancho="max-w-3xl"
    >
      {eventos.length === 0 ? (
        <p className="text-sm text-gray-600 py-6 text-center">
          Esta orden todavía no registra cambios.
        </p>
      ) : (
        <ol className="space-y-3">
          {eventos.map((evento, idx) => {
            const cambios = Object.entries(evento?.cambios || {}).filter(
              ([campo]) => !OMITIDOS.has(campo),
            );
            const accion = ACCIONES[evento?.accion] ?? {
              texto: evento?.accion || "Cambio",
              clase: "bg-gray-100 text-gray-700",
            };

            return (
              <li
                key={evento?.id ?? idx}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accion.clase}`}>
                    {accion.texto}
                  </span>
                  <span className="text-sm text-gray-800">
                    {formatValorCambio(evento?.usuario?.nombre ?? evento?.usuario) || "—"}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{formatFecha(evento)}</span>
                </div>

                {cambios.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500 italic">Sin campos modificados.</p>
                ) : (
                  <dl className="divide-y divide-gray-100">
                    {cambios.map(([campo, valores]) => (
                      <div
                        key={campo}
                        className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1"
                      >
                        <dt className="text-sm font-medium text-gray-700">{nombreCampo(campo)}</dt>
                        <dd className="text-sm text-gray-800 flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-gray-500 line-through break-words">
                            {valorLegible(valores?.before, campo)}
                          </span>
                          <span aria-hidden="true" className="text-gray-400">
                            →
                          </span>
                          <span className="font-medium break-words">
                            {valorLegible(valores?.after, campo)}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
