import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../lib/api.js";
import { setCurrentUser } from "../services/scopeCheck.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api("/auth/me");
        if (!cancelled) {
          setCurrentUser(me);
          setUser(me);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Para que la sesión sea compartida entre multiples pestañas
  //
  // 🔴 Esto llamaba a `setToken`, que NO EXISTE en este componente: la sesión vive en la cookie
  // y el usuario se resuelve con `/auth/me`, no hay estado de token. Cualquier login o logout en
  // otra pestaña lanzaba un ReferenceError dentro del listener de todas las demás.
  //
  // Lo que corresponde es reflejar el cambio, no guardar el token: si otra pestaña inició
  // sesión se vuelve a preguntar quién es; si la cerró, se limpia acá también.
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key !== "access_token") return;

      if (e.newValue) {
        api("/auth/me")
          .then((me) => {
            setCurrentUser(me);
            setUser(me);
          })
          .catch(() => {
            setCurrentUser(null);
            setUser(null);
          });
      } else {
        // Y `setCurrentUser` también: es el que alimenta los scopes. Limpiar sólo `user` dejaba
        // los permisos del usuario anterior en pie.
        setCurrentUser(null);
        setUser(null);
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  async function login(email, password) {
    setAuthError("");

    try {
      await api("/auth/login", {
        auth: false,
        method: "POST",
        body: { email, password },
      });

      const me = await api("/auth/me");
      setCurrentUser(me);
      setUser(me);
      return true;
    } catch (e) {
      console.warn("Login failed:", e?.message);
      setAuthError(e?.message || "Error al iniciar sesión");
      setCurrentUser(null);
      setUser(null);
      return false;
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    }
    setCurrentUser(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      isAuth: !!user,
      loading,
      login,
      logout,
      authError,
    }),
    [user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
