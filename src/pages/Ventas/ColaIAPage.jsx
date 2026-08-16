import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Selector from "../../components/Forms/Selector";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import Pagination from "../../components/UI/Pagination";
import Tabs from "../../components/UI/Tabs";
import PanelApartados from "../../components/DTE/PanelApartados";
import { compararFormato } from "../../utils/formatoProducto";
import {
  indexarPreciosPorNombre,
  precioUnitarioDeLista,
  precioUtil,
  formatearPesos,
} from "../../utils/preciosLista";
import { esFormatoCajas, lineaEnCajas, unidadesPorCajaDeLinea } from "../../utils/formatoCantidad";
import {
  problemaDeDescuento,
  descuentoAGuardar,
  formatearDescuento,
} from "../../utils/descuentoLinea";

const PRODUCTOS_VISIBLES = 4;
const PAGE_SIZE = 6;

// ── Precios de la lista del cliente ─────────────────────────────────────────
//
// Una lista trae ~17 entradas (~10 KB), y las 267 órdenes de la cola se reparten entre 18
// listas: cargarlas por tarjeta sería pedir la misma lista decenas de veces.
//
// ⚠️ El caché guarda la PROMESA, no el resultado. Si varias filas abren su editor antes de que
// llegue la respuesta, todas esperan la MISMA petición; guardando el resultado, cada una
// dispararía la suya y recién la última poblaría el caché. Es el mismo error que produjo la
// ráfaga de 136 peticiones al abrir una solicitud (§0-quadragies): la guarda miraba estado, que
// todavía no existe mientras las respuestas viajan.
function usePreciosDeLista() {
  const api = useApi();
  const cache = useRef(new Map());

  return useCallback(
    (idLista) => {
      if (!idLista) return Promise.resolve(null);
      const clave = String(idLista);
      if (!cache.current.has(clave)) {
        const promesa = api(`/producto-base-lista-precio/lista/${clave}`)
          .then((resp) => indexarPreciosPorNombre(Array.isArray(resp) ? resp : resp?.data))
          // Un fallo no se cachea: si la red falló, el siguiente intento debe volver a pedir.
          .catch((err) => {
            cache.current.delete(clave);
            throw err;
          });
        cache.current.set(clave, promesa);
      }
      return cache.current.get(clave);
    },
    [api]
  );
}

// ── Flags IA: mapeo a etiquetas legibles ────────────────────────────────────
//
// `null` = no se muestra acá porque ya se ve en otra parte, mejor. Un aviso que repite lo que
// la tarjeta ya dice roba atención a los que sí aportan algo nuevo.
const FLAG_LABELS = {
  // Lo dicen la fila de requisitos («2 sin asociar») y las propias líneas marcadas, con el
  // número exacto y con cuáles. El aviso genérico sólo repetía.
  producto_sin_match:    null,
  // Ídem: la fila de requisitos cuenta las líneas sin precio y cada una queda marcada.
  precio_no_disponible:  null,
  // Éste SÍ aporta: dice de DÓNDE salió el precio, que no se ve en ninguna otra parte.
  precio_desde_lista:    "Precios tomados de la lista de precios del cliente",
  cliente_no_encontrado: null, // se muestra vía el selector de cliente, no aquí
  sin_precio:            null, // lo cuenta la fila de requisitos, con el número exacto

  // Los que cuentan de dónde vino el dato o qué decidió el sistema. Ninguno se ve en otra
  // parte, así que acá es donde tienen que estar.
  origen_edi:                        "Leído del archivo EDI del cliente, no interpretado por la IA",
  sugerencia_fuzzy_aplicada:         "Algunos productos se asociaron por parecido de nombre",
  cliente_propia_empresa_descartado: "La IA eligió nuestra propia empresa como cliente — se descartó",
  cantidad_convertida_de_cajas:      "El pedido venía en cajas: la cantidad se convirtió a unidades",
  precio_unitario_redondeado:        "El precio por caja no dividía exacto: el unitario se redondeó",
  cliente_corregido_por_rut:         "El cliente se corrigió por el RUT del correo",
  cliente_ambiguo:                   "Varios clientes coinciden con el nombre del correo",
  cliente_resuelto_por_rut:            "Cliente identificado por su RUT",
  cliente_resuelto_por_nombre_exacto:  "Cliente identificado por su nombre",
  cliente_resuelto_por_nombre_contenido: "Cliente identificado por su nombre",
  cliente_resuelto_por_giro:           "Cliente identificado por su giro — conviene confirmarlo",
};

function parseFlagsVisibles(errorDetalle) {
  if (!errorDetalle) return [];
  return errorDetalle
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f && !f.startsWith("modificacion_oc:"))
    // Varios flags llevan un dato pegado con `:` (`sin_precio:2`, `cliente_ambiguo:3,9`).
    // Se busca la etiqueta por la clave sola; si no hay, se muestra legible en vez de con
    // guiones bajos.
    .map((f) => ({ clave: f.split(":")[0], crudo: f }))
    .filter(({ clave }) => FLAG_LABELS[clave] !== null)
    .map(({ clave, crudo }) => FLAG_LABELS[clave] ?? crudo.replace(/_/g, " "));
}

// ── Confianza badge con tooltip de escala ────────────────────────────────────
const CONFIANZA_TOOLTIP = (
  <div className="absolute top-full right-0 mt-2 w-60 bg-gray-900 text-white rounded-xl px-3.5 py-3 shadow-xl z-20 pointer-events-none">
    <p className="text-xs font-semibold text-gray-300 mb-2">Nivel de confianza IA</p>
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span><span className="font-semibold text-green-300">≥ 85%</span> — datos bien identificados, listo para revisar</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
        <span><span className="font-semibold text-yellow-300">70–84%</span> — algunos campos pueden necesitar corrección</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <span><span className="font-semibold text-red-300">&lt; 70%</span> — revisar todos los campos con cuidado</span>
      </div>
    </div>
    <div className="absolute -top-1.5 right-5 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
  </div>
);

function ConfianzaBadge({ valor }) {
  const pct = Math.round((valor ?? 0) * 100);

  const badgeClass =
    pct >= 85
      ? "bg-green-100 text-green-700"
      : pct >= 70
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  const icon = pct >= 85 ? "✓" : pct >= 70 ? "⚠" : "✕";

  return (
    <div className="relative group inline-flex cursor-help">
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
        {icon} {pct}% confianza
      </span>
      <div className="hidden group-hover:block">
        {CONFIANZA_TOOLTIP}
      </div>
    </div>
  );
}

// ── Fila de producto editable ────────────────────────────────────────────────
// Bajo el campo de precio: de dónde salió el número que se está viendo.
//
// El caso que importa no es el feliz, es «este producto no está en la lista del cliente»: hoy eso
// se descubre facturando. Y cuando la lista dice otra cosa que el campo, se muestran los dos y se
// deja elegir — pisarlo en silencio sería decidir por el operario.
function OrigenPrecio({ origen, nombreLista, precioActual, onUsarDeLista }) {
  if (!origen) return null;
  const lista = nombreLista ? `«${nombreLista}»` : "del cliente";

  if (origen.tipo === "cargando") {
    return <p className="text-[11px] text-gray-400 mt-0.5">Buscando en la lista de precios…</p>;
  }
  if (origen.tipo === "sin_lista") {
    return (
      <p className="text-[11px] text-amber-700 mt-0.5">
        El cliente no tiene lista de precios asignada
      </p>
    );
  }
  if (origen.tipo === "no_en_lista") {
    return (
      <p className="text-[11px] text-amber-700 mt-0.5">
        Este producto no está en la lista {lista} — escribe el precio
      </p>
    );
  }
  if (origen.tipo === "error") {
    return (
      <p className="text-[11px] text-red-600 mt-0.5">No se pudo leer la lista de precios</p>
    );
  }

  const coincide = Number(precioActual) === Number(origen.precio);
  if (origen.tipo === "lista" && coincide) {
    return (
      <p className="text-[11px] text-gray-500 mt-0.5">Precio de la lista {lista}</p>
    );
  }
  return (
    <p className="text-[11px] text-gray-500 mt-0.5">
      La lista {lista} dice {formatearPesos(origen.precio)}
      <button
        type="button"
        onClick={() => onUsarDeLista(origen.precio)}
        className="ml-1 font-medium text-[#7A5AF8] hover:text-[#6648e0] underline"
      >
        usar
      </button>
    </p>
  );
}

function ProductoRow({
  prod,
  catalogoOpts,
  ovId,
  onUpdated,
  onDeleted,
  idListaPrecio,
  nombreLista,
  cargarPrecios,
  formatoCantidad,
}) {
  const api = useApi();
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  // Pre-fill con la sugerencia fuzzy si no hay match directo
  // Se elige por NOMBRE DE FACTURACIÓN, que es la unidad con la que se vende y se factura.
  // Si la línea ya trae producto físico —viene de una OV vieja o del picking— se muestra su
  // nombre comercial, que es el que corresponde a este catálogo.
  const [prodIdSel, setProdIdSel]   = useState(
    String(prod.id_nombre_facturacion ?? "")
  );
  const [cantidad, setCantidad]     = useState(String(prod.cantidad ?? ""));
  const [precio, setPrecio]         = useState(String(prod.precio_venta ?? ""));
  // Vacío cuando no hay descuento: un «0» precargado se lee como un descuento puesto en cero.
  const [descuento, setDescuento]   = useState(
    prod.porcentaje_descuento ? String(prod.porcentaje_descuento) : "",
  );
  const [confirmDel, setConfirmDel] = useState(false);
  // De dónde salió el precio que se está mostrando. Es la mitad que faltaba: el número solo no
  // dice si es el acordado con el cliente o el que la IA leyó del correo.
  const [origenPrecio, setOrigenPrecio] = useState(null);

  // La cantidad en cajas, cuando la orden se trabaja así.  si no aplica.
  const cajasLinea = esFormatoCajas(formatoCantidad)
    ? lineaEnCajas(Number(prod.cantidad || 0), Number(prod.precio_venta || 0), unidadesPorCajaDeLinea(prod))
    : null;

  const sinMatch    = !prod.id_producto;
  const nombre      = prod.ProductoBase?.nombre ?? null;
  const nombreFact  = prod.NombreFacturacion?.nombre ?? null;
  const sugerido    = prod.ProductoSugerido ?? null;
  // Lo que se ofrece y lo que se aplica es el NOMBRE COMERCIAL. El producto físico que guarda
  // la columna es sólo su portador; se cae a él si por alguna razón no trae nombre.
  const nfSugeridoId  = sugerido?.nombreFacturacion?.id ?? sugerido?.id_nombre_facturacion ?? null;
  const nombreSugerido = sugerido?.nombreFacturacion?.nombre ?? sugerido?.nombre ?? null;
  const simPct      = sugerido && prod.similitud_sugerencia != null
    ? Math.round(prod.similitud_sugerencia * 100)
    : null;

  // 🔴 La similitud se calcula sobre el texto e IGNORA los números, así que un formato
  // distinto no le baja el puntaje: en producción hay sugerencias al 100% de "Camembert
  // 100 g" apuntando al de 150 g. Otro gramaje es otro producto, con otro precio. El puntaje
  // no se toca acá —eso es del backend— pero el desacuerdo se avisa antes de aceptar.
  // El gramaje se compara contra el nombre COMERCIAL, que es el que se va a aplicar.
  const formato = nombreSugerido ? compararFormato(prod.descripcion_original, nombreSugerido) : null;
  const formatoDifiere = formato?.estado === "difiere";

  // Acepta la sugerencia fuzzy directamente (sin abrir el editor).
  //
  // Se aplica el NOMBRE COMERCIAL de la sugerencia, no el producto físico: ése es sólo el
  // portador que guarda la columna (tiene FK a ProductoBase) y puede haber varios bajo el
  // mismo nombre. Aplicar el nombre es lo que la venta necesita, y de paso permite que la
  // sugerencia se ofrezca también cuando el nombre agrupa varios productos — antes esas se
  // descartaban en la extracción justamente porque no había forma segura de elegir uno.
  const handleAcceptSuggestion = async () => {
    if (!nfSugeridoId) return;
    setSaving(true);
    try {
      const updated = await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, {
        method: "PATCH",
        body: { id_producto: null, id_nombre_facturacion: nfSugeridoId },
      });
      toast.success(`Asociado: ${nombreSugerido}`);
      onUpdated(updated);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo aceptar"}`);
    } finally {
      setSaving(false);
    }
  };

  // 🔴 EL PRECIO DE UNA LÍNEA ES EL DE ESE PRODUCTO PARA ESE CLIENTE, no el que traía antes.
  //
  // El campo se precargaba con `prod.precio_venta`, que es lo que la IA leyó del correo o lo que
  // quedó del producto ANTERIOR. Al cambiar el producto, ese número deja de corresponder: sigue
  // ahí, con pinta de dato bueno, apuntando a otra cosa.
  //
  // `sobrescribir` distingue los dos momentos. Al CAMBIAR el producto se sobrescribe siempre —el
  // precio viejo es de otro producto—. Al ABRIR el editor no: si ya hay un precio puesto puede
  // ser una excepción acordada, así que se muestra lo que dice la lista y se deja decidir.
  const aplicarPrecioDeLista = useCallback(
    async (idNombreFacturacion, { sobrescribir }) => {
      if (!idNombreFacturacion) { setOrigenPrecio(null); return; }
      if (!idListaPrecio) { setOrigenPrecio({ tipo: "sin_lista" }); return; }

      setOrigenPrecio({ tipo: "cargando" });
      try {
        const indice = await cargarPrecios(idListaPrecio);
        const deLista = precioUnitarioDeLista(indice, idNombreFacturacion);
        if (deLista == null) { setOrigenPrecio({ tipo: "no_en_lista" }); return; }

        // Al abrir, un precio vacío o en 0 no es una decisión de nadie: se completa solo. Es el
        // caso de 139 de las 296 líneas sin precio de la cola.
        setPrecio((actual) => {
          if (sobrescribir || !precioUtil(actual)) return String(deLista);
          return actual;
        });
        setOrigenPrecio({ tipo: "lista", precio: deLista });
      } catch {
        setOrigenPrecio({ tipo: "error" });
      }
    },
    [idListaPrecio, cargarPrecios]
  );

  // Cambiar el producto es el evento que obliga a recalcular el precio; va en el handler y no en
  // un efecto sobre `prodIdSel`, que además se dispararía en el primer render.
  const handleSelectProducto = (valor) => {
    setProdIdSel(valor);
    aplicarPrecioDeLista(valor ? Number(valor) : null, { sobrescribir: true });
  };

  // Al abrir el editor se consulta la lista para la línea que ya está puesta: así el operario ve
  // de entrada si el precio que trae coincide con el del cliente.
  useEffect(() => {
    if (!editing) return;
    aplicarPrecioDeLista(prodIdSel ? Number(prodIdSel) : null, { sobrescribir: false });
    // `prodIdSel` no va en las dependencias a propósito: sus cambios los maneja el handler, y
    // ponerlo acá volvería a pisar el precio que el operario acaba de escribir a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, aplicarPrecioDeLista]);

  const handleSave = async () => {
    const problemaDesc = problemaDeDescuento(descuento);
    if (problemaDesc) {
      toast.warning(problemaDesc);
      return;
    }
    setSaving(true);
    try {
      const updated = await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, {
        method: "PATCH",
        body: {
          // Se manda el nombre comercial, no el producto físico: `updateProductoOV` acepta
          // ambos y en una venta el que corresponde es éste. El producto físico se resuelve
          // en el picking, donde sí importa de qué planta salió.
          //
          // ⚠️ `id_producto: null` va explícito. Si sólo se mandara el nombre, un producto
          // físico que ya estuviera en la línea se quedaría pegado — apuntando a un producto
          // del grupo ANTERIOR. El backend lo trata bien: con `id_producto` en null respeta el
          // nombre que se envía (`updateProductoOV`).
          id_producto: null,
          id_nombre_facturacion: prodIdSel ? Number(prodIdSel) : null,
          cantidad:     Number(cantidad),
          precio_venta: Number(precio),
          porcentaje_descuento: descuentoAGuardar(descuento),
        },
      });
      toast.success("Producto actualizado");
      setEditing(false);
      onUpdated(updated);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo guardar"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api(`/ordenes-venta/${ovId}/productos/${prod.id}`, { method: "DELETE" });
      toast.success("Producto eliminado");
      onDeleted(prod.id);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo eliminar"}`);
    } finally {
      setSaving(false);
      setConfirmDel(false);
    }
  };

  if (editing) {
    return (
      <li className="py-2 flex flex-col gap-2 bg-gray-50 rounded-lg px-2 -mx-2">
        {/* Descripción original de referencia */}
        {prod.descripcion_original && (
          <p className="text-xs text-gray-500 italic">
            IA extrajo: «{prod.descripcion_original}»
          </p>
        )}
        {/* Selector de producto del catálogo */}
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Producto (nombre de facturación)</label>
          <Selector
            options={[{ value: "", label: "— Sin asociar —" }, ...catalogoOpts]}
            selectedValue={prodIdSel}
            onSelect={handleSelectProducto}
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-0.5 block">Cantidad</label>
            <input
              type="number" min="1" value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
              disabled={saving}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-0.5 block">Precio unitario</label>
            <input
              type="number" min="0" value={precio}
              onChange={(e) => {
                setPrecio(e.target.value);
                // Escrito a mano deja de ser «el de la lista». Decirlo evita que alguien lea un
                // número tecleado como si viniera del acuerdo con el cliente.
                setOrigenPrecio((o) => (o?.tipo === "lista" ? { ...o, tipo: "editado" } : o));
              }}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
              disabled={saving}
            />
            <OrigenPrecio
              origen={origenPrecio}
              nombreLista={nombreLista}
              precioActual={precio}
              onUsarDeLista={(p) => {
                setPrecio(String(p));
                setOrigenPrecio({ tipo: "lista", precio: p });
              }}
            />
          </div>
          <div className="w-24">
            {/* El descuento del retail entra por acá: el XML de Jumbo lo declara por línea y
                hasta ahora no había dónde revisarlo ni corregirlo antes de validar. */}
            <label className="text-xs text-gray-500 mb-0.5 block">Desc. (%)</label>
            <input
              type="number" min="0" max="100" step="any" value={descuento}
              placeholder="0"
              onChange={(e) => setDescuento(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
              disabled={saving}
            />
          </div>
        </div>
        {problemaDeDescuento(descuento) && (
          <p className="text-xs text-red-600">{problemaDeDescuento(descuento)}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !cantidad}
            className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </li>
    );
  }

  // 🔴 Lo que le falta a ESTA línea. Se marca la fila entera, no sólo el texto: el problema
  // tiene que saltar recorriendo la lista con la vista, sin leer cada nombre.
  //
  // «Sin asociar» es no tener NI producto físico NI nombre comercial — con el nombre comercial
  // basta, porque el DTE arma la línea por ahí. Es la misma regla que usa el contador de la
  // tarjeta, a propósito: cuando miraban cosas distintas, el chip decía 3 y la lista mostraba 2.
  const faltaNombre = !(nombreFact || nombre);
  const faltaPrecio = !(Number(prod.precio_venta) > 0);
  // El nombre lo puso una sugerencia de la IA y nadie la confirmó. La línea se ve completa
  // pero ese nombre es el que va a la factura, así que se marca igual.
  const porConfirmar = prod.producto_id_sugerido != null && !prod.id_producto && !faltaNombre;
  const conProblema = faltaNombre || faltaPrecio || porConfirmar;

  return (
    <>
      <li
        className={`flex flex-col gap-1 group ${
          conProblema
            ? "py-2 pl-2.5 pr-2 -mx-2 bg-amber-50/70 border-l-2 border-amber-400"
            : "py-1.5"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            {/* Nombre del producto o descripción original */}
            {nombreFact || nombre ? (
              <span className="text-gray-800 text-sm truncate">{nombreFact ?? nombre}</span>
            ) : (
              <span className="text-amber-900 text-sm truncate font-medium">
                {prod.descripcion_original ?? "producto desconocido"}
              </span>
            )}
            {/* Etiquetas de lo que falta. Van bajo el nombre para no competir con él. */}
            {conProblema && (
              <span className="flex flex-wrap items-center gap-1 mt-0.5">
                {faltaNombre && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    sin asociar al catálogo
                  </span>
                )}
                {faltaPrecio && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                    sin precio
                  </span>
                )}
                {porConfirmar && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    nombre puesto por la IA — confirmar
                  </span>
                )}
              </span>
            )}
            {/* Si tiene match y además hay descripción original, mostrarla en gris */}
            {nombre && prod.descripcion_original && (
              <span className="text-xs text-gray-400 truncate italic">
                «{prod.descripcion_original}»
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* En una orden por cajas se muestra en cajas: es la unidad en que el cliente pidió
                y en la que se va a pickear y facturar. El equivalente en unidades va al lado,
                porque es lo que la base guarda y lo que bodega cuenta. */}
            <span className={`text-sm text-right ${conProblema ? "text-amber-900" : "text-gray-500"}`}>
              {cajasLinea?.cajas > 0 ? (
                <>
                  × {cajasLinea.cajas} {cajasLinea.cajas === 1 ? "caja" : "cajas"}
                  <span className="block text-[11px] text-gray-400">
                    {prod.cantidad} un
                    {cajasLinea.unidades_sueltas > 0 && ` · ${cajasLinea.unidades_sueltas} sueltas`}
                  </span>
                </>
              ) : (
                <>× {prod.cantidad}</>
              )}
              {/* El descuento se muestra sólo cuando lo hay. Es un dato del documento del
                  cliente que cambia el monto de la línea, así que no puede quedar escondido
                  detrás del botón «Editar». */}
              {Number(prod.porcentaje_descuento) > 0 && (
                <span className="block text-[11px] font-medium text-emerald-700">
                  −{formatearDescuento(prod.porcentaje_descuento)}
                </span>
              )}
            </span>
            {/* En una línea con problema, la acción para arreglarlo tiene que verse: que
                aparezca sólo al pasar el mouse esconde justo lo que hay que hacer. */}
            <button
              onClick={() => setEditing(true)}
              className={`text-xs transition ${
                conProblema
                  ? "text-amber-900 font-medium underline decoration-dotted hover:text-amber-950"
                  : "text-gray-500 hover:text-[#7A5AF8] opacity-0 group-hover:opacity-100"
              }`}
            >
              {conProblema ? "Corregir" : "Editar"}
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              className="text-xs text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
            >
              Eliminar
              </button>
          </div>
        </div>

        {/* Sugerencia fuzzy — visible solo cuando sin match y hay candidato */}
        {sinMatch && sugerido && simPct !== null && (
          <div className={`rounded-lg border px-2 py-1 text-xs ${
            formatoDifiere ? "bg-amber-50 border-amber-300" : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-700 truncate">
                ¿Es <strong>{nombreSugerido}</strong>?{" "}
                <span className={
                  formatoDifiere
                    ? "text-amber-700 font-semibold"
                    : simPct >= 80
                    ? "text-green-600 font-semibold"
                    : simPct >= 65
                    ? "text-yellow-600 font-semibold"
                    : "text-gray-500"
                }>
                  ({simPct}%)
                </span>
              </span>
              <button
                onClick={handleAcceptSuggestion}
                disabled={saving}
                className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-0.5 rounded font-medium"
              >
                Aceptar
              </button>
            </div>
            {formatoDifiere && (
              <p className="text-amber-800 mt-0.5">
                El formato no coincide: pidieron <strong>{formato.pedido.texto}</strong> y el
                sugerido es de <strong>{formato.sugerido.texto}</strong>.
              </p>
            )}
          </div>
        )}
      </li>

      <ConfirmActionModal
        isOpen={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Eliminar producto"
        description={`¿Eliminar "${prod.descripcion_original ?? nombre ?? "este producto"}" de la OV?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </>
  );
}

// ── Fila para agregar producto nuevo ─────────────────────────────────────────
function AgregarProductoRow({
  ovId,
  catalogoOpts,
  onAdded,
  onCancel,
  idListaPrecio,
  nombreLista,
  cargarPrecios,
}) {
  const api = useApi();
  const [saving, setSaving]       = useState(false);
  const [prodIdSel, setProdIdSel] = useState("");
  const [cantidad, setCantidad]   = useState("1");
  const [precio, setPrecio]       = useState("0");
  const [descOrig, setDescOrig]   = useState("");
  const [descuento, setDescuento] = useState("");
  const [origenPrecio, setOrigenPrecio] = useState(null);

  // Una línea nueva parte en 0, que es justo el valor que la guarda de validación rechaza. Elegir
  // el producto es el momento en que el precio se sabe.
  const handleSelectProducto = async (valor) => {
    setProdIdSel(valor);
    if (!valor) { setOrigenPrecio(null); return; }
    if (!idListaPrecio) { setOrigenPrecio({ tipo: "sin_lista" }); return; }
    setOrigenPrecio({ tipo: "cargando" });
    try {
      const indice = await cargarPrecios(idListaPrecio);
      const deLista = precioUnitarioDeLista(indice, Number(valor));
      if (deLista == null) { setOrigenPrecio({ tipo: "no_en_lista" }); return; }
      setPrecio(String(deLista));
      setOrigenPrecio({ tipo: "lista", precio: deLista });
    } catch {
      setOrigenPrecio({ tipo: "error" });
    }
  };

  const handleAdd = async () => {
    if (!cantidad || Number(cantidad) <= 0) {
      toast.warning("Ingresa una cantidad válida");
      return;
    }
    const problemaDesc = problemaDeDescuento(descuento);
    if (problemaDesc) {
      toast.warning(problemaDesc);
      return;
    }
    setSaving(true);
    try {
      const created = await api(`/ordenes-venta/${ovId}/productos`, {
        method: "POST",
        body: {
          // Igual que al editar: la venta se pide por nombre comercial.
          id_nombre_facturacion: prodIdSel ? Number(prodIdSel) : null,
          descripcion_original: descOrig || null,
          cantidad:             Number(cantidad),
          precio_venta:         Number(precio),
          porcentaje_descuento: descuentoAGuardar(descuento),
        },
      });
      toast.success("Producto agregado");
      onAdded(created);
    } catch (err) {
      toast.error(`Error: ${err?.message ?? "No se pudo agregar"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-2 flex flex-col gap-2 border-t border-dashed border-[#7A5AF8]/30 mt-1 pt-2">
      <p className="text-xs font-semibold text-[#7A5AF8]">Agregar producto</p>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Producto del catálogo</label>
        <Selector
          options={[{ value: "", label: "— Sin asociar / manual —" }, ...catalogoOpts]}
          selectedValue={prodIdSel}
          onSelect={handleSelectProducto}
          disabled={saving}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Descripción (opcional)</label>
        <input
          type="text" value={descOrig}
          onChange={(e) => setDescOrig(e.target.value)}
          placeholder="Texto tal como llegó en el email…"
          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
          disabled={saving}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">Cantidad</label>
          <input
            type="number" min="1" value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
            disabled={saving}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-0.5 block">Precio unitario</label>
          <input
            type="number" min="0" value={precio}
            onChange={(e) => {
              setPrecio(e.target.value);
              setOrigenPrecio((o) => (o?.tipo === "lista" ? { ...o, tipo: "editado" } : o));
            }}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
            disabled={saving}
          />
          <OrigenPrecio
            origen={origenPrecio}
            nombreLista={nombreLista}
            precioActual={precio}
            onUsarDeLista={(p) => {
              setPrecio(String(p));
              setOrigenPrecio({ tipo: "lista", precio: p });
            }}
          />
        </div>
        <div className="w-24">
          <label className="text-xs text-gray-500 mb-0.5 block">Desc. (%)</label>
          <input
            type="number" min="0" max="100" step="any" value={descuento}
            placeholder="0"
            onChange={(e) => setDescuento(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8]"
            disabled={saving}
          />
        </div>
      </div>
      {problemaDeDescuento(descuento) && (
        <p className="text-xs text-red-600">{problemaDeDescuento(descuento)}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancelar
        </button>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1 text-xs bg-[#7A5AF8] text-white px-3 py-1 rounded-lg hover:bg-[#6648e0] disabled:opacity-50"
        >
          {saving ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </li>
  );
}

// ── Modal correo original (estilo tipo Gmail) ────────────────────────────────
function EmailModal({ log, onClose }) {
  if (!log) return null;

  const inicial = (log.email_remitente || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: cerrar */}
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition rounded-full p-1.5 hover:bg-gray-100"
          >
            </button>
        </div>

        {/* Asunto grande, como el título de un correo en Gmail */}
        <div className="px-6 pt-3 pb-4 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 leading-snug">
            {log.email_asunto || "(Sin asunto)"}
          </h2>
        </div>

        {/* Fila remitente: avatar + email + fecha, como en Gmail */}
        <div className="px-6 pb-4 flex items-start gap-3 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#7A5AF8] text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {inicial}
          </div>
          <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
            <span className="text-sm text-gray-800 font-medium break-all">
              {log.email_remitente || "Remitente desconocido"}
            </span>
            {log.procesado_en && (
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(log.procesado_en).toLocaleString("es-CL")}
              </span>
            )}
          </div>
        </div>

        {/* Cuerpo del correo */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {log.raw_email_texto ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {log.raw_email_texto}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic text-center py-10">
              Texto del correo no disponible
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de una OV IA ─────────────────────────────────────────────────────
function OVIACard({
  ov: ovInicial,
  bodegas,
  catalogoOpts,
  clientesOpts,
  clientesPorId,
  cargarPrecios,
  onValidar,
  onRechazar,
  procesando,
}) {
  const api = useApi();
  const navigate = useNavigate();
  const [ov, setOv]                   = useState(ovInicial);
  const [bodegaId, setBodegaId]       = useState(() => {
    const santiago = bodegas.find(
      (b) => (b.nombre_bodega ?? b.nombre ?? "").toLowerCase().includes("santiago")
    );
    return santiago ? String(santiago.id) : "";
  });
  const [clienteIdLocal, setClienteIdLocal] = useState("");
  const [cambiandoCliente, setCambiandoCliente] = useState(false);
  const [agregando, setAgregando]     = useState(false);
  const [emailOpen, setEmailOpen]     = useState(false);
  const [esReferencial, setEsReferencial] = useState(ovInicial.es_referencial ?? true);
  const [guardandoRef, setGuardandoRef]   = useState(false);
  const [productosExpandido, setProductosExpandido] = useState(false);
  const log = ov.ai_log;

  const handleToggleReferencial = async () => {
    const nuevoValor = !esReferencial;
    setEsReferencial(nuevoValor);
    setGuardandoRef(true);
    try {
      await api(`/ordenes-venta/${ov.id}`, {
        method: "PUT",
        body: { es_referencial: nuevoValor },
      });
    } catch (err) {
      setEsReferencial(!nuevoValor);
      toast.error("No se pudo actualizar el modo referencial");
    } finally {
      setGuardandoRef(false);
    }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-CL") : "—");

  const modOcMatch  = log?.error_detalle?.match(/modificacion_oc:OV#(\d+)/);
  const ovOriginalId = modOcMatch ? modOcMatch[1] : null;
  const flagsInfo   = parseFlagsVisibles(log?.error_detalle);

  // Datos de cliente que la IA extrajo del correo aunque no hayan matcheado
  // ningún cliente registrado — sirven para precargar "Crear cliente".
  const nombreExtraido = log?.raw_ai_response?.cliente_nombre_extraido || "";
  const rutExtraido    = log?.raw_ai_response?.cliente_rut_extraido || "";

  // El cliente que el operario eligió a mano, si eligió alguno. Manda sobre el de la IA.
  const clienteElegido = clienteIdLocal
    ? clientesOpts.find((c) => String(c.value) === String(clienteIdLocal))
    : null;

  // 🔴 LA LISTA DE PRECIOS ES LA DEL CLIENTE QUE VA A QUEDAR, no la del que la IA adivinó.
  //
  // Si el operario está corrigiendo el cliente —el caso de las 57 órdenes que quedaron con
  // «Artisan»— los precios que corresponden son los del cliente nuevo. Tomarlos del anterior
  // sería facturarle a uno con la lista de otro.
  const clienteEfectivoId = clienteIdLocal || (ov.id_cliente != null ? String(ov.id_cliente) : "");
  const clienteEfectivo = clienteEfectivoId ? clientesPorId.get(clienteEfectivoId) : null;
  const idListaPrecio = clienteEfectivo?.id_lista_precio ?? null;
  const nombreLista = clienteEfectivo?.listaPrecio?.nombre ?? null;

  const handleCrearCliente = () => {
    navigate("/clientes/add", {
      state: { prefill: { nombre_empresa: nombreExtraido, rut: rutExtraido } },
    });
  };

  const bodegaOptions = bodegas.map((b) => ({
    value: String(b.id),
    label: b.nombre_bodega ?? b.nombre ?? `Bodega ${b.id}`,
  }));

  const handleUpdatedProd = (updated) => {
    setOv((prev) => ({
      ...prev,
      productos: prev.productos.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleDeletedProd = (prodId) => {
    setOv((prev) => ({
      ...prev,
      productos: prev.productos.filter((p) => p.id !== prodId),
    }));
  };

  const handleAddedProd = (created) => {
    setOv((prev) => ({ ...prev, productos: [...prev.productos, created] }));
    setAgregando(false);
  };

  const todosLosProductos = ov.productos ?? [];

  // 🔴 UNA LÍNEA ESTÁ "SIN ASOCIAR" CUANDO NO TIENE NI PRODUCTO NI NOMBRE COMERCIAL.
  //
  // No basta con `!id_producto`: el DTE arma cada línea por NOMBRE DE FACTURACIÓN
  // (`ovLineas.ts`: `NombreFacturacion?.nombre || ProductoBase?.nombre || 'Producto'`), así que
  // una línea con nombre comercial y sin producto físico se factura perfecto — es el caso
  // normal cuando el nombre agrupa varios productos y la IA no puede elegir uno.
  //
  // La primera versión de este contador miraba sólo `id_producto` y decía «3 sin asociar»
  // mientras la lista mostraba 2 (visto en la OV 731): la tercera tenía su nombre comercial y
  // se veía perfectamente asociada. La tarjeta se contradecía sola.
  //
  // Lo que sí rompe es una línea sin ninguno de los dos: en la factura sale con el literal
  // «Producto».
  //
  // ⚠️ Es LA MISMA condición que usa `ProductoRow` para pintar «Sin asociar»
  // (`nombreFact || nombre`), y a propósito: el contador y la fila mirando cosas distintas es
  // exactamente lo que hacía que la tarjeta se contradijera. Se compara por NOMBRE y no por id
  // porque el nombre es lo que termina en el documento.
  const sinAsociar = (p) => !(p.NombreFacturacion?.nombre || p.ProductoBase?.nombre);
  const sinMatchCount = todosLosProductos.filter(sinAsociar).length;
  const sinPrecioCount = todosLosProductos.filter((p) => !(Number(p.precio_venta) > 0)).length;

  // 🔴 UNA SUGERENCIA SIN CONFIRMAR TAMBIÉN NECESITA ATENCIÓN, aunque la línea ya muestre nombre.
  //
  // Medido en la copia de producción: de 58 líneas con sugerencia, 18 ya tenían el nombre
  // comercial puesto y NINGUNA tenía producto confirmado — la extracción aplica el nombre de
  // la sugerencia como si fuera un match. O sea que la línea se ve asociada y su nombre es una
  // adivinanza, varias al 55-60% de similitud.
  //
  // Ese nombre es el que se imprime en la factura, así que no puede pasar en verde sin que
  // alguien lo mire. Aceptar o corregir la sugerencia es una decisión, no un adorno.
  const porConfirmar = (p) => p.producto_id_sugerido != null && p.id_producto == null;
  const porConfirmarCount = todosLosProductos.filter((p) => porConfirmar(p) && !sinAsociar(p)).length;

  // 🔴 LO QUE FALTA PARA VALIDAR, EN UN SOLO LUGAR.
  //
  // Antes esto estaba repartido: el cliente en su recuadro, los productos sin asociar en el
  // título de la lista, la bodega en su selector, y el precio en ninguna parte. Había que
  // recorrer la tarjeta entera para saber por qué el botón estaba gris.
  const requisitos = [
    { ok: !!(ov.id_cliente || clienteIdLocal), okTxt: "Cliente", faltaTxt: "Falta el cliente" },
    { ok: todosLosProductos.length > 0, okTxt: `${todosLosProductos.length} líneas`, faltaTxt: "Sin productos" },
    { ok: sinMatchCount === 0, okTxt: "Productos asociados", faltaTxt: `${sinMatchCount} sin asociar` },
    // Ámbar, no rojo: no impide validar —el nombre existe y la factura saldría— pero avisa que
    // ese nombre lo eligió la IA y nadie lo confirmó.
    ...(porConfirmarCount > 0
      ? [{ ok: false, bloquea: false, okTxt: "", faltaTxt: `${porConfirmarCount} por confirmar` }]
      : []),
    { ok: sinPrecioCount === 0, okTxt: "Precios", faltaTxt: `${sinPrecioCount} sin precio` },
    // Ámbar: no impide validar —el precio se puede escribir a mano— pero explica POR QUÉ los
    // precios no se están completando solos, que si no parece que la pantalla no funciona.
    // Medido en la copia de producción: 5 de las 201 órdenes con cliente están así.
    ...(clienteEfectivo && !idListaPrecio
      ? [{ ok: false, bloquea: false, okTxt: "", faltaTxt: "Cliente sin lista de precios" }]
      : []),
    { ok: !!bodegaId, okTxt: "Bodega", faltaTxt: "Falta la bodega" },
  ];
  // Lo que impide validar. `bloquea: false` sólo avisa (la sugerencia sin confirmar), porque
  // la línea sí tiene nombre y precio: obligar a confirmarla sería trabar el flujo por algo
  // que a menudo está bien.
  const loQueFalta = requisitos.filter((r) => !r.ok && r.bloquea !== false).map((r) => r.faltaTxt);

  // Las líneas que necesitan atención se muestran siempre; las correctas se pliegan. Es lo que
  // corta el crecimiento de la tarjeta: una orden de 14 líneas con 2 problemas ocupa 2 filas,
  // no 14.
  const necesitaAtencion = (p) =>
    sinAsociar(p) || !(Number(p.precio_venta) > 0) || porConfirmar(p);
  const conProblema = todosLosProductos.filter(necesitaAtencion);
  const sinProblema = todosLosProductos.filter((p) => !necesitaAtencion(p));
  const productosMostrados = productosExpandido
    ? todosLosProductos
    : [...conProblema, ...sinProblema].slice(0, Math.max(conProblema.length, PRODUCTOS_VISIBLES));
  const productosOcultos = todosLosProductos.length - productosMostrados.length;

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              OV #{ov.id}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
              Pendiente IA
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mt-0.5">
            {clienteElegido?.label ?? ov.cliente?.nombre_empresa ?? (
              <span className="text-gray-500 italic">Cliente no identificado</span>
            )}
          </h3>
          {/* Si hay un cambio pendiente se dice, para que nadie valide creyendo otra cosa. */}
          {clienteElegido && ov.id_cliente ? (
            <p className="text-xs text-amber-700">
              Se cambiará al validar (antes: {ov.cliente?.nombre_empresa ?? "sin cliente"})
            </p>
          ) : (
            ov.cliente?.rut && <p className="text-xs text-gray-500">RUT {ov.cliente.rut}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {ov.ingreso_venta > 0 && (
            <span className="text-lg font-bold text-gray-800 whitespace-nowrap">
              ${Number(ov.ingreso_venta).toLocaleString("es-CL")}
            </span>
          )}
          <ConfianzaBadge valor={ov.confianza_ia} />
        </div>
      </div>

      {/* Qué falta para validar, de un vistazo. Reemplaza tener que recorrer la tarjeta. */}
      <div className="flex flex-wrap gap-1.5 -mt-1">
        {requisitos.map((r, i) => (
          <span
            key={i}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              r.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {r.ok ? "✓ " : "• "}
            {r.ok ? r.okTxt : r.faltaTxt}
          </span>
        ))}
      </div>

      {/* Metadata: remitente + asunto + OC/fecha */}
      <div className="flex flex-col gap-1.5 text-sm border-t border-gray-100 pt-3 -mt-1">
        {log?.email_remitente && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 truncate flex-1">{log.email_remitente}</span>
            <button
              onClick={() => setEmailOpen(true)}
              className="shrink-0 flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium ml-2"
            >
              Ver correo
            </button>
          </div>
        )}
        {log?.email_asunto && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 text-xs leading-snug">{log.email_asunto}</span>
          </div>
        )}
        {(ov.numero_oc || ov.fecha_orden) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500 mt-0.5">
            {ov.numero_oc && (
              <div className="flex items-center gap-1.5">
                <span>OC {ov.numero_oc}</span>
              </div>
            )}
            {ov.fecha_orden && (
              <div className="flex items-center gap-1.5">
                <span>{fmtDate(ov.fecha_orden)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chips informativos de flags IA */}
      {flagsInfo.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {flagsInfo.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* 🔴 EL CLIENTE SIEMPRE SE PUEDE CAMBIAR, LO HAYA ACERTADO LA IA O NO.
          Antes este bloque salía sólo con `!ov.id_cliente`: si la IA elegía mal, no había
          forma de corregirlo desde la app. Y elegía mal seguido — medido el 2026-08-12,
          58 órdenes habían quedado asignadas a nuestra propia empresa, porque en una orden
          de compra nuestro RUT aparece como proveedor y la IA lo leía como cliente. */}
      {(!ov.id_cliente || cambiandoCliente) ? (
        <div className={`border rounded-xl p-3 flex flex-col gap-2 ${
          ov.id_cliente ? "border-gray-200 bg-gray-50" : "border-orange-200 bg-orange-50"
        }`}>
          <p className="text-xs font-semibold text-gray-700">
            {ov.id_cliente ? "Cambiar el cliente de esta orden" : "Cliente no identificado — selecciona uno para validar"}
          </p>
          {nombreExtraido && (
            <p className="text-xs text-gray-600">
              La IA encontró en el correo: <span className="font-semibold">{nombreExtraido}</span>
              {rutExtraido && <> — RUT {rutExtraido}</>}
            </p>
          )}
          <Selector
            options={[{ value: "", label: "— Busca y selecciona un cliente —" }, ...clientesOpts]}
            selectedValue={clienteIdLocal}
            onSelect={setClienteIdLocal}
            disabled={procesando}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleCrearCliente}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-800 underline decoration-dotted"
            >
              No existe — crear cliente nuevo{nombreExtraido ? " con estos datos" : ""}
            </button>
            {ov.id_cliente && (
              <button
                type="button"
                onClick={() => { setCambiandoCliente(false); setClienteIdLocal(""); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCambiandoCliente(true)}
          className="self-start text-xs text-gray-500 hover:text-gray-700 underline decoration-dotted"
        >
          No es este cliente — cambiar
        </button>
      )}

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
            {conProblema.length > 0 && !productosExpandido
              ? `Necesitan atención (${conProblema.length} de ${todosLosProductos.length})`
              : `Productos (${todosLosProductos.length})`}
          </p>
          {!agregando && (
            <button
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1 text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium"
            >
              Agregar
            </button>
          )}
        </div>

        <ul className="divide-y divide-gray-100 text-sm">
          {productosMostrados.map((p) => (
            <ProductoRow
              key={p.id}
              prod={p}
              catalogoOpts={catalogoOpts}
              ovId={ov.id}
              onUpdated={handleUpdatedProd}
              onDeleted={handleDeletedProd}
              idListaPrecio={idListaPrecio}
              nombreLista={nombreLista}
              cargarPrecios={cargarPrecios}
              formatoCantidad={ov.formato_cantidad}
            />
          ))}
          {todosLosProductos.length === 0 && !agregando && (
            <li className="py-2 text-xs text-gray-400 italic text-center">
              Sin productos — agrega al menos uno para validar
            </li>
          )}
          {agregando && (
            <AgregarProductoRow
              ovId={ov.id}
              catalogoOpts={catalogoOpts}
              onAdded={handleAddedProd}
              onCancel={() => setAgregando(false)}
              idListaPrecio={idListaPrecio}
              nombreLista={nombreLista}
              cargarPrecios={cargarPrecios}
            />
          )}
        </ul>

        {productosOcultos > 0 && (
          <button
            onClick={() => setProductosExpandido(true)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-[#7A5AF8] hover:text-[#6648e0] py-1.5 border-t border-dashed border-gray-200"
          >
            Ver {productosOcultos} línea{productosOcultos === 1 ? "" : "s"} más
            {conProblema.length > 0 ? ", todas correctas" : ""}
          </button>
        )}
        {productosExpandido && todosLosProductos.length > PRODUCTOS_VISIBLES && (
          <button
            onClick={() => setProductosExpandido(false)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 py-1.5 border-t border-dashed border-gray-200"
          >
            Ver menos
          </button>
        )}
      </div>

      {/* Banner: OC modificada — enlace a la OV original */}
      {ovOriginalId && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-medium">
          <span>
            Posible modificación de OC — la OV original ya fue validada (
            <a
              href={`/ventas/ordenes/${ovOriginalId}`}
              className="underline font-semibold hover:text-orange-900"
              target="_blank"
              rel="noreferrer"
            >
              OV #{ovOriginalId}
            </a>
            ). Revisa y edita antes de validar.
          </span>
        </div>
      )}

      {/* Toggle: orden referencial */}
      <label className={`flex items-center gap-2.5 cursor-pointer select-none w-fit ${guardandoRef ? "opacity-50" : ""}`}>
        <div className="relative shrink-0">
          <input
            type="checkbox"
            className="sr-only"
            checked={esReferencial}
            onChange={handleToggleReferencial}
            disabled={guardandoRef || procesando}
          />
          <div className={`w-9 h-5 rounded-full transition-colors ${esReferencial ? "bg-[#7A5AF8]" : "bg-gray-200"}`} />
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${esReferencial ? "translate-x-4" : ""}`} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">Orden referencial</span>
          <span className="text-xs text-gray-400">El picking no se realiza con QR, se declara la cantidad directamente</span>
        </div>
      </label>

      {/* Selector de bodega */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Bodega <span className="text-red-500">*</span>
        </label>
        <Selector
          options={bodegaOptions}
          selectedValue={bodegaId}
          onSelect={setBodegaId}
          disabled={procesando}
        />
      </div>

      {/* Acciones */}
      <div className="flex gap-3 pt-1">
        {/* El botón dice QUÉ falta, no sólo que no se puede. Un botón gris sin explicación
            obliga a recorrer la tarjeta buscando el motivo. */}
        <button
          onClick={() => onValidar(ov.id, bodegaId, clienteIdLocal || null)}
          disabled={loQueFalta.length > 0 || procesando}
          className="flex-1 bg-[#7A5AF8] hover:bg-[#6648e0] disabled:bg-gray-200 disabled:text-gray-500 text-white text-sm font-semibold py-2 rounded-xl transition"
        >
          {procesando
            ? "Procesando…"
            : loQueFalta.length > 0
            ? loQueFalta.join(" · ")
            : "Validar"}
        </button>
        <button
          onClick={() => onRechazar(ov.id)}
          disabled={procesando}
          className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 text-sm font-semibold py-2 rounded-xl transition"
        >
          Rechazar
        </button>
      </div>

      {emailOpen && <EmailModal log={log} onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function ColaIAPage() {
  const api = useApi();
  const [ordenes, setOrdenes]   = useState([]);
  const [bodegas, setBodegas]   = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [rechazarId, setRechazarId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina]     = useState(1);
  const [tab, setTab]           = useState("validar");
  const [apartados, setApartados] = useState([]);
  const [errorApartados, setErrorApartados] = useState(null);
  // Se pide bajo demanda —al abrir el editor de una línea— y una sola vez por lista. Cargarlas
  // todas al entrar sería traer 18 listas que casi nadie va a mirar.
  const cargarPrecios = usePreciosDeLista();

  const fetchData = useCallback(async () => {
    try {
      const [colaRes, bodegasRes, catalogoRes, clientesRes] = await Promise.all([
        api("/ordenes-venta/cola-ia"),
        api("/bodegas"),
        // 🔴 NOMBRES DE FACTURACIÓN, NO PRODUCTOS FÍSICOS.
        //
        // Una orden de venta se pide por nombre comercial y el DTE emite una línea por nombre
        // (`ovLineas.ts`), así que asociar una línea a un producto físico concreto es elegir
        // más de lo que la venta necesita — y elegir mal: si el nombre agrupa el mismo queso de
        // Valdivia y de San Felipe, la venta no distingue cuál, eso lo resuelve el picking.
        //
        // Es el mismo catálogo que usa el formulario de crear OV (`AddOrdenVenta`), así que
        // ambos caminos ofrecen lo mismo.
        api("/nombres-facturacion"),
        api("/clientes"),
      ]);
      setOrdenes(Array.isArray(colaRes) ? colaRes : colaRes.data ?? []);
      const lista = Array.isArray(bodegasRes?.bodegas)
        ? bodegasRes.bodegas
        : Array.isArray(bodegasRes)
        ? bodegasRes
        : [];
      setBodegas(lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)));
      const prods = Array.isArray(catalogoRes)
        ? catalogoRes
        : Array.isArray(catalogoRes?.data)
        ? catalogoRes.data
        : catalogoRes?.productos ?? [];
      setCatalogo(prods);

      const clis = Array.isArray(clientesRes)
        ? clientesRes
        : Array.isArray(clientesRes?.data)
        ? clientesRes.data
        : clientesRes?.clientes ?? [];
      setClientes(clis);
    } catch {
      toast.error("Error al cargar la cola IA");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Los apartados se piden aparte y en su propio try: si esta consulta falla, la cola de
  // validación —que es el trabajo diario— tiene que seguir funcionando igual.
  useEffect(() => {
    let cancelado = false;
    api("/ordenes-venta/cola-ia/apartados")
      .then((res) => {
        if (cancelado) return;
        setApartados(res?.apartados ?? res?.data?.apartados ?? []);
        setErrorApartados(null);
      })
      .catch((err) => {
        if (!cancelado) setErrorApartados(err?.message ?? "error desconocido");
      });
    return () => { cancelado = true; };
  }, [api]);

  // Opciones del catálogo para Selector
  const catalogoOpts = catalogo.map((p) => ({
    value: String(p.id),
    label: p.nombre,
  }));

  const clientesOpts = clientes.map((c) => ({
    value: String(c.id),
    label: c.nombre_empresa ?? `Cliente #${c.id}`,
  }));

  // El cliente completo, para llegar a su lista de precios. `clientesOpts` sólo lleva
  // value/label, que es lo que el Selector necesita y no alcanza para resolver un precio.
  const clientesPorId = useMemo(
    () => new Map(clientes.map((c) => [String(c.id), c])),
    [clientes]
  );

  // Búsqueda: cliente, RUT, N° OC, remitente o asunto del correo
  const ordenesFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return ordenes;
    return ordenes.filter((ov) => {
      const campos = [
        ov.cliente?.nombre_empresa,
        ov.cliente?.rut,
        ov.numero_oc,
        ov.ai_log?.email_remitente,
        ov.ai_log?.email_asunto,
      ];
      return campos.some((c) => c && String(c).toLowerCase().includes(term));
    });
  }, [ordenes, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / PAGE_SIZE));

  // Si la búsqueda o una validación/rechazo dejan la página actual vacía, retrocede.
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  useEffect(() => { setPagina(1); }, [busqueda]);

  const ordenesPagina = ordenesFiltradas.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const handleValidar = async (id, bodegaId, clienteId) => {
    if (!bodegaId) { toast.warning("Debes seleccionar una bodega antes de validar"); return; }
    setProcesando(true);
    try {
      const body = { bodega_id: Number(bodegaId) };
      if (clienteId) body.id_cliente = Number(clienteId);
      await api(`/ordenes-venta/${id}/validar-cola-ia`, {
        method: "PUT",
        body,
      });
      toast.success(`OV #${id} validada correctamente`);
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      toast.error(`Error al validar OV #${id}: ${err?.message ?? "Error desconocido"}`);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarRechazo = async () => {
    const id = rechazarId;
    setRechazarId(null);
    setProcesando(true);
    try {
      await api(`/ordenes-venta/${id}`, { method: "DELETE" });
      toast.success(`OV #${id} rechazada y eliminada`);
      setOrdenes((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      toast.error(`Error al rechazar OV #${id}: ${err?.message ?? "Error desconocido"}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Cola IA
            {!loading && ordenes.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7A5AF8] text-white text-xs font-bold">
                {ordenes.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Órdenes detectadas automáticamente vía correo. Revisa los productos, asocia los que
            aparecen sin match, asigna bodega y valida cada orden.
          </p>
        </div>
        <Link
          to="/ConsumoGemini"
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-[#7A5AF8] hover:text-[#6648e0] border border-[#7A5AF8]/30 hover:bg-[#7A5AF8]/5 rounded-xl px-3 py-2 transition"
        >
          Consumo API Gemini
        </Link>
      </div>

      <Tabs
        pestanas={[
          { id: "validar", label: "Por validar", cantidad: ordenes.length },
          { id: "apartados", label: "Apartados", cantidad: apartados.length },
        ]}
        activa={tab}
        onCambiar={setTab}
      />

      {tab === "apartados" ? (
        <PanelApartados apartados={apartados} loading={false} error={errorApartados} />
      ) : (
      <>
      {!loading && ordenes.length > 0 && (
        <div className="relative mb-5">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, RUT, N° OC, remitente o asunto…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A5AF8] focus:border-[#7A5AF8]"
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando…</div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 font-medium">No hay órdenes pendientes de validación</p>
          <p className="text-xs text-gray-400 mt-1">
            Cuando llegue un correo con una OC, aparecerá aquí automáticamente
          </p>
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">Sin resultados para "{busqueda}"</p>
          <button
            onClick={() => setBusqueda("")}
            className="text-xs text-[#7A5AF8] hover:text-[#6648e0] font-medium mt-2"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {ordenesPagina.map((ov) => (
              <OVIACard
                key={ov.id}
                ov={ov}
                bodegas={bodegas}
                catalogoOpts={catalogoOpts}
                clientesOpts={clientesOpts}
                clientesPorId={clientesPorId}
                cargarPrecios={cargarPrecios}
                onValidar={handleValidar}
                onRechazar={setRechazarId}
                procesando={procesando}
              />
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagina}
                totalPages={totalPaginas}
                onPageChange={setPagina}
              />
            </div>
          )}
        </>
      )}
      </>
      )}

      <ConfirmActionModal
        isOpen={rechazarId !== null}
        onClose={() => setRechazarId(null)}
        onConfirm={confirmarRechazo}
        title="Rechazar orden"
        description={`¿Estás seguro de que deseas rechazar y eliminar la OV #${rechazarId}? Esta acción no se puede deshacer.`}
        confirmText="Rechazar"
        cancelText="Cancelar"
      />
    </div>
  );
}
