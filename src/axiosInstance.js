// src/utils/axiosInstance.js
import axios from "axios";


const baseURL = import.meta.env.VITE_API_URL;
const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

// Crea una instancia
const axiosInstance = axios.create({
  baseURL: cleanBaseURL,
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
