import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { Spinner } from "../../components/UI/Spinner";

/**
 * Largo del codigo
 */
const CODE_LENGTH = 6;

/**
 * Cooldown del codigo en segundos
 */
const CODE_COOLDOWN = 300;

export default function VerifyResetCode() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? "";

  useEffect(() => {
    if (!email) navigate("/forgot-password", { replace: true });
  }, [email, navigate]);

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // tiempo restante, en segundos
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);
  const code = digits.join("");
  const isComplete = code.length === CODE_LENGTH && digits.every((d) => d !== "");

  function startCooldown(seconds = CODE_COOLDOWN) {
    setResendCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  function handleDigitChange(index, value) {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned && index < CODE_LENGTH - 1) {
      inputRefs.current[index+1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index-1].focus();
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH-1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isComplete) return;

    setLoading(true);

    try {
      const data = await api("/auth/verify-reset-code", {
        method: "POST",
        auth: false,
        body: { email, code },
      });

      navigate("/reset-password", { state: { email, code } });
    } catch (error) {
      toast.error(error?.message ?? "Error enviando código. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;

    try {
      await api("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email },
      });
      toast.success("Código reenviado");
      startCooldown(300);
    } catch {
      toast.error("Error intentando reenviar código. Intenta nuevamente.");
    }
  }

  function formatCooldown(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h1 className="text-2xl font-semibold text-gray-900" >Ingresar código</h1>
            <p className="mt-1 text-sm text-gray-500">
              Se te ha enviado un código de 6 digitos a {""}
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-14 text-center text-xl font-semibold rounded-xl border border-gray-300
                              text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2
                              focus:ring-primary/30 transition"
                  aria-label={`Dígito ${i+1}`}
                  autoComplete="off"
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || !isComplete}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3
                          text-white font-medium shadow-sm transition hover:bg-primary-dark
                          disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (<Spinner/>)}
              Verificar código
            </button>
          </form>
          <div className="mt-4 text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-gray-400">
                Podrá solicitar un nuevo código en{""}
                <span className="font-medium text-gray-600">{formatCooldown(resendCooldown)}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-primary hover:text-primary-dark font-medium transition"
              >
                Reenviar código
              </button>
            )}
          </div>
          <p className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Artisan — ERP
          </p>
        </div>
      </div>
    </div>
  );
}