import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { jwtDecode } from "jwt-decode";
import { getToken, clearToken, API_BASE } from "../lib/api.js";
import { toast } from "../lib/toast.js";

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    return jwtDecode(token);
  } catch {
    return {};
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    // JWT exp is in seconds, Date.now() is in milliseconds
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp ? decoded.exp < currentTime : false;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken());
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");

  // Derivar "user" desde el JWT (id, email, scope/roles, etc.)
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    // Verificar si el token está expirado
    if (isTokenExpired(token)) {
      toast.error("Sesión expirada. Por favor, inicia sesión nuevamente.");
      clearToken();
      setToken(null);
      setUser(null);
      // Redirigir al login si no estamos ya ahí
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return;
    }

    const p = decodeJwt(token);

    setUser({
      id: p?.id ?? p?.sub ?? null,
      email: p?.email ?? null,
      nombre: p?.nombre ?? p?.name ?? null,
      role: p?.role ?? null,
      scope: p?.scopes ?? [],
      raw: p,
    });
  }, [token]);

  // Verificar periódicamente si el token ha expirado durante la sesión
  useEffect(() => {
    if (!token) return;

    const checkInterval = setInterval(() => {
      const currentToken = getToken();
      if (currentToken && isTokenExpired(currentToken)) {
        toast.error("Sesión expirada. Por favor, inicia sesión nuevamente.");
        clearToken();
        setToken(null);
        setUser(null);
        // Redirigir al login si no estamos ya ahí
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }, 60000); // Verificar cada minuto

    return () => clearInterval(checkInterval);
  }, [token]);

  async function login(email, password) {
    setAuthError("");
    const LOGIN_PATH = import.meta.env.VITE_LOGIN_PATH || "/auth/login";
    const url = `${API_BASE}${LOGIN_PATH}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let msg = `Error ${res.status} en login`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const tk =
        data?.access_token || data?.token || data?.jwt || data?.data?.token;
      if (!tk) throw new Error("No se recibió token del servidor.");

      // Verificar que el token recibido no esté expirado
      if (isTokenExpired(tk)) {
        throw new Error("El token recibido está expirado.");
      }

      // clave única que usa api.js
      localStorage.setItem("access_token", tk);
      setToken(tk);
      return true;
    } catch (e) {
      console.warn("Login failed:", e?.message);
      setAuthError(e?.message || "Error al iniciar sesión");
      // limpiar por si quedó algo inconsistente
      clearToken();
      setToken(null);
      return false;
    }
  }

  function logout() {
    clearToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuth: !!token,
      login,
      logout,
      authError,
    }),
    [token, user, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
