import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import toast from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader";
import { Spinner } from "../../components/UI/Spinner";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Tables/Table";

export default function UsuarioAsignarBodega(params) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [allBodegas, setAllBodegas] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingBodegas, setLoadingBodegas] = useState(true);
  const [loadingBodegasofUser, setLoadingBodegasOfUser] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const data = await api(`/usuarios/${id}`);
        setUsuario(data);
      } catch {
        toast.error("Error al cargar el usuario.");
      } finally {
        setLoadingUser(false);
      }
    };
    const fetchBodegas = async () => {
      try {
        const res = await api(`/bodegas`, { method: "GET" });
        const lista = Array.isArray(res?.bodegas) ? res.bodegas
                    : Array.isArray(res?.data)    ? res.data
                    : Array.isArray(res)          ? res
                    : [];
        setAllBodegas(lista.map((b) => ({id: b.id, nombre: b.nombre})));
      } catch {
        toast.error("Error al cargar las bodegas.");
      } finally {
        setLoadingBodegas(false);
      }
    };
    const fetchBodegaDeUsuario = async () => {
      try {
        const uBodegas = await api(`/usuarios/${id}/bodegas`);
        const ids = Array.isArray(uBodegas?.bodegas) ? uBodegas.bodegas : []
        setSelectedIds(ids);
      } catch {
        toast.error("Error obteniendo las bodegas de este usuario.");
      } finally {
        setLoadingBodegasOfUser(false);
      }
    }
    fetchUsuario();
    fetchBodegaDeUsuario();
    fetchBodegas();
  }, [id]);

  useEffect(() => {
    const handleClickOut = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOut);
    return () => document.removeEventListener("mousedown", handleClickOut);
  }, []);

  const toggleBodega = (bodegaId) => {
    setSelectedIds((prev) => 
      prev.includes(bodegaId) ? prev.filter((bid) => bid !== bodegaId) : [...prev, bodegaId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSaving(true);
    try {
      await api(`/usuarios/${id}/bodegas`, {
        method: "PUT",
        body: { bodegas: selectedIds},
      });
      toast.success("Bodegas asignadas correctamente.");
      navigate(`/Usuarios`);
    } catch (err) {
      toast.error(err.message || "Error al guardar bodegas.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser || loadingBodegasofUser) return <PageLoader message="Cargando" />;

  const bodegasSeleccionadas = allBodegas.filter((b) => selectedIds.includes(b.id));

  const bodegasFiltradas = allBodegas.filter((b) => 
    !selectedIds.includes(b.id) &&
    b.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const tableColumns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre", accessor: "nombre" },
  ];

  return (
    <div>
      <BackButton to={"/Usuarios"} />
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">Asignar Bodega</h1>
        <p className="text-sm text-gray-500 mt-1">
          Usuario:{" "}
          <span className="font-medium text-gray-700">{usuario?.nombre}</span>
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium mb-1">Añadir bodega</label>
          {loadingBodegas ? (
            <div className="flex items-center gap-2 py-2">
              <Spinner size="sm" label="" />
              <span className="text-sm text-gray-400">Cargando bodegas disponibles...</span>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                placeholder="Buscar bodega..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {dropdownOpen && (
                <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto">
                  {bodegasFiltradas.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-400">
                      {allBodegas.length > 0 && allBodegas.length === selectedIds.length
                        ? "Se han asignado todas las bodegas."
                        : "Sin resultados."
                      }
                    </li>
                  ) : (
                    bodegasFiltradas.map((b) => (
                      <li
                        key={b.id}
                        onClick={() => {
                          toggleBodega(b.id);
                          setSearch("");
                          setDropdownOpen(false);
                        }}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-green-50 hover:text-green-700"
                      >
                        {b.nombre}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Bodegas asignadas{" "}
            <span className="text-gray-400 font-normal">
              ({selectedIds.length})
            </span>
          </label>
          {selectedIds.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Este usuario no tiene bodegas asignadas.</p>
          ) : (
            <Table
              columns={tableColumns}
              data={bodegasSeleccionadas}
              renderActions={(row) => (
                <button 
                  type="button"
                  onClick={() => toggleBodega(row.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Quitar
                </button>
              )}
            />
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}