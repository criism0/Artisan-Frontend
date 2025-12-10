// src/pages/Login.jsx  (o donde lo tengas)
import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext"; // <- ajusta si tu ruta cambia
import { useLocation, useNavigate } from "react-router-dom";
import QRScanner from "../components/QRScanner";
import { QrCode } from "lucide-react";
import { toast } from "../lib/toast";

export default function Login() {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showScanQrCode, setShowScanQrCode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/Home";

  useEffect(() => {
    if (authError) {
      toast.error(authError);
    }
  }, [authError]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(email.toLowerCase().trim(), password.trim());
      if (ok) navigate(from, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleQRScan(credentials) {
    if (loading) return;
    
    setShowScanQrCode(false);
    setLoading(true);
    try {
      const ok = await login(credentials.user.toLowerCase().trim(), credentials.password.trim());
      if (ok) navigate(from, { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            {/* <img src="/logo.png" alt="Artisan" className="h-8 w-8" /> */}
            <h1 className="text-2xl font-semibold text-gray-900">Iniciar sesión</h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm 
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="nombre@artisan.cl"
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 pr-20 text-gray-900 shadow-sm 
                           focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-[34px] rounded-lg px-3 py-1 text-xs font-medium text-gray-600 
                           hover:bg-gray-100"
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPwd ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {/* Login with Email and Password */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 
                         text-white font-medium shadow-sm transition hover:bg-hover 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              )}
              Entrar
            </button>

            {/* Login with Scan QR Code */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setShowScanQrCode(true)}
                className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
              >
                <QrCode className="w-4 h-4" />
                Iniciar sesión con QR
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Artisan — ERP
          </p>
        </div>
      </div>

      {showScanQrCode && (
        <QRScanner
          onScanSuccess={handleQRScan}
          onClose={() => setShowScanQrCode(false)}
        />
      )}
    </div>
  );
}
