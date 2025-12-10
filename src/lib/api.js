const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "https://api-dev.proyecto-artisan.website/";


export function getToken() {
  return localStorage.getItem("access_token");
}
export function clearToken() {
  localStorage.removeItem("access_token");
}

async function safeMessage(res) {
  try {
    const j = await res.json();
    return j?.detalles || j?.message || j?.error || `${res.status} ${res.statusText}` || "Error desconocido";
  } catch (err) {
    return `${res.status} ${res.statusText}` || "Error desconocido";
  }
}

export async function api(path, { auth = true, headers, ...opts } = {}) {
  const h = new Headers(headers || {});
  if (!h.has("Content-Type") && opts.body) h.set("Content-Type", "application/json");

  if (auth) {
    const t = getToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: h });

  if (!res.ok) {
    if (res.status === 401 && window.location.pathname !== "/login") {
      clearToken();
      window.location.href = "/login";
    }
    throw new Error(await safeMessage(res));
  }
  if (res.status === 204) return null;
  return res.json();
}

// Compat con tu Sidebar: `const api = useApi();`
import { useCallback } from "react";
export function useApi() {
  return useCallback((path, opts) => api(path, opts), []);
}

export { API_BASE };
