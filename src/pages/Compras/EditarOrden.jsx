import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { uploadToS3 } from "../../lib/uploadToS3";
import ConfirmModal from "../../components/ConfirmModal";
import Selector from "../../components/Selector";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";

export default function EditOrden() {
  const { user } = useAuth();
  const { ordenId } = useParams(); 
  const navigate = useNavigate();
  const api = useApi();

  const [proveedores, setProveedores] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);

  const [form, setForm] = useState({
    id_proveedor: "",
    id_bodega: "",
    fecha: "",
    condiciones: "",
    requiere_prepago: false,
    archivosAdjuntos: [],
    archivosExistentes: [], // Archivos que ya están en S3
  });

  const [formErrors, setFormErrors] = useState({});
  const [showInsumoError, setShowInsumoError] = useState(false);
  const [insumoErrorMsg, setInsumoErrorMsg] = useState("");

  const hydrateProveedorInsumosWithOC = (proveedorInsumos, seleccionados) => {
    const byId = new Map(
      (seleccionados || [])
        .map((s) => [Number(s?.id_proveedor_materia_prima), s])
        .filter(([k]) => Number.isFinite(k))
    );

    return (proveedorInsumos || []).map((pi) => {
      const sel = byId.get(Number(pi?.id));
      if (!sel) return pi;
      return {
        ...pi,
        cantidad_formato: Number(sel.cantidad_formato) || 0,
        precio_unitario_input: Number(sel.precio_unitario) || 0,
      };
    });
  };

  const total_neto = insumosSeleccionados.reduce(
    (acc, item) => acc + (Number(item.cantidad_formato) || 0) * (Number(item.precio_unitario) || 0),
    0
  );
  const iva = Math.round(total_neto * 0.19);
  const total_pago = total_neto + iva;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [provRes, bodRes, ordenRes] = await Promise.all([
          api(`/proveedores`),
          api(`/bodegas`),
          api(`/proceso-compra/ordenes/${ordenId}`), 
        ]);

        const proveedoresData = Array.isArray(provRes?.data)
          ? provRes.data
          : provRes || [];

        const proveedoresActivos = proveedoresData.filter((p) => p.activo === true);

        const bodegasData =
          Array.isArray(bodRes?.data?.bodegas) || Array.isArray(bodRes?.bodegas)
            ? bodRes.data?.bodegas || bodRes.bodegas
            : [];

        const bodegasUtiles = bodegasData.filter(
          (b) =>
            typeof b?.nombre === "string" &&
            b.nombre.toLowerCase().trim() !== "en tránsito"
        );

        setProveedores(proveedoresActivos);
        setBodegas(bodegasUtiles);

        setForm({
          id_proveedor: ordenRes.id_proveedor?.toString() || "",
          id_bodega: ordenRes.id_bodega_solicitante?.toString() || "",
          fecha: ordenRes.fecha?.split("T")[0] || "",
          condiciones: ordenRes.condiciones || "",
          requiere_prepago: ordenRes.requiere_prepago || false,
          archivosAdjuntos: [],
          archivosExistentes: ordenRes.archivos || [],
        });

        setInsumosSeleccionados(
          (ordenRes.materiasPrimas || ordenRes.materias_primas || []).map(
            (i) => ({
              id_proveedor_materia_prima: Number(
                i.id_proveedor_materia_prima ?? i.proveedorMateriaPrima?.id
              ),
              nombre:
                i.proveedorMateriaPrima?.materiaPrima?.nombre ||
                i.nombre ||
                `MP #${i.id_proveedor_materia_prima ?? i.proveedorMateriaPrima?.id ?? i.id}`,
              formato: i.proveedorMateriaPrima?.formato || i.formato || "—",
              cantidad_por_formato: Number(
                i.cantidad_por_formato ?? i.proveedorMateriaPrima?.cantidad_por_formato
              ) || 1,
              cantidad_formato: Number(i.cantidad_formato ?? i.cantidad) || 0,
              cantidad: Number(i.cantidad) || 0,
              precio_unitario: Number(i.precio_unitario) || 0,
            })
          )
            .filter((x) => Number.isFinite(x.id_proveedor_materia_prima))
        );
      } catch (error) {
        toast.error("Error al cargar datos de la orden:", error);
      }
    };

    fetchData();
  }, [ordenId]); 

  useEffect(() => {
    const fetchInsumos = async () => {
      if (!form.id_proveedor) return;
      try {
        const res = await api(`/proveedores/${form.id_proveedor}`, { method: "GET" });
        const activosBase = res.materiasPrimas?.filter((i) => i.materiaPrima?.activo) || [];
        const activos = (activosBase || []).map((i) => ({
          ...i,
          precio_unitario: Number(i?.precio_unitario) || 0,
        }));
        setMateriasPrimas(
          hydrateProveedorInsumosWithOC(activos, insumosSeleccionados)
        );
      } catch (error) {
        toast.error("Error al cargar materias primas del proveedor:", error);
        setMateriasPrimas([]);
      }
    };
    fetchInsumos();
  }, [form.id_proveedor]);

  const setFormField = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === "file") {
      const nuevosArchivos = Array.from(files || []);
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

  const handleRemoveNewFile = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      archivosAdjuntos: prev.archivosAdjuntos.filter((_, i) => i !== indexToRemove),
    }));
  };

  const handleRemoveExistingFile = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      archivosExistentes: prev.archivosExistentes.filter((_, i) => i !== indexToRemove),
    }));
  };

  const proveedoresOptions = useMemo(
    () =>
      (proveedores || []).map((p) => ({
        label: p.nombre_empresa || p.nombre || `Proveedor #${p.id}`,
        value: String(p.id),
        searchText: `${p.nombre_empresa || ""} ${p.nombre || ""} ${p.rut || ""}`.trim(),
      })),
    [proveedores]
  );

  const bodegasOptions = useMemo(
    () =>
      (bodegas || []).map((b) => ({
        label: b.nombre || `Bodega #${b.id}`,
        value: String(b.id),
        searchText: `${b.nombre || ""}`.trim(),
      })),
    [bodegas]
  );

  const materiasPrimasAgrupadas = useMemo(() => {
    const groups = new Map();
    for (const row of materiasPrimas || []) {
      const mp = row?.materiaPrima;
      const key = mp?.id != null ? `mp:${mp.id}` : `row:${row?.id}`;
      if (!groups.has(key)) groups.set(key, { materiaPrima: mp, rows: [] });
      groups.get(key).rows.push(row);
    }

    const sorted = Array.from(groups.values()).sort((a, b) =>
      String(a?.materiaPrima?.nombre ?? "").localeCompare(
        String(b?.materiaPrima?.nombre ?? ""),
        "es"
      )
    );

    for (const g of sorted) {
      g.rows.sort((a, b) => {
        const fa = String(a?.formato ?? "");
        const fb = String(b?.formato ?? "");
        const cmp = fa.localeCompare(fb, "es");
        if (cmp !== 0) return cmp;
        return (Number(a?.cantidad_por_formato) || 0) - (Number(b?.cantidad_por_formato) || 0);
      });
    }

    return sorted;
  }, [materiasPrimas]);

  // Si la OC carga insumos seleccionados después del fetch del proveedor,
  // aseguramos que se reflejen en la tabla (cantidad/precio).
  useEffect(() => {
    if (!Array.isArray(insumosSeleccionados) || insumosSeleccionados.length === 0)
      return;
    setMateriasPrimas((prev) => hydrateProveedorInsumosWithOC(prev, insumosSeleccionados));
  }, [insumosSeleccionados]);

  const handleCantidadChange = (insumoRow, rawValue) => {
    const idNum = Number(insumoRow?.id);
    const cantidadFormato = Number(rawValue) || 0;

    setMateriasPrimas((prev) =>
      prev.map((m) =>
        Number(m?.id) === idNum ? { ...m, cantidad_formato: cantidadFormato } : m
      )
    );

    setInsumosSeleccionados((prev) => {
      if (cantidadFormato <= 0) {
        return prev.filter((i) => Number(i?.id_proveedor_materia_prima) !== idNum);
      }

      const existente = prev.find(
        (i) => Number(i?.id_proveedor_materia_prima) === idNum
      );

      const nombre =
        insumoRow?.materiaPrima?.nombre || insumoRow?.nombre || `MP #${idNum}`;
      const formato = insumoRow?.formato || "—";
      const cantidad_por_formato = Number(insumoRow?.cantidad_por_formato) || 1;
      const cantidad_total = cantidadFormato * cantidad_por_formato;
      const precio_unitario =
        Number(insumoRow?.precio_unitario_input ?? insumoRow?.precio_unitario ?? 0) || 0;

      if (existente) {
        return prev.map((i) =>
          Number(i?.id_proveedor_materia_prima) === idNum
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
          id_proveedor_materia_prima: idNum,
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

  const handlePrecioChange = (insumoRow, rawValue) => {
    const idNum = Number(insumoRow?.id);
    const value = Number(rawValue) || 0;
    setMateriasPrimas((prev) =>
      prev.map((m) =>
        Number(m?.id) === idNum ? { ...m, precio_unitario_input: value } : m
      )
    );
    setInsumosSeleccionados((prev) =>
      prev.map((i) =>
        Number(i?.id_proveedor_materia_prima) === idNum
          ? { ...i, precio_unitario: value }
          : i
      )
    );
  };

  const validateForm = () => {
    const errors = {};
    if (!form.id_proveedor) errors.id_proveedor = "Debe seleccionar un proveedor.";
    if (!form.id_bodega) errors.id_bodega = "Debe seleccionar una bodega.";
    if (!form.fecha) errors.fecha = "Debe ingresar una fecha.";
    if (insumosSeleccionados.length === 0)
      errors.insumos = "Debe agregar al menos un insumo.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const emailSender = async (ordenId) => {
    try {
      const ordenData = await api(
        `/proceso-compra/ordenes/${ordenId}`, { method: "GET" }
      );
      const { items, totalNeto, iva, totalPago } = buildOcEmailItemsFromOrden(ordenData);
      
      // Obtener usuarios con rol Super Admin
      const superAdmins = await api(`/usuarios?role=Super Admin`, { method: "GET" });
      const adminsArray = Array.isArray(superAdmins) ? superAdmins : [];
      
      // Obtener encargados de la bodega
      const bodegaId = ordenData.BodegaSolicitante?.id;
      let encargados = [];
      if (bodegaId) {
        const bodegaData = await api(`/bodegas/${bodegaId}`, { method: "GET" });
        encargados = Array.isArray(bodegaData?.Encargados) ? bodegaData.Encargados : [];
      }
      
      // Combinar ambos grupos de destinatarios
      const adminEmails = adminsArray.map((admin) => admin?.email).filter(Boolean);
      const encargadoEmails = encargados.map((e) => e?.usuario?.email).filter(Boolean);
      const allEmails = [...new Set([...adminEmails, ...encargadoEmails])];
      
      const to = allEmails.map((email) => ({ email }));
      
      const adminsNames = adminsArray.map((admin) => admin?.nombre).filter(Boolean).join(", ");
      const encargadosNames = encargados.map((e) => e?.usuario?.nombre).filter(Boolean).join(", ");
      const allNames = [adminsNames, encargadosNames].filter(Boolean).join(", ") || "Sin destinatarios";
        
      // Enviar correo de notificación
      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: ordenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: "Editada",
        bodega: ordenData.BodegaSolicitante?.nombre || "No especificada",
        proveedor: ordenData.Proveedor?.nombre_empresa || ordenData.proveedor?.nombre_empresa || "No especificado",
        clientNames: allNames,
        items,
        totalNeto,
        iva,
        totalPago,
      });
    } catch (emailError) {
      console.error("Error enviando correo de notificación:", emailError); 
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Subir archivos nuevos a S3
    let nuevosS3Refs = [];
    if (form.archivosAdjuntos.length > 0) {
      nuevosS3Refs = await Promise.all(
        form.archivosAdjuntos.map(async (file) => {
          try {
            const ref = await uploadToS3(file);
            return ref;
          } catch (err) {
            toast.error(`Error subiendo ${file.name}:`, err);
            return null;
          }
        })
      );
      nuevosS3Refs = nuevosS3Refs.filter(Boolean);
    }

    // Combinar archivos existentes (que no fueron eliminados) con los nuevos
    const todosLosArchivos = [...form.archivosExistentes, ...nuevosS3Refs];

    const dataToSend = {
      id_proveedor: parseInt(form.id_proveedor),
      id_bodega_solicitante: parseInt(form.id_bodega),
      id_bodega_destino: parseInt(form.id_bodega),
      condiciones: form.condiciones,
      requiere_prepago: form.requiere_prepago,
      fecha: form.fecha,
      archivos: todosLosArchivos,
      materias_primas: (insumosSeleccionados || []).map((i) => ({
        ...i,
        id_proveedor_materia_prima: Number(i.id_proveedor_materia_prima),
        cantidad_formato: Number(i.cantidad_formato) || 0,
        cantidad_por_formato: Number(i.cantidad_por_formato) || 1,
        cantidad: Number(i.cantidad) || 0,
        precio_unitario: Number(i.precio_unitario) || 0,
      })),
    };

    try {
      await api(`/proceso-compra/ordenes/${ordenId}`, { 
        method: "PUT",
        body: JSON.stringify(dataToSend),
      });
      toast.success("Orden de compra actualizada correctamente");
      try {
        emailSender(ordenId)
      } catch (emailErr) {
        toast.error("Error enviando email tras crear orden:", emailErr);
      }
      navigate("/Ordenes");
    } catch (error) {
      toast.error("Error al actualizar la orden:", error);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <BackButton to="/Ordenes" />
      <h1 className="text-2xl font-bold text-text mb-4">Editar Orden de Compra</h1>

      <ConfirmModal
        open={showInsumoError}
        title="Insumo no disponible"
        message={insumoErrorMsg}
        onConfirm={() => setShowInsumoError(false)}
        onCancel={() => setShowInsumoError(false)}
        confirmText="Cerrar"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* === Selección de proveedor === */}
        <div>
          <label className="block font-semibold mb-1">Proveedor:</label>
          <Selector
            options={proveedoresOptions}
            selectedValue={form.id_proveedor}
            onSelect={(value) => {
              // Cambiar proveedor invalida el set de insumos seleccionados.
              setFormField("id_proveedor", String(value ?? ""));
              setMateriasPrimas([]);
              setInsumosSeleccionados([]);
            }}
            useFuzzy
            className="p-2 border rounded"
          />
          {formErrors.id_proveedor && (
            <p className="text-red-600 text-sm mt-1">{formErrors.id_proveedor}</p>
          )}
        </div>

        {/* === Bodega === */}
        <div>
          <label className="block font-semibold mb-1">Bodega:</label>
          <Selector
            options={bodegasOptions}
            selectedValue={form.id_bodega}
            onSelect={(value) => setFormField("id_bodega", String(value ?? ""))}
            useFuzzy
            className="p-2 border rounded"
          />
          {formErrors.id_bodega && (
            <p className="text-red-600 text-sm mt-1">{formErrors.id_bodega}</p>
          )}
        </div>

        {/* === Fecha === */}
        <div>
          <label className="block font-semibold mb-1">Fecha:</label>
          <input
            type="date"
            name="fecha"
            value={form.fecha}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* === Condiciones === */}
        <div>
          <label className="block font-semibold mb-1">Condiciones:</label>
          <input
            type="text"
            name="condiciones"
            value={form.condiciones}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* === Requiere prepago === */}
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

        {/* === Archivos Adjuntos === */}
        <div className="border-t pt-4 mt-4">
          <label className="block font-semibold mb-1">Archivos Adjuntos:</label>
          
          {/* Archivos existentes */}
          {form.archivosExistentes.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2">Archivos actuales:</p>
              <ul className="space-y-1">
                {form.archivosExistentes.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="text-blue-600">📎</span>
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate"
                        >
                          {file.original_name || `Archivo ${index + 1}`}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-700 truncate">
                          {file.original_name || `Archivo ${index + 1}`}
                        </span>
                      )}
                      {file.size && (
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingFile(index)}
                      className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex-shrink-0"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nuevos archivos a subir */}
          {form.archivosAdjuntos.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2">Nuevos archivos a adjuntar:</p>
              <ul className="space-y-1">
                {form.archivosAdjuntos.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className="text-green-600">📎</span>
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNewFile(index)}
                      className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 flex-shrink-0"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Input para agregar archivos */}
          <div>
            <input
              type="file"
              id="archivosAdjuntos"
              name="archivosAdjuntos"
              multiple
              onChange={handleChange}
              className="hidden"
            />
            <label
              htmlFor="archivosAdjuntos"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
            >
              Agregar Archivos
            </label>
          </div>
        </div>

        {/* === Tabla de insumos === */}
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
                    {materiasPrimasAgrupadas.map((g) => (
                      <Fragment
                        key={
                          g?.materiaPrima?.id != null
                            ? `mp:${g.materiaPrima.id}`
                            : `mp:${g?.materiaPrima?.nombre ?? "sin-nombre"}`
                        }
                      >
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td className="px-4 py-2 font-semibold text-gray-800" colSpan={3}>
                            {g?.materiaPrima?.nombre || "Insumo"}
                          </td>
                        </tr>

                        {g.rows.map((insumo) => (
                          <tr
                            key={insumo.id}
                            className="border-t border-gray-200 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">
                              <div className="pl-3">
                                <div className="text-gray-700">{insumo.formato || "—"}</div>
                                <div className="text-xs text-gray-500">
                                  {insumo.cantidad_por_formato == null ? "N/A" : insumo.cantidad_por_formato}{" "}
                                  {insumo.materiaPrima?.unidad_medida || "unidad"}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={insumo.cantidad_formato ?? ""}
                                onChange={(e) =>
                                  handleCantidadChange(insumo, e.target.value)
                                }
                                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-center text-sm"
                                step="any"
                              />
                            </td>

                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={
                                  insumo.precio_unitario_input !== undefined
                                    ? insumo.precio_unitario_input
                                    : insumo.precio_unitario ?? ""
                                }
                                onChange={(e) =>
                                  handlePrecioChange(insumo, e.target.value)
                                }
                                className="w-24 border border-gray-300 rounded-md px-2 py-1 text-center text-sm"
                                step="any"
                              />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-600 mt-6">
                No hay insumos disponibles para este proveedor.
              </p>
            )}
          </div>

          {/* === Resumen === */}
          <div className="col-span-1 flex flex-col justify-end h-full border-l pl-4">
            <h2 className="font-semibold text-lg mb-3 text-gray-800">
              Resumen
            </h2>
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
                          {i.nombre || `MP #${i.id_proveedor_materia_prima}`}
                        </span>
                        <span className="text-gray-500 text-xs">
                          Cantidad: {i.cantidad_formato} {i.formato === i.nombre ? "" : i.formato || ""}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        ${(Number(i.precio_unitario || 0) * Number(i.cantidad_formato || 0)).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-sm text-gray-800 space-y-1 mb-4">
              <p>
                <strong>Total Neto:</strong> ${total_neto.toLocaleString()}
              </p>
              <p>
                <strong>IVA (19%):</strong> ${iva.toLocaleString()}
              </p>
              <p>
                <strong>Total:</strong> ${total_pago.toLocaleString()}
              </p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

