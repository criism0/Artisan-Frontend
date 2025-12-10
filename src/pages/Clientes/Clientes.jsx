import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ViewDetailButton, EditButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import Selector from "../../components/Selector";
import { api } from "../../lib/api.js";

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("Todos");
  const [filtroListaPrecio, setFiltroListaPrecio] = useState("Todas");
  const [filtroFormatoCompra, setFiltroFormatoCompra] = useState("Todos");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [canales, setCanales] = useState([]);
  const [showCanalesModal, setShowCanalesModal] = useState(false);
  const [newCanalName, setNewCanalName] = useState("");
  const [editingCanalId, setEditingCanalId] = useState(null);
  const [editingCanalName, setEditingCanalName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/clientes")
      .then((data) => {
        setClientes(data);
      })
      .catch(console.error);
  }, []);

  const loadCanales = () => {
    api("/canales")
      .then((data) => setCanales(data))
      .catch(console.error);
  };

  useEffect(() => {
    if (showCanalesModal) loadCanales();
  }, [showCanalesModal]);

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Nombre Comercial", accessor: "nombre_empresa" },
    { header: "Canal", accessor: "canalInfo", Cell: ({ value }) => value?.nombre || "" },
    { header: "Lista de Precio", accessor: "listaPrecio", Cell: ({ value }) => value?.nombre || "" },
    { header: "Contacto Comercial", accessor: "contacto_comercial" },
    { header: "E-mail Comercial", accessor: "email_comercial" },
    { header: "Teléfono", accessor: "telefono_comercial" },
    { header: "Opciones", accessor: "acciones" },
  ];

  const normalize = (text) =>
    (text ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const canalOptions = useMemo(() => {
    const map = new Map();
    clientes.forEach((c) => {
      const canal = c.canalInfo;
      if (canal?.id && !map.has(String(canal.id))) {
        map.set(String(canal.id), canal.nombre || `Canal ${canal.id}`);
      }
    });
    return [{ value: "Todos", label: "Todos" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [clientes]);

  const listaPrecioOptions = useMemo(() => {
    const map = new Map();
    clientes.forEach((c) => {
      const lista = c.listaPrecio;
      if (lista?.id && !map.has(String(lista.id))) {
        map.set(String(lista.id), lista.nombre || `Lista ${lista.id}`);
      }
    });
    return [{ value: "Todas", label: "Todas" }, ...Array.from(map, ([value, label]) => ({ value, label }))];
  }, [clientes]);

  const formatoCompraOptions = useMemo(() => {
    const formatos = Array.from(new Set(clientes.map((c) => c.formato_compra_predeterminado).filter(Boolean)));
    return [{ value: "Todos", label: "Todos" }, ...formatos.map((f) => ({ value: f, label: f }))];
  }, [clientes]);

  // Aplica búsqueda + filtros
  useEffect(() => {
    let list = [...clientes];

    const q = normalize(searchQuery);
    if (q) {
      list = list.filter((c) =>
        normalize(
          JSON.stringify([
            c.id,
            c.nombre_empresa,
            c.canalInfo?.nombre,
            c.listaPrecio?.nombre,
            c.contacto_comercial,
            c.email_comercial,
            c.telefono_comercial,
            c.formato_compra_predeterminado,
          ])
        ).includes(q)
      );
    }

    if (filtroCanal !== "Todos") {
      list = list.filter((c) => String(c.canalInfo?.id) === String(filtroCanal));
    }

    if (filtroListaPrecio !== "Todas") {
      list = list.filter((c) => String(c.listaPrecio?.id) === String(filtroListaPrecio));
    }

    if (filtroFormatoCompra !== "Todos") {
      list = list.filter((c) => c.formato_compra_predeterminado === filtroFormatoCompra);
    }

    setFiltered(list);
    setPage(1);
  }, [clientes, searchQuery, filtroCanal, filtroListaPrecio, filtroFormatoCompra]);

  const handleSearch = (q) => {
    setSearchQuery(q);
  };

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const slice = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const actions = (row) => (
    <div className="flex gap-2 justify-center">
      <ViewDetailButton onClick={() => navigate(`/clientes/${row.id}`)} tooltipText="Ver Detalle" />
      <EditButton onClick={() => navigate(`/clientes/${row.id}/edit`)} tooltipText="Editar Cliente" />
    </div>
  );

  const handleCreateCanal = () => {
    if (!newCanalName.trim()) return;
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
    if (!window.confirm("Eliminar canal?")) return;
    api(`/canales/${id}`, { method: "DELETE" })
      .then(() => loadCanales())
      .catch(console.error);
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Clientes</h1>
        <div className="flex gap-2">
          <button
            className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
            onClick={() => navigate("/clientes/add")}
          >
            Añadir Cliente
          </button>
          <button
            className="px-3 py-2 bg-green-300 text-green-900 rounded-md hover:bg-green-400"
            onClick={() => setShowCanalesModal(true)}
          >
            Ver Canales
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex justify-between items-center gap-3">
          <RowsPerPageSelector onRowsChange={(v) => { setRowsPerPage(v); setPage(1); }} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 border border-primary/20 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition-colors"
              onClick={() => setFiltrosAbiertos((v) => !v)}
            >
              {filtrosAbiertos ? 'Ocultar filtros' : 'Filtros'}
            </button>
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
        {filtrosAbiertos && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-border">
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600">Canal</label>
              <Selector
                options={canalOptions}
                selectedValue={filtroCanal}
                onSelect={setFiltroCanal}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600">Lista de Precio</label>
              <Selector
                options={listaPrecioOptions}
                selectedValue={filtroListaPrecio}
                onSelect={setFiltroListaPrecio}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-sm text-gray-600">Formato de Compra Predeterminado</label>
              <Selector
                options={formatoCompraOptions}
                selectedValue={filtroFormatoCompra}
                onSelect={setFiltroFormatoCompra}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                className="px-3 py-2 text-sm text-gray-700 hover:text-purple-600"
                onClick={() => {
                  setFiltroCanal("Todos");
                  setFiltroListaPrecio("Todas");
                  setFiltroFormatoCompra("Todos");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <Table columns={columns} data={slice.map((c) => ({ ...c, acciones: actions(c) }))} />

      <div className="mt-6 flex justify-end">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {showCanalesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-1/2">
            <h2 className="text-xl font-semibold mb-4">Gestión de Canales</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Nuevo canal"
                value={newCanalName}
                onChange={(e) => setNewCanalName(e.target.value)}
                className="border px-3 py-2 flex-grow"
              />
              <button
                onClick={handleCreateCanal}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
              >
                Agregar
              </button>
            </div>
            <table className="w-full table-auto border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">ID</th>
                  <th className="border px-2 py-1">Nombre</th>
                  <th className="border px-2 py-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {canales.map((c) => (
                  <tr key={c.id}>
                    <td className="border px-2 py-1">{c.id}</td>
                    <td className="border px-2 py-1">
                      {editingCanalId === c.id ? (
                        <input
                          value={editingCanalName}
                          onChange={(e) => setEditingCanalName(e.target.value)}
                          className="border px-2 py-1 w-full"
                        />
                      ) : (
                        c.nombre
                      )}
                    </td>
                    <td className="border px-2 py-1 flex gap-2">
                      {editingCanalId === c.id ? (
                        <button
                          onClick={saveEditCanal}
                          className="px-2 py-1 bg-primary text-white rounded hover:bg-hover"
                        >
                          Guardar
                        </button>
                      ) : (
                        <button
                          onClick={() => startEditCanal(c)}
                          className="px-2 py-1 bg-secondary text-white rounded hover:bg-secondary-light"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        onClick={() => deleteCanal(c.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right">
              <button
                onClick={() => setShowCanalesModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
