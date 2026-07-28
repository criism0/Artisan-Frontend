import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { Spinner } from "../../components/UI/Spinner";

function validatePassword(password) {
  const minLength = 8;
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  const characterTypes = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

  if (password.length < minLength) {
    return { valid: false, message: `La contraseña debe tener al menos ${minLength} caracteres.` };
  }
  if (characterTypes < 3) {
    return {
      valid: false,
      message:
        "La contraseña debe contener al menos 3 de los siguientes tipos de caracteres: " +
        "letras minúsculas, letras mayúsculas, números, caracteres especiales (!@#$%^&*)"
    };
  }
  return { valid: true };
}

function PasswordStrength({ password }) {
  if (!password) return null;
  
  const checks = [
    { label: "8 caracteres mínimo", ok: password.length >= 8 },
    { label: "Letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Letra mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Número", ok: /[0-9]/.test(password) },
    { label: "Carácter especial (!@#$%^&*)", ok: /[!@#$%^&*]/.test(password) },
  ];

  return (
    <ul className="mt-2 space-y-1">
      {checks.map(({ label, ok }) => (
        <li key={label} className={`flex items-center gap-2 text-xs ${ok ? "text-green-600" : "text-gray-400"}`}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {ok ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            )}
          </svg>
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? "";
  const code = location.state?.code ?? "";

  useEffect(() => {
    if (!email || !code) navigate("/forgot-password", { replace: true });
  }, [email, code, navigate]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const passwordValidation = validatePassword(newPassword);
  const passwordMatch = newPassword === confirmPassword;
  const canSubmit = passwordValidation.valid && passwordMatch && confirmPassword.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!passwordValidation.valid) {
      toast.error(passwordValidation.message);
      return;
    }
    if (!passwordMatch) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const data = await api("/auth/reset-password", {
        method: "POST",
        auth: false,
        body: { email, code, new_password: newPassword },
      });

      toast.success("Contraseña restablecida correctamente");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error?.message ?? "Error intentando actualizar contraseña. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate("/reset-code", { state: { email } })}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Nueva contraseña</h1>
            <p className="mt-1 text-sm text-gray-500">Elige una contraseña segura para tu cuenta.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                Nueva contraseña
              </label>
              <div className="relative mt-1">
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pr-20 text-gray-900 shadow-sm
                             focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {showNew ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <div className="relative mt-1">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full rounded-xl border bg-white px-3 py-2 pr-20 text-gray-900 shadow-sm
                              focus:outline-none focus:ring-2 focus:ring-primary/30
                              ${confirmPassword && !passwordMatch
                                ? "border-red-400 focus:border-red-400"
                                : "border-gray-300 focus:border-primary"}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  {showConfirm ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {confirmPassword && ! passwordMatch && (
                <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3
                         text-white font-medium shadow-sm transition hover:bg-primary-dark
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (<Spinner/>)}
              Restablecer contraseña
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Artisan — ERP
          </p>
        </div>
      </div>
    </div>
  );
}