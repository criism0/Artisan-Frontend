const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "https://api-dev.proyecto-artisan.website/";

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function getToken() {
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}
export function clearToken() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight = null;

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isAuthEndpoint(path) {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("auth/login") ||
    path.startsWith("auth/refresh") ||
    path.startsWith("auth/logout")
  );
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

  const isFormDataBody =
    typeof FormData !== "undefined" && opts.body instanceof FormData;

  if (opts.body && !isFormDataBody && typeof opts.body === "object") {
    opts.body = JSON.stringify(opts.body);
  }
  if (!h.has("Content-Type") && opts.body && !isFormDataBody) {
    h.set("Content-Type", "application/json");
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: h,
    credentials: "include",
  });

  if (res.status === 401 && auth && !isAuthEndpoint(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: h,
        credentials: "include",
      });
    }
  }

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

export async function apiBlob(path, { auth = true, headers, ...opts } = {}) {
  const h = new Headers(headers || {});

  const isFormDataBody =
    typeof FormData !== "undefined" && opts.body instanceof FormData;

  if (opts.body && !isFormDataBody && typeof opts.body === "object") {
    opts.body = JSON.stringify(opts.body);
  }
  if (!h.has("Content-Type") && opts.body && !isFormDataBody) {
    h.set("Content-Type", "application/json");
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: h,
    credentials: "include",
  });

  if (res.status === 401 && auth && !isAuthEndpoint(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        headers: h,
        credentials: "include",
      });
    }
  }

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

  return res.blob();
}

// Compat con tu Sidebar: `const api = useApi();`
import { useCallback } from "react";
export function useApi() {
  return useCallback((path, opts) => api(path, opts), []);
}

export { API_BASE };

export function buildApiUrl(path = "") {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return new URL(path, API_BASE).toString();
}
