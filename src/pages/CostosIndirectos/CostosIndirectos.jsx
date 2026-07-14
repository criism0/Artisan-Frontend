import { useEffect, useRef, useState } from "react";
import { ApiError, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import DataTable from "../../components/Tables/DataTable";
import Selector from "../../components/Forms/Selector";
import {
  BackButton,
  EditButton,
  TrashButton,
} from "../../components/Buttons/ActionButtons";
import SimilarNameConfirmModal from "../../components/Modals/SimilarNameConfirmModal";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { Lock, Unlock } from "lucide-react";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

function normalize(text) {
  return String(text ?? "").trim();
}

const ESTADO_OPTIONS = [
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
  { value: "todos", label: "Todos" },
];

function EstadoChip({ activo }) {
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[min(560px,95vw)] bg-white rounded-xl shadow-lg border border-gray-200">
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

function CostoIndirectoForm({ form, setForm, onCancel, onSubmit, isSaving, submitLabel, canWrite, showActivo = false }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Energía eléctrica"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descripción</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          rows={3}
          placeholder="Opcional"
        />
      </div>
      {showActivo && (
        <div className="flex items-center gap-2">
          <input
            id="ci_is_active"
            type="checkbox"
            checked={!!form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
          />
          <label htmlFor="ci_is_active" className="text-sm text-gray-700">
            Activo
          </label>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
          onClick={onSubmit}
          disabled={isSaving || !canWrite}
        >
          {isSaving ? "Guardando..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function CostosIndirectos() {
  const api = useApi();

  const pendingSimilarActionRef = useRef(null);
  const [similarModal, setSimilarModal] = useState({
    open: false,
    inputName: "",
    matches: [],
    confirmText: "Crear igualmente",
  });

  const [items, setItems] = useState([]);
  const [estado, setEstado] = useState("activos"); // activos | inactivos | todos
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ nombre: "", descripcion: "" });
  const [isCreating, setIsCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", descripcion: "", is_active: true });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const canWriteIndirectCost = checkScope(ModelType.COSTO_INDIRECTO, ScopeType.WRITE);
  const canDeleteIndirectCost = checkScope(ModelType.COSTO_INDIRECTO, ScopeType.DELETE);

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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const openAdd = () => {
    if (!canWriteIndirectCost) {
      toast.permissionError([ModelType.COSTO_INDIRECTO, ScopeType.WRITE]);
      return;
    }
    setAddForm({ nombre: "", descripcion: "" });
    setAddOpen(true);
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setEditForm({
      nombre: row?.nombre ?? "",
      descripcion: row?.descripcion ?? "",
      is_active: row?.is_active !== false,
    });
    setEditOpen(true);
  };

  const handleCreate = async (confirmSimilarName = false) => {
    const nombre = normalize(addForm.nombre);
    const descripcion = normalize(addForm.descripcion);

    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }

    if (!canWriteIndirectCost) {
      toast.permissionError([ModelType.COSTO_INDIRECTO, ScopeType.WRITE]);
      setIsCreating(false);
      return;
    }

    try {
      setIsCreating(true);
      await api("/costos-indirectos", {
        method: "POST",
        body: JSON.stringify({ nombre, descripcion, confirmSimilarName }),
      });
      toast.success("Costo indirecto creado");
      setAddOpen(false);
      await fetchAll();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleCreate(true);
        setSimilarModal({
          open: true,
          inputName: e.data?.input || nombre,
          matches: e.data?.matches || [],
          confirmText: "Crear costo igualmente",
        });
        return;
      }

      console.error(e);
      const msg = String(e?.message || e);
      if (msg.includes("409")) toast.error("Ya existe un costo indirecto con ese nombre");
      else toast.error("No se pudo crear el costo indirecto");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveEdit = async (confirmSimilarName = false) => {
    if (!editId) return;
    const nombre = normalize(editForm.nombre);
    const descripcion = normalize(editForm.descripcion);

    if (!nombre) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }

    if (!canWriteIndirectCost) {
      toast.permissionError([ModelType.COSTO_INDIRECTO, ScopeType.WRITE]);
      setIsSavingEdit(false);
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
          confirmSimilarName,
        }),
      });
      toast.success("Costo indirecto actualizado");
      setEditOpen(false);
      await fetchAll();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleSaveEdit(true);
        setSimilarModal({
          open: true,
          inputName: e.data?.input || nombre,
          matches: e.data?.matches || [],
          confirmText: "Guardar igualmente",
        });
        return;
      }

      console.error(e);
      toast.error("No se pudo actualizar el costo indirecto");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggle = async (row) => {
    if (!canWriteIndirectCost) {
      toast.permissionError([ModelType.COSTO_INDIRECTO, ScopeType.WRITE]);
      return;
    }
    const activo = row.is_active !== false;
    setTogglingId(row.id);
    try {
      await api(`/costos-indirectos/${row.id}/toggle-active`, { method: "PUT" });
      toast.success(activo ? "Costo indirecto desactivado" : "Costo indirecto activado");
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cambiar el estado");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSoftDelete = async (row) => {
    if (!canDeleteIndirectCost) {
      toast.permissionError([ModelType.COSTO_INDIRECTO, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/costos-indirectos/${row.id}`, { method: "DELETE" });
      toast.success("Costo indirecto desactivado");
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo desactivar");
    }
  };

  const columns = [
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => (
        <div className="max-w-[320px] truncate font-medium" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Descripción",
      accessor: "descripcion",
      Cell: ({ value }) => (
        <div className="max-w-[480px] truncate text-gray-600" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Estado",
      accessor: "is_active",
      sortable: true,
      align: "center",
      sortValue: (row) => (row.is_active === false ? 0 : 1),
      Cell: ({ row }) => (
        <div className="flex justify-center">
          <EstadoChip activo={row.is_active !== false} />
        </div>
      ),
    },
  ];

  const actions = (row) => {
    const activo = row.is_active !== false;
    return (
      <div className="flex gap-2 items-center">
        <EditButton onClick={() => openEdit(row)} tooltipText="Editar costo indirecto" />
        <button
          type="button"
          onClick={() => void handleToggle(row)}
          disabled={togglingId === row.id || !canWriteIndirectCost}
          className={`${activo ? "text-yellow-600 hover:text-yellow-700" : "text-green-600 hover:text-green-700"} ${togglingId === row.id || !canWriteIndirectCost ? "opacity-60 cursor-not-allowed" : ""}`}
          title={togglingId === row.id ? "Actualizando..." : activo ? "Desactivar costo indirecto" : "Activar costo indirecto"}
          aria-label={activo ? "Desactivar costo indirecto" : "Activar costo indirecto"}
        >
          {activo ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
        </button>
        {activo && canDeleteIndirectCost ? (
          <TrashButton
            onConfirmDelete={() => handleSoftDelete(row)}
            tooltipText="Desactivar (los costos no se eliminan para no romper recetas históricas)"
            entityName={`costo indirecto ${row.nombre || ""}`}
          />
        ) : null}
      </div>
    );
  };

  const getSearchText = (row) =>
    [row?.nombre, row?.descripcion, row?.is_active === false ? "inactivo" : "activo"]
      .filter((v) => v != null)
      .join(" ");

  return (
    <>
      {(isCreating || isSavingEdit) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}

      <DataTable
        title="Costos Indirectos"
        data={items}
        columns={columns}
        actions={actions}
        getSearchText={getSearchText}
        loading={isLoading}
        loadingMessage="Cargando costos indirectos"
        defaultRowsPerPage={25}
        emptyMessage="No hay costos indirectos para mostrar."
        headerActions={
          <>
            <BackButton to="/Home" />
            <button
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
              onClick={openAdd}
            >
              Añadir Costo Indirecto
            </button>
          </>
        }
        toolbarStart={
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Estado</span>
            <Selector
              options={ESTADO_OPTIONS}
              selectedValue={estado}
              onSelect={(v) => setEstado(v)}
              className="px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
        }
      />

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="costo indirecto"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        confirmText={similarModal.confirmText}
        onCancel={() => {
          setSimilarModal({ open: false, inputName: "", matches: [], confirmText: "Crear igualmente" });
          pendingSimilarActionRef.current = null;
        }}
        onConfirm={async () => {
          const fn = pendingSimilarActionRef.current;
          setSimilarModal({ open: false, inputName: "", matches: [], confirmText: "Crear igualmente" });
          pendingSimilarActionRef.current = null;
          if (typeof fn === "function") await fn();
        }}
      />

      <Modal
        open={addOpen}
        title="Añadir Costo Indirecto"
        onClose={() => {
          if (!isCreating) setAddOpen(false);
        }}
      >
        <CostoIndirectoForm
          form={addForm}
          setForm={setAddForm}
          onCancel={() => setAddOpen(false)}
          onSubmit={() => handleCreate(false)}
          isSaving={isCreating}
          submitLabel="Crear"
          canWrite={canWriteIndirectCost}
        />
      </Modal>

      <Modal
        open={editOpen}
        title="Editar costo indirecto"
        onClose={() => {
          if (!isSavingEdit) setEditOpen(false);
        }}
      >
        <CostoIndirectoForm
          form={editForm}
          setForm={setEditForm}
          onCancel={() => setEditOpen(false)}
          onSubmit={() => handleSaveEdit(false)}
          isSaving={isSavingEdit}
          submitLabel="Guardar"
          canWrite={canWriteIndirectCost}
          showActivo
        />
      </Modal>
    </>
  );
}
