import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import ConfirmModal from "../../components/ConfirmModal";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { uploadToS3 } from "../../lib/uploadToS3";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";

export default function CrearOrden() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useApi();
  // Calcular la fecha mínima permitida (hoy - 3 meses) de forma robusta
  const hoy = new Date();
  const fechaActual = hoy.toISOString().split("T")[0];
  const tresMesesAntes = new Date(hoy);
  tresMesesAntes.setMonth(hoy.getMonth() - 3);
  const minFecha = tresMesesAntes.toISOString().split('T')[0];
  const [proveedores, setProveedores] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);
  const [form, setForm] = useState({
    id_proveedor: "",
    fecha: fechaActual,
    condiciones: "",
    requiere_prepago: false,
    archivosAdjuntos: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [showInsumoError, setShowInsumoError] = useState(false);
  const [insumoErrorMsg, setInsumoErrorMsg] = useState("");

  const total_neto = insumosSeleccionados.reduce(
    (acc, item) => acc + item.cantidad_formato * item.precio_unitario,
    0
  );
  const iva = Math.round(total_neto * 0.19);
  const total_pago = total_neto + iva;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const provRes = await api(`/proveedores`);
       
        const proveedoresData = Array.isArray(provRes?.data)
          ? provRes.data
          : provRes?.data?.proveedores || provRes || [];

        const proveedoresActivos = proveedoresData.filter((p) => p.activo === true);

        setProveedores(proveedoresActivos);

      } catch (error) {
        toast.error("Error al cargar datos iniciales:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchInsumos = async () => {
      if (!form.id_proveedor) return;
      try {
        const res = await api(`/proveedores/${form.id_proveedor}`, { method: "GET" });
        const activos = res.materiasPrimas?.filter((i) => i.materiaPrima?.activo === true);
        setMateriasPrimas(activos || []);
        console.log("Insumos del proveedor cargados:", activos);
      } catch (error) {
        toast.error("Error al cargar materias primas del proveedor:", error);
        setMateriasPrimas([]);
      }
    };
    fetchInsumos();
  }, [form.id_proveedor]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      const nuevosArchivos = Array.from(files);
      setForm((prev) => ({
        ...prev,
        [name]: [
          ...prev.archivosAdjuntos,
          ...nuevosArchivos.filter(
            (nuevo) => !prev.archivosAdjuntos.some((existente) => existente.name === nuevo.name)
          ),
        ],
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRemoveFile = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      archivosAdjuntos: prev.archivosAdjuntos.filter((_, i) => i !== indexToRemove),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.id_proveedor) errors.id_proveedor = "Debe seleccionar un proveedor.";
    if (!form.fecha) {
      errors.fecha = "Debe ingresar una fecha.";
    } else {
      // Validar que la fecha no sea más de 3 meses antes de la fecha actual
      const fechaOrden = new Date(form.fecha);
      const hoy = new Date();
      const tresMesesAntes = new Date(hoy);
      tresMesesAntes.setMonth(hoy.getMonth() - 3);
      if (fechaOrden < tresMesesAntes) {
        errors.fecha = "La fecha no puede ser anterior a 3 meses desde hoy.";
      }
    }
    if (insumosSeleccionados.length === 0) errors.insumos = "Debe agregar al menos un insumo.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const emailSender = async (selectedOrdenId) => {
    try {
      const ordenData = await api(
        `/proceso-compra/ordenes/${selectedOrdenId}`, { method: "GET" }
      );
      const items = buildOcEmailItemsFromOrden(ordenData);
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
        encargados.map((e) => e?.usuario?.nombre).filter(Boolean).join(", ") ||
        "Sin encargados";
      
      // Enviar correo de notificación
      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: selectedOrdenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: ordenData.estado || "Estado desconocido",
        bodega: ordenData.BodegaSolicitante?.nombre || "No especificada",
        clientNames: encargadosNames || "",
        items,
      });
    } catch (emailError) {
      console.error("Error enviando correo de notificación:", emailError); 
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Subir todos los archivos primero
    const archivosAdjuntos = form.archivosAdjuntos;

    let s3Refs = [];
    if (archivosAdjuntos.length > 0) {
      s3Refs = await Promise.all(
        archivosAdjuntos.map(async (file) => {
          try {
            const ref = await uploadToS3(file);
            return ref;
          } catch (err) {
            toast.error(`Error subiendo ${file.name}:`, err);
            return null; // evita romper el flujo si falla uno
          }
        })
      );
      s3Refs = s3Refs.filter(Boolean); // elimina nulos
    }
    
    const dataToSend = {
      id_proveedor: parseInt(form.id_proveedor),
      condiciones: form.condiciones,
      requiere_prepago: form.requiere_prepago,
      materias_primas: insumosSeleccionados,
      archivos: s3Refs,
    };

    try {
      const resp = await api(`/proceso-compra/ordenes`, { method: "POST", body: JSON.stringify(dataToSend) });  
      toast.success("Orden de compra creada correctamente");
      try {
        emailSender(resp.orden.id)
      } catch (emailErr) {
        toast.error("Error enviando email tras crear orden:", emailErr);
      }
      navigate("/Ordenes");
    } catch (error) {
      toast.error("Error al crear orden:", error);
    }
  };

  const handleCantidadChange = (id, rawValue) => {
    const cantidadFormato = Number(rawValue) || 0;

    setMateriasPrimas((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, cantidad_formato: cantidadFormato } : m
      )
    );

    setInsumosSeleccionados((prev) => {
      if (cantidadFormato <= 0) {
        return prev.filter((i) => i.id_proveedor_materia_prima !== id);
      }

      const insumo = materiasPrimas.find((m) => m.id === id);
      if (!insumo) return prev;

      const existente = prev.find((i) => i.id_proveedor_materia_prima === id);

      const nombre = insumo.materiaPrima?.nombre || `MP #${id}`;
      const precio_unitario =
        insumo.precio_unitario_input ?? insumo.precio_unitario ?? 0;
      const formato = insumo.formato || "—";
      const cantidad_por_formato = Number(insumo.cantidad_por_formato) || 1;
      const cantidad_total = cantidadFormato * cantidad_por_formato;

      if (existente) {
        return prev.map((i) =>
          i.id_proveedor_materia_prima === id
            ? {
                ...i,
                nombre,
                formato,
                precio_unitario,
                cantidad_formato: cantidadFormato,
                cantidad_por_formato,
                cantidad: cantidad_total, 
              }
            : i
        );
      }

      return [
        ...prev,
        {
          id_proveedor_materia_prima: id,
          nombre,
          formato,
          precio_unitario,
          cantidad_formato: cantidadFormato,
          cantidad_por_formato,
          cantidad: cantidad_total,
        },
      ];
    });
  };

  const handlePrecioChange = (id, value) => {
    setMateriasPrimas((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, precio_unitario_input: value } : m
      )
    );

    setInsumosSeleccionados((prev) =>
      prev.map((i) =>
        i.id_proveedor_materia_prima === id
          ? { ...i, precio_unitario: value }
          : i
      )
    );
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/Ordenes" />
      </div>

      <h1 className="text-2xl font-bold text-text mb-4">Crear Orden de Compra</h1>

      <ConfirmModal
        open={showInsumoError}
        title="Insumo no disponible"
        message={insumoErrorMsg}
        onConfirm={() => setShowInsumoError(false)}
        onCancel={() => setShowInsumoError(false)}
        confirmText="Cerrar"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Proveedor:</label>
          <select
            name="id_proveedor"
            value={form.id_proveedor}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            <option value="">Seleccione proveedor</option>
            {proveedores.map((prov) => (
              <option key={prov.id} value={prov.id}>{prov.nombre_empresa || prov.nombre}</option>
            ))}
          </select>
          {formErrors.id_proveedor && <p className="text-red-600 text-sm mt-1">{formErrors.id_proveedor}</p>}
        </div>

        <div>
          <label className="block font-semibold mb-1">Fecha:</label>
          <input
            type="date"
            name="fecha"
            value={form.fecha}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            min={minFecha}
          />
          {formErrors.fecha && <p className="text-red-600 text-sm mt-1">{formErrors.fecha}</p>}
        </div>

        <div>
          <label className="block font-semibold mb-1">Condiciones de Compra:</label>
          <input
            type="text"
            name="condiciones"
            value={form.condiciones}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mt-4 mb-1">
            <label className="block font-semibold mb-1 mt-4">
              Archivos Adjuntos:
            </label>
            <input
              id="fileInput"
              type="file"
              name="archivosAdjuntos"
              multiple
              onChange={handleChange}
              className="hidden"
            />
            
            <label
              htmlFor="fileInput"
              className="inline-block px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-hover transition"
              >
                Agregar Archivos
            </label>
          </div>
          

          {/* Vista previa de archivos seleccionados */}
          {form.archivosAdjuntos.length > 0 && (
            <ul className="mt-3 space-y-2">
              {form.archivosAdjuntos.map((file, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700"
                >
                  <span className="truncate max-w-[80%]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="block font-semibold mb-1">Requiere prepago:</label>
          <input
            type="checkbox"
            name="requiere_prepago"
            checked={form.requiere_prepago}
            onChange={handleChange}
            className="ml-2"
          />
        </div>

        <div className="grid grid-cols-3 gap-6 h-[80vh] overflow-hidden">
          <div className="col-span-2 flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">
              Insumos del proveedor
            </h2>
            {materiasPrimas.length > 0 ? (
              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Insumo</th>
                      <th className="px-4 py-2 text-center">Cantidad a comprar</th>
                      <th className="px-4 py-2 text-center">Precio unitario</th>
                    </tr>
                  </thead>

                  <tbody>
                    {materiasPrimas.map((insumo) => (
                      <tr key={insumo.id} className="border-t border-gray-200 hover:bg-gray-50">
                        {/* Nombre del insumo */}
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {insumo.formato === insumo.materiaPrima?.nombre ? '' : insumo.formato + " - "} {insumo.materiaPrima?.nombre || `Insumo ${insumo.id}`}{" "} 
                          ({insumo.cantidad_por_formato === null ? `N/A` : insumo.cantidad_por_formato} {insumo.materiaPrima?.unidad_medida === null ? `Unidad desconocida` : insumo.materiaPrima?.unidad_medida})
                        </td>

                        {/* Input cantidad */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={insumo.cantidad_formato ?? ""}
                            onChange={(e) => handleCantidadChange(insumo.id, e.target.value)}
                            className="w-20 border border-gray-300 rounded-md px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          
                        </td>

                        {/* Input precio unitario */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={
                              insumo.precio_unitario_input !== undefined
                                ? insumo.precio_unitario_input
                                : insumo.precio_unitario || ""
                            }
                            onChange={(e) =>
                              handlePrecioChange(insumo.id, e.target.value)
                            }
                            className="w-24 border border-gray-300 rounded-md px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                           <span className="text-sm text-gray-500"> {insumo.moneda || "CLP"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <p className="text-lg font-medium mb-2">
                      No hay insumos disponibles.
                    </p>
                    <p className="text-sm">
                      Selecciona una bodega para ver los insumos asociados a ese proveedor.
                    </p>
                  </div>
                </div>
              )}

            {formErrors.insumos && (
              <p className="text-red-600 text-center text-sm mt-4">
                {formErrors.insumos}
              </p>
            )}
          </div>

          <div className="col-span-1 flex flex-col justify-end h-full border-l pl-4">
            <div className="mt-auto">
              <h2 className="font-semibold text-lg mb-3 text-gray-800">Resumen de Insumos Seleccionados</h2>
              <div className="bg-gray-50 rounded-lg p-3 shadow-inner mb-4 max-h-80 overflow-y-auto">
                {insumosSeleccionados.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No hay insumos seleccionados.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 text-sm bg-white rounded-lg shadow-sm">
                    {insumosSeleccionados.map((i, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center py-2 px-2 hover:bg-gray-50 transition"
                      >
                        <div className="flex flex-col">
                          
                          <span className="font-medium text-gray-800">
                             {i.formato === i.nombre ? '' : i.formato + " - "}{i.nombre || `MP #${i.id_proveedor_materia_prima}`}
                          </span>
                          <span className="text-gray-500 text-xs">
                            Cantidad: {i.cantidad_formato} {i.formato === i.nombre ? '' : i.formato}
                          </span>
                        </div>

                        <span className="font-semibold text-gray-900">
                          ${(i.precio_unitario * i.cantidad_formato).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>

                )}
              </div>
            </div>

            <div className="text-sm text-gray-800 space-y-1 mb-4">
              <p><strong>Total Neto:</strong> ${total_neto.toLocaleString()}</p>
              <p><strong>IVA (19%):</strong> ${iva.toLocaleString()}</p>
              <p><strong>Total:</strong> ${total_pago.toLocaleString()}</p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
            >
              Guardar Orden
            </button>
          </div>
        </div>
        </form>
    </div>
  );
}