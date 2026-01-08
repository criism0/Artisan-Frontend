import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useApi } from "../../lib/api";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

export default function CambiarBodegaBulto() {
  const api = useApi();
  const canEditBulto = useMemo(
    () => checkScope(ModelType.BULTO, ScopeType.WRITE),
    []
  );

  const [bodegas, setBodegas] = useState([]);
  const [bultoId, setBultoId] = useState("");
  const [bulto, setBulto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [idBodegaDestino, setIdBodegaDestino] = useState("");

  useEffect(() => {
    const loadBodegas = async () => {
      try {
        const resp = await api("/bodegas");
        const lista = Array.isArray(resp?.bodegas)
          ? resp.bodegas
          : Array.isArray(resp)
            ? resp
            : [];
        setBodegas(lista);
      } catch (e) {
        console.error(e);
        toast.error("Error cargando bodegas");
      }
    };

    loadBodegas();
  }, [api]);

  const buscarBulto = async () => {
    if (!bultoId.trim()) {
      toast.error("Ingresa el ID o identificador del bulto");
      return;
    }

    setLoading(true);
    try {
      const resp = await api(`/bultos/${encodeURIComponent(bultoId.trim())}`);
      setBulto(resp);
      const currentId = resp?.id_bodega ?? resp?.idBodega ?? "";
      setIdBodegaDestino(String(currentId || ""));
      toast.success("Bulto cargado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el bulto");
    } finally {
      setLoading(false);
    }
  };

  const cambiarBodega = async () => {
    if (!canEditBulto) {
      toast.error("No tienes permisos para cambiar bodegas de bultos");
      return;
    }
    if (!bultoId.trim()) {
      toast.error("Ingresa el ID o identificador del bulto");
      return;
    }
    if (!idBodegaDestino) {
      toast.error("Selecciona la bodega destino");
      return;
    }

    setLoading(true);
    try {
      const updated = await api(
        `/bultos/${encodeURIComponent(bultoId.trim())}/cambiar-bodega`,
        {
          method: "PUT",
          body: JSON.stringify({ id_bodega: Number(idBodegaDestino) }),
        }
      );
      setBulto(updated);
      toast.success("Bodega del bulto actualizada");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cambiar la bodega del bulto");
    } finally {
      setLoading(false);
    }
  };

  if (!canEditBulto) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          No tienes permisos para usar esta herramienta.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen space-y-6">
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-text">
          Cambiar bodega de bulto (Admin)
        </h1>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={bultoId}
            onChange={(e) => setBultoId(e.target.value)}
            placeholder="ID numérico o identificador"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={buscarBulto}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60"
          >
            Buscar
          </button>
        </div>

        {bulto && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="text-sm text-gray-700">
              <div>
                <strong>ID:</strong> {bulto?.id}
              </div>
              <div>
                <strong>Identificador:</strong> {bulto?.identificador}
              </div>
              <div>
                <strong>Bodega actual:</strong>{" "}
                {bulto?.Bodega?.nombre ?? bulto?.bodega?.nombre ?? "(sin info)"}
              </div>
              <div>
                <strong>Pallet:</strong>{" "}
                {bulto?.Pallet?.identificador ?? bulto?.pallet?.identificador ?? "(sin pallet)"}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-700 mb-1">
                  Bodega destino
                </label>
                <select
                  value={idBodegaDestino}
                  onChange={(e) => setIdBodegaDestino(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Selecciona...</option>
                  {bodegas.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={cambiarBodega}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
