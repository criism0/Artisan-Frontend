import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, useApi } from "../../lib/api";
import { createPortal } from "react-dom";
import DireccionesManager from "../../components/DireccionesManager";
import SimilarNameConfirmModal from "../../components/SimilarNameConfirmModal";
import { BackButton } from "../../components/Buttons/ActionButtons";

function DynamicCombobox({ value, onChange, options, onSelect, placeholder }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const filtered = (value || "").trim()
    ? options.filter((opt) =>
        opt.nombre?.toLowerCase().includes(value.toLowerCase()) ||
        opt.toLowerCase?.().includes(value.toLowerCase())
      )
    : options;

  const updatePosition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useEffect(() => {
    updatePosition();
  }, [open, value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!inputRef.current) return;
      if (!open) return;
      const target = e.target;
      if (target === inputRef.current || inputRef.current.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("click", handleClickOutside, true);
    return () => window.removeEventListener("click", handleClickOutside, true);
  }, [open]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
      {open && filtered.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 2147483647
            }}
          >
            <ul className="bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto">
              {filtered.map((opt, idx) => {
                const label = opt.nombre || opt;
                const id = opt.id ?? opt;
                return (
                  <li
                    key={id || idx}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-primary/10 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(opt);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

// Clase base reutilizable para inputs de texto
const inputClass = (hasError) =>
  `border px-3 py-2 w-full rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
    hasError ? "border-red-500" : "border-gray-300"
  }`;

export default function AddClientes() {
  const navigate = useNavigate();
  const api = useApi();
  const [canales, setCanales] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [selectedCanal, setSelectedCanal] = useState("");
  const [selectedListaPrecio, setSelectedListaPrecio] = useState("");
  const [selectedTipoPrecio, setSelectedTipoPrecio] = useState("");
  const [direcciones, setDirecciones] = useState([]);

  const [similarModal, setSimilarModal] = useState({
    open: false,
    inputName: "",
    matches: [],
  });
  const [pendingPayload, setPendingPayload] = useState(null);

  const [paymentType, setPaymentType] = useState("Contado");
  const [creditDays, setCreditDays] = useState("");

  const [formData, setFormData] = useState({
    nombre_empresa: "",
    razon_social: "",
    rut: "",
    giro: "",
    condicion_pago: "Contado",
    email_comercial: "",
    contacto_comercial: "",
    telefono_comercial: "",
    contacto_finanzas: "",
    telefono_finanzas: "",
    email_finanzas: ""
  });
  const [errors, setErrors] = useState({});

  const tiposPrecio = ["UNIDADES", "CAJAS"];

  useEffect(() => {
    if (paymentType === "Contado") {
      setFormData(prev => ({ ...prev, condicion_pago: "Contado" }));
    } else if (paymentType === "Bloqueado") {
      setFormData(prev => ({ ...prev, condicion_pago: "Bloqueado" }));
    } else if (paymentType === "Crédito") {
      setFormData(prev => ({ ...prev, condicion_pago: creditDays ? `Crédito ${creditDays} días` : "" }));
    }
  }, [paymentType, creditDays]);

  const validarRUT = (rut) => {
    const rutLimpio = rut.replace(/[.-]/g, "");
    if (!/^[0-9]+[0-9kK]$/.test(rutLimpio)) return false;
    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1).toUpperCase();
    if (numero.length < 7 || numero.length > 8) return false;
    let suma = 0;
    let multiplicador = 2;
    for (let i = numero.length - 1; i >= 0; i--) {
      suma += parseInt(numero[i]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resto = suma % 11;
    const dvCalculado = resto === 0 ? "0" : resto === 1 ? "K" : (11 - resto).toString();
    return dv === dvCalculado;
  };

  const formatearRUT = (value) => {
    const rutLimpio = value.replace(/[^0-9kK]/g, "");
    if (rutLimpio.length <= 1) return rutLimpio;
    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return numeroFormateado + (dv ? "-" + dv : "");
  };

  const formatearTelefonoChile = (value) => {
    const digits = value.replace(/\D/g, "");
    const sinPrefijo = digits.startsWith("56") ? digits.slice(2) : digits;
    let out = "+56";
    if (sinPrefijo.length === 0) return out;
    out += " " + sinPrefijo.slice(0, 1);
    if (sinPrefijo.length <= 1) return out;
    out += " " + sinPrefijo.slice(1, 5);
    if (sinPrefijo.length <= 5) return out;
    out += " " + sinPrefijo.slice(5, 9);
    return out.trim();
  };

  useEffect(() => {
    api("/canales").then(data => setCanales(data)).catch(() => {});
    api("/lista-precio").then(data => setListasPrecio(data)).catch(() => {});
  }, [api]);

  const handleChange = e => {
    const { name, value } = e.target;
    if (name === "rut") {
      setFormData(prev => ({ ...prev, [name]: formatearRUT(value) }));
    } else if (name === "telefono_comercial" || name === "telefono_finanzas") {
      setFormData(prev => ({ ...prev, [name]: formatearTelefonoChile(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const placeholders = {
    nombre_empresa: "Ej: Comercial Los Andes Ltda.",
    razon_social: "Ej: Los Andes S.A.",
    rut: "Ej: 12.345.678-9",
    giro: "Ej: Venta de alimentos",
    email_comercial: "Ej: contacto@empresa.cl",
    contacto_comercial: "Ej: Juan Pérez",
    telefono_comercial: "Ej: +56 9 8765 4321",
    contacto_finanzas: "Ej: María López",
    telefono_finanzas: "Ej: +56 9 1234 5678",
    email_finanzas: "Ej: finanzas@empresa.cl"
  };

  const validateAll = () => {
    const newErrors = {};
    if (!selectedCanal) newErrors.canal = "Debes seleccionar un canal.";
    if (!selectedListaPrecio) newErrors.lista_precio = "Debes seleccionar una lista de precios.";
    if (!selectedTipoPrecio) newErrors.tipo_precio = "Debes seleccionar un tipo de precio.";

    for (const key of ["nombre_empresa", "razon_social", "rut", "giro"]) {
      if (!formData[key].trim()) newErrors[key] = "Campo obligatorio.";
    }
    for (const key of ["contacto_comercial", "telefono_comercial", "email_comercial"]) {
      if (!formData[key].trim()) newErrors[key] = "Campo obligatorio.";
    }
    if (formData.rut && !validarRUT(formData.rut.trim())) {
      newErrors.rut = "RUT inválido. Verifique el formato y dígito verificador. Ej: 12.345.678-9";
    }
    if (formData.email_comercial && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_comercial)) {
      newErrors.email_comercial = "Correo inválido. Ej: contacto@empresa.cl";
    }
    if (formData.email_finanzas && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_finanzas)) {
      newErrors.email_finanzas = "Correo inválido. Ej: finanzas@empresa.cl";
    }
    const regexTelefonoCL = /^\+56\s\d\s\d{4}\s\d{4}$/;
    if (formData.telefono_comercial && !regexTelefonoCL.test(formData.telefono_comercial)) {
      newErrors.telefono_comercial = "Formato inválido. Use +56 X XXXX XXXX";
    }
    if (formData.telefono_finanzas && !regexTelefonoCL.test(formData.telefono_finanzas)) {
      newErrors.telefono_finanzas = "Formato inválido. Use +56 X XXXX XXXX";
    }
    if (!formData.condicion_pago || formData.condicion_pago.trim() === "") {
      newErrors.condicion_pago = paymentType === "Crédito" ? "Ingresa los días de crédito." : "Campo obligatorio.";
    } else if (paymentType === "Crédito") {
      const dias = parseInt(creditDays);
      if (isNaN(dias) || dias <= 0) newErrors.condicion_pago = "Debe ser un número entero mayor a 0.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildPayload = () => {
    const canalSeleccionado = canales.find(c => c.nombre === selectedCanal);
    const listaPrecioSeleccionada = listasPrecio.find(l => l.nombre === selectedListaPrecio);
    return {
      ...formData,
      id_canal: canalSeleccionado?.id || null,
      id_lista_precio: listaPrecioSeleccionada?.id || null,
      tipo_precio: selectedTipoPrecio,
      cuenta_corriente: " ",
      banco: " "
    };
  };

  const saveDirecciones = async (clienteId) => {
    for (const dir of direcciones) {
      await api("/direcciones", {
        method: "POST",
        body: JSON.stringify({
          tipo_direccion: dir.tipo_direccion,
          nombre_sucursal: dir.nombre_sucursal,
          calle: dir.calle,
          numero: dir.numero,
          comuna: dir.comuna,
          region: dir.region,
          tipo_recinto: dir.tipo_recinto,
          es_principal: dir.es_principal,
          cliente_id: clienteId
        })
      });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validateAll()) return;

    const payload = buildPayload();
    try {
      const response = await api("/clientes", { method: "POST", body: JSON.stringify(payload) });
      if (direcciones.length > 0) {
        try { await saveDirecciones(response.id); }
        catch { alert("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después."); }
      }
      navigate("/clientes");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.code === "SIMILAR_NAME") {
        setPendingPayload(payload);
        setSimilarModal({ open: true, inputName: err.data?.input || payload.nombre_empresa, matches: err.data?.matches || [] });
        return;
      }
      alert("Error al crear cliente: " + err.message);
    }
  };

  const confirmCreateAnyway = async () => {
    if (!pendingPayload) return;
    try {
      const response = await api("/clientes", {
        method: "POST",
        body: JSON.stringify({ ...pendingPayload, confirmSimilarName: true })
      });
      if (direcciones.length > 0) {
        try { await saveDirecciones(response.id); }
        catch { alert("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después."); }
      }
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      navigate("/clientes");
    } catch (err) {
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      alert("Error al crear cliente: " + err.message);
    }
  };

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  const SectionCard = ({ children }) => (
    <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
      <div className="p-6">{children}</div>
    </div>
  );

  const SectionHeader = ({ title }) => (
    <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
  );

  const FieldError = ({ msg }) =>
    msg ? <span className="text-red-500 text-xs mt-0.5">{msg}</span> : null;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-6">
        <BackButton to="/clientes" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Añadir Cliente</h1>

      <form onSubmit={handleSubmit}>

        {/* ── 1. Clasificación Comercial ── */}
        <SectionCard>
          <SectionHeader title="Clasificación Comercial" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Canal <span className="text-red-500">*</span>
              </span>
              <DynamicCombobox
                value={selectedCanal}
                onChange={setSelectedCanal}
                options={canales}
                onSelect={(canal) => { setSelectedCanal(canal.nombre); setErrors(p => ({ ...p, canal: "" })); }}
                placeholder="Selecciona canal..."
              />
              <FieldError msg={errors.canal} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Lista de Precios <span className="text-red-500">*</span>
              </span>
              <DynamicCombobox
                value={selectedListaPrecio}
                onChange={setSelectedListaPrecio}
                options={listasPrecio}
                onSelect={(lista) => { setSelectedListaPrecio(lista.nombre); setErrors(p => ({ ...p, lista_precio: "" })); }}
                placeholder="Selecciona lista de precios..."
              />
              <FieldError msg={errors.lista_precio} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Formato de Compra <span className="text-red-500">*</span>
              </span>
              <DynamicCombobox
                value={selectedTipoPrecio}
                onChange={setSelectedTipoPrecio}
                options={tiposPrecio}
                onSelect={(tp) => { setSelectedTipoPrecio(tp); setErrors(p => ({ ...p, tipo_precio: "" })); }}
                placeholder="Selecciona formato..."
              />
              <FieldError msg={errors.tipo_precio} />
            </label>

          </div>
        </SectionCard>

        {/* ── 2. Información Fiscal ── */}
        <SectionCard>
          <SectionHeader title="Información Fiscal y de Facturación" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Nombre Comercial <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                name="nombre_empresa"
                value={formData.nombre_empresa}
                onChange={handleChange}
                placeholder={placeholders.nombre_empresa}
                className={inputClass(errors.nombre_empresa)}
              />
              <FieldError msg={errors.nombre_empresa} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Razón Social <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                name="razon_social"
                value={formData.razon_social}
                onChange={handleChange}
                placeholder={placeholders.razon_social}
                className={inputClass(errors.razon_social)}
              />
              <FieldError msg={errors.razon_social} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                RUT <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                name="rut"
                value={formData.rut}
                onChange={handleChange}
                placeholder={placeholders.rut}
                maxLength="12"
                className={inputClass(errors.rut)}
              />
              <FieldError msg={errors.rut} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Giro <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                name="giro"
                value={formData.giro}
                onChange={handleChange}
                placeholder={placeholders.giro}
                className={inputClass(errors.giro)}
              />
              <FieldError msg={errors.giro} />
            </label>

            {/* Condición de pago — ocupa ambas columnas en móvil, una en md */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Condición de Pago <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-5 mt-1">
                {[
                  { value: "Contado", color: "accent-green-600" },
                  { value: "Bloqueado", color: "accent-red-500" },
                  { value: "Crédito", color: "accent-blue-600" },
                ].map(({ value, color }) => (
                  <label key={value} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value={value}
                      checked={paymentType === value}
                      onChange={() => setPaymentType(value)}
                      className={`w-4 h-4 ${color}`}
                    />
                    <span className="text-sm text-gray-700">{value}</span>
                  </label>
                ))}
              </div>
              {paymentType === "Crédito" && (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    placeholder="30"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    min="1"
                    className={`border px-3 py-1.5 w-24 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                      errors.condicion_pago ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  <span className="text-sm text-gray-500">días</span>
                </div>
              )}
              <FieldError msg={errors.condicion_pago} />
            </div>

          </div>
        </SectionCard>

        {/* ── 3. Direcciones ── */}
        <SectionCard>
          <SectionHeader title="Gestión de Direcciones" />
          <DireccionesManager
            clienteId={null}
            direcciones={direcciones}
            onDireccionesChange={setDirecciones}
            isEditing={true}
          />
        </SectionCard>

        {/* ── 4. Puntos de Contacto ── */}
        <SectionCard>
          <SectionHeader title="Puntos de Contacto" />
          <div className="space-y-6">

            {/* Contacto Comercial */}
            <div className="border-l-4 border-primary/60 pl-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Contacto Comercial
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">
                    Nombre <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    name="contacto_comercial"
                    value={formData.contacto_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.contacto_comercial}
                    className={inputClass(errors.contacto_comercial)}
                  />
                  <FieldError msg={errors.contacto_comercial} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">
                    Teléfono <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    name="telefono_comercial"
                    value={formData.telefono_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.telefono_comercial}
                    className={inputClass(errors.telefono_comercial)}
                  />
                  <FieldError msg={errors.telefono_comercial} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">
                    E-mail <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="email"
                    name="email_comercial"
                    value={formData.email_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.email_comercial}
                    className={inputClass(errors.email_comercial)}
                  />
                  <FieldError msg={errors.email_comercial} />
                </label>

              </div>
            </div>

            {/* Contacto Finanzas */}
            <div className="border-l-4 border-primary/30 pl-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Contacto Finanzas <span className="font-normal text-gray-400">(Opcional)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Nombre</span>
                  <input
                    type="text"
                    name="contacto_finanzas"
                    value={formData.contacto_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.contacto_finanzas}
                    className="border border-gray-300 px-3 py-2 w-full rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Teléfono</span>
                  <input
                    type="text"
                    name="telefono_finanzas"
                    value={formData.telefono_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.telefono_finanzas}
                    className={inputClass(errors.telefono_finanzas)}
                  />
                  <FieldError msg={errors.telefono_finanzas} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">E-mail</span>
                  <input
                    type="email"
                    name="email_finanzas"
                    value={formData.email_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.email_finanzas}
                    className={inputClass(errors.email_finanzas)}
                  />
                  <FieldError msg={errors.email_finanzas} />
                </label>

              </div>
            </div>

          </div>
        </SectionCard>

        {/* ── Acciones ── */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover font-medium transition-colors"
          >
            Guardar Cliente
          </button>
        </div>

      </form>

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="cliente"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        onCancel={() => { setSimilarModal({ open: false, inputName: "", matches: [] }); setPendingPayload(null); }}
        onConfirm={confirmCreateAnyway}
        confirmText="Crear cliente igualmente"
      />
    </div>
  );
}
