import React, { useEffect, useMemo, useState } from "react";
import Table from "../../components/Table";
import { toast } from "../../lib/toast";
import { API_BASE, useApi, getToken } from "../../lib/api";

const PAGE_SIZE = 50;

const formatDate = (value) => {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Santiago",
    }).format(d);
  } catch {
    return value;
  }
};

export default function PalletsDashboard() {
  const api = useApi();
  const [pallets, setPallets] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [selected, setSelected] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchPallets = async () => {
      setLoadingList(true);
      setError("");
      try {
        const data = await api("/pallets", { method: "GET" });
        setPallets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error cargando pallets:", err);
        setError(err?.message || "Error cargando pallets.");
      } finally {
        setLoadingList(false);
      }
    };
    fetchPallets();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pallets;
    return pallets.filter(
      (p) =>
        p.identificador?.toLowerCase().includes(q) ||
        p.estado?.toLowerCase().includes(q) ||
        p.id?.toString().includes(q)
    );
  }, [pallets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const handleSelect = async (pallet) => {
    setSelected(pallet);
    setBultos(Array.isArray(pallet.Bultos) ? pallet.Bultos : []);
    setDetailLoading(true);
    try {
      const data = await api(`/pallets/${pallet.id}`, { method: "GET" });
      const detailBultos =
        data?.bultos ||
        data?.Bultos ||
        data?.pallet?.bultos ||
        data?.pallet?.Bultos ||
        [];
      setBultos(detailBultos);
      setSelected((prev) =>
        prev ? { ...prev, estado: data?.estado || prev.estado } : prev
      );
    } catch (err) {
      console.error("Error obteniendo detalle de pallet:", err);
      toast.error(err?.message || "Error obteniendo detalle.");
    } finally {
      setDetailLoading(false);
    }
  };

  const cerrarPallet = async () => {
    if (!selected?.id) return;
    setClosing(true);
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/pallets/${selected.id}/cerrar`, {
        method: "PUT",
        headers,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Error al cerrar el pallet.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pallet_${selected.identificador || selected.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Pallet cerrado con éxito.");
      setSelected((prev) =>
        prev ? { ...prev, estado: "Completado" } : prev
      );
    } catch (err) {
      console.error("Error al cerrar pallet:", err);
      toast.error(err?.message || "Error al cerrar el pallet.");
    } finally {
      setClosing(false);
    }
  };

  const deletePallet = async () => {
    if (!selected?.id) return;
    const confirm = window.confirm(
      "¿Eliminar este pallet? Se liberarán los bultos asociados."
    );
    if (!confirm) return;

    setDeleting(true);
    try {
      await api(`/pallets/${selected.id}/liberar-bultos`, { method: "POST" });
      await api(`/pallets/${selected.id}`, { method: "DELETE" });
      toast.success("Pallet eliminado.");
      setPallets((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
      setBultos([]);
    } catch (err) {
      console.error("Error eliminando pallet:", err);
      toast.error(err?.message || "Error eliminando pallet.");
    } finally {
      setDeleting(false);
    }
  };

  const totals = useMemo(() => {
    const totalBultos = bultos.length;
    const totalUnidades = bultos.reduce(
      (acc, b) => acc + Number(b.cantidad_unidades || b.unidades_disponibles || 0),
      0
    );
    const pesoTotal = bultos.reduce(
      (acc, b) =>
        acc +
        (Number(b.cantidad_unidades || b.unidades_disponibles || 0) *
          Number(b.peso_unitario || b.peso || 0)),
      0
    );
    return { totalBultos, totalUnidades, pesoTotal };
  }, [bultos]);

  const listColumns = [
    { header: "ID", accessor: "id" },
    { header: "Identificador", accessor: "identificador" },
    { header: "Estado", accessor: "estado" },
    {
      header: "Bultos",
      accessor: "bultos_count",
      Cell: ({ row }) => (Array.isArray(row.Bultos) ? row.Bultos.length : "—"),
    },
    {
      header: "Creado",
      accessor: "createdAt",
      Cell: ({ row }) => formatDate(row.createdAt),
    },
    {
      header: "Acciones",
      accessor: "acciones",
      Cell: ({ row }) => (
        <button
          onClick={() => handleSelect(row)}
          className="px-3 py-1 bg-primary text-white rounded hover:bg-hover text-sm"
        >
          Ver detalle
        </button>
      ),
    },
  ];

  const bultosColumns = [
    {
      header: "Materia Prima",
      accessor: "MateriaPrima.nombre",
      Cell: ({ row }) => row?.MateriaPrima?.nombre || "—",
    },
    { header: "Identificador", accessor: "identificador" },
    {
      header: "Cantidad unidades",
      accessor: "cantidad_unidades",
      Cell: ({ row }) =>
        row.cantidad_unidades ?? row.unidades_disponibles ?? "—",
    },
    {
      header: "Peso unitario",
      accessor: "peso_unitario",
      Cell: ({ row }) => row.peso_unitario ?? row.peso ?? "—",
    },
    {
      header: "Peso total",
      accessor: "peso_total",
      Cell: ({ row }) => {
        const unidades =
          Number(row.cantidad_unidades || row.unidades_disponibles || 0);
        const pesoUnit = Number(row.peso_unitario || row.peso || 0);
        const total = unidades * pesoUnit;
        return total
          ? total.toLocaleString("es-CL", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "—";
      },
    },
    {
      header: "Fecha creación",
      accessor: "createdAt",
      Cell: ({ row }) => formatDate(row.createdAt),
    },
  ];

  const isClosed =
    (selected?.estado || "").toLowerCase() === "completado" ||
    (selected?.estado || "").toLowerCase() === "cerrado";

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Pallets Dashboard</h1>
          <p className="text-sm text-gray-600">
            Lista todos los pallets (50 por página), revisa detalle y opera sobre ellos.
          </p>
        </div>
        <div className="flex gap-2 items-center w-full md:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por ID, identificador o estado"
            className="border rounded px-3 py-2 w-full md:w-80"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded bg-red-50 text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loadingList ? (
          <div className="p-6 text-sm text-gray-600">Cargando pallets...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No hay pallets para mostrar.</div>
        ) : (
          <>
            <Table columns={listColumns} data={pageData} />
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span>
                Página {currentPage + 1} de {totalPages} — mostrando{" "}
                {pageData.length} de {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-xl font-semibold">
              Pallet {selected.identificador || selected.id}
            </h2>
            <span className="px-3 py-1 bg-gray-100 rounded text-sm">
              Estado: {selected.estado || "—"}
            </span>
            {!isClosed && (
              <button
                onClick={cerrarPallet}
                disabled={closing}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
              >
                {closing ? "Cerrando..." : "Cerrar pallet"}
              </button>
            )}
            <button
              onClick={deletePallet}
              disabled={deleting}
              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>

          {detailLoading ? (
            <div className="text-sm text-gray-600">Cargando detalle...</div>
          ) : bultos.length === 0 ? (
            <div className="text-sm text-gray-600">Este pallet no tiene bultos.</div>
          ) : (
            <>
              <Table columns={bultosColumns} data={bultos} />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Total de bultos</p>
                  <p className="text-lg font-semibold">{totals.totalBultos}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Total de unidades</p>
                  <p className="text-lg font-semibold">
                    {totals.totalUnidades.toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-500">Peso total</p>
                  <p className="text-lg font-semibold">
                    {totals.pesoTotal.toLocaleString("es-CL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    kg
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
