import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * Confirmación por promesa: reemplazo directo de `window.confirm` con un modal
 * estándar de la app. Se monta UNA vez en el root (main.jsx) y se consume con
 * el hook `useConfirm`:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "¿Eliminar?", message: "…", danger: true }))) return;
 *
 * Opciones: { title, message, confirmText, cancelText, danger }.
 */
const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: opts.title ?? "¿Estás seguro?",
        message: opts.message ?? "",
        confirmText: opts.confirmText ?? "Confirmar",
        cancelText: opts.cancelText ?? "Cancelar",
        danger: opts.danger ?? false,
      });
    });
  }, []);

  const settle = (result) => {
    setState(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={() => settle(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md text-center break-words"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{state.title}</h2>
            {state.message && (
              <div className="text-gray-600 mb-6 text-sm leading-relaxed break-words whitespace-pre-line">
                {state.message}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => settle(false)}
                className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => settle(true)}
                className={
                  state.danger
                    ? "px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium shadow transition-colors"
                    : "px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium shadow transition-colors"
                }
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
