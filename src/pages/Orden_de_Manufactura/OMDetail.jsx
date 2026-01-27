import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, apiBlob } from "../../lib/api";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { toast } from "../../lib/toast";
import { downloadBlob } from "../../lib/downloadBlob";
import { FileDown, Pencil } from "lucide-react";
import HistorialPasosModal from "./modals/HistorialPasosModal";
import HistorialBultosModal from "./modals/HistorialBultosModal";
import HistorialCostosModal from "./modals/HistorialCostosModal";

const CATEGORIAS = [
  { value: "I", label: "Insumos (I)" },
  { value: "PIP", label: "PIP" },
  { value: "PT", label: "PT" },
  { value: "M", label: "Merma (M)" },
];

function getBodegaNombre(b) {
  return b?.Bodega?.nombre ?? b?.bodega?.nombre ?? "(sin bodega)";
}

function getItemNombre(b) {
  return (
    b?.materiaPrima?.nombre ??
    b?.MateriaPrima?.nombre ??
    b?.loteProductoFinal?.productoBase?.nombre ??
    b?.LoteProductoFinal?.productoBase?.nombre ??
    "Desconocido"
  );
}

function getUnidadMedida(b) {
  return (
    b?.materiaPrima?.unidad_medida ??
    b?.MateriaPrima?.unidad_medida ??
    b?.loteProductoFinal?.productoBase?.unidad_medida ??
    b?.LoteProductoFinal?.productoBase?.unidad_medida ??
    ""
  );
}

function getClaveCategoria(b) {
  return b?.clave_categoria ?? (b?.es_merma ? "M" : b?.categoria) ?? "";
}

function BadgeCategoria({ value }) {
  const v = value || "";
  const base =
    "inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-semibold";
  if (v === "M") return <span className={`${base} bg-red-100 text-red-700`}>M</span>;
  if (v === "PT") return <span className={`${base} bg-green-100 text-green-700`}>PT</span>;
  if (v === "PIP") return <span className={`${base} bg-amber-100 text-amber-800`}>PIP</span>;
  if (v === "I") return <span className={`${base} bg-blue-100 text-blue-700`}>I</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
}

function BadgeEstadoPVA({ value }) {
  const v = String(value || "").toLowerCase();
  const base = "px-2 py-0.5 rounded-full text-xs font-semibold";
  if (!v) return <span className={`${base} bg-gray-100 text-gray-600`}>—</span>;
  if (v.includes("pend")) return <span className={`${base} bg-amber-100 text-amber-800`}>Pendiente</span>;
  if (v.includes("progres") || v.includes("ejec") || v.includes("inici"))
    return <span className={`${base} bg-blue-100 text-blue-700`}>En progreso</span>;
  if (v.includes("termin") || v.includes("complet"))
    return <span className={`${base} bg-green-100 text-green-700`}>Completado</span>;
  if (v.includes("cancel")) return <span className={`${base} bg-red-100 text-red-700`}>Cancelado</span>;
  return <span className={`${base} bg-gray-100 text-gray-600`}>{value}</span>;
}

export default function OMDetail() {
  const { id } = useParams();
  const [om, setOM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productosFinales, setProductosFinales] = useState([]);
  const [loteProductoEnProceso, setLoteProductoEnProceso] = useState(null);
  const [subproductos, setSubproductos] = useState([]);
  const [consumoInsumos, setConsumoInsumos] = useState([]);
  const [bultosAsociados, setBultosAsociados] = useState([]);
  const [loadingBultos, setLoadingBultos] = useState(false);
  const [pautasPVA, setPautasPVA] = useState([]);
  const [loadingPVA, setLoadingPVA] = useState(false);
  const [selectedBultoIds, setSelectedBultoIds] = useState(() => new Set());
  const [showSubproductos, setShowSubproductos] = useState(false);
  const [showHistorialPasos, setShowHistorialPasos] = useState(false);
  const [showHistorialBultos, setShowHistorialBultos] = useState(false);
  const [showHistorialCostos, setShowHistorialCostos] = useState(false);
  const [insumosAsignados, setInsumosAsignados] = useState(false);
  const [tieneRegistrosInsumo, setTieneRegistrosInsumo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOM = async () => {
      try {
        const response = await api(`/ordenes_manufactura/${id}`);
        setOM(response);
      } catch {
        setError("Error al cargar la Orden de Manufactura");
      } finally {
        setLoading(false);
      }
    };

    const fetchProductosFinales = async () => {
      try {
        const res = await api(`/ordenes_manufactura/${id}/productos_finales`);
        setProductosFinales(res.productosFinales || []);
        setSubproductos(res.subproductos || []);
        setLoteProductoEnProceso(res.loteProductoEnProceso || null);

        const loteId = Number(res?.loteProductoEnProceso?.id);
        if (Number.isFinite(loteId) && loteId > 0) {
          setLoadingPVA(true);
          try {
            const pautas = await api(`/pautas-valor-agregado/lote?id_lote_producto_en_proceso=${loteId}`);
            setPautasPVA(Array.isArray(pautas) ? pautas : []);
          } catch {
            setPautasPVA([]);
          } finally {
            setLoadingPVA(false);
          }
        } else {
          setPautasPVA([]);
        }
      } catch {
        setProductosFinales([]);
        setSubproductos([]);
        setLoteProductoEnProceso(null);
        setPautasPVA([]);
      }
    };

    const fetchBultosAsociados = async () => {
      try {
        setLoadingBultos(true);
        const res = await api(`/ordenes_manufactura/${id}/bultos`);
        setBultosAsociados(Array.isArray(res?.bultos) ? res.bultos : []);
        setSelectedBultoIds(new Set());
      } catch {
        setBultosAsociados([]);
        setSelectedBultoIds(new Set());
      } finally {
        setLoadingBultos(false);
      }
    };

    const fetchInsumos = async () => {
      try {
        const res = await api(`/registros-insumo-produccion?id_orden_manufactura=${id}`);
        const registros = res.registros || [];
        setConsumoInsumos(Array.isArray(registros) ? registros : []);
        setTieneRegistrosInsumo(registros.length > 0);

        // Si no hay registros de insumo, no hay nada que asignar.
        const todosAsignados = registros.length === 0 ? true : registros.every((insumo) => {
          const pesoUtilizado = Number(insumo.peso_utilizado) || 0;
          const pesoNecesario = Number(insumo.peso_necesario) || 0;

          if (pesoNecesario === 0) {
            return pesoUtilizado > 0.0001;
          }

          const diferencia = Math.abs(pesoUtilizado - pesoNecesario);
          const tolerancia = Math.max(0.0001, pesoNecesario * 0.01);

          return pesoUtilizado > 0.0001 && diferencia <= tolerancia;
        });
        setInsumosAsignados(todosAsignados);
      } catch {
        setInsumosAsignados(false);
        setTieneRegistrosInsumo(false);
        setConsumoInsumos([]);
      }
    };

    fetchOM();
    fetchProductosFinales();
    fetchInsumos();
    fetchBultosAsociados();
  }, [id]);

  const descargarEtiquetas = async (ids, filename) => {
    const idsNum = (Array.isArray(ids) ? ids : [ids])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    if (idsNum.length === 0) return toast.error("No hay bultos/cajas para etiquetar.");

    try {
      const blob = await apiBlob(`/bultos/etiquetas`, {
        method: "POST",
        body: JSON.stringify({ ids_bultos: idsNum }),
      });
      downloadBlob(blob, filename || `etiquetas_OM_${id}.pdf`);
    } catch (err) {
      toast.error(err?.message || "No se pudieron descargar las etiquetas.");
    }
  };

  const toggleSelectAllBultos = (checked) => {
    if (!checked) {
      setSelectedBultoIds(new Set());
      return;
    }
    const next = new Set();
    (bultosAsociados || []).forEach((b) => {
      if (b?.id) next.add(b.id);
    });
    setSelectedBultoIds(next);
  };

  const toggleSelectOneBulto = (bultoId, checked) => {
    setSelectedBultoIds((prev) => {
      const next = new Set(prev);
      if (!checked) next.delete(bultoId);
      else next.add(bultoId);
      return next;
    });
  };

  if (loading)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  if (error)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  if (!om)
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center text-gray-500">
        No se encontró la Orden de Manufactura
      </div>
    );

  const getEstadoBadge = (estado) => {
    if (!estado) return "";
    const normalized = estado.toLowerCase();
    const base = "px-3 py-1 rounded-full text-sm font-medium";
    switch (normalized) {
      case "borrador":
        return (
          <span className={`${base} bg-gray-200 text-gray-700`}>Borrador</span>
        );
      case "insumos asignados":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            Insumos asignados
          </span>
        );
      case "en ejecución":
        return (
          <span className={`${base} bg-cyan-100 text-cyan-700`}>
            En ejecución
          </span>
        );
      case "esperando salidas":
        return (
          <span className={`${base} bg-orange-100 text-orange-700`}>
            Esperando salidas
          </span>
        );
      case "esperando pvas":
        return (
          <span className={`${base} bg-purple-100 text-purple-700`}>
            Esperando PVAs
          </span>
        );
      case "cerrada":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>Cerrada</span>
        );
      default:
        return (
          <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>
        );
    }
  };

  const estado = om.estado;
  const hasPasos = (om?.registrosPasoProduccion?.length ?? 0) > 0;
  const esPostCierre = ["Cerrada", "Esperando PVAs"].includes(estado);

  const pesoObjetivo = Number(om?.peso_objetivo || 0);
  const pesoObtenido = Number(om?.peso_obtenido || 0);
  const pesoSubproductos = (Array.isArray(subproductos) ? subproductos : [])
    .reduce((acc, sp) => acc + Number(sp?.peso || 0), 0);
  const pesoTotalSalidaRendimiento = pesoObtenido + pesoSubproductos;
  const pesoMerma = Number.isFinite(Number(om?.peso_merma))
    ? Number(om?.peso_merma)
    : (pesoObjetivo ? (pesoObjetivo - pesoTotalSalidaRendimiento) : 0);
  const rendimientoPeso = Number.isFinite(Number(om?.rendimiento_peso))
    ? Number(om?.rendimiento_peso)
    : (pesoObjetivo > 0 ? (pesoTotalSalidaRendimiento / pesoObjetivo) : null);
  const costoTotal = Number(om?.costo_total || 0);
  const costoPorKg = pesoObtenido > 0 ? (costoTotal / pesoObtenido) : null;

  const fechaVencimiento = (() => {
    const fromPT = productosFinales?.[0]?.loteProductoFinal?.fecha_vencimiento;
    const fromPIP = loteProductoEnProceso?.fecha_vencimiento;
    return fromPT || fromPIP || null;
  })();

  // Cálculo de progreso
  const totalInsumos = (consumoInsumos || []).length || 0;
  const insumosConsumidos = (consumoInsumos || []).filter((r) => Number(r?.peso_utilizado || 0) > 0).length || 0;
  const porcentajeInsumos = totalInsumos > 0 ? Math.round((insumosConsumidos / totalInsumos) * 100) : 0;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Orden_de_Manufactura" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Orden de Manufactura: {om.id}</h1>
        <div>{getEstadoBadge(om.estado)}</div>
      </div>

      {/* Panel de estado rápido: 4 tarjetas informativas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {/* Receta */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
          <div className="text-xs text-gray-500 font-medium">RECETA</div>
          <div className="font-bold text-text mt-1">{om.receta?.nombre || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">
            Costo ref: ${Number(om.receta?.costo_referencial_produccion || 0).toFixed(2)}
          </div>
        </div>

        {/* Progreso de ingredientes */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 font-medium">INGREDIENTES</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${porcentajeInsumos}%` }}
                ></div>
              </div>
            </div>
            <span className="text-sm font-bold">{porcentajeInsumos}%</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">{insumosConsumidos}/{totalInsumos} consumidos</div>
        </div>

        {/* Costos */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 font-medium">COSTO TOTAL</div>
          <div className="text-lg font-bold text-text mt-1">${Number(om.costo_total || 0).toFixed(2)}</div>
          <div className="text-xs text-gray-600 mt-2">
            Objetivo: {om.peso_objetivo || 0} kg
          </div>
        </div>

        {/* Información de estado */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 font-medium">ENCARGADO</div>
          <div className="font-bold text-text mt-1">{om.elaboradorEncargado?.nombre || "—"}</div>
          <div className="text-xs text-gray-600 mt-2">
            Bodega: {om.bodega?.nombre || "—"}
          </div>
        </div>
      </div>

      {esPostCierre ? (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-text">Resumen de cierre</h2>
            <div className="text-xs text-gray-500">
              {fechaVencimiento ? `Vence: ${new Date(fechaVencimiento).toLocaleDateString()}` : "—"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Peso objetivo</div>
              <div className="text-lg font-bold text-text">{pesoObjetivo.toFixed(2)} kg</div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Peso obtenido</div>
              <div className="text-lg font-bold text-text">{pesoObtenido.toFixed(2)} kg</div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Subproductos</div>
              <div className="text-lg font-bold text-text">{pesoSubproductos.toFixed(2)} kg</div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Salida total (rendimiento)</div>
              <div className="text-lg font-bold text-text">{pesoTotalSalidaRendimiento.toFixed(2)} kg</div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Merma (no inventariada)</div>
              <div className={`text-lg font-bold ${pesoMerma > 0.0001 ? "text-orange-700" : "text-text"}`}>
                {Number.isFinite(pesoMerma) ? `${pesoMerma.toFixed(2)} kg` : "—"}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Rendimiento (peso)</div>
              <div className="text-lg font-bold text-text">
                {rendimientoPeso == null ? "—" : `${(Number(rendimientoPeso) * 100).toFixed(2)}%`}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Costo total</div>
              <div className="text-lg font-bold text-text">${costoTotal.toFixed(2)}</div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-border p-3">
              <div className="text-xs text-gray-500 font-medium">Costo por kg (sobre peso obtenido)</div>
              <div className="text-lg font-bold text-text">
                {costoPorKg == null ? "—" : `$${costoPorKg.toFixed(4)}`}
              </div>
            </div>
          </div>

          {Array.isArray(bultosAsociados) && bultosAsociados.length > 0 ? (
            <div className="mt-3 text-xs text-gray-600">
              Salidas registradas: {bultosAsociados.filter((b) => getClaveCategoria(b) === "PT").length} PT · {bultosAsociados.filter((b) => getClaveCategoria(b) === "PIP").length} PIP · {bultosAsociados.filter((b) => getClaveCategoria(b) === "M").length} Merma
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Bultos / Cajas asociados + etiquetas (estilo Inventario, sin filtros) */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-base font-semibold text-text">Bultos / Cajas generados</h2>
            <div className="text-xs text-gray-600">
              {loadingBultos
                ? "Cargando…"
                : `Filas: ${(bultosAsociados || []).length} · Seleccionadas: ${selectedBultoIds.size}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 bg-white border border-border rounded-lg hover:bg-gray-100 text-sm disabled:opacity-50"
              onClick={() => descargarEtiquetas(Array.from(selectedBultoIds), `etiquetas_OM_${id}_seleccion.pdf`)}
              disabled={loadingBultos || selectedBultoIds.size === 0}
              title="Descargar etiquetas de seleccionados"
            >
              Descargar seleccionados
            </button>
            <button
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium shadow disabled:opacity-50"
              onClick={() => descargarEtiquetas((bultosAsociados || []).map((b) => b.id), `etiquetas_OM_${id}.pdf`)}
              disabled={loadingBultos || (bultosAsociados || []).length === 0}
              title="Descargar etiquetas de todos"
            >
              Descargar todo
            </button>
          </div>
        </div>

        {loadingBultos ? (
          <div className="text-sm text-gray-600">Cargando bultos…</div>
        ) : (bultosAsociados || []).length === 0 ? (
          <div className="text-sm text-gray-600">Aún no hay bultos/cajas asociados a esta OM.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border w-10 text-center">
                    <input
                      type="checkbox"
                      checked={(bultosAsociados || []).length > 0 && selectedBultoIds.size === (bultosAsociados || []).length}
                      onChange={(e) => toggleSelectAllBultos(e.target.checked)}
                      aria-label="Seleccionar todo"
                    />
                  </th>
                  <th className="p-2 border text-center">Cat</th>
                  <th className="p-2 border">ID</th>
                  <th className="p-2 border">Identificador</th>
                  <th className="p-2 border">Item</th>
                  <th className="p-2 border">Bodega</th>
                  <th className="p-2 border">Formato</th>
                  <th className="p-2 border">Disponible</th>
                  <th className="p-2 border">Rango</th>
                  <th className="p-2 border w-28 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(bultosAsociados || []).map((b) => {
                  const clave = getClaveCategoria(b);
                  const nombre = getItemNombre(b);
                  const bodegaNombre = getBodegaNombre(b);
                  const unidad = getUnidadMedida(b);

                  const checked = selectedBultoIds.has(b.id);

                  const peso = Number(b?.peso_unitario ?? 0);
                  const unidades = Number(b?.cantidad_unidades ?? 0);
                  const disp = Number(b?.unidades_disponibles ?? 0);
                  const rangos = Array.isArray(b?.cajaRangos) ? b.cajaRangos : [];
                  const rangoTxt = rangos.length
                    ? `${Number(rangos[0]?.nro_inicio || 0)}-${Number(rangos[rangos.length - 1]?.nro_fin || 0)}`
                    : "—";

                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="p-2 border text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleSelectOneBulto(b.id, e.target.checked)}
                          aria-label={`Seleccionar bulto ${b?.identificador || b?.id}`}
                        />
                      </td>
                      <td className="p-2 border text-center">
                        <BadgeCategoria value={clave} />
                      </td>
                      <td className="p-2 border">{b.id}</td>
                      <td className="p-2 border font-mono text-xs">{b?.identificador || "—"}</td>
                      <td className="p-2 border">{nombre}</td>
                      <td className="p-2 border">{bodegaNombre}</td>
                      <td className="p-2 border">
                        {Number.isFinite(peso) ? peso.toFixed(2) : "0.00"} {unidad || "kg"}
                      </td>
                      <td className="p-2 border">
                        <div className="font-medium">{Number.isFinite(disp) ? disp : 0} un.</div>
                        <div className="text-xs text-gray-500">({disp}/{unidades} un.)</div>
                      </td>
                      <td className="p-2 border">{rangoTxt}</td>
                      <td className="p-2 border text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => descargarEtiquetas([b.id], `etiqueta_${b?.identificador || b.id}.pdf`)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Descargar etiqueta"
                          >
                            <FileDown className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => navigate(`/Inventario/bultos/editar/${b.id}`)}
                            className="text-gray-400 hover:text-blue-600"
                            title="Editar bulto"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PVAs (ordenado, acciones directas) */}
      {loteProductoEnProceso ? (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h2 className="text-base font-semibold text-text">PVAs del PIP</h2>
              <div className="text-xs text-gray-600">
                Lote PIP #{loteProductoEnProceso?.id} · Estado PVA: {loteProductoEnProceso?.estado_PVA || "—"}
              </div>
            </div>
          </div>

          {loadingPVA ? (
            <div className="text-sm text-gray-600">Cargando PVAs…</div>
          ) : (pautasPVA || []).length === 0 ? (
            <div className="text-sm text-gray-600">Este PIP no tiene PVAs asociados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Orden</th>
                    <th className="p-2 border">Proceso</th>
                    <th className="p-2 border text-center">Estado</th>
                    <th className="p-2 border w-56 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pautasPVA]
                    .sort((a, b) => Number(a?.pvaPorProducto?.orden || 0) - Number(b?.pvaPorProducto?.orden || 0))
                    .map((p) => {
                      const orden = Number(p?.pvaPorProducto?.orden || 0) || "—";
                      const procesoObj = p?.pvaPorProducto?.procesoValorAgregado;
                      const nombreProceso =
                        procesoObj?.nombre ||
                        procesoObj?.descripcion ||
                        `Proceso #${p?.id_proceso || "—"}`;

                      const utilizaInsumos =
                        Boolean(procesoObj?.utiliza_insumos) ||
                        (p?.pvaPorProducto?.insumosPVAProductos?.length ?? 0) > 0;

                      const estadoLower = String(p?.estado || "").toLowerCase();
                      const estaPendiente = estadoLower.includes("pend");
                      const estaCompletada = estadoLower.includes("complet");

                      const hayPreviasIncompletas = [...pautasPVA].some((prev) => {
                        const prevOrden = Number(prev?.pvaPorProducto?.orden || 0);
                        if (!prevOrden) return false;
                        if (prevOrden >= Number(p?.pvaPorProducto?.orden || 0)) return false;
                        const st = String(prev?.estado || "").toLowerCase();
                        return !st.includes("complet");
                      });

                      const comenzarYejecutar = async () => {
                        if (!p?.id) {
                          toast.error("Pauta inválida");
                          return;
                        }

                        if (hayPreviasIncompletas) {
                          toast.error("Debes completar los PVAs anteriores antes de ejecutar este.");
                          return;
                        }

                        try {
                          if (estaPendiente) {
                            await api(`/pautas-valor-agregado/${p.id}/comenzar`, { method: "PUT" });
                          }
                          navigate(`/PautasValorAgregado/ejecutar/${p.id}`);
                        } catch (err) {
                          const msg = err?.error || err?.message;
                          toast.error(msg || "No se pudo comenzar la pauta");
                        }
                      };

                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-2 border">{orden}</td>
                          <td className="p-2 border">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="font-medium text-text">PVA: {nombreProceso}</div>
                              <div className="text-xs text-gray-400">#{p.id}</div>
                            </div>
                          </td>
                          <td className="p-2 border text-center">
                            <BadgeEstadoPVA value={p?.estado} />
                          </td>
                          <td className="p-2 border">
                            <div className="flex items-center justify-center gap-2">
                              {utilizaInsumos ? (
                                <button
                                  className="px-3 py-2 bg-white border border-border rounded hover:bg-gray-100 text-sm"
                                  onClick={() => navigate(`/PautasValorAgregado/asignar-insumos/${p.id}`)}
                                >
                                  Insumos
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="px-3 py-2 bg-gray-100 text-gray-500 border border-border rounded text-sm cursor-not-allowed"
                                  disabled
                                  title="Este proceso no utiliza insumos"
                                >
                                  Sin insumos
                                </button>
                              )}
                              <button
                                className="px-3 py-2 bg-primary text-white rounded hover:bg-hover text-sm shadow disabled:opacity-60"
                                disabled={estaCompletada || hayPreviasIncompletas}
                                title={hayPreviasIncompletas ? "Debes completar los PVAs anteriores" : undefined}
                                onClick={() => void comenzarYejecutar()}
                              >
                                {estaPendiente ? "Comenzar" : "Ejecutar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="bg-gray-200 p-4 rounded-lg hidden">
        <table className="w-full bg-white rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-100 text-sm text-gray-600">
            <tr>
              <th className="px-6 py-3 text-xl font-semibold text-left mb-2">INFORMACIÓN</th>
              <th className="px-6 py-3 text-xl font-semibold text-left mb-2">DATO</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Producto / PIP</td>
              <td className="px-6 py-4 text-sm text-text">
                {om.productoBase?.nombre || om.materiaPrima?.nombre || om.receta?.nombre || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Encargado</td>
              <td className="px-6 py-4 text-sm text-text">
                {om.elaboradorEncargado?.nombre || om.id_elaborador_encargado || "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Bodega</td>
              <td className="px-6 py-4 text-sm text-text">{om.bodega?.nombre || om.id_bodega || "—"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Fecha</td>
              <td className="px-6 py-4 text-sm text-text">
                {om.fecha ? new Date(om.fecha).toLocaleDateString() : "—"}
              </td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Peso objetivo</td>
              <td className="px-6 py-4 text-sm text-text">{om.peso_objetivo ? `${om.peso_objetivo} kg` : "—"}</td>
            </tr>
            {esPostCierre && (
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Peso obtenido</td>
                <td className="px-6 py-4 text-sm text-text">{om.peso_obtenido ? `${om.peso_obtenido} kg` : "—"}</td>
              </tr>
            )}
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Costo referencial</td>
              <td className="px-6 py-4 text-sm text-text">{om.receta?.costo_referencial_produccion != null ? `$${om.receta.costo_referencial_produccion}` : "—"}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-6 py-4 text-sm font-medium text-text">Costo total</td>
              <td className="px-6 py-4 text-sm text-text">{om.costo_total != null ? `$${om.costo_total}` : "—"}</td>
            </tr>
            {esPostCierre && om.peso_objetivo && om.peso_obtenido && (
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Rendimiento</td>
                <td className="px-6 py-4 text-sm text-text">{((om.peso_obtenido / om.peso_objetivo) * 100).toFixed(2)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {estado === "Borrador" && !insumosAsignados && tieneRegistrosInsumo && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium shadow"
            onClick={() => navigate(`/Orden_de_Manufactura/${id}/insumos`)}
          >
            ➜ Asignar Insumos
          </button>
        )}

        {(hasPasos && (insumosAsignados || [
          "Insumos Asignados",
          "En ejecución",
          "Validada",
          "Completado",
          "Esperando Salidas",
        ].includes(estado)) && !["Cerrada", "Esperando PVAs"].includes(estado)) && (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium shadow"
              onClick={() => navigate(`/Orden_de_Manufactura/${id}/pasos`)}
            >
              ▶ Ejecutar Pasos
            </button>
          )}

        {["Esperando Salidas"].includes(estado) && subproductos.length > 0 && (
          <button
            className="px-4 py-2 bg-yellow-400 text-yellow-700 rounded-lg hover:bg-yellow-500 font-medium shadow"
            onClick={() =>
              navigate(`/Orden_de_Manufactura/${id}/subproductos-decision`)
            }
          >
            ⚠ Verificar Subproductos
          </button>
        )}

        {(
          ["Completado", "Esperando Salidas"].includes(estado) ||
          (!hasPasos && estado === "Insumos Asignados")
        ) && (
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium shadow"
            onClick={() =>
              navigate(`/Orden_de_Manufactura/${id}/produccion-final`)
            }
          >
            ✓ Producción Final
          </button>
        )}

        {["Cerrada", "Esperando PVAs"].includes(estado) && subproductos.length > 0 && (
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium shadow"
            onClick={() => setShowSubproductos(true)}
          >
            📦 Ver Subproductos
          </button>
        )}

        {["Cerrada", "Esperando PVAs"].includes(estado) && (
          <button
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium shadow"
            onClick={() => setShowHistorialPasos(true)}
          >
            📋 Historial de Pasos
          </button>
        )}

        {tieneRegistrosInsumo && (
          <button
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-black font-medium shadow"
            onClick={() => setShowHistorialBultos(true)}
          >
            🧾 Historial de Bultos
          </button>
        )}

        <button
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-medium shadow"
          onClick={() => setShowHistorialCostos(true)}
        >
          💰 Historial de Costos
        </button>
      </div>

      <HistorialPasosModal
        open={showHistorialPasos}
        omId={id}
        onClose={() => setShowHistorialPasos(false)}
      />

      <HistorialBultosModal
        open={showHistorialBultos}
        omId={id}
        onClose={() => setShowHistorialBultos(false)}
      />

      <HistorialCostosModal
        open={showHistorialCostos}
        omId={id}
        onClose={() => setShowHistorialCostos(false)}
      />

      {productosFinales && productosFinales.length > 0 && (
        <div className="mt-8 bg-gray-200 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-text">Productos finales</h2>
          </div>
          <table className="w-full bg-white rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-100 text-sm text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Producto
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Peso (kg)
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Peso Referencial (kg)
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Fecha Vencimiento
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text">
                  Costo
                </th>
              </tr>
            </thead>
            <tbody>
              {productosFinales.map((prod) => (
                <tr key={prod.id} className="border-b border-border">
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.productoBase?.nombre || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.peso_unitario}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.productoBase?.peso_unitario || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {prod.loteProductoFinal?.fecha_vencimiento
                      ? new Date(prod.loteProductoFinal?.fecha_vencimiento).toLocaleDateString()
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {(prod.costo_unitario).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subproductos Modal */}
      {showSubproductos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Subproductos Registrados</h2>
                <button
                  onClick={() => setShowSubproductos(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {subproductos.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No se encontraron subproductos registrados.
                </div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    // Group subproductos by materia prima ID
                    const groupedSubproductos = subproductos.reduce((acc, subproducto) => {
                      const materiaPrimaId = subproducto.id_materia_prima;
                      if (!acc[materiaPrimaId]) {
                        acc[materiaPrimaId] = [];
                      }
                      acc[materiaPrimaId].push(subproducto);
                      return acc;
                    }, {});

                    return Object.entries(groupedSubproductos).map(([materiaPrimaId, subproductosGroup]) => {
                      // Calculate totals for this group
                      const totalPeso = subproductosGroup.reduce((sum, sp) => sum + sp.peso, 0);
                      const allBultos = subproductosGroup.flatMap(sp => sp.RegistroSubproductoBultos || []);

                      return (
                        <div key={materiaPrimaId} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-medium text-gray-800">
                              Materia Prima: {subproductosGroup[0].materiaPrima?.nombre || "-"}
                            </h3>
                            <span className="text-sm text-gray-500">
                              {subproductosGroup.length} registro{subproductosGroup.length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Peso Total:</span>
                              <p className="text-gray-800">{totalPeso} kg</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Fecha Elaboración:</span>
                              <p className="text-gray-800">
                                {new Date(subproductosGroup[0].fecha_elaboracion).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Fecha Vencimiento:</span>
                              <p className="text-gray-800">
                                {new Date(subproductosGroup[0].fecha_vencimiento).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {/* Bultos de todos los subproductos de esta materia prima */}
                          {allBultos.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Bultos Asociados ({allBultos.length}):</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-300">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Identificador</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Cantidad Unidades</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Peso Unitario</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Unidades Disponibles</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left text-sm">Precio Unitario</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allBultos.map((bulto) => (
                                      <tr key={bulto.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.identificador}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.cantidad_unidades}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.peso_unitario} kg
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          {bulto.unidades_disponibles}
                                        </td>
                                        <td className="border border-gray-300 px-3 py-2 text-sm">
                                          ${bulto.precio_unitario}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
