import { useParams, useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useState, useEffect } from "react";
import axiosInstance from "../../axiosInstance";
import TablePallets from "../../components/TablePallets";

export default function PrepararPedido() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showBultosFor, setShowBultosFor] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [selects, setSelects] = useState({ id_materia_prima: "" });
  const [pesosAsignados, setPesosAsignados] = useState({});

  useEffect(() => {
    fetchSolicitud();
  }, [solicitudId]);

  const fetchSolicitud = async () => {
    try {
      const res = await axiosInstance.get(`/solicitudes-mercaderia/${solicitudId}`);
      setSolicitud(res.data);
    } catch {
      setError("Error al cargar los datos");
    }
  };

  const handleShowBultos = (palletId) => {
    setShowBultosFor(palletId);
    setBultos([]);
    setDisponibles([]);
    setSelects({ id_materia_prima: "" });
    setPesosAsignados({});
    fetchBultos(palletId);
  };

  const fetchBultos = async (palletId) => {
    try {
      const res = await axiosInstance.get(`/pallets/${palletId}`);
      setBultos(res.data.bultos || []);
    } catch {
      setError("Error al cargar bultos");
    }
  };

  const handleBuscarDisponibles = async () => {
    if (!selects.id_materia_prima) return setError("Selecciona una materia prima");
    try {
      const params = {
        id_bodega: solicitud.bodegaProveedora.id,
        id_materia_prima: selects.id_materia_prima,
      };
      const res = await axiosInstance.get("/bultos/disponibles", { params });
      setDisponibles(res.data);
    } catch {
      setError("Error buscando bultos disponibles");
    }
  };

  const handlePesoChange = (bultoId, pesoKg) => {
    setPesosAsignados((prev) => ({ ...prev, [bultoId]: pesoKg }));
  };

  const handleAddBulto = async (bulto) => {
    const pesoKg = Number(pesosAsignados[bulto.id]);
    if (!pesoKg || pesoKg <= 0) return setError("Ingresa un peso válido");

    setLoading(true);
    try {
      let bultoAAsignar = bulto.id;

      if (pesoKg < bulto.unidades_disponibles) {
        const res = await axiosInstance.post(`/bultos/${bulto.id}/dividir`, {
          divisiones: [pesoKg, bulto.unidades_disponibles - pesoKg],
        });
        const nuevos = res.data?.nuevos_bultos ?? res.data?.bultos ?? [];
        bultoAAsignar = nuevos[0].id;
      }

      await axiosInstance.post(`/pallets/${showBultosFor}/asociar-bulto`, {
        id_bulto: bultoAAsignar,
      });
      setSuccess("Bulto asignado correctamente");
      setTimeout(() => setSuccess(""), 3000);
      fetchBultos(showBultosFor);
    } catch (err) {
      console.error("asociar-bulto error:", err.response?.data || err);
      setError(err.response?.data?.error || "Error asignando bulto");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulto = async (bultoId) => {
    setLoading(true);
    try {
      await axiosInstance.delete(`/pallets/bulto/${bultoId}`);
      setSuccess("Bulto eliminado");
      setTimeout(() => setSuccess(""), 3000);
      fetchBultos(showBultosFor);
    } catch {
      setError("Error eliminando bulto");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePallet = async (palletId) => {
    setLoading(true);
    try {
      await axiosInstance.post(`/pallets/${palletId}/liberar-bultos`);
      await axiosInstance.delete(`/pallets/${palletId}`);
      setSuccess("Pallet eliminado");
      setTimeout(() => setSuccess(""), 3000);
      fetchSolicitud();
    } catch {
      setError("Error eliminando pallet");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleListaParaDespacho = async (solicitudId) => {
    try {
      await axiosInstance.put(`/solicitudes-mercaderia/${solicitudId}/lista-para-despacho`);
      setSuccess("Solicitud lista para despacho");
      setTimeout(() => navigate("/Solicitudes"), 1500);
    } catch (err) {
      console.error("Error al marcar como listo para despacho:", err.response?.data || err);
      setError(err.response?.data?.error || "Error modificando estado");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleCreatePallet = async () => {
    setLoading(true);
    try {
      if (solicitud.estado !== "En preparación") {
        await axiosInstance.put(`/solicitudes-mercaderia/${solicitudId}/preparar`);
      }
      await axiosInstance.post(`/pallets`, { id_solicitud_mercaderia: Number(solicitudId) });
      setSuccess("Pallet creado exitosamente");
      setTimeout(() => setSuccess(""), 3000);
      fetchSolicitud();
    } catch {
      setError("Error creando pallet");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePallet = async (palletId) => {
    setLoading(true);
    try {
      await axiosInstance.put(`/pallets/${palletId}/cerrar`);
      setSuccess("Pallet cerrado");
      setTimeout(() => setSuccess(""), 3000);
      setShowBultosFor(null);
      fetchSolicitud();
    } catch {
      setError("Error al cerrar pallet (¿faltan bultos?)");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!solicitud) return <div className="p-6">Cargando...</div>;

  const materiasPrimas = solicitud.detalles.map((d) => ({
    id: d.materiaPrima.id,
    nombre: d.materiaPrima.nombre,
  }));

  const pallets = solicitud.pallets || [];
  const palletsData = pallets.map((p) => ({
    id: p.id,
    estado: p.estado,
  }));
  const palletActivo = pallets.find((p) => p.id === showBultosFor)?.estado !== "Completado";

  const palletsColumns = [
    { header: "ID", accessor: "id" },
    { header: "Estado", accessor: "estado" },
    {
      header: "Acciones",
      accessor: "acciones",
      renderCell: ({ id }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleShowBultos(id)}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
          >
            Bultos
          </button>
          <button
            onClick={() => handleClosePallet(id)}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Cerrar
          </button>
          <button
            onClick={() => handleDeletePallet(id)}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  const bultosData = bultos.map((r) => ({
    identificador: r.identificador,
    cantidad: `${r.unidades_disponibles.toFixed(2)}`,
    acciones: palletActivo ? (
      <button
        onClick={() => handleDeleteBulto(r.id)}
        className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
      >
        Eliminar
      </button>
    ) : null,
  }));

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to={`/Solicitudes/${solicitudId}`} />
      <h1 className="mt-4 text-3xl font-bold mb-6">Preparar Pedido #{solicitudId}</h1>

      {error && <div className="text-red-500 mb-4 font-semibold">{error}</div>}
      {success && <div className="text-green-600 mb-4 font-semibold">{success}</div>}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Pallets en Preparación</h2>
        <button
          onClick={handleCreatePallet}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
        >
          Crear Pallet
        </button>
      </div>

      <TablePallets data={palletsData} columns={palletsColumns} />

      {showBultosFor && (
        <div className="mt-8 p-6 bg-white shadow rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Bultos del Pallet #{showBultosFor}</h2>

          {palletActivo && (
            <>
              <h3 className="text-lg font-semibold mb-2">Asignar Nuevos Bultos</h3>
              <div className="flex gap-4 mb-4">
                <select
                  value={selects.id_materia_prima}
                  onChange={(e) =>
                    setSelects({ ...selects, id_materia_prima: e.target.value })
                  }
                  className="border px-4 py-2 rounded-md w-full"
                >
                  <option value="">Selecciona Materia Prima</option>
                  {materiasPrimas.map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.nombre}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBuscarDisponibles}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                >
                  Buscar
                </button>
              </div>

              {disponibles.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-b py-3"
                >
                  <div className="flex-1 font-medium">
                    Bulto {b.identificador} –{" "}
                    {b.unidades_disponibles.toFixed(2)} {b.materiaPrima.unidad_medida} disponibles
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Cantidad a usar"
                    onChange={(e) =>
                      handlePesoChange(b.id, parseFloat(e.target.value))
                    }
                    className="p-2 border rounded-md w-40"
                  />
                  <button
                    onClick={() => handleAddBulto(b)}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </>
          )}

          <h4 className="mt-6 mb-2 font-semibold">Bultos Asignados:</h4>
          <TablePallets
            data={bultosData}
            columns={[
              { header: "Identificador", accessor: "identificador" },
              { header: "Cantidad", accessor: "cantidad" },
              { header: "Acciones", accessor: "acciones" },
            ]}
          />
        </div>
      )}

      {pallets.length > 0 && pallets.every((p) => p.estado === "Completado") && (
        <button
          onClick={() => handleListaParaDespacho(solicitudId)}
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Marcar Listo para Despacho
        </button>
      )}
    </div>
  );
}
