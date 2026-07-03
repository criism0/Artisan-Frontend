import React from "react";

export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmDisabled = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center break-words">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>

          {description && (
            <div className="text-gray-600 mb-6 text-sm leading-relaxed break-words whitespace-pre-line">
              {description}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={
                confirmDisabled
                  ? "px-5 py-2 rounded-xl bg-gray-300 text-gray-600 font-medium cursor-not-allowed"
                  : "px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow"
              }
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors shadow"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
