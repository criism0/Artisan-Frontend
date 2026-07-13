import { useState, useEffect } from "react";
import DataTable from "../../components/Tables/DataTable";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { toast } from "../../lib/toast";

export default function InventarioInsumos() {
  const { id_bodega } = useParams();
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventario = async () => {
      try {
        setLoading(true);
        const response = await api(`/inventario/${id_bodega}`);
        const inventarioData = (Array.isArray(response) ? response : []).map((item) => ({
          id: item.materiaPrima.id,
          insumo: item.materiaPrima.nombre,
          unidad: item.materiaPrima.unidad_medida,
          enInventario: item.cantidadDisponible,
          estado: item.estado,
          ultimoMovimientoRaw: item.ultimo_movimiento,
          ultimoMovimiento: new Date(item.ultimo_movimiento).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setInventario(inventarioData);
      } catch (error) {
        console.error("Error fetching inventario:", error);
        toast.error("Error al cargar el inventario");
      } finally {
        setLoading(false);
      }
    };

    if (id_bodega) {
      fetchInventario();
    } else {
      setLoading(false);
    }
  }, [id_bodega]);

  const columns = [
    { header: "Insumo", accessor: "insumo", sortable: true },
    { header: "Unidad", accessor: "unidad", sortable: true },
    { header: "En Inventario", accessor: "enInventario", sortable: true, align: "right" },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ value }) => (
        <span
          className={`px-2 py-1 rounded-full text-sm ${
            value === "Bien" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      header: "Último Movimiento",
      accessor: "ultimoMovimiento",
      sortable: true,
      sortValue: (row) =>
        row.ultimoMovimientoRaw ? new Date(row.ultimoMovimientoRaw).getTime() : 0,
    },
  ];

  return (
    <DataTable
      title={`Inventario de Insumos - ${id_bodega || "Global"}`}
      data={inventario}
      columns={columns}
      getSearchText={(i) => [i.insumo, i.unidad, i.estado].filter(Boolean).join(" ")}
      loading={loading}
      loadingMessage="Cargando inventario"
      initialSort={{ key: "insumo", direction: "asc" }}
      emptyMessage="No hay insumos en esta bodega."
    />
  );
}
