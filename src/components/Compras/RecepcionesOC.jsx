import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MenuAcciones from "../UI/MenuAcciones.jsx";
import { ModalConfirmacion } from "../UI/PanelAcciones.jsx";
import { useApi, apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP } from "../../services/formatHelpers";
import { formatFecha } from "../../lib/dateUtils";
import { mensajeDelBackend } from "../../utils/mensajeError.js";

const hace = (d) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `el ${formatFecha(d)}`;
};

/**
 * Pestaña «Recepciones» del detalle de una OC: el borrador abierto (si hay) y cada entrega
 * confirmada o anulada, con quién, cuándo, documentos, bultos y valor. Cada confirmada se puede
 * anular mientras ninguno de sus bultos se haya usado.
 */
export default function RecepcionesOC({ orden, lineas, puedeEscribir, onCambio, onCantidad }) {
  const api = useApi();
  const navigate = useNavigate();
  const [recepciones, setRecepciones] = useState(null);
  const [porConfirmar, setPorConfirmar] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api(`/proceso-compra/ordenes/${orden.id}/recepciones`);
      setRecepciones(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(mensajeDelBackend(e) || "No se pudieron cargar las recepciones");
      setRecepciones([]);
    }
  }, [api, orden.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (recepciones) onCantidad?.(recepciones.filter((r) => r.estado !== "Anulada").length);
  }, [recepciones, onCantidad]);

  const nombreLinea = (id) => lineas.find((l) => l.id === Number(id))?.proveedorMateriaPrima?.materiaPrima?.nombre ?? `línea ${id}`;
  const resumenLineas = (r) =>
    (r.lineas ?? [])
      .filter((l) => Number(l.cantidad) > 0)
      .map((l) => `${nombreLinea(l.id_linea)} ${Math.round(Number(l.cantidad) * 100) / 100}`)
      .join(" · ");

  const etiquetas = async (r) => {
    try {
      const blob = await apiBlob("/bultos/etiquetas", { method: "POST", body: { ids_bultos: r.ids_bultos } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiquetas_OC_${orden.id}_recepcion_${r.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudieron bajar las etiquetas: " + (e?.message || e));
    }
  };

  const llamar = async (ruta, metodo, exito) => {
    try {
      await api(ruta, { method: metodo });
      toast.success(exito);
      await cargar();
      onCambio?.();
    } catch (e) {
      toast.error(mensajeDelBackend(e) || "No se pudo completar la acción");
    }
  };

  if (!recepciones) return <p className="p-4 text-sm text-gray-500">Cargando recepciones…</p>;
  if (recepciones.length === 0)
    return <p className="bg-white rounded-xl shadow-sm p-6 text-center text-sm text-gray-500">Esta orden todavía no tiene recepciones.</p>;

  return (
    <div className="space-y-3">
      {recepciones.map((r) => {
        const borrador = r.estado === "Borrador";
        const anulada = r.estado === "Anulada";
        const docs = [
          r.numero_factura?.length ? `factura ${r.numero_factura.join(", ")}` : null,
          r.guia_despacho ? `guía ${r.guia_despacho}` : null,
        ].filter(Boolean);
        const quien = borrador ? r.creador?.nombre : r.confirmador?.nombre ?? r.creador?.nombre;
        return (
          <div
            key={r.id}
            className={`rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${
              borrador ? "border-2 border-dashed border-violet-300 bg-violet-50/40" : anulada ? "border border-gray-200 bg-gray-50 text-gray-500" : "bg-white shadow-sm"
            }`}
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b className={anulada ? "line-through" : "text-gray-900"}>Recepción {r.numero}</b>
                {borrador && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">✎ Borrador</span>}
                {r.estado === "Confirmada" && (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Confirmada {formatFecha(r.confirmada_en)}</span>
                )}
                {anulada && <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">Anulada {formatFecha(r.anulada_en)}</span>}
                {borrador && <span className="text-xs text-gray-500">guardada {hace(r.updatedAt)}</span>}
              </div>
              <div className="text-sm text-gray-600">
                {[quien, r.bodega?.nombre, ...docs, resumenLineas(r) || null, !borrador && `${r.cantidad_bultos} bulto${r.cantidad_bultos === 1 ? "" : "s"}`, !borrador && r.neto > 0 && formatCLP(r.neto, 0)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {borrador && puedeEscribir && (
                <>
                  <button
                    type="button"
                    className="btn btn-secundario text-red-700"
                    onClick={() =>
                      setPorConfirmar({
                        label: "Descartar",
                        destructiva: true,
                        confirmar: { titulo: `¿Descartar la recepción ${r.numero}?`, mensaje: "Se borra lo anotado. No había creado bultos.", textoBoton: "Descartar" },
                        onClick: () => llamar(`/proceso-compra/recepciones/${r.id}`, "DELETE", "Borrador descartado"),
                      })
                    }
                  >
                    Descartar
                  </button>
                  <button type="button" className="btn btn-primario" onClick={() => navigate(`/adquisiciones/ordenes-compra/${orden.id}/recepcionar`)}>
                    Seguir
                  </button>
                </>
              )}
              {r.estado === "Confirmada" && r.cantidad_bultos > 0 && (
                <button type="button" className="btn btn-secundario" onClick={() => etiquetas(r)}>
                  Etiquetas
                </button>
              )}
              {r.estado === "Confirmada" && puedeEscribir && (
                <MenuAcciones
                  etiqueta={`Más acciones de la recepción ${r.numero}`}
                  items={[
                    {
                      label: "Anular recepción",
                      peligro: true,
                      disabled: r.bultos_usados > 0,
                      title: r.bultos_usados > 0 ? `${r.bultos_usados} bulto(s) ya se usaron` : undefined,
                      onClick: () =>
                        setPorConfirmar({
                          label: "Anular",
                          destructiva: true,
                          confirmar: {
                            titulo: `¿Anular la recepción ${r.numero}?`,
                            mensaje: `Se borran sus ${r.cantidad_bultos} bultos y se resta lo que sumó a la orden.`,
                            textoBoton: "Anular",
                          },
                          onClick: () => llamar(`/proceso-compra/recepciones/${r.id}/anular`, "POST", `Recepción ${r.numero} anulada`),
                        }),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        );
      })}
      <ModalConfirmacion accion={porConfirmar} onCerrar={() => setPorConfirmar(null)} />
    </div>
  );
}
