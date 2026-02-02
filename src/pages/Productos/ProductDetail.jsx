import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { ModifyButton, DeleteButton, BackButton } from "../../components/Buttons/ActionButtons";
import TabButton from "../../components/Wizard/TabButton";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [producto, setProducto] = useState(null);
  const [tab, setTab] = useState("datos");

  const [receta, setReceta] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [recetaCostos, setRecetaCostos] = useState([]);
  const [pautas, setPautas] = useState([]);
  const [formatosEmpaque, setFormatosEmpaque] = useState([]);

  const [pautaDetalle, setPautaDetalle] = useState(null);
  const [pautaPasosDetalle, setPautaPasosDetalle] = useState([]);
  const [pautaAnalisisDetalle, setPautaAnalisisDetalle] = useState(null);
  const [pautaDetalleLoading, setPautaDetalleLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [productoRes, recetasRes, pautasRes] = await Promise.all([
          api(`/productos-base/${id}`),
          api(`/recetas/buscar-por-id-producto-base?id_producto_base=${id}`),
          api(`/pautas-elaboracion`),
        ]);

        setProducto(productoRes || null);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);

        const recetasList = Array.isArray(recetasRes) ? recetasRes : [];
        const recetaBase = recetasList[0] || null;
        if (!recetaBase?.id) {
          setReceta(null);
          setIngredientes([]);
          setSubproductos([]);
          setRecetaCostos([]);
          return;
        }

        const recetaId = recetaBase.id;
        const [recetaFull, ings, subs, costos, formatos] = await Promise.all([
          api(`/recetas/${recetaId}`),
          api(`/recetas/${recetaId}/ingredientes`),
          api(`/recetas/${recetaId}/subproductos`),
          api(`/recetas/${recetaId}/costos-indirectos`),
          api(`/recetas/${recetaId}/formatos-empaque`).catch(() => []),
        ]);

        setReceta(recetaFull || recetaBase);
        setIngredientes(Array.isArray(ings) ? ings : []);
        setSubproductos(Array.isArray(subs) ? subs : []);
        setRecetaCostos(Array.isArray(costos) ? costos : []);
        setFormatosEmpaque(Array.isArray(formatos) ? formatos : []);
      } catch (error) {
        console.error("Error fetching producto:", error);
        toast.error("No se pudo cargar el detalle del producto");
      }
    };

    void load();
  }, [id, api]);

  useEffect(() => {
    const loadPautaDetalle = async () => {
      if (tab !== "pauta") return;
      const idPauta = receta?.id_pauta_elaboracion;
      if (!idPauta) {
        setPautaDetalle(null);
        setPautaPasosDetalle([]);
        setPautaAnalisisDetalle(null);
        return;
      }

      setPautaDetalleLoading(true);
      try {
        const [pautaRes, pasosRes, analisisRes] = await Promise.all([
          api(`/pautas-elaboracion/${idPauta}`),
          api(`/pasos-pauta-elaboracion/pauta/${idPauta}`).catch(() => []),
          api(`/analisis-sensorial/definicion/${idPauta}`).catch(() => null),
        ]);

        setPautaDetalle(pautaRes || null);
        setPautaPasosDetalle(
          (Array.isArray(pasosRes) ? pasosRes : []).slice().sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
        );
        setPautaAnalisisDetalle(analisisRes);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar el detalle de la pauta");
      } finally {
        setPautaDetalleLoading(false);
      }
    };

    void loadPautaDetalle();
  }, [api, receta?.id_pauta_elaboracion, tab]);

  const handleDeleteProduct = async () => {
    try {
      await api(`/productos-base/${id}`, { method: "DELETE" });
      toast.success("Producto eliminado");
      navigate('/Productos');
    } catch (error) {
      console.error('Error eliminando producto:', error);
      toast.error("Error eliminando producto");
    }
  };

  if (!producto) return <div>Cargando...</div>;

  const recetaPautaId = receta?.id_pauta_elaboracion ?? null;
  const pautaNombre = recetaPautaId
    ? pautas.find((p) => String(p?.id) === String(recetaPautaId))?.name || "—"
    : "Sin pauta asignada";

  const canGoReceta = !!receta?.id;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Productos" />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Detalle del Producto</h1>
          <p className="text-sm text-gray-600 mt-1">
            Vista completa: datos → receta → ingredientes/subproductos → costos secos → pauta → costos indirectos.
          </p>
        </div>
        <div className="flex gap-2">
          {receta?.id ? (
            <button
              type="button"
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => navigate(`/Recetas/${receta.id}`)}
            >
              Abrir receta
            </button>
          ) : null}
          <ModifyButton onClick={() => navigate(`/Productos/${id}/edit`)} />
          <DeleteButton
            baseUrl={`${import.meta.env.VITE_BACKEND_URL}/productos-base`}
            entityId={id}
            onConfirmDelete={handleDeleteProduct}
            tooltipText="Eliminar Producto"
            entityName="producto"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>Datos</TabButton>
        <TabButton active={tab === "receta"} disabled={!canGoReceta} onClick={() => setTab("receta")}>Receta</TabButton>
        <TabButton active={tab === "ingredientes"} disabled={!canGoReceta} onClick={() => setTab("ingredientes")}>Ingredientes</TabButton>
        <TabButton active={tab === "costos_secos"} disabled={!canGoReceta} onClick={() => setTab("costos_secos")}>Costos secos</TabButton>
        <TabButton active={tab === "pauta"} disabled={!canGoReceta} onClick={() => setTab("pauta")}>Pauta</TabButton>
        <TabButton active={tab === "costos"} disabled={!canGoReceta} onClick={() => setTab("costos")}>Costos indirectos</TabButton>
      </div>

      {tab === "datos" ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-text mb-4">Información del Producto</h2>
          <table className="w-full bg-white rounded-lg overflow-hidden border border-gray-200">
            <tbody>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">ID</td>
                <td className="px-6 py-4 text-sm text-text">{producto.id}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Nombre</td>
                <td className="px-6 py-4 text-sm text-text">{producto.nombre}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Cantidad</td>
                <td className="px-6 py-4 text-sm text-text">
                  {producto.peso_unitario} {producto.unidad_medida}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Descripción</td>
                <td className="px-6 py-4 text-sm text-text">{producto.descripcion}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Unidades por Caja</td>
                <td className="px-6 py-4 text-sm text-text">{producto.unidades_por_caja}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Código EAN</td>
                <td className="px-6 py-4 text-sm text-text">{producto.codigo_ean}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">Código SAP</td>
                <td className="px-6 py-4 text-sm text-text">{producto.codigo_sap}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "receta" ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-text mb-4">Información de la Receta</h2>
          {!receta ? (
            <div className="text-sm text-gray-600">Este producto no tiene receta asociada.</div>
          ) : (
            <table className="w-full bg-white rounded-lg overflow-hidden border border-gray-200">
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">ID Receta</td>
                  <td className="px-6 py-4 text-sm text-text">{receta.id}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">Nombre</td>
                  <td className="px-6 py-4 text-sm text-text">{receta.nombre}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">Descripción</td>
                  <td className="px-6 py-4 text-sm text-text">{receta.descripcion || "—"}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">Peso</td>
                  <td className="px-6 py-4 text-sm text-text">
                    {receta.peso} {receta.unidad_medida}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">Costo referencial</td>
                  <td className="px-6 py-4 text-sm text-text">{receta.costo_referencial_produccion ?? 0}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === "ingredientes" ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-text mb-4">Ingredientes</h2>
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              {ingredientes.length === 0 ? (
                <div className="p-4 text-sm text-gray-700">Sin ingredientes.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Materia prima</th>
                      <th className="px-4 py-2 text-left">Peso</th>
                      <th className="px-4 py-2 text-left">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientes.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="px-4 py-2">{i?.materiaPrima?.nombre || "—"}</td>
                        <td className="px-4 py-2">{i.peso}</td>
                        <td className="px-4 py-2">{i.unidad_medida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-text mb-4">Subproductos</h2>
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              {subproductos.length === 0 ? (
                <div className="p-4 text-sm text-gray-700">Sin subproductos.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Materia prima</th>
                      <th className="px-4 py-2 text-left">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subproductos.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-4 py-2">{s.nombre}</td>
                        <td className="px-4 py-2">{s.unidad_medida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "costos_secos" ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-text">Costos secos (formatos de empaque)</h2>
            {receta?.id ? (
              <button
                type="button"
                className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => navigate(`/Recetas/${receta.id}`)}
              >
                Administrar en receta
              </button>
            ) : null}
          </div>

          {formatosEmpaque.length === 0 ? (
            <div className="text-sm text-gray-600">Sin formatos de empaque configurados.</div>
          ) : (
            <div className="space-y-3">
              {formatosEmpaque.map((f) => (
                <div key={f.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text">{f?.nombre || `Formato #${f.id}`}</div>
                      <div className="text-xs text-gray-500">{f?.opcional ? "Opcional" : "Requerido"}</div>
                    </div>
                  </div>

                  {Array.isArray(f?.insumos) && f.insumos.length > 0 ? (
                    <div className="mt-3 overflow-x-auto border border-border rounded">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="text-left p-2">Insumo</th>
                            <th className="text-left p-2">UM</th>
                            <th className="text-left p-2">Opcional</th>
                            <th className="text-left p-2">Sug/unidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.insumos.map((mp) => (
                            <tr key={mp.id} className="border-t border-border">
                              <td className="p-2">{mp?.nombre || "—"}</td>
                              <td className="p-2">{mp?.unidad_medida || "—"}</td>
                              <td className="p-2">{mp?.FormatoEmpaqueInsumo?.opcional ? "Sí" : "No"}</td>
                              <td className="p-2">{mp?.FormatoEmpaqueInsumo?.cantidad_sugerida_por_unidad ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-gray-600">Este formato no tiene insumos.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "pauta" ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-xl font-semibold text-text">Pauta de Elaboración</h2>
            {recetaPautaId ? (
              <button
                type="button"
                className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                onClick={() => navigate(`/PautasElaboracion/${recetaPautaId}/edit`)}
              >
                Editar pauta
              </button>
            ) : null}
          </div>

          {!recetaPautaId ? (
            <div className="text-sm text-gray-600">La receta no tiene pauta asignada.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500">Nombre</div>
                  <div className="font-semibold text-gray-900">{pautaDetalle?.name || pautaNombre}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">ID</div>
                  <div className="font-mono text-gray-800">{recetaPautaId}</div>
                </div>
                <div className="md:col-span-3">
                  <div className="text-xs text-gray-500">Descripción</div>
                  <div className="text-gray-800">{pautaDetalle?.description || "—"}</div>
                </div>
              </div>

              {pautaDetalleLoading ? (
                <div className="text-sm text-gray-600">Cargando detalle de la pauta...</div>
              ) : (
                <>
                  <div className="border rounded-lg p-4">
                    <div className="font-semibold text-gray-900 mb-2">Pasos</div>
                    {pautaPasosDetalle.length === 0 ? (
                      <div className="text-sm text-gray-600">Sin pasos configurados.</div>
                    ) : (
                      <div className="space-y-2">
                        {pautaPasosDetalle.map((p) => (
                          <div key={p.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 border flex items-center justify-center text-sm font-semibold text-gray-700 flex-shrink-0">
                              {p.orden}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-gray-900">{p.descripcion || "—"}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {p.requires_ph ? "• pH" : ""}
                                {p.requires_temperature ? " • Temp" : ""}
                                {p.requires_obtained_quantity ? " • Cant. obtenida" : ""}
                                {!p.requires_ph && !p.requires_temperature && !p.requires_obtained_quantity ? "Sin controles" : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="font-semibold text-gray-900 mb-2">Análisis Sensorial</div>
                    {Array.isArray(pautaAnalisisDetalle?.campos_definicion) && pautaAnalisisDetalle.campos_definicion.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="text-left p-2">Etiqueta</th>
                              <th className="text-left p-2">Tipo</th>
                              <th className="text-left p-2">Obligatorio</th>
                              <th className="text-left p-2">Opciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pautaAnalisisDetalle.campos_definicion.map((c) => (
                              <tr key={c.nombre} className="border-t">
                                <td className="p-2 font-medium text-gray-900">{c.etiqueta || c.nombre}</td>
                                <td className="p-2 text-gray-700">{c.tipo}</td>
                                <td className="p-2 text-gray-700">{c.obligatorio ? "Sí" : "No"}</td>
                                <td className="p-2 text-gray-700">
                                  {c.tipo === "select" ? (c.opciones || []).join(", ") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">Sin análisis sensorial configurado.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}

      {tab === "costos" ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-text mb-4">Costos indirectos asociados (por kg)</h2>
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            {recetaCostos.length === 0 ? (
              <div className="p-4 text-sm text-gray-700">Sin costos indirectos asociados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-left">Costo $/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {recetaCostos.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-2">{c.nombre}</td>
                      <td className="px-4 py-2">
                        {c?.RecetaCostoIndirecto?.costo_por_kg ?? c?.recetaCostoIndirecto?.costo_por_kg ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
} 