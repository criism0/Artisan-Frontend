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

      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>1) Datos</TabButton>
        <TabButton active={tab === "receta"} disabled={!canGoReceta} onClick={() => setTab("receta")}>2) Receta</TabButton>
        <TabButton active={tab === "ingredientes"} disabled={!canGoReceta} onClick={() => setTab("ingredientes")}>3) Ingredientes</TabButton>
        <TabButton active={tab === "costos_secos"} disabled={!canGoReceta} onClick={() => setTab("costos_secos")}>4) Costos secos</TabButton>
        <TabButton active={tab === "pauta"} disabled={!canGoReceta} onClick={() => setTab("pauta")}>5) Pauta</TabButton>
        <TabButton active={tab === "costos"} disabled={!canGoReceta} onClick={() => setTab("costos")}>6) Costos indirectos</TabButton>
      </div>

      {tab === "datos" ? (
        <div className="bg-gray-200 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-text mb-2">Información del Producto</h2>
          <table className="w-full bg-white rounded-lg shadow overflow-hidden">
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
        <div className="bg-gray-200 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-text mb-2">Información de la Receta</h2>
          {!receta ? (
            <div className="bg-white p-4 rounded-lg shadow text-sm text-gray-700">Este producto no tiene receta asociada.</div>
          ) : (
            <table className="w-full bg-white rounded-lg shadow overflow-hidden">
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
          <div className="bg-gray-200 p-4 rounded-lg">
            <h2 className="text-xl font-semibold text-text mb-2">Ingredientes</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
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

          <div className="bg-gray-200 p-4 rounded-lg">
            <h2 className="text-xl font-semibold text-text mb-2">Subproductos</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
        <div className="bg-white p-6 rounded-lg shadow space-y-3">
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
        <div className="bg-gray-200 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-text mb-2">Pauta de Elaboración</h2>
          <div className="bg-white p-4 rounded-lg shadow text-sm text-gray-800">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-medium">Pauta asignada:</span>
              <span>{pautaNombre}</span>
              {recetaPautaId ? <span className="text-gray-500">(ID: {recetaPautaId})</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "costos" ? (
        <div className="bg-gray-200 p-4 rounded-lg">
          <h2 className="text-xl font-semibold text-text mb-2">Costos indirectos asociados (por kg)</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
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