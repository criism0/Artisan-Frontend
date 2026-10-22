import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { EditButton, BackButton } from "../../components/Buttons/ActionButtons";
import { PageLoader } from "../../components/UI/PageLoader.jsx";

export default function UsuarioById() {
  const { id } = useParams();
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const api = useApi();

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const response = await api(`/usuarios/${id}`);
        setUsuario(response);
      } catch (err) {
        console.error("Error fetching usuario:", err);
        setError("No se pudo cargar el usuario");
      } finally {
        setLoading(false);
      }
    };

    fetchUsuario();
  }, [id]);

  if (loading) return <PageLoader message="Cargando usuario" />;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!usuario) return <p className="p-6">Usuario no encontrado</p>;

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/Usuarios" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle de Usuario</h1>
        <div className="flex gap-2">
          <EditButton onClick={() => navigate(`/Usuarios/${usuario.id}/edit`)} tooltipText="Editar Usuario" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-text mb-4">Información del Usuario</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Nombre</p>
            <p className="font-medium">{usuario.nombre || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Email</p>
            <p className="font-medium">{usuario.email || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Rol</p>
            <p className="font-medium">{usuario.role?.name || "Sin rol"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Estado</p>
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                usuario.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {usuario.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
