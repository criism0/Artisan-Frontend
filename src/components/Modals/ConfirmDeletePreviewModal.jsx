import React from "react";

export default function ConfirmDeletePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  entityName = "elemento",
  title,
  preview,
  loading = false,
  error = null,
  maxItems = 8,
}) {
  if (!isOpen) return null;

  const canDelete = preview?.canDelete;
  const blockedReason = preview?.blockedReason;
  const outputs = preview?.outputs || {};
  const bultos = preview?.revert?.bultos || [];
  const totals = preview?.revert?.totals || {};

  const top = Array.isArray(bultos) ? bultos.slice(0, maxItems) : [];
  const remaining = Array.isArray(bultos) ? Math.max(0, bultos.length - top.length) : 0;

  const header = title || `¿Eliminar ${entityName}?`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl break-words">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">{header}</h2>

        {loading && (
          <p className="text-gray-600 text-sm mb-4">Cargando detalle de eliminación…</p>
        )}

        {!loading && error && (
          <p className="text-red-600 text-sm mb-4">
            No se pudo obtener el detalle. Puedes intentar nuevamente o eliminar igual.
          </p>
        )}

        {!loading && blockedReason === "tiene salidas" && canDelete === false && (
          <div className="mb-4">
            <p className="text-red-600 font-medium mb-2">
              No se puede eliminar porque tiene salidas asociadas.
            </p>
            <div className="text-sm text-gray-700 bg-gray-50 border rounded p-3">
              <div>Lotes finales: {outputs.lotes_finales || 0}</div>
              <div>Lotes en proceso: {outputs.lotes_en_proceso || 0}</div>
              <div>Registros subproducto: {outputs.registros_subproducto || 0}</div>
              <div>Bultos subproducto: {outputs.bultos_subproducto || 0}</div>
            </div>
          </div>
        )}

        {!loading && (!blockedReason || canDelete !== false) && (
          <div className="mb-4">
            {Array.isArray(bultos) && bultos.length > 0 ? (
              <>
                <p className="text-gray-700 text-sm mb-2">
                  Al eliminar, se devolverán insumos a los bultos:
                </p>
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="space-y-2">
                    {top.map((b) => (
                      <div key={b.id_bulto} className="flex items-start justify-between gap-4 text-sm">
                        <div className="text-gray-800 font-medium">
                          {b.identificador || `Bulto ${b.id_bulto}`}
                        </div>
                        <div className="text-gray-700 text-right">
                          <div>
                            Devolver: {b.unidades_a_devolver} unidades
                          </div>
                          <div className="text-gray-600">
                            (= {b.peso_utilizado_total} {b.materia_prima?.unidad_medida || ""})
                          </div>
                        </div>
                      </div>
                    ))}
                    {remaining > 0 && (
                      <div className="text-sm text-gray-600">…y {remaining} bultos más</div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t text-sm text-gray-800 flex items-center justify-between">
                    <div className="font-semibold">Totales</div>
                    <div className="text-right">
                      <div>{totals.unidades_a_devolver_total || 0} unidades</div>
                      <div className="text-gray-600">
                        {totals.peso_utilizado_total || 0} {top?.[0]?.materia_prima?.unidad_medida || ""}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-700 text-sm">
                Se eliminará <span className="font-semibold">{entityName}</span> y sus datos relacionados.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={loading || canDelete === false}
            className={`px-5 py-2 rounded-xl font-medium transition-colors shadow ${
              loading || canDelete === false
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
