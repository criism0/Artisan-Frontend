// src/utils/axiosInstance.js
import axios from "axios";

const normalizeBaseURL = (url) => {
  if (typeof url !== "string" || url.trim() === "") return undefined;
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

// Preferimos VITE_BACKEND_URL porque el resto del frontend lo usa,
// pero mantenemos compatibilidad con VITE_API_URL.
const baseURL =
  normalizeBaseURL(import.meta.env.VITE_BACKEND_URL) ??
  normalizeBaseURL(import.meta.env.VITE_API_URL);

if (!baseURL) {
  // No rompemos el render; solo dejamos una pista clara en consola.
  console.error(
    "Missing API base URL: define VITE_BACKEND_URL (recommended) or VITE_API_URL in your Vite env vars."
  );
}

// Crea una instancia
const axiosInstance = axios.create({
  baseURL,
});

// Agrega un interceptor para inyectar el token en cada request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
