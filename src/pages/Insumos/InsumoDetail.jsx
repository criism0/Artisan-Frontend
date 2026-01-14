import { useParams, useNavigate } from "react-router-dom";
import { ModifyButton, TrashButton, BackButton, EditButton, ToggleActiveButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Table from "../../components/Table";
import TabButton from "../../components/Wizard/TabButton";

export default function InsumoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [insumo, setInsumo] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [tab, setTab] = useState("datos");

  const [recetaId, setRecetaId] = useState(null);
  const [receta, setReceta] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [subproductos, setSubproductos] = useState([]);
  const [recetaCostos, setRecetaCostos] = useState([]);
  const [pautas, setPautas] = useState([]);

  useEffect(() => {
    const fetchInsumo = async () => {
      try {
        const response = await api(`/materias-primas/${id}`);
        setInsumo(response);
      } catch (error) {
        console.error("Error fetching insumo:", error);
      }
    };

    const fetchProveedores = async () => {
      try {
        const response = await api(
      `/proveedor-materia-prima/por-materia-prima?id_materia_prima=${id}`, {method: "GET"}
    );
        const proveedoresActivos = Array.isArray(response) 
          ? response.filter((p) => p.proveedor?.activo === true)
          : [];
        setProveedores(proveedoresActivos);
      } catch (error) {
        console.error("Error al obtener proveedores del insumo:", error);
      }
    };

    fetchInsumo();
    fetchProveedores();
  }, [id]);

  useEffect(() => {
    const loadRecetaPip = async () => {
      try {
        if (!insumo) return;
        const isPip = insumo?.categoria?.nombre === "PIP";
        if (!isPip) return;

        const [pautasRes, recetasRes] = await Promise.all([
          api("/pautas-elaboracion"),
          api(`/recetas/buscar-por-id-producto-base?id_materia_prima=${id}`),
        ]);
        setPautas(Array.isArray(pautasRes) ? pautasRes : []);

        const recetasList = Array.isArray(recetasRes) ? recetasRes : [];
        const recetaBase = recetasList[0] || null;
        if (!recetaBase?.id) {
          setRecetaId(null);
          setReceta(null);
          setIngredientes([]);
          setSubproductos([]);
          setRecetaCostos([]);
          return;
        }

        const rid = recetaBase.id;
        setRecetaId(rid);
        const [recetaFull, ings, subs, costos] = await Promise.all([
          api(`/recetas/${rid}`),
          api(`/recetas/${rid}/ingredientes`),
          api(`/recetas/${rid}/subproductos`),
          api(`/recetas/${rid}/costos-indirectos`),
        ]);
        setReceta(recetaFull);
        setIngredientes(Array.isArray(ings) ? ings : []);
        setSubproductos(Array.isArray(subs) ? subs : []);
        setRecetaCostos(Array.isArray(costos) ? costos : []);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar la receta asociada al PIP");
      }
    };

    void loadRecetaPip();
  }, [api, id, insumo]);

  const handleToggleActiveInsumo = async (insumoId) => {
    try {
      const res = await api(`/materias-primas/${insumoId}/toggle-active`, { method: "PUT" });
      const updated = res;
      
      // Actualizar el insumo principal
      setInsumo(prev => ({ ...prev, activo: updated.activo }));
    } catch (error) {
      toast.error('Error activando/desactivando insumo:', error);
    }
  };

  const handleDeleteAssociation = async (associationId) => {
    try {
      await api(`/proveedor-materia-prima/por-materia-prima/${associationId}`, { method: "DELETE" });
      toast.success("Asociación eliminada correctamente.");
      setProveedores(prev => prev.filter(p => p.id !== associationId));
      
    } catch (error) {
      toast.error("Error eliminando asociación:", error);
    }
  };

  const actions = (row) => (
    <div className="flex gap-2">
      <EditButton
        tooltipText="Editar Asociación"
        onClick={() => navigate(`/Insumos/asociar/edit/${row.id}`)}
      />
      <TrashButton
        tooltipText="Eliminar Asociación"
        onConfirmDelete={() => handleDeleteAssociation(row.id)}
        entityName="Asociación"
      />
    </div>
  );

  if (!insumo) return <div>Cargando...</div>;

  const isPip = insumo?.categoria?.nombre === "PIP";

  const insumoInfo = {
    "ID": insumo.id,
    "Nombre": insumo.nombre,
    "Categoría": insumo.categoria.nombre || 'Sin categoría',
    "Unidad de Medida": insumo.unidad_medida,
    "Stock Crítico": insumo.stock_critico,
    "Activo": insumo.activo ? "Activo" : "Inactivo"
  };

  const proveedoresData = proveedores.map(proveedor => ({
    id: proveedor.id,
    nombre_empresa: proveedor.proveedor.nombre_empresa,
    nombre_formato: proveedor.formato,
    contiene: proveedor.es_unidad_consumo 
      ? `${proveedor.cantidad_por_formato} ${proveedor.unidad_medida}`
      : `${proveedor.cantidad_hijos} ${proveedor.formatoHijo ? proveedor.formatoHijo.formato : 'Unidades'}${proveedor.cantidad_hijos !== 1 ? 's' : ''}`,
    precio_unitario: `${proveedor.precio_unitario} ${proveedor.moneda}`
  }));

  const columns = [
    { header: "Proveedor", accessor: "nombre_empresa" },
    { header: "Nombre Formato", accessor: "nombre_formato" },
    { header: "Contiene", accessor: "contiene" },
    { header: "Precio neto", accessor: "precio_unitario" }
  ];

  if (isPip) {
    const pautaSeleccionada = pautas.find((p) => String(p?.id) === String(receta?.id_pauta_elaboracion || ""));

    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="mb-4">
          <BackButton to="/Insumos" />
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Detalle del PIP</h1>
            <p className="text-sm text-gray-600 mt-1">
              Vista completa: datos → receta → ingredientes/subproductos → pauta → costos → proveedores.
            </p>
          </div>
          <div className="flex gap-4">
            <ModifyButton onClick={() => navigate(`/Insumos/${id}/edit`)} />
            <ToggleActiveButton
              isActive={insumo.activo === true}
              entityName={insumo.nombre || "PIP"}
              onToggleActive={() => handleToggleActiveInsumo(parseInt(id))}
              tooltipText={insumo.activo ? "Desactivar" : "Activar"}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>Datos</TabButton>
          <TabButton active={tab === "receta"} onClick={() => setTab("receta")}>Receta</TabButton>
          <TabButton active={tab === "ingredientes"} onClick={() => setTab("ingredientes")}>Ingredientes</TabButton>
          <TabButton active={tab === "pauta"} onClick={() => setTab("pauta")}>Pauta</TabButton>
          <TabButton active={tab === "costos"} onClick={() => setTab("costos")}>Costos</TabButton>
          <TabButton active={tab === "proveedores"} onClick={() => setTab("proveedores")}>Proveedores</TabButton>
        </div>

        {tab === "datos" ? (
          <div className="bg-gray-200 p-4 rounded-lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text mb-2">Información Principal</h2>
              <table className="w-full bg-white rounded-lg shadow overflow-hidden">
                <tbody>
                  {Object.entries(insumoInfo).map(([key, value]) => (
                    <tr key={key} className="border-b border-border">
                      <td className="px-6 py-4 text-sm font-medium text-text">{key}</td>
                      <td className="px-6 py-4 text-sm text-text">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "receta" ? (
          <div className="bg-white p-6 rounded-lg shadow space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-text">Receta asociada</h2>
              {recetaId ? (
                <button
                  type="button"
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                  onClick={() => navigate(`/Recetas/${recetaId}`)}
                >
                  Abrir receta
                </button>
              ) : null}
            </div>
            {!recetaId ? (
              <div className="text-sm text-gray-600">Este PIP no tiene receta asociada.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="font-semibold">Nombre:</span> {receta?.nombre || "—"}</div>
                <div><span className="font-semibold">Unidad:</span> {receta?.unidad_medida || insumo?.unidad_medida || "—"}</div>
                <div><span className="font-semibold">Peso:</span> {receta?.peso ?? "—"}</div>
                <div><span className="font-semibold">Costo referencial:</span> {receta?.costo_referencial_produccion ?? "—"}</div>
                <div className="md:col-span-2"><span className="font-semibold">Descripción:</span> {receta?.descripcion || "—"}</div>
              </div>
            )}
          </div>
        ) : null}

        {tab === "ingredientes" ? (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-text mb-2">Ingredientes</h2>
              {ingredientes.length === 0 ? (
                <div className="text-sm text-gray-600">Sin ingredientes.</div>
              ) : (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Materia prima</th>
                      <th className="px-3 py-2 text-left">Peso</th>
                      <th className="px-3 py-2 text-left">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredientes.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="px-3 py-2">{i?.materiaPrima?.nombre || "—"}</td>
                        <td className="px-3 py-2">{i?.peso ?? "—"}</td>
                        <td className="px-3 py-2">{i?.unidad_medida || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-text mb-2">Subproductos</h2>
              {subproductos.length === 0 ? (
                <div className="text-sm text-gray-600">Sin subproductos.</div>
              ) : (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Materia prima</th>
                      <th className="px-3 py-2 text-left">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subproductos.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2">{s?.nombre || "—"}</td>
                        <td className="px-3 py-2">{s?.unidad_medida || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        {tab === "pauta" ? (
          <div className="bg-white p-6 rounded-lg shadow space-y-2">
            <h2 className="text-xl font-semibold text-text">Pauta de elaboración</h2>
            {!recetaId ? (
              <div className="text-sm text-gray-600">No hay receta para asignar pauta.</div>
            ) : receta?.id_pauta_elaboracion ? (
              <div className="text-sm">
                <div><span className="font-semibold">ID:</span> {receta.id_pauta_elaboracion}</div>
                <div><span className="font-semibold">Nombre:</span> {pautaSeleccionada?.name || "—"}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">La receta no tiene pauta asignada.</div>
            )}
          </div>
        ) : null}

        {tab === "costos" ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-text mb-2">Costos indirectos</h2>
            {recetaCostos.length === 0 ? (
              <div className="text-sm text-gray-600">Sin costos indirectos.</div>
            ) : (
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Costo $/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {recetaCostos.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2">{c?.nombre || "—"}</td>
                      <td className="px-3 py-2">{c?.RecetaCostoIndirecto?.costo_por_kg ?? c?.recetaCostoIndirecto?.costo_por_kg ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {tab === "proveedores" ? (
          <div className="bg-gray-200 p-4 rounded-lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text mb-2">Proveedores Asociados</h2>
              <Table data={proveedoresData} columns={columns} actions={actions} />
              <div className="mt-4">
                <button
                  onClick={() => navigate(`/Insumos/asociar/${id}`)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
                >
                  + Asociar Nuevo Proveedor
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Insumos"/>
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle del Insumo</h1>
        <div className="flex gap-4">
          <ModifyButton onClick={() => navigate(`/Insumos/${id}/edit`)} />
          <ToggleActiveButton
            isActive={insumo.activo === true}
            entityName={insumo.nombre || "Insumo"}
            onToggleActive={() => handleToggleActiveInsumo(parseInt(id))}
            tooltipText={insumo.activo ? "Desactivar Insumo" : "Activar Insumo"}
          />
        </div>
      </div>

      <div className="bg-gray-200 p-4 rounded-lg">
        {/* Información Principal */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text mb-2">Información Principal</h2>
          <table className="w-full bg-white rounded-lg shadow overflow-hidden">
            <tbody>
              {Object.entries(insumoInfo).map(([key, value]) => (
                <tr key={key} className="border-b border-border">
                  <td className="px-6 py-4 text-sm font-medium text-text">{key}</td>
                  <td className="px-6 py-4 text-sm text-text">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tabla de Proveedores */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text mb-2">Proveedores Asociados</h2>
          <Table 
            data={proveedoresData}
            columns={columns}
            actions={actions}
          />
          <div className="mt-4">
            <button
              onClick={() => navigate(`/Insumos/asociar/${id}`)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
            >
              + Asociar Nuevo Proveedor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 