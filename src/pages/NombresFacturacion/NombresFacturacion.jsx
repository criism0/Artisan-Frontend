import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import DataTable from "../../components/Tables/DataTable";
import { EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import SimilarNameConfirmModal from "../../components/Modals/SimilarNameConfirmModal";
import ConfirmActionModal from "../../components/Modals/ConfirmActionModal";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatNumberCL } from "../../services/formatHelpers";
import { Merge, ChevronDown, ChevronRight, X } from "lucide-react";

function normalize(text) {
  return String(text ?? "").trim();
}

function Modal({ open, title, children, onClose, maxWidth = "560px" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white rounded-xl shadow-lg border border-gray-200 max-h-[90vh] overflow-y-auto"
        style={{ width: `min(${maxWidth}, 95vw)` }}
      >
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

function NombreForm({ form, setForm, onCancel, onSubmit, isSaving, submitLabel, canWrite, productos = null }) {
  const [productoSearch, setProductoSearch] = useState("");

  const filteredProductos = useMemo(() => {
    if (!productos) return [];
    const q = productoSearch.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => (p.nombre || "").toLowerCase().includes(q));
  }, [productos, productoSearch]);

  const toggleProducto = (id) => {
    setForm((p) => ({
      ...p,
      ids_productos: p.ids_productos.includes(id)
        ? p.ids_productos.filter((x) => x !== id)
        : [...p.ids_productos, id],
    }));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre comercial *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Yogurt Griego Litro Artisan"
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

      {productos && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Productos del grupo
            <span className="text-gray-500 font-normal"> (opcional — se reasignan a este nombre)</span>
          </label>
          <input
            type="text"
            placeholder="Buscar producto"
            value={productoSearch}
            onChange={(e) => setProductoSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md mb-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
            {filteredProductos.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">Sin productos</div>
            ) : (
              filteredProductos.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.ids_productos.includes(p.id)}
                    onChange={() => toggleProducto(p.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-800 flex-1">{p.nombre}</span>
                  {p.nombreFacturacion?.nombre && (
                    <span className="text-xs text-gray-400" title="Nombre de facturación actual">
                      {p.nombreFacturacion.nombre}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
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

export default function NombresFacturacion() {
  const api = useApi();

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selección para fusionar
  const [selectedIds, setSelectedIds] = useState([]);

  // Filas expandidas (desglose de productos del grupo)
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Modal añadir / editar
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ nombre: "", descripcion: "", ids_productos: [] });
  const [isCreating, setIsCreating] = useState(false);
  const [productosBase, setProductosBase] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", descripcion: "", ids_productos: [] });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal nombre similar (409 SIMILAR_NAME)
  const pendingSimilarActionRef = useRef(null);
  const [similarModal, setSimilarModal] = useState({ open: false, inputName: "", matches: [] });

  // Quitar producto del grupo (inverso del merge)
  const [quitarTarget, setQuitarTarget] = useState(null); // { grupo, producto }
  const [isQuitando, setIsQuitando] = useState(false);

  // Fusión
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeDestinoId, setMergeDestinoId] = useState(null);
  const [isMerging, setIsMerging] = useState(false);

  // Conflictos de precio al fusionar (409 CONFLICTO_PRECIOS)
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictos, setConflictos] = useState({ lista: [], precioCliente: [] });
  const [conflictSelLista, setConflictSelLista] = useState({});
  const [conflictSelPc, setConflictSelPc] = useState({});
  const [listasById, setListasById] = useState({});
  const [clientesById, setClientesById] = useState({});

  const canWrite = checkScope(ModelType.NOMBRE_FACTURACION, ScopeType.WRITE);
  const canDelete = checkScope(ModelType.NOMBRE_FACTURACION, ScopeType.DELETE);

  const nombresById = useMemo(() => {
    const m = {};
    for (const n of items) m[n.id] = n;
    return m;
  }, [items]);

  const fetchAll = async () => {
    try {
      const res = await api("/nombres-facturacion");
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los nombres de facturación");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProductosBase = async () => {
    if (productosBase) return;
    try {
      const res = await api("/productos-base");
      setProductosBase(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      setProductosBase([]);
    }
  };

  // ── Crear ──
  const openAdd = () => {
    if (!canWrite) {
      toast.permissionError([ModelType.NOMBRE_FACTURACION, ScopeType.WRITE]);
      return;
    }
    setAddForm({ nombre: "", descripcion: "", ids_productos: [] });
    void fetchProductosBase();
    setAddOpen(true);
  };

  const handleCreate = async (confirmSimilarName = false) => {
    const nombre = normalize(addForm.nombre);
    if (!nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    try {
      setIsCreating(true);
      await api("/nombres-facturacion", {
        method: "POST",
        body: JSON.stringify({
          nombre,
          descripcion: normalize(addForm.descripcion) || null,
          ids_productos: addForm.ids_productos,
          confirmSimilarName,
        }),
      });
      toast.success("Nombre de facturación creado");
      setAddOpen(false);
      setProductosBase(null);
      await fetchAll();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleCreate(true);
        setSimilarModal({ open: true, inputName: e.data?.input || nombre, matches: e.data?.matches || [] });
        return;
      }
      console.error(e);
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Ya existe un nombre de facturación con ese nombre");
      } else {
        toast.error("No se pudo crear el nombre de facturación");
      }
    } finally {
      setIsCreating(false);
    }
  };

  // ── Editar ──
  const openEdit = (row) => {
    if (!canWrite) {
      toast.permissionError([ModelType.NOMBRE_FACTURACION, ScopeType.WRITE]);
      return;
    }
    setEditId(row.id);
    setEditForm({ nombre: row?.nombre ?? "", descripcion: row?.descripcion ?? "", ids_productos: [] });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    const nombre = normalize(editForm.nombre);
    if (!nombre) {
      toast.error("El nombre no puede quedar vacío");
      return;
    }
    try {
      setIsSavingEdit(true);
      await api(`/nombres-facturacion/${editId}`, {
        method: "PUT",
        body: JSON.stringify({ nombre, descripcion: normalize(editForm.descripcion) || null }),
      });
      toast.success("Nombre de facturación actualizado");
      setEditOpen(false);
      await fetchAll();
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Ya existe un nombre de facturación con ese nombre");
      } else {
        toast.error("No se pudo actualizar el nombre de facturación");
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Eliminar ──
  const handleDelete = async (row) => {
    if (!canDelete) {
      toast.permissionError([ModelType.NOMBRE_FACTURACION, ScopeType.DELETE]);
      return;
    }
    try {
      await api(`/nombres-facturacion/${row.id}`, { method: "DELETE" });
      toast.success("Nombre de facturación eliminado");
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      await fetchAll();
    } catch (e) {
      console.error(e);
      // 409: tiene productos asociados — el backend explica qué hacer
      toast.error(e?.message || "No se pudo eliminar el nombre de facturación");
    }
  };

  // ── Quitar producto del grupo ──
  const handleQuitarProducto = async () => {
    if (!quitarTarget) return;
    const { grupo, producto } = quitarTarget;
    try {
      setIsQuitando(true);
      const res = await api(`/nombres-facturacion/${grupo.id}/quitar-producto`, {
        method: "POST",
        body: JSON.stringify({ id_producto: producto.id }),
      });
      toast.success(
        `"${producto.nombre}" volverá a facturarse como "${res?.nombre_destino?.nombre ?? producto.nombre}"`
      );
      setQuitarTarget(null);
      await fetchAll();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "No se pudo quitar el producto del grupo");
    } finally {
      setIsQuitando(false);
    }
  };

  // ── Fusionar ──
  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openMerge = () => {
    if (!canWrite) {
      toast.permissionError([ModelType.NOMBRE_FACTURACION, ScopeType.WRITE]);
      return;
    }
    if (selectedIds.length < 2) {
      toast.error("Selecciona al menos dos nombres para fusionar");
      return;
    }
    setMergeDestinoId(selectedIds[0]);
    setMergeOpen(true);
  };

  const cargarCatalogosConflicto = async () => {
    try {
      const [listas, clientes] = await Promise.all([api("/lista-precio"), api("/clientes")]);
      const lMap = {};
      for (const l of Array.isArray(listas) ? listas : []) lMap[l.id] = l;
      const cMap = {};
      for (const c of Array.isArray(clientes) ? clientes : []) cMap[c.id] = c;
      setListasById(lMap);
      setClientesById(cMap);
    } catch (e) {
      console.error("No se pudieron cargar listas/clientes para el detalle de conflictos:", e);
    }
  };

  const handleMerge = async ({ idsListaMantener = [], idsPcMantener = [] } = {}) => {
    const destinoId = mergeDestinoId;
    const idsOrigen = selectedIds.filter((id) => id !== destinoId);
    if (!destinoId || idsOrigen.length === 0) return;

    try {
      setIsMerging(true);
      const res = await api(`/nombres-facturacion/${destinoId}/merge`, {
        method: "POST",
        body: JSON.stringify({
          ids_origen: idsOrigen,
          ids_entradas_lista_mantener: idsListaMantener,
          ids_precios_cliente_mantener: idsPcMantener,
        }),
      });
      toast.success(`Nombres fusionados en "${res?.nombre ?? "destino"}"`);
      setMergeOpen(false);
      setConflictOpen(false);
      setSelectedIds([]);
      setMergeDestinoId(null);
      await fetchAll();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "CONFLICTO_PRECIOS") {
        setConflictos({
          lista: e.data?.conflictos_lista || [],
          precioCliente: e.data?.conflictos_precio_cliente || [],
        });
        setConflictSelLista({});
        setConflictSelPc({});
        setMergeOpen(false);
        setConflictOpen(true);
        void cargarCatalogosConflicto();
        return;
      }
      console.error(e);
      toast.error(e?.message || "No se pudo fusionar");
    } finally {
      setIsMerging(false);
    }
  };

  const conflictosResueltos =
    conflictos.lista.every((c) => conflictSelLista[c.id_lista_precio] != null) &&
    conflictos.precioCliente.every((c) => conflictSelPc[c.id_cliente] != null);

  const handleResolverConflictos = () => {
    if (!conflictosResueltos) {
      toast.error("Elige qué precio conservar en cada conflicto");
      return;
    }
    void handleMerge({
      idsListaMantener: Object.values(conflictSelLista),
      idsPcMantener: Object.values(conflictSelPc),
    });
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tabla ──
  const columns = [
    {
      header: "",
      accessor: "_sel",
      align: "center",
      Cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelected(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary focus:ring-primary"
          title="Seleccionar para fusionar"
        />
      ),
    },
    {
      header: "Nombre",
      accessor: "nombre",
      sortable: true,
      Cell: ({ value }) => (
        <div className="max-w-[360px] truncate font-medium" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Descripción",
      accessor: "descripcion",
      Cell: ({ value }) => (
        <div className="max-w-[360px] truncate text-gray-600" title={value || ""}>
          {value || "—"}
        </div>
      ),
    },
    {
      header: "Productos",
      accessor: "productos",
      sortable: true,
      align: "center",
      sortValue: (row) => row.productos?.length ?? 0,
      Cell: ({ row, value }) => {
        const n = value?.length ?? 0;
        const expanded = expandedIds.has(row.id);
        return (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => toggleExpanded(row.id)}
              className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                n > 1 ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : n === 1 ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-amber-100 text-amber-800"
              }`}
              title={n === 0 ? "Sin productos" : "Ver productos del grupo"}
              disabled={n === 0}
            >
              {n === 0 ? "Sin productos" : n === 1 ? "1 producto" : `${n} productos`}
              {n > 0 && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
            </button>
          </div>
        );
      },
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2 items-center">
      <EditButton onClick={() => openEdit(row)} tooltipText="Editar nombre de facturación" />
      {canDelete && (
        <TrashButton
          onConfirmDelete={() => handleDelete(row)}
          tooltipText="Eliminar (solo si no tiene productos)"
          entityName={`nombre de facturación ${row.nombre || ""}`}
        />
      )}
    </div>
  );

  const renderExpandedRow = (row) => {
    if (!expandedIds.has(row.id)) return null;
    const productos = row.productos || [];
    return (
      <tr key={`${row.id}-expanded`}>
        <td colSpan={columns.length + 1} className="bg-gray-50 px-6 py-4">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Productos físicos del grupo</div>
          {productos.length === 0 ? (
            <div className="text-sm text-gray-500">Este nombre no tiene productos asociados.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {productos.map((p) => (
                <span
                  key={p.id}
                  className="pl-2 pr-1 py-1 bg-white border border-gray-200 text-gray-800 text-xs rounded-full inline-flex items-center gap-1"
                >
                  {p.nombre}
                  {p.peso_unitario != null && p.unidad_medida ? (
                    <span className="text-gray-500">
                      {" · "}
                      {formatNumberCL(p.peso_unitario, 2)}{" "}
                      {{ Kilogramos: "kg", Litros: "L", Unidades: "unid." }[p.unidad_medida] || ""}
                    </span>
                  ) : null}
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setQuitarTarget({ grupo: row, producto: p })}
                      className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Quitar del grupo (vuelve a facturarse con su propio nombre)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </td>
      </tr>
    );
  };

  const getSearchText = (row) =>
    [row?.nombre, row?.descripcion, ...(row?.productos || []).map((p) => p.nombre)]
      .filter(Boolean)
      .join(" ");

  const mergeCandidatos = selectedIds.map((id) => nombresById[id]).filter(Boolean);

  return (
    <>
      {(isCreating || isSavingEdit || isMerging) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}

      <DataTable
        title="Nombres de Facturación"
        data={items}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={getSearchText}
        renderExpandedRow={renderExpandedRow}
        loading={isLoading}
        loadingMessage="Cargando nombres de facturación"
        defaultRowsPerPage={25}
        initialSort={{ key: "nombre", direction: "asc" }}
        emptyMessage="No hay nombres de facturación para mostrar."
        headerActions={
          <>
            <button
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={openMerge}
              disabled={selectedIds.length < 2}
              title={
                selectedIds.length < 2
                  ? "Selecciona dos o más nombres con las casillas de la tabla"
                  : "Fusionar los nombres seleccionados"
              }
            >
              <Merge className="w-4 h-4" />
              Fusionar{selectedIds.length >= 2 ? ` (${selectedIds.length})` : ""}
            </button>
            <button
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
              onClick={openAdd}
            >
              Añadir Nombre
            </button>
          </>
        }
      />

      {/* Confirmación: quitar producto del grupo (inverso del merge) */}
      <ConfirmActionModal
        isOpen={!!quitarTarget}
        onClose={() => { if (!isQuitando) setQuitarTarget(null); }}
        onConfirm={handleQuitarProducto}
        title="Quitar producto del grupo"
        description={
          quitarTarget
            ? `"${quitarTarget.producto.nombre}" saldrá de "${quitarTarget.grupo.nombre}" y volverá a facturarse con su propio nombre. Los precios definidos para el grupo NO lo acompañan: si corresponde, configura su precio aparte.`
            : ""
        }
        confirmText={isQuitando ? "Quitando..." : "Quitar del grupo"}
        cancelText="Cancelar"
      />

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="nombre de facturación"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        confirmText="Crear igualmente"
        onCancel={() => {
          setSimilarModal({ open: false, inputName: "", matches: [] });
          pendingSimilarActionRef.current = null;
        }}
        onConfirm={async () => {
          const fn = pendingSimilarActionRef.current;
          setSimilarModal({ open: false, inputName: "", matches: [] });
          pendingSimilarActionRef.current = null;
          if (typeof fn === "function") await fn();
        }}
      />

      <Modal
        open={addOpen}
        title="Añadir Nombre de Facturación"
        onClose={() => {
          if (!isCreating) setAddOpen(false);
        }}
      >
        <NombreForm
          form={addForm}
          setForm={setAddForm}
          onCancel={() => setAddOpen(false)}
          onSubmit={() => handleCreate(false)}
          isSaving={isCreating}
          submitLabel="Crear"
          canWrite={canWrite}
          productos={productosBase}
        />
      </Modal>

      <Modal
        open={editOpen}
        title="Editar Nombre de Facturación"
        onClose={() => {
          if (!isSavingEdit) setEditOpen(false);
        }}
      >
        <NombreForm
          form={editForm}
          setForm={setEditForm}
          onCancel={() => setEditOpen(false)}
          onSubmit={handleSaveEdit}
          isSaving={isSavingEdit}
          submitLabel="Guardar"
          canWrite={canWrite}
        />
      </Modal>

      {/* Modal de fusión: elegir destino */}
      <Modal
        open={mergeOpen}
        title="Fusionar nombres de facturación"
        onClose={() => {
          if (!isMerging) setMergeOpen(false);
        }}
      >
        <p className="text-sm text-gray-700 mb-3">
          Los productos, precios de lista y precios por cliente de los nombres de origen pasarán al
          nombre <b>destino</b>, y los nombres de origen se eliminarán. Elige el destino:
        </p>
        <div className="border rounded-lg divide-y mb-4 max-h-64 overflow-y-auto">
          {mergeCandidatos.map((n) => (
            <label key={n.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="merge-destino"
                checked={mergeDestinoId === n.id}
                onChange={() => setMergeDestinoId(n.id)}
                className="text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{n.nombre}</div>
                <div className="text-xs text-gray-500">
                  {(n.productos || []).length} producto(s)
                  {n.descripcion ? ` · ${n.descripcion}` : ""}
                </div>
              </div>
              {mergeDestinoId === n.id && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">Destino</span>
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => setMergeOpen(false)}
            disabled={isMerging}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
            onClick={() => void handleMerge()}
            disabled={isMerging || !mergeDestinoId}
          >
            {isMerging ? "Fusionando..." : "Fusionar"}
          </button>
        </div>
      </Modal>

      {/* Modal de resolución de conflictos de precio */}
      <Modal
        open={conflictOpen}
        title="Conflictos de precio al fusionar"
        maxWidth="680px"
        onClose={() => {
          if (!isMerging) setConflictOpen(false);
        }}
      >
        <p className="text-sm text-gray-700 mb-4">
          Los nombres a fusionar tienen precios distintos. Elige qué precio conservar en cada caso;
          el resto se eliminará.
        </p>

        {conflictos.lista.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Listas de precio</div>
            <div className="space-y-3">
              {conflictos.lista.map((c) => (
                <div key={c.id_lista_precio} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    {listasById[c.id_lista_precio]?.nombre || `Lista de precio #${c.id_lista_precio}`}
                  </div>
                  <div className="space-y-1">
                    {c.entradas.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`conf-lista-${c.id_lista_precio}`}
                          checked={conflictSelLista[c.id_lista_precio] === e.id}
                          onChange={() =>
                            setConflictSelLista((prev) => ({ ...prev, [c.id_lista_precio]: e.id }))
                          }
                          className="text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-800 flex-1">
                          {nombresById[e.id_nombre_facturacion]?.nombre ||
                            `Nombre #${e.id_nombre_facturacion}`}
                        </span>
                        <span className="text-sm text-gray-600">
                          ${formatNumberCL(e.precio_unidad ?? 0, 0)} unid.
                          {e.precio_caja != null ? ` · $${formatNumberCL(e.precio_caja, 0)} caja` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {conflictos.precioCliente.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Precios por cliente</div>
            <div className="space-y-3">
              {conflictos.precioCliente.map((c) => (
                <div key={c.id_cliente} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    {clientesById[c.id_cliente]?.nombre_empresa || `Cliente #${c.id_cliente}`}
                  </div>
                  <div className="space-y-1">
                    {c.precios.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`conf-pc-${c.id_cliente}`}
                          checked={conflictSelPc[c.id_cliente] === p.id}
                          onChange={() =>
                            setConflictSelPc((prev) => ({ ...prev, [c.id_cliente]: p.id }))
                          }
                          className="text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-800 flex-1">
                          {nombresById[p.id_nombre_facturacion]?.nombre ||
                            `Nombre #${p.id_nombre_facturacion}`}
                        </span>
                        <span className="text-sm text-gray-600">
                          ${formatNumberCL(p.precio_unitario ?? 0, 0)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => setConflictOpen(false)}
            disabled={isMerging}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
            onClick={handleResolverConflictos}
            disabled={isMerging || !conflictosResueltos}
          >
            {isMerging ? "Fusionando..." : "Resolver y fusionar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
