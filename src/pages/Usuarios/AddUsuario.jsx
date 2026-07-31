import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { esEmailValido } from "../../services/formatHelpers";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function AddUsuario() {
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [data, setData] = useState({ nombre: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWriteUser = checkScope(ModelType.USUARIO, ScopeType.WRITE);

  const validate = () => {
    const newErrors = {};
    if (!data.nombre.trim()) newErrors.nombre = "El nombre es obligatorio.";
    if (!data.email.trim()) newErrors.email = "El email es obligatorio.";
    else if (!esEmailValido(data.email)) newErrors.email = "Formato de email inválido.";
    if (!data.password.trim()) newErrors.password = "La contraseña es obligatoria.";
    else if (data.password.length < 8)
      newErrors.password = "Debe tener al menos 8 caracteres.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!canWriteUser) {
      toast.permissionError([ModelType.USUARIO, ScopeType.WRITE]);
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch(`/auth/register`, {
        method: "POST",
        body: JSON.stringify({
          name: data.nombre.trim(),
          email: data.email.trim(),
          password: data.password,
        }),
      });
      toast.success("Usuario creado con éxito.");
      navigate("/Usuarios");
    } catch (error) {
      toast.error(error?.message || "No se pudo crear el usuario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full border rounded px-3 py-2 placeholder-gray-400 ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
      <div className="mb-4">
        <BackButton to="/Usuarios" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">Registrar Usuario</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow space-y-4 max-w-lg"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nombre *</label>
          <input
            name="nombre"
            placeholder="Ej: Juan Pérez"
            value={data.nombre}
            onChange={handleChange}
            className={inputClass("nombre")}
          />
          {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            name="email"
            type="email"
            placeholder="Ej: juan.perez@gmail.com"
            value={data.email}
            onChange={handleChange}
            className={inputClass("email")}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña *</label>
          <input
            name="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={data.password}
            onChange={handleChange}
            className={inputClass("password")}
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded disabled:opacity-50"
          >
            {isSubmitting ? "Registrando..." : "Registrar Usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}
