const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "https://api-dev.proyecto-artisan.website/";


export function getToken() {
  return localStorage.getItem("access_token");
}
export function clearToken() {
  localStorage.removeItem("access_token");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (err) {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
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
    const data = await safeJson(res);
    const message =
      data?.detalles ||
      data?.message ||
      data?.error ||
      `${res.status} ${res.statusText}` ||
      "Error desconocido";

    if (res.status === 401 && window.location.pathname !== "/login") {
      clearToken();
      window.location.href = "/login";
    }
    throw new ApiError(message, res.status, data);
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
