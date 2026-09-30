import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ApiError, useApi } from "../../lib/api";
import DynamicCombobox from "../../components/UI/DynamicCombobox";
import Selector from "../../components/Forms/Selector";
import DireccionesManager from "../../components/Direcciones/DireccionesManager";
import SimilarNameConfirmModal from "../../components/Modals/SimilarNameConfirmModal";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { Spinner } from "../../components/UI/Spinner.jsx";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import RutLookupField from "../../components/RUT/RutLookupField.jsx";
import { esEmailValido, formatPhoneInput, validarTelefonoCL } from "../../services/formatHelpers";


export default function AddClientes() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const canWriteClients = checkScope(ModelType.CLIENTE, ScopeType.WRITE);
  const canWriteAddress = checkScope(ModelType.DIRECCION, ScopeType.WRITE);

  // 🔴 El valor es el del ENUM de la base (`Cliente.formato_compra_predeterminado`); la etiqueta
  // es lo que lee el operario. Antes las opciones eran las cadenas crudas en mayúscula.
  const FORMATOS_COMPRA = [
    { value: "UNIDADES", label: "Unidades" },
    { value: "CAJAS", label: "Cajas" },
  ];

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
    const numeroFormateado = Number(numero).toLocaleString('es-CL');
    return numeroFormateado + (dv ? '-' + dv : '');
  };

  useEffect(() => {
    Promise.all([
      api("/canales").then(data => setCanales(data)).catch(() => {}),
      api("/lista-precio").then(data => setListasPrecio(data)).catch(() => {}),
    ]).finally(() => setIsLoading(false));
  }, [api]);

  // Prefill al venir desde "Crear cliente nuevo" en la Cola IA: la IA ya
  // extrajo el nombre/RUT del correo, así el operario no vuelve a tipearlos.
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill) return;
    setFormData(prev => ({
      ...prev,
      nombre_empresa: prefill.nombre_empresa ? prefill.nombre_empresa : prev.nombre_empresa,
      rut: prefill.rut ? formatearRUT(prefill.rut) : prev.rut,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    
    if (name === 'rut') {
      const rutFormateado = formatearRUT(value);
      setFormData(prev => ({ ...prev, [name]: rutFormateado }));
    } else if (name === 'telefono_comercial' || name === 'telefono_finanzas') {
      const telFormateado = formatPhoneInput(value);
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

  // Handler específico para el campo RUT (RutLookupField llama onChange con el evento del input)
  const handleRutChange = (e) => {
    const rutFormateado = formatearRUT(e.target.value);
    setFormData(prev => ({ ...prev, rut: rutFormateado }));
    setErrors(prev => ({ ...prev, rut: '' }));
  };

  // Callback cuando LibreDTE devuelve datos del contribuyente: autocompleta razón social, giro y dirección
  const handleRutFound = (info) => {
    setFormData(prev => ({
      ...prev,
      razon_social: info.razon_social || prev.razon_social,
      giro: info.giro || prev.giro,
      // Autocompletar nombre_empresa solo si está vacío
      nombre_empresa: prev.nombre_empresa || info.razon_social || prev.nombre_empresa,
    }));
    setErrors(prev => ({ ...prev, razon_social: '', giro: '' }));
    toast.success(`Empresa encontrada en el SII: ${info.razon_social}`);
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
      newErrors.formato_compra = "Debes seleccionar un tipo de precio.";
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
    if (formData.email_comercial && !esEmailValido(formData.email_comercial)) {
      newErrors.email_comercial = "Correo inválido. Ej: contacto@empresa.cl";
    }
    if (formData.email_finanzas && !esEmailValido(formData.email_finanzas)) {
      newErrors.email_finanzas = "Correo inválido. Ej: finanzas@empresa.cl";
    }
    if (formData.telefono_comercial && !validarTelefonoCL(formData.telefono_comercial)) {
      newErrors.telefono_comercial = "Formato inválido. Use +56 X XXXX XXXX";
    }
    if (formData.telefono_finanzas && !validarTelefonoCL(formData.telefono_finanzas)) {
      newErrors.telefono_finanzas = "Formato inválido. Use +56 X XXXX XXXX";
    }
    if (paymentType === "Crédito") {
      const dias = parseInt(creditDays);
      if (!creditDays || isNaN(dias) || dias <= 0) {
        newErrors.condicion_pago = "Ingresa un número de días válido (mayor a 0).";
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

    if (!canWriteClients || (!canWriteAddress && direcciones.length > 0)) {
      toast.permissionError(
        [ModelType.CLIENTE, ScopeType.WRITE],
        ...(
          direcciones.length > 0
          ? [[ModelType.DIRECCION, ScopeType.WRITE]]
          : []
        )
      );
      setIsSubmitting(false);
      return;
    }

    const canalSeleccionado = canales.find(c => c.nombre === selectedCanal);
    const listaPrecioSeleccionada = listasPrecio.find(l => l.nombre === selectedListaPrecio);
    const payload = {
      ...formData,
      condicion_pago: formData.condicion_pago,
      id_canal: canalSeleccionado?.id || null,
      id_lista_precio: listaPrecioSeleccionada?.id || null,
      // 🔴 SE LLAMA `formato_compra_predeterminado`. Se mandaba como `tipo_precio`, un nombre que
      // no existe en ninguna parte del backend, así que el valor elegido se descartaba en
      // silencio y el cliente quedaba siempre en UNIDADES por el default del modelo. Medido en
      // producción: los ÚNICOS 2 clientes en CAJAS (Jumbo y WalMart) se marcaron por SQL.
      formato_compra_predeterminado: selectedTipoPrecio,
      cuenta_corriente: " ",
      banco: " "
    };

    try {
      setIsSubmitting(true);
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
          toast.warning("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después.");
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
      toast.error("Error al crear cliente: " + (err.message));
    } finally {
      setIsSubmitting(false);
    }    
  };

  const confirmCreateAnyway = async () => {
    if (!pendingPayload) return;

    if (!canWriteClients || (!canWriteAddress && direcciones.length > 0)) {
      toast.permissionError(
        [ModelType.CLIENTE, ScopeType.WRITE],
        ...(
          direcciones.length > 0 
          ? [[ModelType.DIRECCION, ScopeType.WRITE]]
          : []
        )
      );
      setIsSubmitting(false);
      return;
    }

    try {
      setIsSubmitting(true);
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
          toast.warning("Cliente creado pero hubo un error al guardar las direcciones. Puedes editarlas después.");
        }
      }

      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      navigate("/clientes");
    } catch (err) {
      setSimilarModal({ open: false, inputName: "", matches: [] });
      setPendingPayload(null);
      toast.error("Error al crear cliente: " + (err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <PageLoader message="Cargando datos" />;

  return (
    <div>
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <Spinner size="lg" />
        </div>
      )}
      <div className="mb-4">
        <BackButton to="/clientes" />
      </div>
      <h1 className="text-2xl font-bold text-text mb-6">Añadir Cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Sección 1: Clasificación Comercial */}
        <div className="bg-white p-6 rounded-xl shadow border border-border">
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
            <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
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
              {/* Son dos valores fijos del enum, no una lista que se busque: un desplegable
                  simple. Antes era un combobox con texto libre encima de las mismas 2 opciones. */}
              {/* El mismo estilo que el canal y la lista de precios, que van a su lado en la
                  misma grilla: `Selector` no trae borde propio, sólo aplica el className. */}
              <Selector
                options={FORMATOS_COMPRA}
                selectedValue={selectedTipoPrecio}
                onSelect={setSelectedTipoPrecio}
                className="border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cómo pide y recibe este cliente. Las órdenes nuevas nacen con este formato y se
                muestran, pickean y facturan así; se puede cambiar orden por orden.
              </p>
              {errors.formato_compra && <p className="text-red-500 text-sm mt-1">{errors.formato_compra}</p>}
            </div>
          </div>
        </div>

        {/* Sección 2: Información Fiscal y de Facturación */}
        <div className="bg-white p-6 rounded-xl shadow border border-border">
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
            <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
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
              <RutLookupField
                value={formData.rut}
                onChange={handleRutChange}
                onFound={handleRutFound}
                error={errors.rut}
                placeholder={placeholders.rut}
              />
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
        <div className="bg-white p-6 rounded-xl shadow border border-border">
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
            <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
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
        <div className="bg-white p-6 rounded-xl shadow border border-border">
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
            <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
            Puntos de Contacto
          </h2>
          
          <div className="space-y-6">
            {/* Contacto Comercial */}
            <div className="border-l-4 border-primary/60 pl-4">
              <h3 className="text-base font-semibold text-text mb-3">Contacto Comercial</h3>
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
            <div className="border-l-4 border-primary/30 pl-4">
              <h3 className="text-base font-semibold text-text mb-3">Contacto Finanzas (Opcional)</h3>
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
            disabled={isSubmitting}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-hover font-medium text-lg disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Guardar Cliente"}
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
