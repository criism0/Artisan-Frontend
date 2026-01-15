import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import Selector from "../../components/Selector";
import { BackButton } from "../../components/Buttons/ActionButtons";

function normalize(text) {
  return String(text ?? "").trim();
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(720px,95vw)] bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-gray-900">{title}</div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function CostosIndirectos() {
  const api = useApi();

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("activos"); // activos | inactivos | todos

  const [createForm, setCreateForm] = useState({ nombre: "", descripcion: "" });
  const [isCreating, setIsCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", descripcion: "", is_active: true });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchAll = async () => {
    try {
      const qs =
        estado === "todos"
          ? ""
          : estado === "activos"
            ? "?is_active=true"
            : "?is_active=false";

      const res = await api(`/costos-indirectos${qs}`);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los costos indirectos");
    }
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const filtered = useMemo(() => {
    const q = normalize(query).toLowerCase();
    if (!q) return items;

    return (items || []).filter((i) => {
      const nombre = String(i?.nombre || "").toLowerCase();
      const descripcion = String(i?.descripcion || "").toLowerCase();
      return nombre.includes(q) || descripcion.includes(q);
    });
  }, [items, query]);

  const estadoOptions = useMemo(
    () => [
      { value: "activos", label: "Activos" },
      { value: "inactivos", label: "Inactivos" },
      { value: "todos", label: "Todos" },
    ],
    []
  );

  const openEdit = (row) => {
    setEditId(row.id);
    setEditForm({
      nombre: row?.nombre ?? "",
      descripcion: row?.descripcion ?? "",
      is_active: row?.is_active !== false,
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    const nombre = normalize(createForm.nombre);
    const descripcion = normalize(createForm.descripcion);

    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }

    try {
      setIsCreating(true);
      await api("/costos-indirectos", {
        method: "POST",
        body: JSON.stringify({ nombre, descripcion }),
      });
      setCreateForm({ nombre: "", descripcion: "" });
      toast.success("Costo indirecto creado");
      await fetchAll();
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (msg.includes("409")) toast.error("Ya existe un costo indirecto con ese nombre");
      else toast.error("No se pudo crear el costo indirecto");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    const nombre = normalize(editForm.nombre);
    const descripcion = normalize(editForm.descripcion);

    if (!nombre) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }

    try {
      setIsSavingEdit(true);
      await api(`/costos-indirectos/${editId}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre,
          descripcion,
          is_active: !!editForm.is_active,
        }),
      });
      toast.success("Costo indirecto actualizado");
      setEditOpen(false);
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el costo indirecto");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggle = async (row) => {
    try {
      await api(`/costos-indirectos/${row.id}/toggle-active`, { method: "PUT" });
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cambiar el estado");
    }
  };

  const handleSoftDelete = async (row) => {
    try {
      await api(`/costos-indirectos/${row.id}`, { method: "DELETE" });
      toast.success("Costo indirecto desactivado");
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo desactivar");
    }
  };

  const columns = useMemo(
    () => [
      { header: "Nombre", accessor: "nombre" },
      {
        header: "Descripción",
        accessor: "descripcion",
        Cell: ({ row }) => (
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{row.descripcion || "—"}</div>
        ),
      },
      {
        header: "Estado",
        accessor: "is_active",
        Cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              row.is_active === false
                ? "bg-gray-100 text-gray-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {row.is_active === false ? "Inactivo" : "Activo"}
          </span>
        ),
      },
      {
        header: "Acciones",
        accessor: "actions",
        Cell: ({ row }) => (
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              className="px-3 py-1.5 border rounded-lg hover:bg-gray-50"
              onClick={() => openEdit(row)}
            >
              Editar
            </button>
            <button
              type="button"
              className="px-3 py-1.5 border rounded-lg hover:bg-gray-50"
              onClick={() => handleToggle(row)}
            >
              {row.is_active === false ? "Activar" : "Desactivar"}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
              onClick={() => handleSoftDelete(row)}
              disabled={row.is_active === false}
              title={row.is_active === false ? "Ya está inactivo" : "Desactiva (soft-delete)"}
            >
              Eliminar
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/InsumosPIPProductos" />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Costos Indirectos</h1>
          <p className="text-sm text-gray-600 mt-1">
            Catálogo maestro de costos indirectos. Se recomienda desactivar en vez de eliminar para no romper recetas históricas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            onClick={fetchAll}
          >
            Refrescar
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Estado</label>
            <Selector
              options={estadoOptions}
              selectedValue={estado}
              onSelect={(v) => setEstado(v)}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Buscar</label>
            <SearchBar onSearch={(q) => setQuery(q)} />
          </div>
          <div className="md:col-span-2" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
        <div className="font-semibold text-gray-900 mb-3">Crear costo indirecto</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={createForm.nombre}
              onChange={(e) => setCreateForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Energía eléctrica"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={createForm.descripcion}
              onChange={(e) => setCreateForm((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
            onClick={handleCreate}
            disabled={isCreating}
          >
            {isCreating ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay costos indirectos para mostrar.</div>
        ) : (
          <Table columns={columns} data={filtered} />
        )}
      </div>

      <Modal
        open={editOpen}
        title="Editar costo indirecto"
        onClose={() => {
          if (!isSavingEdit) setEditOpen(false);
        }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={editForm.nombre}
              onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2"
              value={editForm.descripcion}
              onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={!!editForm.is_active}
              onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Activo
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => setEditOpen(false)}
              disabled={isSavingEdit}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
