// src/pages/Facturas_IA/Facturas.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Pencil, Trash2, X, Upload, PlusCircle } from "lucide-react";
import RowsPerPageSelector from "../../components/RowsPerPageSelector";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import { procesarFacturaExtra1 } from "./facturas_extra_1";
import {crear_factura, lista_de_facturas,editar_factura, eliminar_factura} from "./ocrfacturas_backend";

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
  const [filtered, setFiltered] = useState([]);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});

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

  const recompute = useCallback(() => {
    let base = [...facturas];
    if (emisorFiltro) base = base.filter((f) => (f?.emisor ?? "") === emisorFiltro);
    const s = searchQuery.trim().toLowerCase();
    if (s) {
      base = base.filter((f) => {
        const valor = pick(f, ["valor", "total", "monto_total"]);
        const condiciones = pick(f, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]);
        const lugar = pick(f, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]);
        const infoCompr = pick(f, [
          "informacion_comprador",
          "informacionComprador",
          "Información Comprador",
        ]);
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
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(s));
      });
    }
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      base.sort((a, b) => {
        const val = (row) => {
          if (key === "valor_total") return Number(pick(row, ["valor", "total", "monto_total"])) || 0;
          if (key === "condiciones_pago")
            return String(
              pick(row, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]) ?? ""
            ).toLowerCase();
          if (key === "lugar_entrega")
            return String(pick(row, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]) ?? "")
              .toLowerCase();
          if (key === "informacion_comprador")
            return String(
              pick(row, [
                "informacion_comprador",
                "informacionComprador",
                "Información Comprador",
              ]) ?? ""
            ).toLowerCase();
          return row?.[key];
        };
        const A = val(a);
        const B = val(b);
        if (A == null) return 1;
        if (B == null) return -1;
        if (key === "fecha_emision" || key === "fecha_entrega") {
          const cmp = new Date(A) - new Date(B);
          return direction === "asc" ? cmp : -cmp;
        }
        if (key === "valor_total") {
          return direction === "asc" ? A - B : B - A;
        }
        if (typeof A === "number" && typeof B === "number") {
          return direction === "asc" ? A - B : B - A;
        }
        const aStr = String(A).toLowerCase();
        const bStr = String(B).toLowerCase();
        return direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }
    setFiltered(base);
    setPage(1);
  }, [facturas, emisorFiltro, searchQuery, sortConfig]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  const handleSearch = (q) => setSearchQuery(q || "");
  const onChangeEmisor = (value) => setEmisorFiltro(value);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      let direction = "asc";
      if (prev.key === key) direction = prev.direction === "asc" ? "desc" : "asc";
      return { key, direction };
    });
  };

  const renderHeader = (label, accessor) => {
    const isActive = sortConfig.key === accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(accessor)}
      >
        <span>{label}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const dataSlice = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

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
    setError("");
    setOkMsg("");
    setLoadingParse(true);
    try {
      const parsed = await procesarFacturaExtra1(file);
      setSaving(true);
      await crear_factura(parsed);
      setOkMsg("Factura procesada y guardada correctamente.");
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
      setOkMsg("Factura creada manualmente.");
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
      setOkMsg("Factura actualizada.");
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
    const ok = window.confirm(`¿Eliminar factura ${row.id}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      setSaving(true);
      clearMessages();
      await eliminar_factura(row.id);
      setOkMsg("Factura eliminada.");
      await cargarLista();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la factura");
    } finally {
      setSaving(false);
    }
  };

  const btnPrimary =
    "px-4 h-10 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60";
  const btnGhost = "px-3 h-10 rounded border bg-white text-black hover:bg-gray-50";
  const inputClass = "w-full h-10 bg-white text-black border rounded px-3";

  const headers = [
    { label: "ID", accessor: "id" },
    { label: "Emisor", accessor: "emisor" },
    { label: "Receptor", accessor: "receptor" },
    { label: "Nº OC", accessor: "numero_orden_compra" },
    { label: "Fecha emisión", accessor: "fecha_emision" },
    { label: "Fecha entrega", accessor: "fecha_entrega" },
    { label: "Condiciones de pago", accessor: "condiciones_pago" },
    { label: "Lugar de entrega", accessor: "lugar_entrega" },
    { label: "Información comprador", accessor: "informacion_comprador" },
    { label: "Total", accessor: "valor_total" },
    { label: "Acciones", accessor: "__acciones__" },
  ];

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Facturas</h1>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <RowsPerPageSelector
              defaultValue={25}
              onRowsChange={(n) => {
                setRowsPerPage(n);
                setPage(1);
              }}
            />

          </div>
          <div className="w-64">
            <label className="block text-sm mb-1">Emisor</label>
            <select
              value={emisorFiltro}
              onChange={(e) => onChangeEmisor(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {emisores.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SearchBar onSearch={handleSearch} />
      </div>

      {!!error && (
        <div className="mb-3 text-sm text-red-700 bg-red-100 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
      {!!okMsg && (
        <div className="mb-3 text-sm text-green-800 bg-green-100 border border-green-200 rounded px-3 py-2">
          {okMsg}
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="w-full table-auto rounded">
          <thead className="bg-gray-100 text-gray-800 text-sm">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.accessor}
                  className={`px-4 py-2 ${h.accessor === "__acciones__" ? "text-center" : "text-left"}`}
                >
                  {h.accessor === "__acciones__" ? h.label : renderHeader(h.label, h.accessor)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {loadingLista ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={headers.length}>
                  Cargando facturas…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={headers.length}>
                  No hay facturas para mostrar.
                </td>
              </tr>
            ) : (
              dataSlice.map((f) => {
                const totalNumber = Number(pick(f, ["valor", "total", "monto_total"])) || null;
                const condiciones =
                  pick(f, ["condiciones_pago", "condicionesDePago", "Condiciones de Pago"]) ?? "—";
                const lugar = pick(f, ["lugar_entrega", "lugarDeEntrega", "Lugar de Entrega"]) ?? "—";
                const infoCompr =
                  pick(f, ["informacion_comprador", "informacionComprador", "Información Comprador"]) ??
                  "—";
                return (
                  <tr key={f.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{f.id}</td>
                    <td className="px-4 py-2">{f.emisor || "—"}</td>
                    <td className="px-4 py-2">{f.receptor || "—"}</td>
                    <td className="px-4 py-2">{f.numero_orden_compra || "—"}</td>
                    <td className="px-4 py-2">{fmtDate(f.fecha_emision)}</td>
                    <td className="px-4 py-2">{fmtDate(f.fecha_entrega)}</td>
                    <td className="px-4 py-2">{condiciones || "—"}</td>
                    <td className="px-4 py-2">{lugar || "—"}</td>
                    <td className="px-4 py-2">{infoCompr || "—"}</td>
                    <td className="px-4 py-2">{fmtMoneyCLP(totalNumber)}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => abrirEdicion(f)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-blue-600"
                          title="Editar"
                        >
                          <Pencil size={18} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => borrarFactura(f)}
                          className="p-1 rounded hover:bg-red-100 text-red-600"
                          title="Eliminar"
                        >
                          <Trash2 size={18} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

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
                disabled={!file || loadingParse || saving}
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
              <button onClick={guardarManual} disabled={saving} className={btnPrimary}>
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
              <button onClick={guardarEdicion} disabled={saving} className={btnPrimary}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




