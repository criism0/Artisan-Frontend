// src/pages/Facturas_IA/Facturas.jsx
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { X, Upload, PlusCircle } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { EditButton, TrashButton } from "../../components/Buttons/ActionButtons";
import { procesarFacturaExtra1 } from "../../services/facturasExtra";
import {crear_factura, lista_de_facturas,editar_factura, eliminar_factura} from "../../services/ocrfacturas";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";
import toast from "../../lib/toast";

const fmtDate = (value) => {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Santiago",
    }).format(d);
  } catch {
    return value ?? "—";
  }
};

const fmtMoneyCLP = (n) =>
  typeof n === "number"
    ? n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
    : n == null || n === "" ? "—" : String(n);

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj?.[k] != null) return obj[k];
  }
  return null;
};

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [loadingParse, setLoadingParse] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const [showManual, setShowManual] = useState(false);
  const [manualData, setManualData] = useState({
    emisor: "",
    receptor: "",
    numero_orden_compra: "",
    valor: "",
    fecha_emision: "",
    fecha_entrega: "",
    condiciones_pago: "",
    lugar_entrega: "",
    informacion_comprador: "",
  });

  const [emisorFiltro, setEmisorFiltro] = useState("");

  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});

  const canWriteOCRInvoice = checkScope(ModelType.OCR_FACTURA, ScopeType.WRITE);
  const canDeleteOCRInvoice = checkScope(ModelType.OCR_FACTURA, ScopeType.DELETE);

  const clearMessages = useCallback(() => {
    setOkMsg("");
    setError("");
  }, []);

  useEffect(() => {
    if (!okMsg && !error) return;
    const t = setTimeout(() => {
      setOkMsg("");
      setError("");
    }, 3000);
    return () => clearTimeout(t);
  }, [okMsg, error]);

  const cargarLista = async () => {
    setLoadingLista(true);
    setError("");
    try {
      const data = await lista_de_facturas();
      const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setFacturas(arr);
    } catch (e) {
      setError(e?.message || "No se pudo cargar la lista de facturas");
    } finally {
      setLoadingLista(false);
    }
  };

  useEffect(() => {
    cargarLista();
  }, []);

  const emisores = useMemo(() => {
    const set = new Set(
      (facturas || [])
        .map((r) => (r?.emisor ?? "").toString().trim())
        .filter((x) => x.length > 0)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [facturas]);

  // Filtro de negocio (emisor) sobre la data; búsqueda, orden y paginación las maneja DataTable.
  const dataFiltrada = useMemo(() => {
    if (!emisorFiltro) return facturas;
    return facturas.filter((f) => (f?.emisor ?? "") === emisorFiltro);
  }, [facturas, emisorFiltro]);

  const getSearchText = (f) => {
    const valor = pick(f, ["valor", "total", "monto_total"]);
    const condiciones = pick(f, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]);
    const lugar = pick(f, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]);
    const infoCompr = pick(f, ["informacion_comprador", "informacionComprador", "Información Comprador"]);
    return [
      f.id,
      f.emisor,
      f.receptor,
      f.numero_orden_compra,
      valor,
      f.fecha_emision,
      f.fecha_entrega,
      condiciones,
      lugar,
      infoCompr,
    ]
      .map((v) => String(v ?? ""))
      .join(" ");
  };

  const openUpload = () => {
    clearMessages();
    setShowUpload(true);
  };
  const closeUpload = () => {
    setShowUpload(false);
    setFile(null);
    clearMessages();
  };
  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setOkMsg("");
    setError("");
  };
  const subirYGuardar = async () => {
    if (!file) {
      setError("Selecciona un PDF primero.");
      return;
    }
    if (!canWriteOCRInvoice) {
      toast.permissionError([ModelType.OCR_FACTURA, ScopeType.WRITE]);
      setError("No tienes permiso para realizar esa acción.");
      setLoadingParse(false);
      setSaving(false);
      return;
    }
    setError("");
    setOkMsg("");
    setLoadingParse(true);
    try {
      const parsed = await procesarFacturaExtra1(file);
      setSaving(true);
      await crear_factura(parsed);
      toast.success("Factura procesada y guardada correctamente.");
      await cargarLista();
      closeUpload();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
      setLoadingParse(false);
    }
  };

  const openManual = () => {
    clearMessages();
    setShowManual(true);
  };
  const closeManual = () => {
    setShowManual(false);
    setManualData({
      emisor: "",
      receptor: "",
      numero_orden_compra: "",
      valor: "",
      fecha_emision: "",
      fecha_entrega: "",
      condiciones_pago: "",
      lugar_entrega: "",
      informacion_comprador: "",
    });
    clearMessages();
  };
  const guardarManual = async () => {
    if (!manualData.emisor || !manualData.receptor) {
      setError("Completa al menos Emisor y Receptor.");
      return;
    }
    if (!canWriteOCRInvoice) {
      toast.permissionError([ModelType.OCR_FACTURA, ScopeType.WRITE]);
      setSaving(false);
      setError("No tienes permiso para realizar esa acción.");
      return;
    }
    try {
      setSaving(true);
      clearMessages();
      const payload = {
        ...manualData,
        valor:
          manualData.valor === "" || manualData.valor == null
            ? null
            : Number(manualData.valor),
        fecha_emision: manualData.fecha_emision || null,
        fecha_entrega: manualData.fecha_entrega || null,
      };
      await crear_factura(payload);
      toast.success("Factura creada manualmente.");
      await cargarLista();
      closeManual();
    } catch (e) {
      setError(e?.message || "No se pudo crear la factura");
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicion = (row) => {
    setEditing(row);
    setEditData({
      emisor: row?.emisor ?? "",
      receptor: row?.receptor ?? "",
      numero_orden_compra: row?.numero_orden_compra ?? "",
      valor: pick(row, ["valor", "total", "monto_total"]) ?? "",
      fecha_emision: row?.fecha_emision ?? "",
      fecha_entrega: row?.fecha_entrega ?? "",
      condiciones_pago:
        pick(row, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]) ?? "",
      lugar_entrega: pick(row, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]) ?? "",
      informacion_comprador:
        pick(row, ["informacion_comprador", "informacionComprador", "Información Comprador"]) ?? "",
    });
    clearMessages();
  };
  const cancelarEdicion = () => {
    setEditing(null);
    setEditData({});
    clearMessages();
  };
  const guardarEdicion = async () => {
    if (!editing?.id) return;
    if (!canWriteOCRInvoice) {
      toast.permissionError([ModelType.OCR_FACTURA, ScopeType.WRITE]);
      setSaving(false);
      setError("No tienes permiso para realizar esa acción.");
      return;
    }
    try {
      setSaving(true);
      clearMessages();
      await editar_factura(editing.id, {
        ...editData,
        valor:
          editData.valor === "" || editData.valor == null
            ? null
            : Number(editData.valor),
      });
      toast.success("Factura actualizada.");
      await cargarLista();
      cancelarEdicion();
    } catch (e) {
      setError(e?.message || "No se pudo actualizar la factura");
    } finally {
      setSaving(false);
    }
  };
  const borrarFactura = async (row) => {
    if (!row?.id) return;
    if (!canDeleteOCRInvoice) {
      toast.permissionError([ModelType.OCR_FACTURA, ScopeType.DELETE]);
      return;
    }
    try {
      setSaving(true);
      clearMessages();
      await eliminar_factura(row.id);
      toast.success("Factura eliminada.");
      await cargarLista();
    } catch (e) {
      toast.error(e?.message || "No se pudo eliminar la factura");
    } finally {
      setSaving(false);
    }
  };

  const btnPrimary =
    "px-4 h-10 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-60";
  const btnGhost = "px-3 h-10 rounded-lg border bg-white text-black hover:bg-gray-50";
  const inputClass = "w-full h-10 bg-white text-black border rounded px-3";

  const columns = [
    { header: "ID", accessor: "id", sortable: true },
    { header: "Emisor", accessor: "emisor", sortable: true, Cell: ({ value }) => value || "—" },
    { header: "Receptor", accessor: "receptor", sortable: true, Cell: ({ value }) => value || "—" },
    { header: "Nº OC", accessor: "numero_orden_compra", sortable: true, Cell: ({ value }) => value || "—" },
    {
      header: "Fecha emisión",
      accessor: "fecha_emision",
      sortable: true,
      sortValue: (r) => (r?.fecha_emision ? new Date(r.fecha_emision).getTime() : null),
      Cell: ({ value }) => fmtDate(value),
    },
    {
      header: "Fecha entrega",
      accessor: "fecha_entrega",
      sortable: true,
      sortValue: (r) => (r?.fecha_entrega ? new Date(r.fecha_entrega).getTime() : null),
      Cell: ({ value }) => fmtDate(value),
    },
    {
      header: "Condiciones de pago",
      accessor: "condiciones_pago",
      sortable: true,
      sortValue: (r) =>
        String(pick(r, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]) ?? "").toLowerCase(),
      Cell: ({ row }) => pick(row, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]) || "—",
    },
    {
      header: "Lugar de entrega",
      accessor: "lugar_entrega",
      sortable: true,
      sortValue: (r) =>
        String(pick(r, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]) ?? "").toLowerCase(),
      Cell: ({ row }) => pick(row, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]) || "—",
    },
    {
      header: "Información comprador",
      accessor: "informacion_comprador",
      sortable: true,
      sortValue: (r) =>
        String(pick(r, ["informacion_comprador", "informacionComprador", "Información Comprador"]) ?? "").toLowerCase(),
      Cell: ({ row }) =>
        pick(row, ["informacion_comprador", "informacionComprador", "Información Comprador"]) || "—",
    },
    {
      header: "Total",
      accessor: "valor_total",
      sortable: true,
      sortValue: (r) => Number(pick(r, ["valor", "total", "monto_total"])) || 0,
      Cell: ({ row }) => fmtMoneyCLP(Number(pick(row, ["valor", "total", "monto_total"])) || null),
    },
  ];

  const actions = (row) => (
    <div className="flex gap-2">
      <EditButton onClick={() => abrirEdicion(row)} tooltipText="Editar factura" />
      {canDeleteOCRInvoice && (
        <TrashButton
          onConfirmDelete={() => borrarFactura(row)}
          tooltipText="Eliminar factura"
          entityName={`Factura #${row.id}`}
        />
      )}
    </div>
  );

  return (
    <>
      <DataTable
        title="Facturas"
        data={dataFiltrada}
        columns={columns}
        actions={actions}
        getSearchText={getSearchText}
        loading={loadingLista}
        loadingMessage="Cargando facturas"
        defaultRowsPerPage={25}
        emptyMessage="No hay facturas para mostrar."
        headerActions={
          <>
            <button className={btnPrimary} onClick={openUpload}>
              <span className="inline-flex items-center gap-2">
                <Upload size={18} /> Subir factura (PDF)
              </span>
            </button>
            <button className={btnPrimary} onClick={openManual}>
              <span className="inline-flex items-center gap-2">
                <PlusCircle size={18} /> Crear factura
              </span>
            </button>
          </>
        }
        toolbarStart={
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Emisor</label>
            <select
              value={emisorFiltro}
              onChange={(e) => setEmisorFiltro(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Todos</option>
              {emisores.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {showUpload && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Subir factura (PDF)</h3>
              <button
                onClick={closeUpload}
                className="p-1 text-gray-600 hover:text-gray-900"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileChange}
                className="block"
              />
              {!!error && (
                <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
              {!!okMsg && (
                <div className="text-sm text-green-800 bg-green-100 border border-green-200 rounded px-3 py-2">
                  {okMsg}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeUpload} className={btnGhost}>
                Cancelar
              </button>
              <button
                onClick={subirYGuardar}
                disabled={!file || loadingParse || saving || !canWriteOCRInvoice}
                className={btnPrimary}
              >
                {loadingParse || saving ? "Procesando..." : "Procesar y guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Crear factura manual</h3>
              <button
                onClick={closeManual}
                className="p-1 text-gray-600 hover:text-gray-900"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Emisor</label>
                <input
                  className={inputClass}
                  value={manualData.emisor}
                  onChange={(e) => setManualData((p) => ({ ...p, emisor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Receptor</label>
                <input
                  className={inputClass}
                  value={manualData.receptor}
                  onChange={(e) => setManualData((p) => ({ ...p, receptor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Nº orden de compra</label>
                <input
                  className={inputClass}
                  value={manualData.numero_orden_compra}
                  onChange={(e) =>
                    setManualData((p) => ({ ...p, numero_orden_compra: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Valor (Total)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={manualData.valor}
                  onChange={(e) => setManualData((p) => ({ ...p, valor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha de emisión</label>
                <input
                  className={inputClass}
                  type="date"
                  value={manualData.fecha_emision}
                  onChange={(e) => setManualData((p) => ({ ...p, fecha_emision: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha de entrega</label>
                <input
                  className={inputClass}
                  type="date"
                  value={manualData.fecha_entrega}
                  onChange={(e) => setManualData((p) => ({ ...p, fecha_entrega: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Condiciones de pago</label>
                <input
                  className={inputClass}
                  value={manualData.condiciones_pago}
                  onChange={(e) =>
                    setManualData((p) => ({ ...p, condiciones_pago: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Lugar de entrega</label>
                <input
                  className={inputClass}
                  value={manualData.lugar_entrega}
                  onChange={(e) => setManualData((p) => ({ ...p, lugar_entrega: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm mb-1">Información comprador</label>
                <input
                  className={inputClass}
                  value={manualData.informacion_comprador}
                  onChange={(e) =>
                    setManualData((p) => ({ ...p, informacion_comprador: e.target.value }))
                  }
                />
              </div>
            </div>
            {!!error && (
              <div className="mt-3 text-sm text-red-700 bg-red-100 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
            {!!okMsg && (
              <div className="mt-3 text-sm text-green-800 bg-green-100 border border-green-200 rounded px-3 py-2">
                {okMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeManual} className={btnGhost}>
                Cancelar
              </button>
              <button onClick={guardarManual} disabled={saving || !canWriteOCRInvoice} className={btnPrimary}>
                {saving ? "Guardando..." : "Crear factura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar factura #{editing?.id}</h3>
              <button
                onClick={cancelarEdicion}
                className="p-1 text-gray-600 hover:text-gray-900"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Emisor</label>
                <input
                  className={inputClass}
                  value={editData.emisor || ""}
                  onChange={(e) => setEditData((p) => ({ ...p, emisor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Receptor</label>
                <input
                  className={inputClass}
                  value={editData.receptor || ""}
                  onChange={(e) => setEditData((p) => ({ ...p, receptor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Nº orden de compra</label>
                <input
                  className={inputClass}
                  value={editData.numero_orden_compra || ""}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, numero_orden_compra: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Total (CLP)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={editData.valor ?? ""}
                  onChange={(e) =>
                    setEditData((p) => ({
                      ...p,
                      valor: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha de emisión</label>
                <input
                  className={inputClass}
                  type="date"
                  value={
                    editData.fecha_emision
                      ? new Date(editData.fecha_emision).toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) => setEditData((p) => ({ ...p, fecha_emision: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Fecha de entrega</label>
                <input
                  className={inputClass}
                  type="date"
                  value={
                    editData.fecha_entrega
                      ? new Date(editData.fecha_entrega).toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) => setEditData((p) => ({ ...p, fecha_entrega: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Condiciones de pago</label>
                <input
                  className={inputClass}
                  value={editData.condiciones_pago || ""}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, condiciones_pago: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Lugar de entrega</label>
                <input
                  className={inputClass}
                  value={editData.lugar_entrega || ""}
                  onChange={(e) => setEditData((p) => ({ ...p, lugar_entrega: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm mb-1">Información comprador</label>
                <input
                  className={inputClass}
                  value={editData.informacion_comprador || ""}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, informacion_comprador: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={cancelarEdicion} className={btnGhost}>
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={saving || !canWriteOCRInvoice} className={btnPrimary}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
