import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../axiosInstance";

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [producto, setProducto] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    categoria: "",
    estado: true
  });

  useEffect(() => {
    const fetchProducto = async () => {
      try {
        const response = await axiosInstance.get(`${import.meta.env.VITE_BACKEND_URL}/productos-base/${id}`);
        setProducto(response.data);
        setFormData({
          nombre: response.data.nombre,
          descripcion: response.data.descripcion,
          precio: response.data.precio,
          categoria: response.data.categoria,
          estado: response.data.estado
        });
      } catch (error) {
        console.error("Error fetching producto:", error);
      }
    };

    fetchProducto();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.put(`${import.meta.env.VITE_BACKEND_URL}/productos-base/${id}`, formData);
      navigate(`/Productos/${id}`);
    } catch (error) {
      console.error("Error updating producto:", error);
    }
  };
} 