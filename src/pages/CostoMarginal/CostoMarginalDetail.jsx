import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";


export default function CostoMarginalDetail() {
    const { tipo, id } = useParams();
    const api = useApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bodegas, setBodegas] = useState([]);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                if (!tipo) {
                    setData(null);
                    setLoading(false);
                    return;
                }
                // Esta "hardcodeado" segun el tipo de producto. 
                // No existen otros productos aparte de estos dos.
                const tipo_request = tipo.includes("Final")
                    ? "ProductoFinal"
                    : (tipo.includes("Proceso")
                        ? "ProductoEnProceso"
                        : "SinTipo");
                const res = await api(`/costo-marginal/${id}?tipo=${tipo_request}`);
                setData(res ?? null);
            } catch (err) {
                console.error("Error fetching costo marginal detail:", err);
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
        // Cargar bodegas para mostrar nombre de bodega si existe orden.id_bodega
        const fetchBodegas = async () => {
            try {
                const b = await api('/bodegas');
                const list = Array.isArray(b?.bodegas) ? b.bodegas : Array.isArray(b) ? b : [];
                setBodegas(list);
            } catch (e) {
                setBodegas([]);
            }
        };
        fetchBodegas();
    }, [api, tipo, id]);

    if (loading) return <div className="p-6">Cargando...</div>;

    if (!data) {
        return (
            <div className="p-6">
                <BackButton to="/CostoMarginal" />
                <div className="text-lg font-semibold mb-2">Detalle Costo Marginal</div>
                <div className="text-sm text-gray-600">No se encontró información para este lote.</div>
            </div>
        );
    }

    const lote = data.lote || {};
    const orden = data.orden || {};
    const pautas = Array.isArray(data.pautas) ? data.pautas : [];
    const nombre = lote.productoBase?.nombre || lote.materiaPrima?.nombre || orden.receta?.nombre || "-";
    const costoTotal = lote.costo ?? null;
    const costoUnitario = lote.costo_unitario ?? null;

    return (
        <div className="p-6 bg-background min-h-screen">
            <BackButton to="/CostoMarginal" />
            <div className="bg-white rounded shadow p-6">
                <div className="flex flex-col justify-between text-center gap-4">
                    <div className="flex items-baseline justify-between gap-4">
                        <div>
                            <div className="text-sm text-gray-500">Lote</div>
                            <div className="font-semibold">#{lote.id ?? "-"}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Tipo</div>
                            <div className="font-medium">{tipo}</div>
                        </div>
                        {lote.estado_PVA && (
                            <div>
                                <div className="text-sm text-gray-500">Estado PVA</div>
                                <div className="font-medium text-gray-700">{lote.estado_PVA}</div>
                            </div>
                        )}
                        <div>
                            <div className="text-sm text-gray-500">Costo total</div>
                            <div className="font-medium">{costoTotal != null ? Number(costoTotal).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '-'}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Cantidad bultos</div>
                            <div className="font-medium">{lote.cantidad_bultos ?? '-'}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Costo unitario</div>
                            <div className="font-medium">{costoUnitario != null ? Number(costoUnitario).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '-'}</div>
                        </div>
                    </div>

                </div>

                <div className="mt-6">
                    <div className="text-sm text-gray-500">Nombre</div>
                    <div className="text-2xl font-bold mt-1">{nombre}</div>
                </div>

                <div className="mt-6">
                    <div className="text-lg font-bold mb-2">Orden de Manufactura</div>
                    {data.orden ? (
                        <div className="space-y-2">
                            <div>
                                <span className="font-semibold">ID Orden:</span> {orden.id ?? '-'}
                            </div>
                            <div>
                                <span className="font-semibold">Receta:</span> {orden.receta?.nombre || '-'}
                            </div>
                            <div>
                                <span className="font-semibold">Bodega:</span> {(() => {
                                    const idB = orden.id_bodega ?? null;
                                    const found = bodegas.find(b => (b.id ?? b._id) === idB || String(b.id) === String(idB));
                                    return found ? found.nombre : (idB ? `#${idB}` : '-');
                                })()}
                            </div>
                            <div>
                                <span className="font-semibold">Costo Total Orden:</span> {orden.costo_total != null ? Number(orden.costo_total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '-'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500">No hay información de la orden disponible.</div>
                    )}
                </div>

                <div className="mt-6">
                    <div className="text-lg font-bold mb-2">Proceso de Valor Agregado</div>
                    {pautas.length === 0 ? (
                        <div className="text-sm text-gray-500">No hay procesos de valor agregado para este producto</div>
                    ) : (

                        <ul className="divide-y">
                            {pautas.map((p) => (
                                <li key={p.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <span className="font-semibold">ID Pauta de PVA:</span> {p.id ?? '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Proceso de Valor Agregado:</span> {p.procesoValorAgregado?.descripcion || 'Paso'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Bodega:</span> {(() => {
                                            const idB = orden.id_bodega ?? null;
                                            const found = bodegas.find(b => (b.id ?? b._id) === idB || String(b.id) === String(idB));
                                            return found ? found.nombre : (idB ? `#${idB}` : '-');
                                        })()}
                                    </div>

                                    <div>
                                        <span className="font-semibold">Costo Pauta de PVA:</span> {p.costo_real != null ? Number(p.costo_real).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }) : '-'}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
