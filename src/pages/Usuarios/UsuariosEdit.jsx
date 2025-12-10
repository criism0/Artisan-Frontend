import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { BackButton } from "../../components/Buttons/ActionButtons";

export default function UsuariosEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState({
    nombre: "",
    email: "",
    activo: true,
    rolId: "",
  });
  const [originalUsuario, setOriginalUsuario] = useState(null);

  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const data = await api(`/usuarios/${id}`);

        if (!data) {
          toast.error("No se pudieron cargar los datos del usuario.");
          setLoading(false);
          return;
        }

        const normalizedRolId = data.rolId ?? data.role_id ?? data.rol?.id ?? "";

        setUsuario({
          nombre: data.nombre || "",
          email: data.email || "",
          activo: data.activo ?? true,
          rolId: normalizedRolId?.toString() ?? "",
        });

        setOriginalUsuario({
          ...data,
          _normalized_role_id: normalizedRolId ?? "",
        });
      } catch (err) {
        const errorMessage = err?.message || "Error al cargar el usuario";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchUsuario();
    }
  }, [id]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const resp = await api(`/roles`);
        const list = Array.isArray(resp) ? resp : resp?.roles || [];
        const ordered = list.slice().sort((a, b) =>
          (a.nombre || a.name || "").localeCompare(b.nombre || b.name || "")
        );
        setRoles(ordered);
      } catch (err) {
        console.error("Error cargando roles:", err);
      } finally {
        setRolesLoading(false);
      }
    };
    fetchRoles();
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!usuario.nombre.trim()) newErrors.nombre = "El nombre es obligatorio.";
    if (!usuario.email.trim()) newErrors.email = "El email es obligatorio.";
    else if (!/\S+@\S+\.\S+/.test(usuario.email))
      newErrors.email = "Formato de email inválido.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUsuario((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const cambios = {};
    const original = originalUsuario || {};

    if (usuario.nombre !== original.nombre) cambios.nombre = usuario.nombre;
    if (usuario.email !== original.email) cambios.email = usuario.email;
    if (usuario.activo !== original.activo) cambios.activo = usuario.activo;

    const originalRoleIdStr =
      original._normalized_role_id === null || original._normalized_role_id === undefined
        ? ""
        : String(original._normalized_role_id);

    if (String(usuario.rolId ?? "") !== originalRoleIdStr) {
      const parsed = usuario.rolId === "" ? null : Number(usuario.rolId);
      cambios.role_id = parsed === null || Number.isNaN(parsed) ? null : parsed;
    }

    if (Object.keys(cambios).length === 0) {
      toast.info("No hay cambios para guardar.");
      return;
    }

    try {
      await api(`/usuarios/${id}`, {
        method: "PUT",
        body: JSON.stringify(cambios)
      });
      toast.success("Usuario actualizado correctamente.");
      navigate(`/Usuarios/${id}`);
    } catch (error) {
      const mensaje = error?.message || "Error al actualizar el usuario";
      toast.error(mensaje);
    }
  };

  if (loading) return <p className="p-6">Cargando información del usuario...</p>;

  const inputClass = (field) =>
    `w-full border rounded px-2 py-1 ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Usuarios/${id}`} />
      <div className="mt-4">
        <h1 className="text-2xl font-bold mb-6">Editar Usuario</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded p-4 space-y-4 max-w-md"
      >
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input
            name="nombre"
            value={usuario.nombre}
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
            value={usuario.email}
            onChange={handleChange}
            className={inputClass("email")}
          />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium">Rol</label>
          <select
            name="rolId"
            value={usuario.rolId ?? ""}
            onChange={handleChange}
            className={`${inputClass("rolId")} disabled:opacity-60`}
            disabled={rolesLoading}
          >
            <option value="">Sin rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre || r.name || `Rol #${r.id}`}
              </option>
            ))}
          </select>
          {errors.rolId && (
            <p className="text-red-500 text-sm">{errors.rolId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Activo</label>
          <select
            name="activo"
            value={usuario.activo}
            onChange={(e) =>
              setUsuario((prev) => ({
                ...prev,
                activo: e.target.value === "true",
              }))
            }
            className="w-full border rounded px-2 py-1"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
}
