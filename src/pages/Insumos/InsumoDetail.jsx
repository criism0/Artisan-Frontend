import { useParams, useNavigate } from "react-router-dom";
import { ModifyButton, TrashButton, BackButton, EditButton, ToggleActiveButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import Table from "../../components/Table";

export default function InsumoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [insumo, setInsumo] = useState(null);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    const fetchInsumo = async () => {
      try {
        const response = await api(`/materias-primas/${id}`);
        setInsumo(response);
        console.log(response);
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