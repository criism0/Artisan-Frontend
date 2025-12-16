
// src/pages/compras/RecepcionarOrden.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { getToken, API_BASE, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";


export default function RecepcionarOrden() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const { ordenId } = useParams();
  const [ordenData, setOrdenData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [_hasPartialReception, setHasPartialReception] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [bultosGenerados, setBultosGenerados] = useState([]);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const fechaActual = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setIsLoading(true);
    const fetchOrden = async () => {
      try {
        const token = getToken();
        const response = await fetch(
          `${API_BASE}/proceso-compra/ordenes/${ordenId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Error al obtener orden");

        const raw = await response.json();

        const insumosTransformados = raw.materiasPrimas.map((mp) => ({
          id_proveedor_materia_prima: mp.id_proveedor_materia_prima,
          nombre:
            mp.proveedorMateriaPrima?.materiaPrima?.nombre ||
            mp.proveedorMateriaPrima?.MateriaPrima?.nombre ||
            "—",
          formato:
            mp.proveedorMateriaPrima?.formato ||
            mp.formato ||
            "",
          unidad_medida:
            mp.proveedorMateriaPrima?.unidad_medida ||
            mp.proveedorMateriaPrima?.materiaPrima?.unidad_medida ||
            "",
          cantidad_solicitada: mp.cantidad_formato,
          cantidad_recibida: 0,
          bultos: 0,
          precio_unitario: mp.precio_unitario,
        }));

        setOrdenData({
          ...raw,
          proveedor: raw.proveedor?.nombre_empresa || raw.id_proveedor,
          lugar: raw.BodegaSolicitante?.nombre || "-",
          numero: `OC-${String(raw.id).padStart(3, "0")}`,
          fecha_recepcion: fechaActual,
          numero_factura: "",
          fecha_documento: "",
          guia_despacho: "",
          insumos: insumosTransformados,
        });
      } catch (error) {
        toast.error("Error al cargar la orden:", error);
        alert("No se pudo cargar la orden de compra.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrden();
  }, [ordenId]);

  const emailSender = async (ordenId) => {
    try {
      const ordenData = await api(
        `/proceso-compra/ordenes/${ordenId}`, { method: "GET" }
      );
      const bodegaId = ordenData.BodegaSolicitante?.id;
      let encargados = [];
      if (bodegaId) {
        const bodegaData = await api(
          `/bodegas/${bodegaId}`, { method: "GET" }
        );
        encargados = Array.isArray(bodegaData?.Encargados) ? bodegaData.Encargados : [];
      }
      // Destinatarios y nombres para el template
      const to = encargados
        .map((e) => e?.usuario?.email)
        .filter(Boolean)
        .map((email) => ({ email }));
      const encargadosNames =
        encargados.map((e) => e?.usuario?.nombre).filter(Boolean).join(", ") || "Sin encargados";

      let newState = ordenData.estado;
      if (ordenData.estado === "Rechazada") {
        newState = ordenData.estado + (ordenData.motivo_rechazo ? ` - ${ordenData.motivo_rechazo}` : "");
      }

      // Enviar correo de notificación
      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: ordenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: newState || "Estado desconocido",
        bodega: ordenData.BodegaSolicitante?.nombre || "No especificada",
        clientNames: encargadosNames || "",
      });
    } catch (emailError) {
      console.error("Error enviando correo de notificación:", emailError);
      }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    setOrdenData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCantidadChange = (insumoId, newCantidad) => {
    setOrdenData((prev) => {
      const updatedInsumos = prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima === insumoId) {
          return {
            ...insumo,
            cantidad_recibida: parseInt(newCantidad) || 0,
          };
        }
        return insumo;
      });

      const hasPartial = updatedInsumos.some(
        (insumo) => insumo.cantidad_recibida < insumo.cantidad_solicitada
      );
      setHasPartialReception(hasPartial);

      return {
        ...prev,
        insumos: updatedInsumos,
      };
    });
  };

  const handleBultosChange = (insumoId, newBultos) => {
    setOrdenData((prev) => ({
      ...prev,
      insumos: prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima === insumoId) {
          return {
            ...insumo,
            bultos: parseInt(newBultos) || 0,
          };
        }
        return insumo;
      }),
    }));
  };

  const validarNumeroFactura = (valor) => {
    const regexFacturas = /^\d+(,\s*\d+)*$/;
    return regexFacturas.test(valor);
  };

  const handleFinalizarRecepcion = async () => {
    const newErrors = {};
    if (!ordenData.fecha_recepcion)
      newErrors.fecha_recepcion = "La fecha de recepción es obligatoria.";
    if (!ordenData.fecha_documento)
      newErrors.fecha_documento = "La fecha del documento es obligatoria.";
    if (new Date(ordenData.fecha_recepcion) < new Date(ordenData.fecha_documento))
      newErrors.fecha_recepcion = "La fecha de recepción no puede ser anterior a la del documento.";
    if (!ordenData.numero_factura && !ordenData.guia_despacho) {
      newErrors.numero_factura = "Debe ingresar número de factura o guía de despacho.";
      newErrors.guia_despacho = "Debe ingresar número de factura o guía de despacho.";
    }
    if (ordenData.numero_factura && ordenData.guia_despacho) {
      newErrors.numero_factura = "No puede ingresar factura y guía de despacho al mismo tiempo.";
      newErrors.guia_despacho = "No puede ingresar factura y guía de despacho al mismo tiempo.";
    }
    if (
      ordenData.numero_factura &&
      !validarNumeroFactura(ordenData.numero_factura)
    ) {
      newErrors.numero_factura =
        "Formato inválido. Use solo números separados por comas (ej: 1234, 1235, 1236).";
    }

    const tieneRecInsumo = ordenData.insumos.some(
      (i) => i.cantidad_recibida > 0
    );
    const tieneRecBulto = ordenData.insumos.some(
      (i) => i.bultos > 0
    );
    if (!tieneRecInsumo)
      newErrors.insumos = "Debe recepcionar al menos un insumo.";
    if (!tieneRecBulto)
      newErrors.insumos = "Debe recepcionar al menos un bulto.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Por favor corrija los errores en el formulario.");
      return;
    }

    try {
      const token = getToken();

      const payload = {
        pagada: true,
        fecha_recepcion: ordenData.fecha_recepcion,
        numero_factura: ordenData.numero_factura,
        fecha_documento: ordenData.fecha_documento,
        guia_despacho: ordenData.guia_despacho,
        materias_primas_recepcionadas: ordenData.insumos.map((insumo) => ({
          id_proveedor_materia_prima: insumo.id_proveedor_materia_prima,
          cantidad_recepcionada: insumo.cantidad_recibida,
          cantidad_bultos: insumo.bultos,
        })),
      };

      const response = await api(
        `/proceso-compra/ordenes/${ordenId}/recepcionar`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      if (!response || response.error) throw new Error("Error al recepcionar");

      setBultosGenerados(response.bultos || []);
      setShowConfirmation(true);
      toast.success("Orden recepcionada correctamente");
      try {
        emailSender(ordenId);
      } catch (emailErr) {
        toast.error("Error enviando email tras validar orden:" + emailErr);
      }
    } catch (error) {
      toast.error("Error al recepcionar la orden: " + error);
    }
  };

  const handleRechazarRecepcion = async () => {
    const newErrors = {};
    if (!rejectReason.trim()) {
      newErrors.rejectReason = "Debe ingresar una razón para el rechazo.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/proceso-compra/ordenes/${ordenId}/rechazar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ motivo_rechazo: rejectReason.trim() }),
        }
      );

      if (!response.ok) throw new Error("Error al rechazar la orden.");
      setShowRejectPopup(false);
      toast.success("Orden rechazada correctamente");
      try {
        emailSender(ordenId);
      } catch (emailErr) {
        toast.error("Error enviando email tras validar orden:", emailErr);
      }
      navigate("/Ordenes");
    } catch (error) {
      toast.error("No se pudo rechazar la orden." + error);
    }
  };

  const columns = [
    {
      header: "Insumo",
      accessor: "nombre",
      Cell: ({ row }) => {
        const formato = row.formato?.trim?.() || "";
        const nombre = row.nombre?.trim?.() || "—";
        const unidad = row.unidad_medida?.trim?.() || "";

        // Si formato = nombre → mostrar "(unidad) de nombre"
        if (formato && nombre && formato.toLowerCase() === nombre.toLowerCase()) {
          return `${unidad ? `${unidad} - ` : ""} ${nombre}`;
        }

        // Si formato distinto → "(formato) de nombre"
        return `${formato ? `${formato} - ` : ""} ${nombre}`;
      },
    },
    { header: "Cantidad Solicitada", accessor: "cantidad_solicitada" },
    { header: "Cantidad Recibida", accessor: "cantidad_recibida", Cell: ({ row }) => (
        <input
          type="number"
          min="0"
          value={row.cantidad_recibida || ""}
          placeholder="0"
          onChange={(e) =>
            handleCantidadChange(
              row.id_proveedor_materia_prima,
              e.target.value
            )
          }
          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
        />
      ),
    },
    { header: "Bultos", accessor: "bultos", Cell: ({ row }) => (
        <input
          type="number"
          min="0"
          value={row.bultos || ""}
          placeholder="0"
          onChange={(e) =>
            handleBultosChange(row.id_proveedor_materia_prima, e.target.value)
          }
          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
        />
      ),
    },
    { header: "Precio Neto", accessor: "precio_unitario", Cell: ({ value }) => `$${value.toLocaleString()}`,
    },
  ];

  if (isLoading || !ordenData) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex justify-center items-center h-64">
          <span className="text-text">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-4">
        Recepcionar Orden de Compra
      </h1>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 gap-4">
          {["proveedor", "lugar", "numero", "estado", "condiciones", "fecha"].map(
            (field) => {
              let label =
                field === "fecha"
                  ? "Fecha de emisión" 
                  : field.charAt(0).toUpperCase() + field.slice(1);

              let value = ordenData[field];

              if (field === "fecha" && value) {
                const date = new Date(value);
                value = date.toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }

              return (
                <div className="flex items-center" key={field}>
                  <label className="block text-sm font-medium text-gray-700 w-1/3">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={value || ""}
                    disabled
                    className="w-2/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              );
            }
          )}

          {[
            "fecha_recepcion",
            "numero_factura",
            "fecha_documento",
            "guia_despacho",
          ].map((field) => (
            <div className="flex flex-col" key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field
                  .replace("_", " ")
                  .replace("fecha", "Fecha")
                  .replace("numero", "Número")
                  .replace("guia", "Guía")}
              </label>
              <input
                type={field.includes("fecha") ? "date" : "text"}
                name={field}
                value={ordenData[field]}
                onChange={handleFormChange}
                placeholder={
                  field === "numero_factura"
                    ? "Si hay más de una factura, sepárelas con coma: 1234, 1235, 1236"
                    : ""
                }
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              {errors[field] && (
                <p className="text-red-600 text-sm mt-1">{errors[field]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg text-primary font-medium mb-4">Insumos</h2>
        {errors.insumos && (
          <p className="text-red-600 text-sm mb-2">{errors.insumos}</p>
        )}
        <Table columns={columns} data={ordenData.insumos} />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => setShowRejectPopup(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Rechazar Recepción
        </button>
        <button
          onClick={handleFinalizarRecepcion}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          Recepcionar
        </button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Orden Recepcionada
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              La orden ha sido recepcionada correctamente.
            </p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() =>
                  navigate(`/Ordenes/declarar-bultos/${ordenId}`, {
                    state: { bultos: bultosGenerados },
                  })
                }
              >
                Declarar bultos
              </button>
            </div>
          </div>
        </div>
      )}
      {showRejectPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Rechazar Recepción
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Indique las razones del rechazo:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
              placeholder="Escriba aquí las razones del rechazo..."
            />
            {errors.rejectReason && (
              <p className="text-red-600 text-sm mb-2">{errors.rejectReason}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectPopup(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazarRecepcion}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
