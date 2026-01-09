import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../../axiosInstance";
import { toast } from "../../lib/toast";
import {
  checkScope,
  isAdminOrSuperAdmin,
  ModelType,
  ScopeType,
} from "../../services/scopeCheck";

export default function EditarBulto() {
  const navigate = useNavigate();
  const { id } = useParams();

  const canEditBulto = useMemo(
    () =>
      checkScope(ModelType.BULTO, ScopeType.WRITE) || isAdminOrSuperAdmin(),
    []
  );

  const [loading, setLoading] = useState(false);
  const [bodegas, setBodegas] = useState([]);
  const [bulto, setBulto] = useState(null);
  const [idBodegaDestino, setIdBodegaDestino] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [bodegasResp, bultoResp] = await Promise.all([
          axiosInstance.get("/bodegas"),
          axiosInstance.get(`/bultos/${encodeURIComponent(id)}`),
        ]);

        const listaBodegas = Array.isArray(bodegasResp?.data?.bodegas)
          ? bodegasResp.data.bodegas
          : Array.isArray(bodegasResp?.data)
            ? bodegasResp.data
            : [];
        setBodegas(listaBodegas);

        setBulto(bultoResp?.data ?? null);
        const currentId = bultoResp?.data?.id_bodega ?? "";
        setIdBodegaDestino(String(currentId || ""));
      } catch (e) {
        console.error(e);
        toast.error("Error cargando bulto/bodegas");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleGuardar = async () => {
    if (!canEditBulto) {
      toast.error("No tienes permisos para editar bultos");
      return;
    }
    if (!idBodegaDestino) {
      toast.error("Selecciona una bodega destino");
      return;
    }

    setLoading(true);
    try {
      const resp = await axiosInstance.put(
        `/bultos/${encodeURIComponent(id)}/cambiar-bodega`,
        { id_bodega: Number(idBodegaDestino) }
      );
      setBulto(resp?.data ?? null);
      toast.success("Bulto actualizado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el bulto");
    } finally {
      setLoading(false);
    }
  };

  if (!canEditBulto) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          No tienes permisos para editar bultos.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">EDICIÓN DEL BULTO</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Volver
        </button>
      </div>

      {loading && !bulto ? (
        <p className="text-gray-600">Cargando...</p>
      ) : !bulto ? (
        <p className="text-gray-600">No se pudo cargar el bulto.</p>
      ) : (
        <div className="bg-white shadow rounded p-6 space-y-4">
          <div className="text-sm text-gray-700 space-y-1">
            <div>
              <strong>ID:</strong> {bulto.id}
            </div>
            <div>
              <strong>Identificador:</strong> {bulto.identificador}
            </div>
            <div>
              <strong>Item:</strong>{" "}
              {bulto?.materiaPrima?.nombre ??
                bulto?.loteProductoFinal?.productoBase?.nombre ??
                "Desconocido"}
            </div>
            <div>
              <strong>Bodega actual:</strong>{" "}
              {bulto?.Bodega?.nombre ?? bulto?.bodega?.nombre ?? "(sin info)"}
            </div>
            <div>
              <strong>Pallet:</strong>{" "}
              {bulto?.Pallet?.identificador ??
                bulto?.pallet?.identificador ??
                "(sin pallet)"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Cambiar bodega
            </label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={idBodegaDestino}
              onChange={(e) => setIdBodegaDestino(e.target.value)}
            >
              <option value="">Seleccione bodega...</option>
              {bodegas.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nombre} — {b.comuna}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGuardar}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
