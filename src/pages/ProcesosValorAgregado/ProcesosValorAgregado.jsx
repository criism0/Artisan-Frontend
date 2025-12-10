import {
    ViewDetailButton,
    EditButton,
    TrashButton,
} from "../../components/Buttons/ActionButtons";
import Table from "../../components/Table";
import SearchBar from "../../components/SearchBar";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import Pagination from "../../components/Pagination";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function ProcesosValorAgregado() {
    const navigate = useNavigate();
    const api = useApi();
    const [pvas, setPvas] = useState([]);
    const [filteredPvas, setFilteredPvas] = useState([]);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchPvas = async () => {
            setIsLoading(true);
            try {
                const response = await api(`/procesos-de-valor-agregado`, { method: "GET" });
                const sorted = response.sort((a, b) => a.id - b.id);
                setPvas(sorted);
                setFilteredPvas(sorted);
            } catch (err) {
                console.error("Error fetching pvas:", err);
                toast.error("No se pudo conectar al servidor. Verifica la conexión.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchPvas();
    }, [api]);

    const columns = [
        { header: "ID", accessor: "id" },
        { header: "NOMBRE", accessor: "descripcion" },
        { header: "COSTO ESTIMADO", accessor: "costo_estimado" },
        { header: "TIEMPO ESTIMADO", accessor: "tiempo_estimado_formateado" },
        { header: "TIENE PASOS", accessor: "tiene_pasos" },
        { header: "GENERA NUEVOS BULTOS", accessor: "genera_nuevos_bultos" },
        { header: "UTILIZA INSUMOS", accessor: "utiliza_insumos" },
    ];

    const handleSearch = (query) => {
        const lower = query.toLowerCase();
        const filtered = pvas.filter((p) =>
            Object.values(p).some((v) => String(v).toLowerCase().includes(lower))
        );
        setFilteredPvas(filtered);
        setCurrentPage(1);
    };

    const actions = (row) => (
        <div className="flex gap-2">
            <ViewDetailButton
                onClick={() => navigate(`/ProcesosValorAgregado/${row.id}`)}
                tooltipText="Ver detalle"
            />
            <EditButton
                onClick={() => navigate(`/ProcesosValorAgregado/${row.id}/edit`)}
                tooltipText="Editar Proceso"
            />
            <TrashButton
            onConfirmDelete={() => navigate(`/ProcesosValorAgregado/${row.id}/delete`)}
            tooltipText="Eliminar Proceso Valor Agregado"
            entityName="proceso valor agregado"
            />


        </div>
    );

    const totalPages = Math.ceil(filteredPvas.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = filteredPvas.slice(
        startIndex,
        startIndex + rowsPerPage
    );

    const formattedData = paginatedData.map((p) => ({
        ...p,
        tiempo_estimado_formateado: p.tiempo_estimado
            ? `${p.tiempo_estimado} ${p.unidad_tiempo || ""}`
            : "-",
        tiene_pasos: p.tiene_pasos ? "Sí" : "No",
        genera_nuevos_bultos: p.genera_bultos_nuevos ? "Sí" : "No",
        utiliza_insumos: p.utiliza_insumos ? "Sí" : "No",
    }));

    return (
        <div className="p-6 bg-background min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-text">Procesos de Valor Agregado</h1>
                <button
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                    onClick={() => navigate("/ProcesosValorAgregado/add")}
                >
                    Añadir Proceso
                </button>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center mb-6">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    <span className="ml-3 text-purple-500">Cargando procesos...</span>
                </div>
            )}

            {!isLoading && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <RowsPerPageSelector
                            onRowsChange={(value) => {
                                setRowsPerPage(value);
                                setCurrentPage(1);
                            }}
                            defaultRows={25}
                            options={[25, 50, 100]}
                        />
                        <SearchBar onSearch={handleSearch} placeholder="Buscar proceso..." />
                    </div>

                    <Table
                        columns={columns}
                        data={formattedData}
                        actions={actions}
                        actionHeader="OPCIONES"
                    />

                    <div className="mt-6 flex justify-end">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                </>
            )}
        </div>
    );
}