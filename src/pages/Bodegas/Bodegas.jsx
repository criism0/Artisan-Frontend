import { ViewDetailButton, EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";

export default function BodegasPage() {
  const [bodegas, setBodegas] = useState([]);
  const [filteredBodegas, setFilteredBodegas] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const apiFetch = useApi();

  const columns = [
    { header: "ID", accessor: "id" },
    { header: "Bodega", accessor: "bodega" },
  ];

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await apiFetch(`/bodegas`, { method: "GET" });
        const body = (await res?.json?.()) ?? res?.data ?? res ?? {};
        const lista = Array.isArray(body?.bodegas) ? body.bodegas
                    : Array.isArray(body?.data)    ? body.data
                    : [];

        const bodegasData = lista.map((bodega) => ({
          id: bodega.id,
          bodega: bodega.nombre,
        }));

        setBodegas(bodegasData);
        setFilteredBodegas(bodegasData);
      } catch (error) {
        console.error("Error fetching bodegas:", error);
      }
    };

    fetchBodegas();
  }, [apiFetch]);

  const handleDeleteBodega = async (id) => {
    try {
      const res = await apiFetch(`/bodegas/${id}`, { method: "DELETE" });
      const st = res?.status ?? 200;
      if (st < 200 || st >= 300) {
        const body = (await res?.json?.()) ?? res?.data ?? {};
        const msg = body?.message || body?.error || "Error eliminando bodega.";
        throw new Error(msg);
      }

      setBodegas((prev) => prev.filter((b) => b.id !== id));
      setFilteredBodegas((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Error eliminando bodega:", error);
    }
  };

  const handleSearch = (query) => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) {
      setFilteredBodegas(bodegas);
      return;
    }

    const filtered = bodegas.filter((bodega) =>
      Object.values(bodega).some((value) =>
        value != null && String(value).toLowerCase().includes(lowercasedQuery)
      )
    );

    setFilteredBodegas(filtered);
  };

  const handleRowsChange = (value) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(filteredBodegas.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredBodegas.slice(startIndex, startIndex + rowsPerPage);

  const actions = (row) => (
    <div className="flex gap-2">
      <ViewDetailButton onClick={() => navigate(`/Bodegas/${row.id}`)} tooltipText="Ver detalle" />
      <EditButton onClick={() => navigate(`/Bodegas/${row.id}/edit`)} tooltipText="Editar Bodega" />
      <TrashButton onConfirmDelete={() => handleDeleteBodega(row.id)} tooltipText="Eliminar Bodega" entityName="bodega"/>
    </div>
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text">Bodegas</h1>
      </div>

      <div className="flex justify-between items-center mb-6">
        <RowsPerPageSelector onRowsChange={handleRowsChange} />
        <SearchBar onSearch={handleSearch} />
      </div>

      <Table columns={columns} data={paginatedData} actions={actions} />

      <div className="mt-6 flex justify-between items-center">
        <button
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
          onClick={() => navigate("/Bodegas/add")}
        >
          Añadir Bodega
        </button>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

