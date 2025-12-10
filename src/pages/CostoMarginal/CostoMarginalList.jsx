import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { ViewDetailButton } from "../../components/Buttons/ActionButtons";
import Selector from "../../components/Selector";

export default function CostoMarginalList() {
    const api = useApi();
    const navigate = useNavigate();
    const [bodegas, setBodegas] = useState([]);
    const [bodegaFilter, setBodegaFilter] = useState(0);
    const [items, setItems] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [query, setQuery] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [page, setPage] = useState(1);
    const [tipoFilter, setTipoFilter] = useState("todos");

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const res = await api(`/costo-marginal`);
                setItems(Array.isArray(res) ? res : []);
                setFiltered(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error("Error fetching costo marginal:", err);
            }
        };

        const fetchBodegas = async () => {
            try {
                const b = await api('/bodegas');
                const list = Array.isArray(b?.bodegas) ? b.bodegas : Array.isArray(b) ? b : [];
                setBodegas(list);
            } catch (e) {
                setBodegas([]);
            }
        };

        fetchAll();
        fetchBodegas();
    }, [api]);

    useEffect(() => {
        const apply = async () => {
            try {
                let data = items;

                if (bodegaFilter && +bodegaFilter > 0) {
                    const qTipo = tipoFilter && tipoFilter !== 'todos' ? `&tipo=${encodeURIComponent(tipoFilter)}` : '';
                    const res = await api(`/costo-marginal?id_bodega=${encodeURIComponent(bodegaFilter)}${qTipo}`);
                    data = Array.isArray(res) ? res : [];
                } else if (tipoFilter && tipoFilter !== 'todos') {
                    const res = await api(`/costo-marginal?tipo=${encodeURIComponent(tipoFilter)}`);
                    data = Array.isArray(res) ? res : [];
                }

                if (query && query.trim()) {
                    const q = query.toLowerCase();
                    data = data.filter((d) =>
                        (d.productoBase?.nombre || d.materiaPrima?.nombre || '').toString().toLowerCase().includes(q) 
                    );
                }
                setFiltered(data);
                setPage(1);
            } catch (err) {
                console.error(err);
            }
        };
        apply();
    }, [bodegaFilter, tipoFilter, query, items, api]);


    const columns = useMemo(() => [
        { header: "Lote - Tipo", accessor: "lote_tipo", Cell: ({ row }) => `${row.lote ?? row.id ?? '-'} - ${row.tipo ?? '-'}` },
        { header: "Nombre", accessor: "nombre_producto", Cell: ({ row }) => row.productoBase?.nombre || row.materiaPrima?.nombre || "-" },
        { header: "Bodega", accessor: "bodega", Cell: ({ row }) => {
            const idB = row?.orden?.id_bodega ?? row.id_bodega ?? row.idBodega ?? null;
            const b = bodegas.find(x => (x.id ?? x._id) === idB || String(x.id) === String(idB));
            return b ? b.nombre : (idB ? `#${idB}` : '-');
        } },
        { header: "Costo total", accessor: "costo", Cell: ({ row }) => {
            const v = row.costo ?? null;
            if (v == null) return "-";
            try { return Number(v).toLocaleString('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}); } catch { return `${v}`; }
        }},
        { header: "Acciones", accessor: "actions", Cell: ({ row }) => {
            const tipo = row.tipo;
            const id = row.id;
            return (
                <ViewDetailButton
                    onClick={() => navigate(`/CostoMarginal/${tipo}/${id}`)}
                    tooltipText="Ver detalle"
                />
            );
        }}
    ], [bodegas]);

    const tipoOptions = useMemo(() => [
        { value: 'todos', label: 'Todos' },
        { value: 'ProductoFinal', label: 'Producto Final' },
        { value: 'ProductoEnProceso', label: 'Producto en Proceso (PIP)' }
    ], []);

    const bodegaOptions = useMemo(() => {
        const base = [{ value: 0, label: 'Todas' }];
        const opts = bodegas
            // Harcodeado, ver como arreglar en general para omitir la bodega "en tránsito"
            .filter(b => b.nombre.toLowerCase() !== 'en tránsito')
            .map(b => ({ value: b.id ?? b._id, label: b.nombre }));
        return base.concat(opts);
    }, [bodegas]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const start = (page - 1) * rowsPerPage;
    const pageData = filtered.slice(start, start + rowsPerPage);

    return (
        <div className="p-6 bg-background min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Costo Marginal</h1>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo</label>
                    <Selector
                        options={tipoOptions}
                        selectedValue={tipoFilter}
                        onSelect={(v) => setTipoFilter(v)}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Bodega</label>
                    <Selector
                        options={bodegaOptions}
                        selectedValue={String(bodegaFilter)}
                        onSelect={(v) => setBodegaFilter(v)}
                        className="px-3 py-2 border border-gray-200 rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Buscar</label>
                    <SearchBar onSearch={(q) => setQuery(q)} />
                </div>
                <div className="flex items-end justify-center">
                    <RowsPerPageSelector onRowsChange={(v) => { setRowsPerPage(v); setPage(1); }} />
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded shadow">
                {filtered.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No hay valores que cumplan con esos filtros.</div>
                ) : (
                    <Table columns={columns} data={pageData} />
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
        </div>
    );
}
