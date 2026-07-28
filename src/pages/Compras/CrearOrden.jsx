import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "../../components/Buttons/ActionButtons";
import ConfirmModal from "../../components/Modals/ConfirmModal";
import Selector from "../../components/Forms/Selector";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { uploadToS3 } from "../../lib/uploadToS3";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";

export default function CrearOrden() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useApi();

  const hoy = new Date();
  const fechaActual = hoy.toISOString().split("T")[0];
  const tresMesesAntes = new Date(hoy);
  tresMesesAntes.setMonth(hoy.getMonth() - 3);
  const minFecha = tresMesesAntes.toISOString().split("T")[0];

  const [proveedores, setProveedores] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [insumosSeleccionados, setInsumosSeleccionados] = useState([]);

  // Búsqueda por insumo: qué proveedores lo ofrecen y a qué precio.
  const [modoBusqueda, setModoBusqueda] = useState("proveedor");
  const [insumosCatalogo, setInsumosCatalogo] = useState(null);
  const [insumoBuscado, setInsumoBuscado] = useState("");
  const [ofertas, setOfertas] = useState([]);
  const [ofertasLoading, setOfertasLoading] = useState(false);

  const [form, setForm] = useState({
    id_proveedor: "",
    id_bodega: "",
    fecha: fechaActual,
    condiciones: "",
    requiere_prepago: false,
    archivosAdjuntos: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [showInsumoError, setShowInsumoError] = useState(false);
  const [insumoErrorMsg, setInsumoErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canWritePurchaseOrder = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const canReadProvider = checkScope(ModelType.PROVEEDOR, ScopeType.READ);

  const total_neto = insumosSeleccionados.reduce(
    (acc, item) => acc + (Number(item.cantidad_formato) || 0) * (Number(item.precio_unitario) || 0),
    0
  );
  const iva = Math.round(total_neto * 0.19);
  const total_pago = total_neto + iva;

  useEffect(() => {
    const fetchData = async () => {
      if (!canReadProvider) {
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        setIsLoading(false);
        return;
      }
      try {
        const [provRes, bodRes] = await Promise.all([api(`/proveedores`), api(`/bodegas`)]);

        const proveedoresData = Array.isArray(provRes?.data)
          ? provRes.data
          : provRes?.data?.proveedores || provRes || [];
        const proveedoresActivos = (proveedoresData || []).filter((p) => p.activo === true);
        setProveedores(proveedoresActivos);

        const bodegasData =
          Array.isArray(bodRes?.data?.bodegas) || Array.isArray(bodRes?.bodegas)
            ? bodRes.data?.bodegas || bodRes.bodegas
            : [];
        const bodegasUtiles = (bodegasData || []).filter(
          (b) => typeof b?.nombre === "string" && b.nombre.toLowerCase().trim() !== "en tránsito"
        );
        setBodegas(bodegasUtiles);
      } catch (error) {
        toast.error(`Error al cargar datos iniciales: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [canReadProvider]);

  useEffect(() => {
    const fetchInsumos = async () => {
      if (!form.id_proveedor) return;
      if (!canReadProvider){
        toast.permissionError([ModelType.PROVEEDOR, ScopeType.READ]);
        return;
      }
      try {
        const res = await api(`/proveedores/${form.id_proveedor}`, { method: "GET" });
        const activos = res.materiasPrimas?.filter((i) => i.materiaPrima?.activo === true);
        setMateriasPrimas(activos || []);
      } catch (error) {
        toast.error(`Error al cargar materias primas del proveedor: ${error.message}`);
        setMateriasPrimas([]);
      }
    };
    fetchInsumos();
  }, [form.id_proveedor, canReadProvider]);

  const setFormField = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Catálogo de insumos (solo se carga al usar el modo "por insumo").
  useEffect(() => {
    if (modoBusqueda !== "insumo" || insumosCatalogo !== null) return;
    const fetchCatalogo = async () => {
      try {
        const res = await api(`/materias-primas`);
        const data = Array.isArray(res?.data) ? res.data : res;
        setInsumosCatalogo((data || []).filter((i) => i.activo === true));
      } catch (error) {
        toast.error(`Error al cargar los insumos: ${error.message}`);
        setInsumosCatalogo([]);
      }
    };
    fetchCatalogo();
  }, [modoBusqueda, insumosCatalogo]);

  // Ofertas de proveedores para el insumo buscado (ordenadas por precio en el backend).
  useEffect(() => {
    if (!insumoBuscado) {
      setOfertas([]);
      return;
    }
    const fetchOfertas = async () => {
      setOfertasLoading(true);
      try {
        const res = await api(
          `/proveedor-materia-prima/por-materia-prima?id_materia_prima=${insumoBuscado}`
        );
        const data = Array.isArray(res?.data) ? res.data : res;
        setOfertas((data || []).filter((o) => o.proveedor?.activo === true));
      } catch (error) {
        toast.error(`Error al buscar proveedores del insumo: ${error.message}`);
        setOfertas([]);
      } finally {
        setOfertasLoading(false);
      }
    };
    fetchOfertas();
  }, [insumoBuscado]);

  const insumosCatalogoOptions = useMemo(
    () =>
      (insumosCatalogo || []).map((i) => ({
        label: i.nombre || `Insumo #${i.id}`,
        value: String(i.id),
        searchText: `${i.nombre || ""}`.trim(),
      })),
    [insumosCatalogo]
  );

  const seleccionarProveedor = (idProveedor) => {
    setFormField("id_proveedor", String(idProveedor ?? ""));
    setMateriasPrimas([]);
    setInsumosSeleccionados([]);
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
      String(a?.materiaPrima?.nombre ?? "").localeCompare(String(b?.materiaPrima?.nombre ?? ""), "es")
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

  const handleRemoveFile = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      archivosAdjuntos: prev.archivosAdjuntos.filter((_, i) => i !== indexToRemove),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.id_proveedor) errors.id_proveedor = "Debe seleccionar un proveedor.";
    if (!form.id_bodega) errors.id_bodega = "Debe seleccionar una bodega.";

    if (!form.fecha) {
      errors.fecha = "Debe ingresar una fecha.";
    } else {
      const fechaOrden = new Date(form.fecha);
      const hoyNow = new Date();
      const tresMesesAntesNow = new Date(hoyNow);
      tresMesesAntesNow.setMonth(hoyNow.getMonth() - 3);
      if (fechaOrden < tresMesesAntesNow) {
        errors.fecha = "La fecha no puede ser anterior a 3 meses desde hoy.";
      }
    }

    if (insumosSeleccionados.length === 0) errors.insumos = "Debe agregar al menos un insumo.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const emailSender = async (selectedOrdenId) => {
    try {
      const ordenData = await api(`/proceso-compra/ordenes/${selectedOrdenId}`, { method: "GET" });
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

      await notifyOrderChange({
        emails: to.map((t) => t.email),
        ordenId: selectedOrdenId,
        operador: user.nombre || user.email || "Operador desconocido",
        state: ordenData.estado || "Estado desconocido",
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

    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    const archivosAdjuntos = form.archivosAdjuntos;
    let s3Refs = [];

    if (archivosAdjuntos.length > 0) {
      s3Refs = await Promise.all(
        archivosAdjuntos.map(async (file) => {
          try {
            const ref = await uploadToS3(file);
            return ref;
          } catch (err) {
            toast.error(`Error subiendo ${file.name}: ${err.message}`);
            return null;
          }
        })
      );
      s3Refs = s3Refs.filter(Boolean);
    }

    const dataToSend = {
      id_proveedor: parseInt(form.id_proveedor),
      id_bodega_solicitante: parseInt(form.id_bodega),
      id_bodega_destino: parseInt(form.id_bodega),
      fecha: form.fecha,
      condiciones: form.condiciones,
      requiere_prepago: form.requiere_prepago,
      materias_primas: insumosSeleccionados,
      archivos: s3Refs,
    };

    try {
      const resp = await api(`/proceso-compra/ordenes`, {
        method: "POST",
        body: JSON.stringify(dataToSend),
      });
      toast.success("Orden de compra creada correctamente");
      try {
        await emailSender(resp.orden.id);
      } catch (emailErr) {
        toast.error(`Error enviando email tras crear orden: ${emailErr.message}`);
      }
      navigate("/Ordenes");
    } catch (error) {
      toast.error(`Error al crear orden: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCantidadChange = (id, rawValue) => {
    const idNum = Number(id);
    const cantidadFormato = Number(rawValue) || 0;

    setMateriasPrimas((prev) =>
      prev.map((m) => (Number(m?.id) === idNum ? { ...m, cantidad_formato: cantidadFormato } : m))
    );

    setInsumosSeleccionados((prev) => {
      if (cantidadFormato <= 0) {
        return prev.filter((i) => Number(i.id_proveedor_materia_prima) !== idNum);
      }

      const insumo = (materiasPrimas || []).find((m) => Number(m?.id) === idNum);
      if (!insumo) return prev;

      const existente = prev.find((i) => Number(i.id_proveedor_materia_prima) === idNum);
      const nombre = insumo.materiaPrima?.nombre || `MP #${idNum}`;
      const formato = insumo.formato || "—";
      const cantidad_por_formato = Number(insumo.cantidad_por_formato) || 1;
      const cantidad_total = cantidadFormato * cantidad_por_formato;
      const precio_unitario = Number(insumo.precio_unitario_input ?? insumo.precio_unitario ?? 0) || 0;

      if (existente) {
        return prev.map((i) =>
          Number(i.id_proveedor_materia_prima) === idNum
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

  const handlePrecioChange = (id, value) => {
    const idNum = Number(id);
    const valNum = Number(value) || 0;

    setMateriasPrimas((prev) =>
      prev.map((m) => (Number(m?.id) === idNum ? { ...m, precio_unitario_input: valNum } : m))
    );

    setInsumosSeleccionados((prev) =>
      prev.map((i) => (Number(i.id_proveedor_materia_prima) === idNum ? { ...i, precio_unitario: valNum } : i))
    );
  };

  if (isLoading) return <PageLoader message="Cargando datos" />;

  return (
    <div className="p-6 bg-background min-h-screen">
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
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
          <div className="flex items-center gap-2 mb-2">
            <label className="block font-semibold">Buscar por:</label>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              {[
                { value: "proveedor", label: "Proveedor" },
                { value: "insumo", label: "Insumo" },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setModoBusqueda(m.value)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    modoBusqueda === m.value
                      ? "bg-primary text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {modoBusqueda === "proveedor" ? (
            <>
              <label className="block font-semibold mb-1">Proveedor:</label>
              <Selector
                options={proveedoresOptions}
                selectedValue={form.id_proveedor}
                onSelect={(value) => seleccionarProveedor(value)}
                useFuzzy
                className="p-2 border rounded"
              />
            </>
          ) : (
            <>
              <label className="block font-semibold mb-1">Insumo:</label>
              <Selector
                options={insumosCatalogoOptions}
                selectedValue={insumoBuscado}
                onSelect={(value) => setInsumoBuscado(String(value ?? ""))}
                useFuzzy
                className="p-2 border rounded"
              />
              {ofertasLoading && (
                <p className="text-sm text-gray-500 mt-2">Buscando proveedores…</p>
              )}
              {!ofertasLoading && insumoBuscado && ofertas.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Ningún proveedor activo ofrece este insumo.
                </p>
              )}
              {!ofertasLoading && ofertas.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
                        <th className="px-3 py-2 text-left font-semibold">Formato</th>
                        <th className="px-3 py-2 text-right font-semibold">Precio</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {ofertas.map((o) => {
                        const seleccionado = String(o.id_proveedor) === form.id_proveedor;
                        return (
                          <tr
                            key={o.id}
                            className={seleccionado ? "bg-primary/10" : "hover:bg-gray-50"}
                          >
                            <td className="px-3 py-2">
                              {o.proveedor?.nombre_empresa || o.proveedor?.nombre || `Proveedor #${o.id_proveedor}`}
                            </td>
                            <td className="px-3 py-2">
                              {o.formato || "—"}
                              {Number(o.cantidad_por_formato) > 0 &&
                                ` (${o.cantidad_por_formato} ${o.unidad_medida || ""})`}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ${Number(o.precio_unitario || 0).toLocaleString()}
                              <span className="text-gray-500"> {o.moneda || "CLP"}</span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {seleccionado ? (
                                <span className="text-primary font-semibold">Seleccionado</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => seleccionarProveedor(o.id_proveedor)}
                                  className="px-3 py-1 rounded-lg bg-primary text-white hover:bg-hover transition-colors"
                                >
                                  Seleccionar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {form.id_proveedor && (
                <p className="text-sm text-gray-600 mt-2">
                  Proveedor seleccionado:{" "}
                  <span className="font-semibold">
                    {proveedores.find((p) => String(p.id) === form.id_proveedor)?.nombre_empresa ||
                      proveedores.find((p) => String(p.id) === form.id_proveedor)?.nombre ||
                      `#${form.id_proveedor}`}
                  </span>
                </p>
              )}
            </>
          )}
          {formErrors.id_proveedor && <p className="text-red-600 text-sm mt-1">{formErrors.id_proveedor}</p>}
        </div>

        <div>
          <label className="block font-semibold mb-1">Bodega:</label>
          <Selector
            options={bodegasOptions}
            selectedValue={form.id_bodega}
            onSelect={(value) => setFormField("id_bodega", String(value ?? ""))}
            useFuzzy
            className="p-2 border rounded"
          />
          {formErrors.id_bodega && <p className="text-red-600 text-sm mt-1">{formErrors.id_bodega}</p>}
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
            <label className="block font-semibold mb-1 mt-4">Archivos Adjuntos:</label>
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
            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">Insumos del proveedor</h2>
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
                          <tr key={insumo.id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              <div className="pl-3">
                                <div className="text-gray-700">{insumo.formato || "—"}</div>
                                <div className="text-xs text-gray-500">
                                  {insumo.cantidad_por_formato == null ? "N/A" : insumo.cantidad_por_formato}{" "}
                                  {insumo.materiaPrima?.unidad_medida == null
                                    ? "Unidad desconocida"
                                    : insumo.materiaPrima?.unidad_medida}
                                </div>
                              </div>
                            </td>
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
                                onChange={(e) => handlePrecioChange(insumo.id, e.target.value)}
                                className="w-24 border border-gray-300 rounded-md px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <span className="text-sm text-gray-500"> {insumo.moneda || "CLP"}</span>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-600">
                  <p className="text-lg font-medium mb-2">No hay insumos disponibles.</p>
                  <p className="text-sm">Selecciona un proveedor para cargar sus insumos.</p>
                </div>
              </div>
            )}

            {formErrors.insumos && (
              <p className="text-red-600 text-center text-sm mt-4">{formErrors.insumos}</p>
            )}
          </div>

          <div className="col-span-1 flex flex-col justify-end h-full border-l pl-4">
            <div className="mt-auto">
              <h2 className="font-semibold text-lg mb-3 text-gray-800">Resumen de Insumos Seleccionados</h2>
              <div className="bg-gray-50 rounded-lg p-3 shadow-inner mb-4 max-h-80 overflow-y-auto">
                {insumosSeleccionados.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No hay insumos seleccionados.</p>
                ) : (
                  <ul className="divide-y divide-gray-200 text-sm bg-white rounded-lg shadow-sm">
                    {insumosSeleccionados.map((i, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center py-2 px-2 hover:bg-gray-50 transition"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800">
                            {i.formato === i.nombre ? "" : `${i.formato} - `}
                            {i.nombre || `MP #${i.id_proveedor_materia_prima}`}
                          </span>
                          <span className="text-gray-500 text-xs">
                            Cantidad: {i.cantidad_formato} {i.formato === i.nombre ? "" : i.formato}
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-hover disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : "Guardar Orden"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
