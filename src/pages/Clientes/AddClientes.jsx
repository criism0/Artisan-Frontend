import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, useApi } from "../../lib/api";
import { createPortal } from "react-dom";
import DireccionesManager from "../../components/DireccionesManager";
import SimilarNameConfirmModal from "../../components/SimilarNameConfirmModal";

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
        className="border px-3 py-2 w-full rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
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
            <ul className="bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
              {filtered.map((opt, idx) => {
                const label = opt.nombre || opt;
                const id = opt.id ?? opt;
                return (
                  <li
                    key={id || idx}
                    className="px-3 py-2 hover:bg-green-100 cursor-pointer"
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

export default function AddClientes() {
  const navigate = useNavigate();
  const api = useApi();
  const [canales, setCanales] = useState([]);
  const [listasPrecio, setListasPrecio] = useState([]);
  const [selectedCanal, setSelectedCanal] = useState("");
  const [selectedListaPrecio, setSelectedListaPrecio] = useState("");
  const [selectedTipoPrecio, setSelectedTipoPrecio] = useState("");
  const [direcciones, setDirecciones] = useState([]);
  const [clienteId, setClienteId] = useState(null);

  const [similarModal, setSimilarModal] = useState({
    open: false,
    inputName: "",
    matches: [],
  });
  const [pendingPayload, setPendingPayload] = useState(null);
  
  // Estado para condición de pago
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

  // Efecto para actualizar condicion_pago en formData
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
    const rutLimpio = rut.replace(/[.-]/g, '');
    if (!/^[0-9]+[0-9kK]$/.test(rutLimpio)) {
      return false;
    }
    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1).toUpperCase();
    if (numero.length < 7 || numero.length > 8) {
      return false;
    }
    let suma = 0;
    let multiplicador = 2;
    for (let i = numero.length - 1; i >= 0; i--) {
      suma += parseInt(numero[i]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    
    const resto = suma % 11;
    const dvCalculado = resto === 0 ? '0' : resto === 1 ? 'K' : (11 - resto).toString();
    
    return dv === dvCalculado;
  };

  const formatearRUT = (value) => {
    const rutLimpio = value.replace(/[^0-9kK]/g, '');
    
    if (rutLimpio.length <= 1) return rutLimpio;
    
    const numero = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return numeroFormateado + (dv ? '-' + dv : '');
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
    api("/canales")
      .then(data => setCanales(data))
      .catch(() => {});
    
    api("/lista-precio")
      .then(data => setListasPrecio(data))
      .catch(() => {});
  }, [api]);

  const handleChange = e => {
    const { name, value } = e.target;
    
    if (name === 'rut') {
      const rutFormateado = formatearRUT(value);
      setFormData(prev => ({ ...prev, [name]: rutFormateado }));
    } else if (name === 'telefono_comercial' || name === 'telefono_finanzas') {
      const telFormateado = formatearTelefonoChile(value);
      setFormData(prev => ({ ...prev, [name]: telFormateado }));
    } else if (name === 'condicion_pago') {
      // Solo permitir números enteros positivos
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: numericValue }));
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
    condicion_pago: "Ej: 30",
    email_comercial: "Ej: contacto@empresa.cl",
    contacto_comercial: "Ej: Juan Pérez",
    telefono_comercial: "Ej: +56 9 8765 4321",
    contacto_finanzas: "Ej: María López",
    telefono_finanzas: "Ej: +56 9 1234 5678",
    email_finanzas: "Ej: finanzas@empresa.cl"
  };

  const validateAll = () => {
    const newErrors = {};
    
    if (!selectedCanal) {
      newErrors.canal = "Debes seleccionar un canal.";
    }
    if (!selectedListaPrecio) {
      newErrors.lista_precio = "Debes seleccionar una lista de precios.";
    }
    if (!selectedTipoPrecio) {
      newErrors.tipo_precio = "Debes seleccionar un tipo de precio.";
    }

    const camposObligatorios = ['nombre_empresa', 'razon_social', 'rut', 'giro'];
    for (let key of camposObligatorios) {
      if (!formData[key].trim()) {
        newErrors[key] = "Campo obligatorio.";
      }
    }
    
    const camposContactoObligatorios = ['contacto_comercial', 'telefono_comercial', 'email_comercial'];
    for (let key of camposContactoObligatorios) {
      if (!formData[key].trim()) {
        newErrors[key] = "Campo obligatorio.";
      }
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
      newErrors.condicion_pago = "Campo obligatorio.";
    } else {
      const condicionPagoNum = parseInt(formData.condicion_pago);
      if (isNaN(condicionPagoNum) || condicionPagoNum <= 0) {
        newErrors.condicion_pago = "Debe ser un número entero mayor a 0.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const isValid = validateAll();
    if (!isValid) {
      return;
    }

    const canalSeleccionado = canales.find(c => c.nombre === selectedCanal);
    const listaPrecioSeleccionada = listasPrecio.find(l => l.nombre === selectedListaPrecio);
    const payload = {
      ...formData,
      condicion_pago: parseInt(formData.condicion_pago),
      id_canal: canalSeleccionado?.id || null,
      id_lista_precio: listaPrecioSeleccionada?.id || null,
      tipo_precio: selectedTipoPrecio,
      cuenta_corriente: " ",
      banco: " "
    };

    try {
      const response = await api("/clientes", { method: "POST", body: JSON.stringify(payload) });
      const nuevoClienteId = response.id;
      
      // Si hay direcciones, las guardamos
      if (direcciones.length > 0) {
        try {
          for (const direccion of direcciones) {
            const direccionData = {
              tipo_direccion: direccion.tipo_direccion,
              nombre_sucursal: direccion.nombre_sucursal,
              calle: direccion.calle,
              numero: direccion.numero,
              comuna: direccion.comuna,
              region: direccion.region,
              tipo_recinto: direccion.tipo_recinto,
              es_principal: direccion.es_principal,
              cliente_id: nuevoClienteId
            };
            await api("/direcciones", { method: "POST", body: JSON.stringify(direccionData) });
          }
        } catch (direccionError) {
          console.error("Error al guardar direcciones:", direccionError);
          alert("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después.");
        }
      }
      
      navigate("/clientes");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.data?.code === "SIMILAR_NAME") {
        setPendingPayload(payload);
        setSimilarModal({
          open: true,
          inputName: err.data?.input || payload.nombre_empresa,
          matches: err.data?.matches || [],
        });
        return;
      }

      console.error("Error al crear cliente:", err);
      alert("Error al crear cliente: " + (err.message));
    }
  };

  const confirmCreateAnyway = async () => {
    if (!pendingPayload) return;
    try {
      const response = await api("/clientes", {
        method: "POST",
        body: JSON.stringify({ ...pendingPayload, confirmSimilarName: true }),
      });
      const nuevoClienteId = response.id;

      if (direcciones.length > 0) {
        try {
          for (const direccion of direcciones) {
            const direccionData = {
              tipo_direccion: direccion.tipo_direccion,
              nombre_sucursal: direccion.nombre_sucursal,
              calle: direccion.calle,
              numero: direccion.numero,
              comuna: direccion.comuna,
              region: direccion.region,
              tipo_recinto: direccion.tipo_recinto,
              es_principal: direccion.es_principal,
              cliente_id: nuevoClienteId,
            };
            await api("/direcciones", { method: "POST", body: JSON.stringify(direccionData) });
          }
        } catch (direccionError) {
          console.error("Error al guardar direcciones:", direccionError);
          alert("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después.");
        }
      }

      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      navigate("/clientes");
    } catch (err) {
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      alert("Error al crear cliente: " + (err.message));
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <button onClick={() => navigate('/clientes')} className="text-primary">&larr; Volver</button>
      </div>
      <h1 className="text-2xl font-bold mb-6">Añadir Cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sección 1: Clasificación Comercial */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
            Clasificación Comercial
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Canal <span className="text-red-500">*</span>
              </label>
              <DynamicCombobox
                value={selectedCanal}
                onChange={setSelectedCanal}
                options={canales}
                onSelect={(canal) => setSelectedCanal(canal.nombre)}
                placeholder="Selecciona canal..."
              />
              {errors.canal && <p className="text-red-500 text-sm mt-1">{errors.canal}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Lista de Precios Asignada <span className="text-red-500">*</span>
              </label>
              <DynamicCombobox
                value={selectedListaPrecio}
                onChange={setSelectedListaPrecio}
                options={listasPrecio}
                onSelect={(lista) => setSelectedListaPrecio(lista.nombre)}
                placeholder="Selecciona lista de precios..."
              />
              {errors.lista_precio && <p className="text-red-500 text-sm mt-1">{errors.lista_precio}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Formato de Compra Predeterminado <span className="text-red-500">*</span>
              </label>
              <DynamicCombobox
                value={selectedTipoPrecio}
                onChange={setSelectedTipoPrecio}
                options={tiposPrecio}
                onSelect={(tp) => setSelectedTipoPrecio(tp)}
                placeholder="Selecciona formato..."
              />
              {errors.tipo_precio && <p className="text-red-500 text-sm mt-1">{errors.tipo_precio}</p>}
            </div>
          </div>
        </div>

        {/* Sección 2: Información Fiscal y de Facturación */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-green-100 text-green-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
            Información Fiscal y de Facturación
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Nombre Comercial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nombre_empresa"
                value={formData.nombre_empresa}
                onChange={handleChange}
                placeholder={placeholders.nombre_empresa}
                className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                  errors.nombre_empresa ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.nombre_empresa && <p className="text-red-500 text-sm mt-1">{errors.nombre_empresa}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="razon_social"
                value={formData.razon_social}
                onChange={handleChange}
                placeholder={placeholders.razon_social}
                className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                  errors.razon_social ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.razon_social && <p className="text-red-500 text-sm mt-1">{errors.razon_social}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                RUT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="rut"
                value={formData.rut}
                onChange={handleChange}
                placeholder={placeholders.rut}
                maxLength="12"
                className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                  errors.rut ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.rut && <p className="text-red-500 text-sm mt-1">{errors.rut}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Giro <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="giro"
                value={formData.giro}
                onChange={handleChange}
                placeholder={placeholders.giro}
                className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                  errors.giro ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.giro && <p className="text-red-500 text-sm mt-1">{errors.giro}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                Condición de Pago <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-green-600"
                      name="paymentType"
                      value="Contado"
                      checked={paymentType === "Contado"}
                      onChange={() => setPaymentType("Contado")}
                    />
                    <span className="ml-2">Contado</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-red-600"
                      name="paymentType"
                      value="Bloqueado"
                      checked={paymentType === "Bloqueado"}
                      onChange={() => setPaymentType("Bloqueado")}
                    />
                    <span className="ml-2">Bloqueado</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="paymentType"
                      value="Crédito"
                      checked={paymentType === "Crédito"}
                      onChange={() => setPaymentType("Crédito")}
                    />
                    <span className="ml-2">Crédito</span>
                  </label>
                </div>
                
                {paymentType === "Crédito" && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="Días"
                      value={creditDays}
                      onChange={(e) => setCreditDays(e.target.value)}
                      className={`border px-3 py-1 w-24 rounded text-gray-700 placeholder-gray-400 ${
                        errors.condicion_pago ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    <span className="text-gray-600 text-sm">días</span>
                  </div>
                )}
              </div>
              {errors.condicion_pago && <p className="text-red-500 text-sm mt-1">{errors.condicion_pago}</p>}
            </div>
          </div>
        </div>

        {/* Sección 3: Gestión de Direcciones */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-yellow-100 text-yellow-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
            Gestión de Direcciones
          </h2>
          
          <DireccionesManager 
            clienteId={clienteId}
            direcciones={direcciones}
            onDireccionesChange={setDirecciones}
            isEditing={true}
          />
        </div>

        {/* Sección 4: Puntos de Contacto */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="bg-purple-100 text-purple-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
            Puntos de Contacto
          </h2>
          
          <div className="space-y-6">
            {/* Contacto Comercial */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Contacto Comercial</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contacto_comercial"
                    value={formData.contacto_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.contacto_comercial}
                    className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                      errors.contacto_comercial ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.contacto_comercial && <p className="text-red-500 text-sm mt-1">{errors.contacto_comercial}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="telefono_comercial"
                    value={formData.telefono_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.telefono_comercial}
                    className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                      errors.telefono_comercial ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.telefono_comercial && <p className="text-red-500 text-sm mt-1">{errors.telefono_comercial}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email_comercial"
                    value={formData.email_comercial}
                    onChange={handleChange}
                    placeholder={placeholders.email_comercial}
                    className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                      errors.email_comercial ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.email_comercial && <p className="text-red-500 text-sm mt-1">{errors.email_comercial}</p>}
                </div>
              </div>
            </div>

            {/* Contacto Finanzas */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Contacto Finanzas (Opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="contacto_finanzas"
                    value={formData.contacto_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.contacto_finanzas}
                    className="border border-gray-300 px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="telefono_finanzas"
                    value={formData.telefono_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.telefono_finanzas}
                    className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                      errors.telefono_finanzas ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.telefono_finanzas && <p className="text-red-500 text-sm mt-1">{errors.telefono_finanzas}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    name="email_finanzas"
                    value={formData.email_finanzas}
                    onChange={handleChange}
                    placeholder={placeholders.email_finanzas}
                    className={`border px-4 py-2 w-full rounded text-gray-700 placeholder-gray-400 ${
                      errors.email_finanzas ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.email_finanzas && <p className="text-red-500 text-sm mt-1">{errors.email_finanzas}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de envío */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-hover font-medium text-lg"
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
        onCancel={() => {
          setSimilarModal({ open: false, inputName: "", matches: [] });
          setPendingPayload(null);
        }}
        onConfirm={confirmCreateAnyway}
        confirmText="Crear cliente igualmente"
      />
    </div>
  );
}

function formKeyToLabel(key) {
  const mapa = {
    nombre_empresa: "Nombre Comercial",
    razon_social: "Razón Social",
    rut: "RUT",
    giro: "Giro",
    email_transferencia: "Email Contacto",
    contacto_comercial: "Contacto Comercial",
    telefono_comercial: "Teléfono Comercial",
    contacto_finanzas: "Contacto Finanzas",
    telefono_finanzas: "Teléfono Finanzas"
  };
  return mapa[key] || key;
}
