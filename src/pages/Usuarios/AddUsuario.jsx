import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState } from "react";
import { useApi } from '../../lib/api';
import { toast } from "../../lib/toast";

export default function AddUsuario() {
  const navigate = useNavigate();
  const [data, setData] = useState({ nombre: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const apiFetch = useApi();

  const validate = () => {
    const newErrors = {};
    if (!data.nombre.trim()) newErrors.nombre = "El nombre es obligatorio.";
    if (!data.email.trim()) newErrors.email = "El email es obligatorio.";
    else if (!/\S+@\S+\.\S+/.test(data.email))
      newErrors.email = "Formato de email inválido.";
    if (!data.password.trim()) newErrors.password = "La contraseña es obligatoria.";
    else if (data.password.length < 8)
      newErrors.password = "Debe tener al menos 8 caracteres.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await apiFetch(`/auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.nombre,
          email: data.email,
          password: data.password,
        }),
      });
      setSuccess(true);
      setTimeout(() => navigate("/Usuarios"), 1500);
    } catch (error) {
      toast.error(error);
    }
  };

  const handleChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const inputClass = (field) =>
    `w-full border rounded px-2 py-1 ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/Usuarios" />
      <h1 className="text-2xl font-bold mb-6">Registrar Usuario</h1>

      {success && (
        <div className="mb-4 p-3 rounded bg-green-100 text-green-800 border border-green-300">
          ✅ Usuario creado con éxito. Redirigiendo...
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded p-4 space-y-4 max-w-md"
      >
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input
            name="nombre"
            placeholder="Ej: Juan Pérez"
            value={data.nombre}
            onChange={handleChange}
            className={inputClass("nombre")}
          />
          {errors.nombre && (
            <p className="text-red-500 text-sm">{errors.nombre}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            placeholder="Ej: juan.perez@gmail.com"
            value={data.email}
            onChange={handleChange}
            className={inputClass("email")}
          />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            name="password"
            type="password"
            placeholder="Ej: Abcdefgh123"
            value={data.password}
            onChange={handleChange}
            className={inputClass("password")}
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Registrar
        </button>
      </form>
    </div>
  );
}
