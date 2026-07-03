import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import { Spinner } from "../../components/UI/Spinner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email.trim()) return;

    setLoading(true);
    
    try {
      const res = await api("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email: email.toLowerCase().trim() },
      });

      toast.success("Si el correo está registrado, recibirás un código a este.");
      navigate("/reset-code", {state: { email: email.toLowerCase().trim() } });
    } catch {
      toast.error("Error de conexión. Intenta nuevamente.");
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
              onClick={() => navigate("/login")}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver a inicio de sesión
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-gray-500">Ingresa tu correo para enviarte un código de verificación.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="nombre@artisan.cl"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3
                         text-white font-medium shadow-sm transition hover:bg-primary-dark
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (<Spinner/>)}
              Enviar código
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