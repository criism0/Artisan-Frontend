import React from "react";

export default function SimilarNameConfirmModal({
  open,
  entityLabel,
  inputName,
  matches,
  onConfirm,
  onCancel,
  confirmText = "Crear igualmente",
}) {
  if (!open) return null;

  const list = Array.isArray(matches) ? matches : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-2">Nombre similar detectado</h2>
        <p className="mb-3 text-gray-700">
          Estás intentando crear un {entityLabel} con nombre: <b>{inputName}</b>.
          {" "}Encontramos {list.length === 1 ? "un" : `${list.length}`} {entityLabel}
          {" "}con nombre similar.
        </p>

        <div className="mb-4 max-h-56 overflow-auto border rounded">
          <ul className="divide-y">
            {list.map((m) => (
              <li key={String(m.id)} className="px-3 py-2 flex items-center justify-between">
                <span className="text-gray-900">{m.nombre}</span>
                {typeof m.score === "number" ? (
                  <span className="text-xs text-gray-500">{Math.round(m.score * 100)}%</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <p className="mb-4 text-gray-700">
          ¿Quieres continuar igualmente?
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
