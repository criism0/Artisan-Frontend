import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function UsuariosEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [contrasena, setContrasena] = useState("");
  const [confirmar_contrasena, setConfirmarContrasena] = useState("");

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const data = await api(`/usuarios/${id}`);
        setUsuario(data);
      } catch {
        toast.error("Error al cargar el usuario");
      } finally {
        setLoading(false);
      }
    };
    fetchUsuario();
  }, [id]);

  const validate = () => {
    const newErrors = {};
    if (!contrasena.trim())
      newErrors.contrasena = "La contraseña es obligatoria.";
    if (!confirmar_contrasena.trim())
      newErrors.confirmar_contrasena =
        "La confirmación de contraseña es obligatoria.";
    if (contrasena !== confirmar_contrasena)
      newErrors.confirmar_contrasena = "Las contraseñas no coinciden.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await api(`/usuarios/${id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: contrasena }),
      });
      toast.success("Contraseña actualizada correctamente.");
      navigate(`/Usuarios/${id}`);
    } catch(e) {
      toast.error(e.message || "Error al actualizar la contraseña.");
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setContrasena(value);
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleConfirmPasswordChange = (e) => {
    const { name, value } = e.target;
    setConfirmarContrasena(value);
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const inputClass = (field) =>
    `w-full border rounded px-2 py-1 ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Usuarios/${id}`} />
      <div className="mt-4">
        <h1 className="text-2xl font-bold mb-6">Cambiar contraseña</h1>
      </div>

      {loading ? (
        <p className="p-6">Cargando información del usuario...</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow rounded p-4 space-y-4 max-w-md"
        >
          <div>
            <label className="block text-sm font-medium">Contraseña</label>
            <input
              name="contrasena"
              type="password"
              value={contrasena}
              onChange={handlePasswordChange}
              className={inputClass("contrasena")}
            />
            {errors.contrasena && (
              <p className="text-red-500 text-sm">{errors.contrasena}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Confirmar contraseña
            </label>
            <input
              name="confirmar_contrasena"
              type="password"
              value={confirmar_contrasena}
              onChange={handleConfirmPasswordChange}
              className={inputClass("confirmar_contrasena")}
            />
            {errors.confirmar_contrasena && (
              <p className="text-red-500 text-sm">
                {errors.confirmar_contrasena}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            Guardar Cambios
          </button>
        </form>
      )}
    </div>
  );
}
