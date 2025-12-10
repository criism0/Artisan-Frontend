// src/lib/apiExtra1.js
const DEFAULT_DEV = "http://127.0.0.1:8000";
const DEFAULT_PROD = "https://two025-2-s4-grupo2-extra-1.onrender.com";

export const EXTRA1_BASE = String(
  import.meta.env.VITE_EXTRA1_BASE ??
    (import.meta.env.MODE === "development" ? DEFAULT_DEV : DEFAULT_PROD)
).replace(/\/+$/, "");

export async function apiExtra1(path, options = {}) {
  const url = path.startsWith("http") ? path : `${EXTRA1_BASE}${path}`;

  const isFormData = options?.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.detail || j?.error || JSON.stringify(j);
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = "";
      }
    }
    throw new Error(`Error ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
