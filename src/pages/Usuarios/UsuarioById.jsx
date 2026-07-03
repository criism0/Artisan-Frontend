import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { EditButton, TrashButton, BackButton } from "../../components/Buttons/ActionButtons";
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
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/Usuarios" />
      <div className="mt-4">
        <h1 className="text-2xl font-bold mb-6">Detalle de Usuario</h1>
      </div>

      <div className="bg-white shadow rounded p-4 space-y-2">
        <p><strong>ID:</strong> {usuario.id}</p>
        <p><strong>Nombre:</strong> {usuario.nombre}</p>
        <p><strong>Email:</strong> {usuario.email}</p>
        <p><strong>Rol:</strong> {usuario.role?.name || "Sin rol"}</p>
        <p>
          <strong>Estado:</strong>{" "}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              usuario.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {usuario.activo ? "Activo" : "Inactivo"}
          </span>
        </p>
      </div>

      <div className="flex gap-2 mt-6">
        <EditButton onClick={() => navigate(`/Usuarios/${usuario.id}/edit`)} tooltipText="Editar Usuario" />
        <TrashButton onClick={() => {}} tooltipText="Eliminar Usuario" />
      </div>
    </div>
  );
}
