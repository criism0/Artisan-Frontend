import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatRutDisplay, toTitle, formatPhone, formatEmail, fmt } from "../../services/formatHelpers";
import { BackButton, ModifyButton, ToggleActiveButton } from "../../components/Buttons/ActionButtons";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

const MONEDAS_POSIBLES = ["CLP", "USD", "EUR", "UF"];

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatNumberCL(value) {
  const n = toNumber(value);
  return n.toLocaleString("es-CL");
}

function InfoTable({ title, rows }) {
  return (
    <div className="bg-gray-200 p-4 rounded-lg">
      <table className="w-full bg-white rounded-lg shadow overflow-hidden">
        <thead className="bg-gray-100 text-sm text-gray-600">
          <tr>
            <th className="px-6 py-3 text-base font-semibold text-left">{title}</th>
            <th className="px-6 py-3 text-base font-semibold text-left">Dato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            if (r.type === "section") {
              return (
                <tr key={`section-${idx}`} className="border-t border-border">
                  <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-gray-800 bg-gray-50">
                    {r.label}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={`row-${idx}`} className="border-t border-border">
                <td className="px-6 py-4 text-sm font-medium text-text">{r.label}</td>
                <td className="px-6 py-4 text-sm text-text">{r.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EstadoPill({ activo }) {
  const isActive = activo === true;
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
      title={isActive ? "Proveedor activo" : "Proveedor inactivo"}
    >
      {isActive ? "Activo" : "Inactivo"}
    </span>
  );
}

function ProveedorInsumos({ proveedorId }) {
  const api = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const [asociaciones, setAsociaciones] = useState([]);
  const [draftById, setDraftById] = useState({});
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  const loadAsociaciones = async () => {
    if (!proveedorId) {
      setAsociaciones([]);
      setDraftById({});
      setDirtyIds(new Set());
      return;
    }

    try {
      setLoading(true);
      const resp = await api(
        `/proveedor-materia-prima?id_proveedor=${encodeURIComponent(String(proveedorId))}`,
        { method: "GET" }
      );

      const lista = Array.isArray(resp) ? resp : [];
      const ordenadas = [...lista].sort((a, b) => {
        const nameA = String(a?.materiaPrima?.nombre || a?.materiaPrima?.name || "");
        const nameB = String(b?.materiaPrima?.nombre || b?.materiaPrima?.name || "");
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return (a?.id ?? 0) - (b?.id ?? 0);
      });

      setAsociaciones(ordenadas);

      const draft = {};
      for (const row of ordenadas) {
        if (row?.id == null) continue;
        draft[row.id] = {
          id: row.id,
          id_proveedor: row.id_proveedor,
          id_materia_prima: row.id_materia_prima,
          formato: String(row.formato || ""),
          unidad_medida: String(row.unidad_medida || ""),
          es_unidad_consumo: !!row.es_unidad_consumo,
          cantidad_por_formato: row.cantidad_por_formato ?? 0,
          precio_unitario: row.precio_unitario ?? 0,
          moneda: String(row.moneda || ""),
          id_formato_hijo: row.id_formato_hijo ?? null,
          cantidad_hijos: row.cantidad_hijos ?? 1,
        };
      }
      setDraftById(draft);
      setDirtyIds(new Set());
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar insumos del proveedor");
      setAsociaciones([]);
      setDraftById({});
      setDirtyIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAsociaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorId]);

  const formatoPorId = useMemo(() => {
    const map = new Map();
    for (const a of asociaciones) {
      if (a?.id == null) continue;
      map.set(Number(a.id), String(a?.formato || ""));
    }
    return map;
  }, [asociaciones]);

  const getNombreFormato = (rowId) => {
    const d = draftById?.[rowId];
    const fromDraft = d?.formato != null ? String(d.formato) : "";
    if (fromDraft.trim()) return fromDraft;
    const fromApi = formatoPorId.get(Number(rowId));
    return String(fromApi || "");
  };

  const getNombreFormatoHijo = (draftRow) => {
    const idHijo = draftRow?.id_formato_hijo;
    if (!idHijo) return "";
    return getNombreFormato(Number(idHijo));
  };

  const derivedById = useMemo(() => {
    const cache = new Map();

    const compute = (rowId, visiting = new Set()) => {
      const idNum = Number(rowId);
      if (!Number.isFinite(idNum)) return null;
      if (cache.has(idNum)) return cache.get(idNum);
      if (visiting.has(idNum)) return null;
      visiting.add(idNum);

      const d = draftById?.[idNum];
      if (!d) {
        visiting.delete(idNum);
        return null;
      }

      const esUC = !!d.es_unidad_consumo;
      if (esUC) {
        const result = {
          precio: toNumber(d.precio_unitario),
          moneda: String(d.moneda || ""),
          cantidadPorFormato: toNumber(d.cantidad_por_formato),
          unidad: String(d.unidad_medida || ""),
        };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const idHijo = d.id_formato_hijo;
      const cantidadHijos = toNumber(d.cantidad_hijos);
      if (!idHijo) {
        const result = {
          precio: toNumber(d.precio_unitario),
          moneda: String(d.moneda || ""),
          cantidadPorFormato: toNumber(d.cantidad_por_formato),
          unidad: String(d.unidad_medida || ""),
        };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const child = compute(idHijo, visiting);
      if (!child) {
        const result = {
          precio: toNumber(d.precio_unitario),
          moneda: String(d.moneda || ""),
          cantidadPorFormato: toNumber(d.cantidad_por_formato),
          unidad: String(d.unidad_medida || ""),
        };
        cache.set(idNum, result);
        visiting.delete(idNum);
        return result;
      }

      const result = {
        precio: child.precio * cantidadHijos,
        moneda: child.moneda,
        cantidadPorFormato: child.cantidadPorFormato * cantidadHijos,
        unidad: child.unidad,
      };
      cache.set(idNum, result);
      visiting.delete(idNum);
      return result;
    };

    for (const id of Object.keys(draftById || {})) {
      compute(id);
    }
    return cache;
  }, [draftById]);

  const resumen = useMemo(() => {
    const insumoIds = new Set(
      asociaciones.map((a) => String(a?.materiaPrima?.id ?? a?.id_materia_prima ?? ""))
    );
    return {
      insumos: insumoIds.size,
      formatos: asociaciones.length,
      pendientes: dirtyIds.size,
    };
  }, [asociaciones, dirtyIds.size]);

  const grouped = useMemo(() => {
    const rankById = new Map();

    const getRank = (rowId, visiting = new Set()) => {
      const idNum = Number(rowId);
      if (!Number.isFinite(idNum)) return 999;
      if (rankById.has(idNum)) return rankById.get(idNum);
      if (visiting.has(idNum)) return 999;
      visiting.add(idNum);

      const d = draftById?.[idNum];
      if (!d) {
        visiting.delete(idNum);
        return 999;
      }

      if (d.es_unidad_consumo) {
        rankById.set(idNum, 0);
        visiting.delete(idNum);
        return 0;
      }

      const childId = d.id_formato_hijo;
      if (!childId) {
        rankById.set(idNum, 1);
        visiting.delete(idNum);
        return 1;
      }

      const childRank = getRank(childId, visiting);
      const thisRank = Number.isFinite(childRank) ? childRank + 1 : 999;
      rankById.set(idNum, thisRank);
      visiting.delete(idNum);
      return thisRank;
    };

    const map = new Map();
    for (const row of asociaciones) {
      const key = String(row?.materiaPrima?.id ?? row?.id_materia_prima ?? "");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }

    const groups = Array.from(map.entries()).map(([key, rows]) => {
      const first = rows?.[0] || {};
      const nombre = String(first?.materiaPrima?.nombre || first?.materiaPrima?.name || "Insumo");
      const sortedRows = [...rows].sort((a, b) => {
        const rankA = getRank(a?.id);
        const rankB = getRank(b?.id);
        if (rankA !== rankB) return rankA - rankB;

        const nameA = String(draftById?.[a?.id]?.formato ?? a?.formato ?? "");
        const nameB = String(draftById?.[b?.id]?.formato ?? b?.formato ?? "");
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return (a?.id ?? 0) - (b?.id ?? 0);
      });
      return { key, nombre, rows: sortedRows };
    });

    groups.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return groups;
  }, [asociaciones, draftById]);

  const setDraftField = (id, field, value) => {
    setDraftById((prev) => {
      const next = { ...prev };
      const current = next[id] || {};
      next[id] = { ...current, [field]: value };
      return next;
    });

    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleGuardarCambios = async () => {
    const ids = Array.from(dirtyIds);
    if (ids.length === 0) {
      toast.info("No hay cambios pendientes");
      return;
    }

    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const draft = draftById[id];
          if (!draft) return;

          const bodyBase = {
            id_proveedor: draft.id_proveedor,
            id_materia_prima: draft.id_materia_prima,
            formato: String(draft.formato || ""),
            unidad_medida: String(draft.unidad_medida || ""),
            es_unidad_consumo: !!draft.es_unidad_consumo,
          };

          const body = draft.es_unidad_consumo
            ? {
                ...bodyBase,
                peso_unitario: toNumber(draft.cantidad_por_formato),
                precio_unitario: toNumber(draft.precio_unitario),
                moneda: String(draft.moneda || ""),
              }
            : {
                ...bodyBase,
                id_formato_hijo: draft.id_formato_hijo,
                cantidad_hijos: toNumber(draft.cantidad_hijos),
              };

          await api(`/proveedor-materia-prima/por-materia-prima/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        })
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error("Fallos guardando cambios:", failed);
        toast.error(`Se guardaron algunos cambios, pero fallaron ${failed.length}`);
      } else {
        toast.success("Cambios guardados");
      }

      await loadAsociaciones();
    } catch (error) {
      console.error(error);
      toast.error("Error guardando cambios");
    }
  };

  const handleDescartarCambios = async () => {
    await loadAsociaciones();
    toast.info("Cambios descartados");
  };

  return (
    <div className="bg-gray-200 p-4 rounded-lg">
      <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="text-sm font-semibold text-gray-800">Insumos asociados</div>
          <div className="text-xs text-gray-600">
            {resumen.insumos} insumo(s) · {resumen.formatos} formato(s) · {resumen.pendientes} pendiente(s)
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <button
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-60"
            onClick={() =>
              navigate(
                `/Insumos/asociar?proveedor=${encodeURIComponent(String(proveedorId ?? ""))}`
              )
            }
            disabled={loading || !proveedorId}
            type="button"
            title="Agregar una nueva asociación de insumo para este proveedor"
          >
            + Asociación
          </button>
          <button
            className="px-3 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 disabled:opacity-60"
            onClick={handleDescartarCambios}
            disabled={loading || resumen.pendientes === 0}
            type="button"
          >
            Descartar
          </button>
          <button
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-60"
            onClick={handleGuardarCambios}
            disabled={loading || resumen.pendientes === 0}
            type="button"
          >
            Guardar ({resumen.pendientes})
          </button>
          <button
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {!open ? null : loading ? (
        <div className="px-4 pb-4 text-gray-700">Cargando insumos...</div>
      ) : asociaciones.length === 0 ? (
        <div className="px-4 pb-4 text-gray-700">Este proveedor no tiene asociaciones de insumos.</div>
      ) : (
        <div className="px-4 pb-4 space-y-4">
          {grouped.map((g) => (
            <div key={g.key} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
                <div className="font-semibold text-gray-900">{g.nombre}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-600">{g.rows.length} formato(s)</div>
                  <button
                    className="px-2 py-1 text-xs border rounded-lg bg-white hover:bg-gray-50"
                    onClick={() =>
                      navigate(
                        `/Insumos/asociar/${encodeURIComponent(String(g.key))}?proveedor=${encodeURIComponent(
                          String(proveedorId ?? "")
                        )}`
                      )
                    }
                    type="button"
                    title="Extender formatos (caja, pallet, etc.) para este insumo"
                  >
                    Extender formatos
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-t border-gray-200">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                      <th className="py-2 px-3 border-b">Formato</th>
                      <th className="py-2 px-3 border-b">Cantidad</th>
                      <th className="py-2 px-3 border-b">Precio</th>
                      <th className="py-2 px-3 border-b">Moneda</th>
                      <th className="py-2 px-3 border-b">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row, idx) => {
                      const d = draftById[row.id];
                      const isDirty = dirtyIds.has(row.id);
                      const esUC = !!d?.es_unidad_consumo;
                      const derived = derivedById.get(Number(row.id));
                      const nombreEsteFormato = getNombreFormato(row.id) || "este formato";
                      const nombreFormatoHijo = getNombreFormatoHijo(d);
                      const displayUnidad = String(d?.unidad_medida ?? "").trim();
                      const displayPrecio = esUC
                        ? toNumber(d?.precio_unitario)
                        : derived?.precio ?? row.precio_unitario ?? 0;
                      const displayMoneda = esUC
                        ? String(d?.moneda ?? "")
                        : String(derived?.moneda ?? row.moneda ?? "");
                      const zebra = idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                      return (
                        <tr key={row.id} className={`border-b last:border-b-0 ${zebra}`}>
                          <td className="py-2 px-3 min-w-[240px]">
                            <input
                              value={d?.formato ?? ""}
                              onChange={(e) => setDraftField(row.id, "formato", e.target.value)}
                              className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                            />
                            <div className="text-xs text-gray-500 mt-1">ID: {row.id}</div>
                          </td>

                          <td className="py-2 px-3 min-w-[200px]">
                            {esUC ? (
                              <input
                                type="number"
                                value={d?.cantidad_por_formato ?? 0}
                                onChange={(e) => setDraftField(row.id, "cantidad_por_formato", e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                              />
                            ) : (
                              <input
                                type="number"
                                value={d?.cantidad_hijos ?? 1}
                                onChange={(e) => setDraftField(row.id, "cantidad_hijos", e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                              />
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {esUC
                                ? `Cantidad de ${displayUnidad || "(sin unidad)"}`
                                : `Cantidad de ${nombreFormatoHijo || "formato hijo"} por ${nombreEsteFormato}`}
                            </div>
                          </td>

                          <td className="py-2 px-3 min-w-[140px]">
                            {esUC ? (
                              <input
                                type="number"
                                value={d?.precio_unitario ?? 0}
                                onChange={(e) => setDraftField(row.id, "precio_unitario", e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                              />
                            ) : (
                              <div className="text-gray-900 py-1">{formatNumberCL(displayPrecio)}</div>
                            )}
                          </td>

                          <td className="py-2 px-3 min-w-[120px]">
                            {esUC ? (
                              <select
                                value={d?.moneda ?? ""}
                                onChange={(e) => setDraftField(row.id, "moneda", e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1 ${isDirty ? "bg-yellow-50" : "bg-white"}`}
                              >
                                <option value="">Seleccionar</option>
                                {MONEDAS_POSIBLES.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="text-gray-900 py-1">{displayMoneda}</div>
                            )}
                          </td>

                          <td className="py-2 px-3 min-w-[160px]">
                            <label className="inline-flex items-center gap-2 text-gray-700">
                              <input
                                type="checkbox"
                                checked={!!d?.es_unidad_consumo}
                                disabled
                              />
                              <span className="text-sm">Unidad consumo</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

export default function ProveedorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [prov, setProv] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOne = async () => {
      try {
        const data = await api(`/proveedores/${id}`, { method: "GET" });
        setProv(data);
      } catch (e) {
        toast.error(`Error cargando proveedor: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    };
    fetchOne();
  }, [id, api]);

  const handleToggleStatus = async () => {
    if (!prov) return;
    try {
      const nuevoEstado = !(prov.activo === true);
      await api(`/proveedores/${id}/toggle-activo`, {
        method: "PATCH",
        body: JSON.stringify({ activo: nuevoEstado }),
      });
      setProv({ ...prov, activo: nuevoEstado });
    } catch (e) {
      toast.error(`Error ${prov.activo === true ? "desactivando" : "activando"} proveedor: ${e?.message || e}`);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!prov) return <div className="p-6">Proveedor no encontrado.</div>;

  const activo = prov.activo === true;
  const razon = toTitle(prov.nombre_empresa);
  const rut = formatRutDisplay(prov.rut_empresa);
  const giro = toTitle(prov.giro);
  const region = toTitle(prov.region);
  const comuna = toTitle(prov.comuna);
  const direccion = fmt(prov.direccion);
  const banco = toTitle(prov.banco);
  const tipoCuenta = toTitle(prov.cuenta);
  const cuentaNumero = fmt(prov.cuenta_corriente);
  const emailPago = formatEmail(prov.email_transferencia);
  const telefono = formatPhone(prov.telefono);
  const tipoProveedor = toTitle(prov.tipo_proveedor);
  const nombreContacto = toTitle(prov.nombre_contacto);
  const creado = prov.createdAt ? new Date(prov.createdAt).toLocaleString() : "—";
  const actualizado = prov.updatedAt ? new Date(prov.updatedAt).toLocaleString() : "—";

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6 w-full">
        <h1 className="text-2xl font-bold text-text">Detalle de Proveedor</h1>
        <div className="flex gap-2">
          <BackButton to="/Proveedores" />
          <ModifyButton onClick={() => navigate(`/Proveedores/${id}/edit`)} />
          <ToggleActiveButton
            isActive={activo}
            entityName={"proveedor " + razon}
            onToggleActive={handleToggleStatus}
          />


        </div>
      </div>
    
      <div className="w-full">
        <InfoTable
          title="Información"
          rows={[
            { type: "section", label: "General" },
            { label: "ID", value: prov.id ?? "—" },
            { label: "Estado", value: "activo" in prov ? <EstadoPill activo={prov.activo} /> : "—" },
            { label: "Razón Social", value: razon },
            { label: "RUT", value: rut },
            { label: "Giro", value: giro },
            { label: "Tipo de Proveedor", value: tipoProveedor || "—" },
            { type: "section", label: "Ubicación" },
            { label: "Región", value: region },
            { label: "Comuna", value: comuna },
            { label: "Dirección", value: direccion },
            { type: "section", label: "Pago" },
            { label: "Banco", value: banco },
            { label: "Tipo de Cuenta", value: tipoCuenta },
            { label: "Nº de Cuenta", value: cuentaNumero },
            { label: "Email para Transferencias", value: emailPago },
            { type: "section", label: "Contacto" },
            { label: "Nombre Contacto Comercial", value: nombreContacto },
            { label: "Teléfono", value: telefono },
            { type: "section", label: "Metadatos" },
            { label: "Creado", value: creado },
            { label: "Actualizado", value: actualizado },
          ]}
        />
      </div>

      <div className="w-full mt-6">
        <ProveedorInsumos proveedorId={prov?.id ?? Number(id)} />
      </div>
    </div>
  );
}