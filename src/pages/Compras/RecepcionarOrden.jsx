
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

        // Para poder mostrar equivalencias y declarar bultos directo acá,
        // necesitamos la info completa de formatos del proveedor (PMP).
        let proveedorData = null;
        try {
          proveedorData = await api(`/proveedores/${raw.id_proveedor}`, { method: "GET" });
        } catch (e) {
          // Si falla, seguimos igual (solo se pierde equivalencia visual)
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

        const insumosTransformados = raw.materiasPrimas.map((mp) => {
          const purchasePmpId = mp.id_proveedor_materia_prima;
          const purchasePmp = pmpById[purchasePmpId] || mp.proveedorMateriaPrima;
          const mpId = purchasePmp?.materiaPrima?.id ?? purchasePmp?.id_materia_prima;
          const basePmp = getBasePmp(purchasePmp) || (mpId ? fallbackBaseByMpId[mpId] : null);

          const purchaseQty = Number(purchasePmp?.cantidad_por_formato) || 0;
          const baseQty = Number(basePmp?.cantidad_por_formato) || 1;
          const ratio = baseQty > 0 ? (purchaseQty / baseQty) : 1;

          const cantidadSolicitadaFormato = Number(mp.cantidad_formato) || 0;
          const expectedBaseUnits = cantidadSolicitadaFormato * ratio;

          const precioUnitarioOC = Number(mp.precio_unitario) || 0;
          const defaultNeto = precioUnitarioOC * cantidadSolicitadaFormato;

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

            // Recepción (nuevo flujo)
            bultos: 0,
            bultos_detalle: [],
            total_neto_factura: defaultNeto,
            costoEdited: false,

            // Derivados
            expected_base_units: expectedBaseUnits,
            total_base_units: 0,
            cantidad_recibida: 0,

            // Info OC
            precio_unitario: precioUnitarioOC,
          };
        });

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

  const buildDefaultDistribution = (totalBaseUnits, cantidadBultos) => {
    const out = [];
    if (!cantidadBultos || cantidadBultos <= 0) return out;
    if (Number.isInteger(totalBaseUnits)) {
      const totalInt = Math.trunc(totalBaseUnits);
      const base = Math.floor(totalInt / cantidadBultos);
      const rem = totalInt % cantidadBultos;
      for (let i = 0; i < cantidadBultos; i++) out.push(base + (i < rem ? 1 : 0));
    } else {
      const u = totalBaseUnits / cantidadBultos;
      for (let i = 0; i < cantidadBultos; i++) out.push(u);
    }
    return out;
  };

  const recalcInsumoDerived = (insumo) => {
    const ratio = Number(insumo.ratio) || 1;
    const totalBase = (insumo.bultos_detalle || []).reduce(
      (s, b) => s + (Number(b.cantidad_unidades) || 0),
      0
    );
    const cantidadRecibidaFormato = ratio > 0 ? (totalBase / ratio) : 0;
    const next = {
      ...insumo,
      total_base_units: totalBase,
      cantidad_recibida: cantidadRecibidaFormato,
    };

    if (!next.costoEdited) {
      const precioOC = Number(next.precio_unitario) || 0;
      next.total_neto_factura = precioOC * cantidadRecibidaFormato;
    }

    return next;
  };

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

  const handleBultosChange = (insumoId, newBultos) => {
    const bCount = parseInt(newBultos) || 0;
    setOrdenData((prev) => {
      const updatedInsumos = prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima !== insumoId) return insumo;

        const expected = Number(insumo.expected_base_units) || 0;
        const dist = buildDefaultDistribution(expected, bCount);
        const bultos_detalle = dist.map((u) => ({
          cantidad_unidades: u,
          identificador_proveedor: "",
          loteEdited: false,
        }));

        return recalcInsumoDerived({
          ...insumo,
          bultos: bCount,
          bultos_detalle,
        });
      });

      const hasPartial = updatedInsumos.some(
        (insumo) => (Number(insumo.cantidad_recibida) || 0) < (Number(insumo.cantidad_solicitada) || 0)
      );
      setHasPartialReception(hasPartial);

      return { ...prev, insumos: updatedInsumos };
    });
  };

  const handleBultoUnitsChange = (insumoId, idx, value) => {
    setOrdenData((prev) => ({
      ...prev,
      insumos: prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima !== insumoId) return insumo;
        const nextDetalle = (insumo.bultos_detalle || []).map((b, i) =>
          i === idx ? { ...b, cantidad_unidades: value } : b
        );
        return recalcInsumoDerived({ ...insumo, bultos_detalle: nextDetalle });
      }),
    }));
  };

  const handleLoteChange = (insumoId, idx, value) => {
    setOrdenData((prev) => ({
      ...prev,
      insumos: prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima !== insumoId) return insumo;

        const detalle = Array.isArray(insumo.bultos_detalle) ? insumo.bultos_detalle : [];
        const next = detalle.map((b, i) => ({ ...b }));

        // Marca corte en el bulto editado
        next[idx] = { ...next[idx], identificador_proveedor: value, loteEdited: true };

        // Propagar hacia adelante hasta el siguiente editado manualmente
        for (let i = idx + 1; i < next.length; i++) {
          if (next[i]?.loteEdited) break;
          next[i] = { ...next[i], identificador_proveedor: value };
        }

        return { ...insumo, bultos_detalle: next };
      }),
    }));
  };

  const handleCostoFacturaChange = (insumoId, value) => {
    setOrdenData((prev) => ({
      ...prev,
      insumos: prev.insumos.map((insumo) => {
        if (insumo.id_proveedor_materia_prima !== insumoId) return insumo;
        return {
          ...insumo,
          total_neto_factura: value,
          costoEdited: true,
        };
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

    const tieneRecBulto = ordenData.insumos.some((i) => (Number(i.bultos) || 0) > 0);
    if (!tieneRecBulto) newErrors.insumos = "Debe recepcionar al menos un bulto.";

    // Validar detalle de bultos + costos
    for (const insumo of ordenData.insumos) {
      const b = Number(insumo.bultos) || 0;
      if (b <= 0) continue;

      const detalle = Array.isArray(insumo.bultos_detalle) ? insumo.bultos_detalle : [];
      if (detalle.length !== b) {
        newErrors.insumos = `Faltan bultos por declarar en ${insumo.nombre}.`;
        break;
      }
      for (const d of detalle) {
        const u = Number(d?.cantidad_unidades);
        const lote = d?.identificador_proveedor?.toString?.().trim?.() || "";
        if (!Number.isFinite(u) || u <= 0 || !lote) {
          newErrors.insumos = `Debes completar unidades y lote en todos los bultos de ${insumo.nombre}.`;
          break;
        }
      }
      if (newErrors.insumos) break;

      const neto = Number(insumo.total_neto_factura);
      if (!Number.isFinite(neto) || neto < 0) {
        newErrors.insumos = `Costo neto factura inválido en ${insumo.nombre}.`;
        break;
      }
    }

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
          id_materia_prima_orden_de_compra: insumo.mpocId,
          cantidad_recepcionada: Number(insumo.cantidad_recibida) || 0,
          cantidad_bultos: insumo.bultos,
          bultos_detalle: (insumo.bultos_detalle || []).map((b) => ({
            cantidad_unidades: Number(b.cantidad_unidades),
            identificador_proveedor: b.identificador_proveedor,
          })),
          total_neto_factura: Number(insumo.total_neto_factura) || 0,
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
      toast.success("Orden recepcionada y bultos declarados correctamente");
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
    {
      header: "Recibido",
      accessor: "total_base_units",
      Cell: ({ row }) => {
        const totalBase = Number(row.total_base_units) || 0;
        const ratio = Number(row.ratio) || 1;
        const recibidoFormato = ratio > 0 ? (totalBase / ratio) : 0;
        const fmt = row.formato || "";
        const baseLabel = row.base_formato?.trim?.() || "un. base";
        return (
          <div className="flex flex-col">
            <span className="font-medium">{totalBase.toFixed(2)} {baseLabel}</span>
            {ratio > 1.01 && (
              <span className="text-xs text-blue-600">≈ {recibidoFormato.toFixed(2)} {fmt}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Costo Neto Factura",
      accessor: "total_neto_factura",
      Cell: ({ row }) => (
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.total_neto_factura ?? ""}
          onChange={(e) => handleCostoFacturaChange(row.id_proveedor_materia_prima, e.target.value)}
          className="w-32 px-2 py-1 border border-gray-300 rounded-md"
          placeholder="0"
        />
      ),
    },
    {
      header: "Costo OC",
      accessor: "precio_unitario",
      Cell: ({ value }) => `$${Number(value || 0).toLocaleString()}`,
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

      {/* Declaración de bultos directa (mezcla Recepcionar + Declarar) */}
      <div className="mt-8">
        <h2 className="text-lg text-primary font-medium mb-4">Declaración de bultos</h2>

        {ordenData.insumos
          .filter((i) => (Number(i.bultos) || 0) > 0)
          .map((insumo) => {
            const expected = Number(insumo.expected_base_units) || 0;
            const totalBase = Number(insumo.total_base_units) || 0;
            const ratio = Number(insumo.ratio) || 1;
            const fmt = insumo.formato || "";
            const baseLabel = insumo.base_formato?.trim?.() || "un. base";
            const expectedFmt = ratio > 0 ? (expected / ratio) : 0;
            const recibidoFmt = ratio > 0 ? (totalBase / ratio) : 0;

            return (
              <div key={insumo.id_proveedor_materia_prima} className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800">
                    {insumo.nombre} <span className="text-sm font-normal text-gray-500">({fmt})</span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Esperado: <strong>{expected.toFixed(2)}</strong> {baseLabel}
                    {ratio > 1.01 && (
                      <span> (≈ {expectedFmt.toFixed(2)} {fmt})</span>
                    )}
                    {" "}· Recibido: <strong>{totalBase.toFixed(2)}</strong> {baseLabel}
                    {ratio > 1.01 && (
                      <span> (≈ {recibidoFmt.toFixed(2)} {fmt})</span>
                    )}
                  </p>
                </div>

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
              </div>
            );
          })}
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
