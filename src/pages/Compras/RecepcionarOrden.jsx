// src/pages/compras/RecepcionarOrden.jsx
//
// Flujo de recepción (orden real del proceso):
//   1) CUADRE DE FACTURA: por cada ítem se declara la cantidad recepcionada
//      (en la unidad de consumo del insumo) y el precio unitario según la
//      factura del proveedor → total neto por ítem y total del documento.
//   2) DECLARACIÓN DE BULTOS: recién después se declara en cuántos bultos
//      llegó cada ítem; la suma de los bultos debe CUADRAR con la cantidad
//      declarada en la factura (la factura manda).
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Table from "../../components/Tables/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { useApi, apiBlob } from "../../lib/api";
import { toast } from "../../lib/toast";
import { buildOcEmailItemsFromOrden, notifyOrderChange } from "../../services/emailService";
import { useAuth } from "../../auth/AuthContext";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatCLP } from "../../services/formatHelpers";
import AvanceItems from "../../components/AvanceItems";

// Evita que el scroll cambie el valor del input type="number"
const handleNumberInputWheel = (e) => {
  e.preventDefault();
};

const EPSILON = 1e-6;

export default function RecepcionarOrden() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const { ordenId } = useParams();
  const [ordenData, setOrdenData] = useState(null);
  const [bodegas, setBodegas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const fechaActual = new Date().toISOString().split("T")[0];

  const canWritePurchaseOrder = checkScope(ModelType.ORDEN_COMPRA, ScopeType.WRITE);
  const canWriteBulk = checkScope(ModelType.BULTO, ScopeType.WRITE);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const res = await api(`/bodegas`, { method: "GET" });
        const list = Array.isArray(res) ? res : (Array.isArray(res?.bodegas) ? res.bodegas : []);
        setBodegas(list);
      } catch {
        setBodegas([]);
      }
    };
    fetchBodegas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadEtiquetasForBultos = async ({ idsBultos, ordenIdForName }) => {
    const ids_bultos = Array.isArray(idsBultos) ? idsBultos.filter(Boolean) : [];
    if (ids_bultos.length === 0) return;

    const blob = await apiBlob("/bultos/etiquetas", { method: "POST", body: { ids_bultos } });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Etiquetas_OC_${ordenIdForName ?? ""}_Recepcion.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setIsLoading(true);
    const fetchOrden = async () => {
      try {
        const fetched = await api(`/proceso-compra/ordenes/${ordenId}`);

        if (!fetched || fetched.error) throw new Error("Error al obtener orden");

        // Neto ya facturado en recepciones anteriores (desde bultos existentes)
        const rawBultos = Array.isArray(fetched?.bultos)
          ? fetched.bultos
          : (Array.isArray(fetched?.Bultos) ? fetched.Bultos : []);

        const netoFacturadoPrevByMpocId = {};
        for (const b of rawBultos) {
          const mpocId = b?.id_materia_prima_orden_de_compra ?? b?.materiaPrimaOrdenDeCompra?.id;
          if (!mpocId) continue;

          const costoUnitario = Number(b?.costo_unitario);
          const unidades = Number(b?.cantidad_unidades);
          if (!Number.isFinite(costoUnitario) || !Number.isFinite(unidades)) continue;

          netoFacturadoPrevByMpocId[mpocId] =
            (Number(netoFacturadoPrevByMpocId[mpocId]) || 0) + (costoUnitario * unidades);
        }

        // Para equivalencias formato de compra ↔ unidad base necesitamos la
        // info completa de formatos del proveedor (PMP).
        let proveedorData = null;
        try {
          proveedorData = await api(`/proveedores/${fetched.id_proveedor}`, { method: "GET" });
        } catch {
          proveedorData = null;
        }

        const pmpById = {};
        const pmps = Array.isArray(proveedorData?.materiasPrimas) ? proveedorData.materiasPrimas : [];
        for (const p of pmps) {
          pmpById[p.id] = p;
        }

        const getBasePmp = (pmp) => {
          if (!pmp) return null;

          const visited = new Set();
          let cur = pmp;

          // Seguimos id_formato_hijo hasta llegar a hoja (formato base)
          while (cur?.id_formato_hijo) {
            if (visited.has(cur.id)) break;
            visited.add(cur.id);
            const next = pmpById[cur.id_formato_hijo];
            if (!next) break;
            cur = next;
          }

          return cur;
        };

        // Fallback: si un proveedor no tiene relaciones id_formato_hijo pobladas,
        // intentamos elegir el "más pequeño" por cantidad_por_formato.
        const fallbackBaseByMpId = {};
        for (const p of pmps) {
          const mpId = p?.materiaPrima?.id ?? p?.id_materia_prima;
          if (!mpId) continue;
          const qty = Number(p.cantidad_por_formato) || 0;
          if (!fallbackBaseByMpId[mpId] || qty < (Number(fallbackBaseByMpId[mpId].cantidad_por_formato) || Infinity)) {
            fallbackBaseByMpId[mpId] = p;
          }
        }

        const insumosTransformados = fetched.materiasPrimas.map((mp) => {
          const purchasePmpId = mp.id_proveedor_materia_prima;
          const purchasePmp = pmpById[purchasePmpId] || mp.proveedorMateriaPrima;
          const mpId = purchasePmp?.materiaPrima?.id ?? purchasePmp?.id_materia_prima;
          const basePmp = getBasePmp(purchasePmp) || (mpId ? fallbackBaseByMpId[mpId] : null);

          const purchaseQty = Number(purchasePmp?.cantidad_por_formato) || 0;
          const baseQty = Number(basePmp?.cantidad_por_formato) || 1;
          const ratio = baseQty > 0 ? (purchaseQty / baseQty) : 1;

          const cantidadSolicitadaFormato = Number(mp.cantidad_formato) || 0;
          const cantidadRecepcionadaAcumFormato = Number(mp.cantidad_recepcionada) || 0;
          const cantidadPendienteFormato = Math.max(
            0,
            cantidadSolicitadaFormato - cantidadRecepcionadaAcumFormato
          );

          const pendienteBaseUnits = cantidadPendienteFormato * ratio;

          const precioUnitarioOC = Number(mp.precio_unitario) || 0;
          // Precio de la OC llevado a la unidad base (referencia para la factura)
          const precioBaseOC = ratio > 0 ? (precioUnitarioOC / ratio) : precioUnitarioOC;

          return {
            // Identificadores
            mpocId: mp.id,
            id_proveedor_materia_prima: purchasePmpId,

            // Visual
            nombre:
              purchasePmp?.materiaPrima?.nombre ||
              purchasePmp?.MateriaPrima?.nombre ||
              "—",
            formato: purchasePmp?.formato || mp.formato || "",
            unidad_medida:
              purchasePmp?.unidad_medida ||
              purchasePmp?.materiaPrima?.unidad_medida ||
              "",
            base_formato: basePmp?.formato || "",
            base_qty: baseQty,
            purchase_qty: purchaseQty,
            ratio,

            // Pedido
            cantidad_solicitada: cantidadSolicitadaFormato,
            cantidad_recepcionada_acumulada: cantidadRecepcionadaAcumFormato,
            cantidad_pendiente: cantidadPendienteFormato,
            pendiente_base_units: pendienteBaseUnits,

            // ── Paso 1: cuadre de factura (la factura manda) ──
            // Cantidad recepcionada según factura, en unidad base del insumo.
            cantidad_factura: pendienteBaseUnits > 0 ? Number(pendienteBaseUnits.toFixed(4)) : 0,
            // Precio unitario según factura ($ por unidad base); parte con el de la OC.
            precio_unitario_factura: Number(precioBaseOC.toFixed(4)),
            // Total neto del ítem (auto = cantidad × precio, editable para cuadrar redondeos)
            total_neto_factura: Number((pendienteBaseUnits * precioBaseOC).toFixed(2)),
            costoEdited: false,
            neto_facturado_prev: Number(netoFacturadoPrevByMpocId?.[mp.id]) || 0,

            // ── Paso 2: bultos (deben cuadrar con la factura) ──
            bultos: 0,
            bultos_detalle: [],
            total_base_units: 0,

            // Info OC
            precio_unitario: precioUnitarioOC,
          };
        })
        // Ocultar insumos ya totalmente recepcionados (pendiente = 0)
        .filter((i) => (Number(i?.cantidad_pendiente) || 0) > 1e-9);

        // Avance completo de la OC (incluye insumos ya recepcionados al 100%)
        const avanceItems = fetched.materiasPrimas.map((mp) => {
          const purchasePmp = pmpById[mp.id_proveedor_materia_prima] || mp.proveedorMateriaPrima;
          return {
            id: mp.id,
            nombre:
              purchasePmp?.materiaPrima?.nombre ||
              purchasePmp?.MateriaPrima?.nombre ||
              `Materia prima #${mp.id_proveedor_materia_prima}`,
            unidad: purchasePmp?.formato || mp.formato || "",
            solicitado: Number(mp.cantidad_formato) || 0,
            completado: Number(mp.cantidad_recepcionada) || 0,
          };
        });

        setOrdenData({
          avance_items: avanceItems,
          ...fetched,
          proveedor: fetched.proveedor?.nombre_empresa || fetched.id_proveedor,
          lugar: fetched.BodegaSolicitante?.nombre || "-",
          numero: `OC-${String(fetched.id).padStart(3, "0")}`,
          id_bodega_recepcion: fetched.id_bodega_destino ?? "",
          fecha_recepcion: fechaActual,
          numero_factura: "",
          fecha_documento: "",
          guia_despacho: "",
          insumos: insumosTransformados,
        });
      } catch (error) {
        toast.error(`Error al cargar la orden: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenId]);

  const buildDefaultDistribution = (totalBaseUnits, cantidadBultos) => {
    const out = [];
    if (!cantidadBultos || cantidadBultos <= 0) return out;
    if (Number.isInteger(totalBaseUnits)) {
      const totalInt = Math.trunc(totalBaseUnits);
      const base = Math.floor(totalInt / cantidadBultos);
      const rem = totalInt % cantidadBultos;
      for (let i = 0; i < cantidadBultos; i++) out.push(base + (i < rem ? 1 : 0));
    } else {
      const u = Number((totalBaseUnits / cantidadBultos).toFixed(4));
      for (let i = 0; i < cantidadBultos; i++) out.push(u);
    }
    return out;
  };

  const sumBultos = (insumo) =>
    (insumo.bultos_detalle || []).reduce((s, b) => s + (Number(b.cantidad_unidades) || 0), 0);

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

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setOrdenData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateInsumo = (insumoId, updater) => {
    setOrdenData((prev) => ({
      ...prev,
      insumos: prev.insumos.map((insumo) =>
        insumo.id_proveedor_materia_prima !== insumoId ? insumo : updater(insumo)
      ),
    }));
  };

  // ── Paso 1: cambios en la factura ──────────────────────────────────────────

  const recalcTotales = (insumo) => {
    const next = { ...insumo, total_base_units: sumBultos(insumo) };
    if (!next.costoEdited) {
      const cant = Number(next.cantidad_factura) || 0;
      const precio = Number(next.precio_unitario_factura) || 0;
      next.total_neto_factura = Number((cant * precio).toFixed(2));
    }
    return next;
  };

  const handleCantidadFacturaChange = (insumoId, value) => {
    updateInsumo(insumoId, (insumo) => {
      const next = { ...insumo, cantidad_factura: value };
      // Si ya había bultos declarados, redistribuir sobre la nueva cantidad
      const bCount = Number(next.bultos) || 0;
      if (bCount > 0) {
        const dist = buildDefaultDistribution(Number(value) || 0, bCount);
        next.bultos_detalle = dist.map((u, i) => ({
          cantidad_unidades: u,
          identificador_proveedor: next.bultos_detalle?.[i]?.identificador_proveedor || "",
          loteEdited: next.bultos_detalle?.[i]?.loteEdited || false,
          unitsEdited: false,
        }));
      }
      return recalcTotales(next);
    });
  };

  const handlePrecioFacturaChange = (insumoId, value) => {
    updateInsumo(insumoId, (insumo) =>
      recalcTotales({ ...insumo, precio_unitario_factura: value })
    );
  };

  const handleTotalNetoChange = (insumoId, value) => {
    updateInsumo(insumoId, (insumo) => ({
      ...insumo,
      total_neto_factura: value,
      costoEdited: true,
    }));
  };

  // ── Paso 2: cambios en bultos ───────────────────────────────────────────────

  const handleBultosChange = (insumoId, newBultos) => {
    const bCount = parseInt(newBultos) || 0;
    updateInsumo(insumoId, (insumo) => {
      // Distribuir por defecto la cantidad declarada en la factura
      const declarado = Number(insumo.cantidad_factura) || 0;
      const dist = buildDefaultDistribution(declarado, bCount);
      const bultos_detalle = dist.map((u) => ({
        cantidad_unidades: u,
        identificador_proveedor: "",
        loteEdited: false,
        unitsEdited: false,
      }));

      return recalcTotales({ ...insumo, bultos: bCount, bultos_detalle });
    });
  };

  const handleBultoUnitsChange = (insumoId, idx, value) => {
    updateInsumo(insumoId, (insumo) => {
      const detalle = Array.isArray(insumo.bultos_detalle) ? insumo.bultos_detalle : [];
      const nextDetalle = detalle.map((b) => ({ ...b }));

      // Marca corte en el bulto editado
      nextDetalle[idx] = {
        ...nextDetalle[idx],
        cantidad_unidades: value,
        unitsEdited: true,
      };

      // Propagar hacia adelante hasta el siguiente editado manualmente
      for (let i = idx + 1; i < nextDetalle.length; i++) {
        if (nextDetalle[i]?.unitsEdited) break;
        nextDetalle[i] = { ...nextDetalle[i], cantidad_unidades: value };
      }

      return recalcTotales({ ...insumo, bultos_detalle: nextDetalle });
    });
  };

  const handleLoteChange = (insumoId, idx, value) => {
    updateInsumo(insumoId, (insumo) => {
      const detalle = Array.isArray(insumo.bultos_detalle) ? insumo.bultos_detalle : [];
      const next = detalle.map((b) => ({ ...b }));

      // Marca corte en el bulto editado
      next[idx] = { ...next[idx], identificador_proveedor: value, loteEdited: true };

      // Propagar hacia adelante hasta el siguiente editado manualmente
      for (let i = idx + 1; i < next.length; i++) {
        if (next[i]?.loteEdited) break;
        next[i] = { ...next[i], identificador_proveedor: value };
      }

      return { ...insumo, bultos_detalle: next };
    });
  };

  const validarNumeroFactura = (valor) => {
    const regexFacturas = /^\d+(,\s*\d+)*$/;
    return regexFacturas.test(valor);
  };

  const handleFinalizarRecepcion = async () => {
    const newErrors = {};
    if (!ordenData?.id_bodega_recepcion) {
      newErrors.id_bodega_recepcion = "Debe seleccionar la bodega donde se recepciona.";
    }
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

    const conCantidad = ordenData.insumos.filter(
      (i) => (Number(i.cantidad_factura) || 0) > EPSILON
    );
    if (conCantidad.length === 0) {
      newErrors.insumos = "Declara la cantidad recepcionada de al menos un insumo (según la factura).";
    }

    // Validar cuadre factura ↔ bultos por ítem
    for (const insumo of conCantidad) {
      const declarado = Number(insumo.cantidad_factura) || 0;
      const b = Number(insumo.bultos) || 0;
      const baseLabel = insumo.base_formato?.trim?.() || "un.";

      const precio = Number(insumo.precio_unitario_factura);
      if (!Number.isFinite(precio) || precio < 0) {
        newErrors.insumos = `Precio unitario inválido en ${insumo.nombre}.`;
        break;
      }
      const neto = Number(insumo.total_neto_factura);
      if (!Number.isFinite(neto) || neto < 0) {
        newErrors.insumos = `Total neto inválido en ${insumo.nombre}.`;
        break;
      }

      if (b <= 0) {
        newErrors.insumos =
          `Declara los bultos de ${insumo.nombre} (paso 2), ` +
          `o deja su cantidad en 0 si no vino en esta recepción.`;
        break;
      }
      const detalle = Array.isArray(insumo.bultos_detalle) ? insumo.bultos_detalle : [];
      if (detalle.length !== b) {
        newErrors.insumos = `Faltan bultos por declarar en ${insumo.nombre}.`;
        break;
      }
      for (const d of detalle) {
        const u = Number(d?.cantidad_unidades);
        const lote = d?.identificador_proveedor?.toString?.().trim?.() || "";
        if (!Number.isFinite(u) || u <= 0 || !lote) {
          newErrors.insumos = `Completa unidades y lote en todos los bultos de ${insumo.nombre}.`;
          break;
        }
      }
      if (newErrors.insumos) break;

      const suma = sumBultos(insumo);
      if (Math.abs(suma - declarado) > 1e-4) {
        newErrors.insumos =
          `Los bultos de ${insumo.nombre} suman ${suma.toFixed(2)} ${baseLabel} ` +
          `pero la factura declara ${declarado.toFixed(2)} ${baseLabel}. Deben cuadrar.`;
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Por favor corrija los errores en el formulario.");
      return;
    }
    setErrors({});

    if (!canWritePurchaseOrder || !canWriteBulk) {
      toast.permissionError(
        [ModelType.ORDEN_COMPRA, ScopeType.WRITE],
        [ModelType.BULTO, ScopeType.WRITE]
      );
      return;
    }

    try {
      const payload = {
        pagada: true,
        id_bodega_recepcion: Number(ordenData.id_bodega_recepcion),
        fecha_recepcion: ordenData.fecha_recepcion,
        numero_factura: ordenData.numero_factura,
        fecha_documento: ordenData.fecha_documento,
        guia_despacho: ordenData.guia_despacho,
        materias_primas_recepcionadas: conCantidad.map((insumo) => {
          const ratio = Number(insumo.ratio) || 1;
          const cantidadBase = Number(insumo.cantidad_factura) || 0;
          return {
            id_proveedor_materia_prima: insumo.id_proveedor_materia_prima,
            id_materia_prima_orden_de_compra: insumo.mpocId,
            // El avance de la OC se lleva en formatos de compra
            cantidad_recepcionada: ratio > 0 ? cantidadBase / ratio : cantidadBase,
            cantidad_bultos: insumo.bultos,
            bultos_detalle: (insumo.bultos_detalle || []).map((b) => ({
              cantidad_unidades: Number(b.cantidad_unidades),
              identificador_proveedor: b.identificador_proveedor,
            })),
            total_neto_factura: Number(insumo.total_neto_factura) || 0,
          };
        }),
      };

      const response = await api(
        `/proceso-compra/ordenes/${ordenId}/recepcionar`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
      if (!response || response.error) throw new Error("Error al recepcionar");

      setShowConfirmation(true);
      toast.success("Orden recepcionada y bultos declarados correctamente");

      // Descargar etiquetas SOLO de los bultos recién recepcionados
      try {
        await downloadEtiquetasForBultos({
          idsBultos: response.ids_bultos_creados,
          ordenIdForName: ordenId,
        });
        toast.success("Etiquetas descargadas correctamente");
      } catch (e) {
        toast.error("Error al descargar etiquetas: " + (e?.message || e));
      }

      try {
        await emailSender(ordenId);
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

    if (!canWritePurchaseOrder) {
      toast.permissionError([ModelType.ORDEN_COMPRA, ScopeType.WRITE]);
      return;
    }
    try {
      await api(
        `/proceso-compra/ordenes/${ordenId}/rechazar`,
        {
          method: "PUT",
          body: { motivo_rechazo: rejectReason.trim() }
        }
      );

      setShowRejectPopup(false);
      toast.success("Orden rechazada correctamente");
      try {
        await emailSender(ordenId);
      } catch (emailErr) {
        toast.error(`Error enviando email tras validar orden: ${emailErr.message}`);
      }
      navigate("/Ordenes");
    } catch (error) {
      toast.error("No se pudo rechazar la orden." + error);
    }
  };

  // ── Paso 1: columnas del cuadre de factura ─────────────────────────────────
  const columnasFactura = [
    {
      header: "Insumo",
      accessor: "nombre",
      Cell: ({ row }) => {
        const formato = row.formato?.trim?.() || "";
        const nombre = row.nombre?.trim?.() || "—";
        const unidad = row.unidad_medida?.trim?.() || "";

        if (formato && nombre && formato.toLowerCase() === nombre.toLowerCase()) {
          return `${unidad ? `${unidad} - ` : ""} ${nombre}`;
        }
        return `${formato ? `${formato} - ` : ""} ${nombre}`;
      },
    },
    {
      header: "Pedido / Pendiente",
      accessor: "cantidad_solicitada",
      Cell: ({ row }) => {
        const sol = Number(row.cantidad_solicitada) || 0;
        const rec = Number(row.cantidad_recepcionada_acumulada) || 0;
        const pendBase = Number(row.pendiente_base_units) || 0;
        const fmt = row.formato || "";
        const baseLabel = row.base_formato?.trim?.() || "un.";
        return (
          <div className="flex flex-col">
            <span className="font-medium">{sol.toFixed(2)} {fmt}</span>
            {rec > 0 && (
              <span className="text-xs text-gray-600">Ya recepcionado: {rec.toFixed(2)} {fmt}</span>
            )}
            <span className="text-xs text-gray-600">
              Pendiente: {pendBase.toFixed(2)} {baseLabel}
            </span>
          </div>
        );
      },
    },
    {
      header: "Cantidad según factura",
      accessor: "cantidad_factura",
      Cell: ({ row }) => {
        const baseLabel = row.base_formato?.trim?.() || "un.";
        const ratio = Number(row.ratio) || 1;
        const cant = Number(row.cantidad_factura) || 0;
        const enFormato = ratio > 0 ? cant / ratio : cant;
        const pendBase = Number(row.pendiente_base_units) || 0;
        const excede = cant > pendBase + 1e-4;
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.cantidad_factura ?? ""}
                onChange={(e) =>
                  handleCantidadFacturaChange(row.id_proveedor_materia_prima, e.target.value)
                }
                onWheel={handleNumberInputWheel}
                className="w-28 px-2 py-1 border border-gray-300 rounded-md"
                placeholder="0"
              />
              <span className="text-xs text-gray-600">{baseLabel}</span>
            </div>
            {ratio > 1.01 && cant > 0 && (
              <span className="text-xs text-blue-600">≈ {enFormato.toFixed(2)} {row.formato}</span>
            )}
            {excede && (
              <span className="text-xs text-amber-700">Supera lo pendiente</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Precio unitario factura",
      accessor: "precio_unitario_factura",
      Cell: ({ row }) => {
        const baseLabel = row.base_formato?.trim?.() || "un.";
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600">$</span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={row.precio_unitario_factura ?? ""}
                onChange={(e) =>
                  handlePrecioFacturaChange(row.id_proveedor_materia_prima, e.target.value)
                }
                onWheel={handleNumberInputWheel}
                className="w-28 px-2 py-1 border border-gray-300 rounded-md"
                placeholder="0"
              />
              <span className="text-xs text-gray-600">/ {baseLabel}</span>
            </div>
          </div>
        );
      },
    },
    {
      header: "Total neto ítem",
      accessor: "total_neto_factura",
      Cell: ({ row }) => {
        const yaFacturado = Number(row?.neto_facturado_prev) || 0;
        return (
          <div className="flex flex-col">
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.total_neto_factura ?? ""}
              onChange={(e) => handleTotalNetoChange(row.id_proveedor_materia_prima, e.target.value)}
              onWheel={handleNumberInputWheel}
              className="w-32 px-2 py-1 border border-gray-300 rounded-md"
              placeholder="0"
            />
            {row.costoEdited && (
              <span className="text-xs text-gray-500 mt-0.5">Editado a mano</span>
            )}
            {yaFacturado > 0 && (
              <span className="text-xs text-gray-600 mt-1">Ya facturado: {formatCLP(yaFacturado, 0)}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Ref. OC",
      accessor: "precio_unitario",
      Cell: ({ row }) => {
        const precioUnitario = Number(row?.precio_unitario) || 0;
        const cantidadSolicitada = Number(row?.cantidad_solicitada) || 0;
        const total = precioUnitario * cantidadSolicitada;
        return (
          <div className="flex flex-col text-sm">
            <span>{formatCLP(total, 0)}</span>
            <span className="text-xs text-gray-500">{formatCLP(precioUnitario, 0)} / {row.formato || "fmt"}</span>
          </div>
        );
      },
    },
  ];

  if (isLoading || !ordenData) return <PageLoader message="Cargando orden" />;

  const totalNetoDocumento = ordenData.insumos.reduce(
    (s, i) => s + (Number(i.total_neto_factura) || 0) * ((Number(i.cantidad_factura) || 0) > EPSILON ? 1 : 0),
    0
  );

  const insumosConCantidad = ordenData.insumos.filter(
    (i) => (Number(i.cantidad_factura) || 0) > EPSILON
  );

  return (
    <div>
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

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bodega de recepción
            </label>
            <select
              name="id_bodega_recepcion"
              value={ordenData?.id_bodega_recepcion ?? ""}
              onChange={handleFormChange}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Seleccione bodega</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            {errors.id_bodega_recepcion && (
              <p className="text-red-600 text-sm mt-1">{errors.id_bodega_recepcion}</p>
            )}
          </div>

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

      {Array.isArray(ordenData.avance_items) && ordenData.avance_items.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <AvanceItems
            title="Avance de recepción"
            items={ordenData.avance_items}
            labels={{
              solicitado: "Pedido",
              completado: "Recepcionado",
              pendiente: "Falta por recepcionar",
              itemNoun: "insumos",
            }}
          />
        </div>
      )}

      {/* ── PASO 1: Cuadre de factura ── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</span>
          <h2 className="text-lg text-primary font-medium">Cuadre de factura del proveedor</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Declara por ítem la <strong>cantidad recepcionada</strong> y el <strong>precio unitario</strong> tal
          como vienen en el documento del proveedor. Los campos parten con lo pendiente y el precio de la OC —
          ajústalos para que cuadren con la factura. Se muestran solo los insumos con pendientes.
        </p>
        {errors.insumos && (
          <p className="text-red-600 text-sm mb-2">{errors.insumos}</p>
        )}
        <Table columns={columnasFactura} data={ordenData.insumos} />

        <div className="mt-3 flex justify-end">
          <div className="bg-white rounded-lg shadow px-4 py-2 text-sm">
            <span className="text-gray-600 mr-2">Total neto del documento:</span>
            <span className="font-bold text-text">{formatCLP(totalNetoDocumento, 0)}</span>
          </div>
        </div>
      </div>

      {/* ── PASO 2: Declaración de bultos ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">2</span>
          <h2 className="text-lg text-primary font-medium">Declaración de bultos</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Indica en cuántos bultos llegó cada ítem. La suma de los bultos debe
          <strong> cuadrar con la cantidad declarada en la factura</strong>.
        </p>

        {insumosConCantidad.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
            Primero declara cantidades en el paso 1.
          </div>
        ) : (
          insumosConCantidad.map((insumo) => {
            const declarado = Number(insumo.cantidad_factura) || 0;
            const totalBase = sumBultos(insumo);
            const baseLabel = insumo.base_formato?.trim?.() || "un.";
            const fmt = insumo.formato || "";
            const cuadra = Math.abs(totalBase - declarado) <= 1e-4;
            const tieneBultos = (Number(insumo.bultos) || 0) > 0;

            return (
              <div key={insumo.id_proveedor_materia_prima} className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {insumo.nombre} <span className="text-sm font-normal text-gray-500">({fmt})</span>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Declarado en factura: <strong>{declarado.toFixed(2)}</strong> {baseLabel}
                      {tieneBultos && (
                        <>
                          {" "}· En bultos: <strong>{totalBase.toFixed(2)}</strong> {baseLabel}{" "}
                          {cuadra ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Cuadra</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              Difiere en {(totalBase - declarado).toFixed(2)}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    N° de bultos
                    <input
                      type="number"
                      min="0"
                      value={insumo.bultos || ""}
                      placeholder="0"
                      onChange={(e) =>
                        handleBultosChange(insumo.id_proveedor_materia_prima, e.target.value)
                      }
                      onWheel={handleNumberInputWheel}
                      className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                    />
                  </label>
                </div>

                {tieneBultos && (
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="p-2 border">Bulto</th>
                          <th className="p-2 border">Cantidad de {baseLabel} en bulto</th>
                          <th className="p-2 border">Lote proveedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(insumo.bultos_detalle || []).map((b, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 border text-center">{idx + 1}</td>
                            <td className="p-2 border text-center">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={b.cantidad_unidades}
                                onChange={(e) => handleBultoUnitsChange(insumo.id_proveedor_materia_prima, idx, e.target.value)}
                                onWheel={handleNumberInputWheel}
                                className="w-32 px-2 py-1 border rounded"
                                placeholder="0"
                              />
                            </td>
                            <td className="p-2 border">
                              <input
                                type="text"
                                value={b.identificador_proveedor}
                                onChange={(e) => handleLoteChange(insumo.id_proveedor_materia_prima, idx, e.target.value)}
                                className="w-48 px-2 py-1 border rounded"
                                placeholder="Lote proveedor"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
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
          disabled={!canWritePurchaseOrder || !canWriteBulk}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover"
        >
          Recepcionar
        </button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Recepción completada
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              La orden ha sido recepcionada y los bultos quedaron declarados.
            </p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
                onClick={() => navigate("/Ordenes")}
              >
                Volver a Ordenes
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
                disabled={!canWritePurchaseOrder}
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
