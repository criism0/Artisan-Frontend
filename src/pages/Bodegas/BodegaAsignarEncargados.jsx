import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";

export default function BodegaAsignarEncargados() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiFetch = useApi();

  const [usuarios, setUsuarios] = useState([]);
  const [encargados, setEncargados] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usuariosData = await apiFetch("/usuarios");
        const encargadosData = await apiFetch(`/bodegas/${id}/encargados`);
        const encargadosIds = encargadosData.encargados?.map(
          (e) => e.usuario?.id
        );
        setUsuarios(usuariosData || []);
        setEncargados(encargadosData.encargados || []);
        setSelected(encargadosIds || []);
      } catch (err) {
        console.error("Error cargando datos:", err);
        setError("No se pudo cargar la información.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, apiFetch]);

  const handleToggleEncargado = async (userId) => {
    const isAssigned = selected.includes(userId);

    try {
      if (isAssigned) {
        // eliminar encargado existente
        await apiFetch(`/bodegas/${id}/encargados/${userId}`, {
          method: "DELETE",
        });
        setSelected(selected.filter((idSel) => idSel !== userId));
      } else {
        // asignar nuevo encargado
        await apiFetch(`/bodegas/${id}/asignar-encargado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_usuario: userId }),
        });
        setSelected([...selected, userId]);
      }
    } catch (err) {
      console.error("Error actualizando encargado:", err);
      setError("No se pudo actualizar el encargado.");
    }
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <span className="text-primary">Cargando datos...</span>
      </div>
    );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4 flex items-center gap-2">
        <BackButton to={`/Bodegas/${id}`} />
        <h1 className="text-2xl font-bold">Asignar Encargados — Bodega #{id}</h1>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded mb-4">{error}</div>
      )}

      <div className="bg-white p-6 rounded-lg shadow max-w-3xl">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-2 text-left">Seleccionar</th>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={() => handleToggleEncargado(u.id)}
                  />
                </td>
                <td className="p-2">{u.id}</td>
                <td className="p-2">{u.nombre}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2 capitalize">{u.rol}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}
