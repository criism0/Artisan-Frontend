import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";

export default function AddProduct() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    categoria: "",
    estado: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post(`${import.meta.env.VITE_BACKEND_URL}/productos-base`, formData);
      navigate("/Productos");
    } catch (error) {
      console.error("Error creating producto:", error);
    }
  };
} 