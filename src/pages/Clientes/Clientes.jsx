import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ViewDetailButton, EditButton } from "../../components/Buttons/ActionButtons";
import DataTable from "../../components/Tables/DataTable";
import Selector from "../../components/Forms/Selector";
import { api } from "../../lib/api.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import toast from "../../lib/toast.js";

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroCanal, setFiltroCanal] = useState("Todos");
  const [filtroListaPrecio, setFiltroListaPrecio] = useState("Todas");
  const [filtroFormatoCompra, setFiltroFormatoCompra] = useState("Todos");
  const [canales, setCanales] = useState([]);
  const [showCanalesModal, setShowCanalesModal] = useState(false);
  const [newCanalName, setNewCanalName] = useState("");
  const [editingCanalId, setEditingCanalId] = useState(null);
  const [editingCanalName, setEditingCanalName] = useState("");
  const navigate = useNavigate();

  const canReadClients = checkScope(ModelType.CLIENTE, ScopeType.READ);
  const canWriteChannel = checkScope(ModelType.CANAL, ScopeType.WRITE);
  const canDeleteChannel = checkScope(ModelType.CANAL, ScopeType.DELETE);

  useEffect(() => {
    if (!canReadClients) {
      toast.permissionError([ModelType.CLIENTE, ScopeType.READ]);
      setIsLoading(false);
      return;
    }
    api("/clientes")
      .then((data) => {
        setClientes(data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const loadCanales = () => {
    api("/canales").then(setCanales).catch(console.error);
  };

  useEffect(() => {
    if (showCanalesModal) loadCanales();
  }, [showCanalesModal]);

  const columns = [
    { header: "Nombre Comercial", accessor: "nombre_empresa", sortable: true },
    { header: "Canal", accessor: "canalInfo", sortable: true, sortValue: (r) => r.canalInfo?.nombre || "", Cell: ({ value }) => value?.nombre || "—" },
    { header: "Lista de Precio", accessor: "listaPrecio", sortable: true, sortValue: (r) => r.listaPrecio?.nombre || "", Cell: ({ value }) => value?.nombre || "—" },
    { header: "Contacto Comercial", accessor: "contacto_comercial", Cell: ({ value }) => value || "—" },
    { header: "E-mail Comercial", accessor: "email_comercial", Cell: ({ value }) => value || "—" },
    { header: "Teléfono", accessor: "telefono_comercial", Cell: ({ value }) => value || "—" },
  ];

  const canalOptions = useMemo(() => {
    const map = new Map();
    clientes.forEach((c) => {
      const canal = c.canalInfo;
      if (canal?.id && !map.has(String(canal.id)))
        map.set(String(canal.id), canal.nombre || `Canal ${canal.id}`);
    });
    return [{ value: "Todos", label: "Todos" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [clientes]);

  const listaPrecioOptions = useMemo(() => {
    const map = new Map();
    clientes.forEach((c) => {
      const lista = c.listaPrecio;
      if (lista?.id && !map.has(String(lista.id)))
        map.set(String(lista.id), lista.nombre || `Lista ${lista.id}`);
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [clientes]);

  const formatoCompraOptions = useMemo(() => {
    const formatos = Array.from(new Set(clientes.map((c) => c.formato_compra_predeterminado).filter(Boolean)));
    return [{ value: "Todos", label: "Todos" }, ...formatos.map((f) => ({ value: f, label: f }))];
  }, [clientes]);

  // Filtros de negocio (canal / lista de precio / formato); la búsqueda,
  // orden y paginación las resuelve DataTable.
  const data = useMemo(() => {
    let list = clientes;
    if (filtroCanal !== "Todos") list = list.filter((c) => String(c.canalInfo?.id) === String(filtroCanal));
    if (filtroListaPrecio !== "Todas") list = list.filter((c) => String(c.listaPrecio?.id) === String(filtroListaPrecio));
    if (filtroFormatoCompra !== "Todos") list = list.filter((c) => c.formato_compra_predeterminado === filtroFormatoCompra);
    return list;
  }, [clientes, filtroCanal, filtroListaPrecio, filtroFormatoCompra]);

  const getSearchText = (c) =>
    [c.nombre_empresa, c.canalInfo?.nombre, c.listaPrecio?.nombre, c.contacto_comercial,
     c.email_comercial, c.telefono_comercial, c.formato_compra_predeterminado].join(" ");

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton onClick={() => navigate(`/clientes/${row.id}`)} tooltipText="Ver Detalle" />
      <EditButton onClick={() => navigate(`/clientes/${row.id}/edit`)} tooltipText="Editar Cliente" />
    </div>
  );

  const handleCreateCanal = () => {
    if (!newCanalName.trim()) return;
    if (!canWriteChannel) {
      toast.permissionError([ModelType.CANAL, ScopeType.WRITE]);
      return;
    }
    api("/canales", {
      method: "POST",
      body: JSON.stringify({ nombre: newCanalName }),
    })
      .then(() => {
        setNewCanalName("");
        loadCanales();
      })
      .catch(console.error);
  };

  const startEditCanal = (canal) => {
    setEditingCanalId(canal.id);
    setEditingCanalName(canal.nombre);
  };

  const saveEditCanal = () => {
    if (!canWriteChannel) {
      toast.permissionError([ModelType.CANAL, ScopeType.WRITE]);
      return;
    }
    api(`/canales/${editingCanalId}`, {
      method: "PUT",
      body: JSON.stringify({ nombre: editingCanalName }),
    })
      .then(() => {
        setEditingCanalId(null);
        setEditingCanalName("");
        loadCanales();
      })
      .catch(console.error);
  };

  const deleteCanal = (id) => {
    if (!canDeleteChannel) {
      toast.permissionError([ModelType.CANAL, ScopeType.DELETE]);
      return;
    }
    if (!window.confirm("¿Eliminar canal?")) return;
    api(`/canales/${id}`, { method: "DELETE" }).then(loadCanales).catch(console.error);
  };

  const clearFiltros = () => {
    setFiltroCanal("Todos");
    setFiltroListaPrecio("Todas");
    setFiltroFormatoCompra("Todos");
  };

  const filtrosPanel = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canal</label>
        <Selector options={canalOptions} selectedValue={filtroCanal} onSelect={setFiltroCanal} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lista de Precio</label>
        <Selector options={listaPrecioOptions} selectedValue={filtroListaPrecio} onSelect={setFiltroListaPrecio} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Formato de Compra</label>
        <Selector options={formatoCompraOptions} selectedValue={filtroFormatoCompra} onSelect={setFiltroFormatoCompra} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div className="md:col-span-3 flex justify-end">
        <button type="button" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors" onClick={clearFiltros}>
          Limpiar filtros
        </button>
      </div>
    </div>
  );

  return (
    <>
      <DataTable
        title="Clientes"
        data={data}
        columns={columns}
        actions={actions}
        getSearchText={getSearchText}
        filters={filtrosPanel}
        loading={isLoading}
        loadingMessage="Cargando clientes"
        emptyMessage="No hay clientes registrados."
        headerActions={
          <>
            <button
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover transition-colors text-sm font-medium"
              onClick={() => navigate("/clientes/add")}
            >
              Añadir Cliente
            </button>
            <button
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              onClick={() => setShowCanalesModal(true)}
            >
              Ver Canales
            </button>
          </>
        }
      />

      {/* ── Modal: Gestión de Canales ── */}
      {showCanalesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Gestión de Canales</h2>
              <button
                onClick={() => setShowCanalesModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Crear canal */}
              <div className="flex gap-2 mb-5">
                <input
                  type="text"
                  placeholder="Nombre del nuevo canal"
                  value={newCanalName}
                  onChange={(e) => setNewCanalName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCanal()}
                  className="border border-gray-300 px-3 py-2 flex-1 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <button
                  onClick={handleCreateCanal}
                  className="px-4 py-2 bg-primary text-white rounded-md text-sm hover:bg-hover transition-colors font-medium"
                >
                  Agregar
                </button>
              </div>

              {/* Lista de canales */}
              {canales.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No hay canales registrados.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-12">ID</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {canales.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500">{c.id}</td>
                          <td className="px-4 py-2.5 text-gray-900">
                            {editingCanalId === c.id ? (
                              <input
                                value={editingCanalName}
                                onChange={(e) => setEditingCanalName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveEditCanal()}
                                className="border border-gray-300 px-2 py-1 w-full rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                            ) : (
                              c.nombre
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5 justify-center">
                              {editingCanalId === c.id ? (
                                <>
                                  <button
                                    onClick={saveEditCanal}
                                    className="px-2.5 py-1 bg-primary text-white rounded text-xs hover:bg-hover transition-colors"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingCanalId(null)}
                                    className="px-2.5 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditCanal(c)}
                                    className="px-2.5 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => deleteCanal(c.id)}
                                    className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowCanalesModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
