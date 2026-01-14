import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import {
  checkScope,
  isAdminOrSuperAdmin,
  ModelType,
  ScopeType,
} from "../../services/scopeCheck";

const CATEGORIAS = [
  { value: "I", label: "Insumos (I)" },
  { value: "PIP", label: "Producto en proceso (PIP)" },
  { value: "PT", label: "Producto terminado (PT)" },
];

function inferirCategoriaBultoLocal(bulto) {
  if (!bulto) return "";
  if (bulto?.categoria) return String(bulto.categoria);
  if (bulto?.id_lote_producto_final) return "PT";
  if (bulto?.id_lote_producto_en_proceso) return "PIP";
  if (bulto?.id_registro_subproducto) return "PIP";
  if (bulto?.id_materia_prima) return "I";
  return "";
}

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
  const [pallets, setPallets] = useState([]);
  const [bulto, setBulto] = useState(null);
  const [idBodegaDestino, setIdBodegaDestino] = useState("");
  const [categoria, setCategoria] = useState("");
  const [esMerma, setEsMerma] = useState(false);
  const [idPalletDestino, setIdPalletDestino] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [bodegasResp, bultoResp, palletsResp] = await Promise.all([
          api("/bodegas"),
          api(`/bultos/${encodeURIComponent(id)}`),
          api("/pallets"),
        ]);

        const listaBodegas = Array.isArray(bodegasResp?.bodegas)
          ? bodegasResp.bodegas
          : Array.isArray(bodegasResp)
            ? bodegasResp
            : [];
        setBodegas(listaBodegas);

        const listaPallets = Array.isArray(palletsResp) ? palletsResp : [];
        setPallets(listaPallets);

        setBulto(bultoResp ?? null);
        const currentId = bultoResp?.id_bodega ?? "";
        setIdBodegaDestino(String(currentId || ""));

        const cat = inferirCategoriaBultoLocal(bultoResp);
        setCategoria(cat);
        setEsMerma(Boolean(bultoResp?.es_merma));

        const palletId = bultoResp?.id_pallet ?? "";
        setIdPalletDestino(palletId ? String(palletId) : "");
        setCostoUnitario(
          bultoResp?.costo_unitario != null ? String(bultoResp.costo_unitario) : ""
        );
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
    if (!categoria) {
      toast.error("Selecciona una categoría");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        id_bodega: Number(idBodegaDestino),
        categoria,
        es_merma: Boolean(esMerma),
        id_pallet: idPalletDestino ? Number(idPalletDestino) : null,
        costo_unitario: costoUnitario === "" ? undefined : Number(costoUnitario),
      };

      const updated = await api(`/bultos/${encodeURIComponent(id)}/admin`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setBulto(updated ?? null);
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

            <div className="pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-50 border rounded p-2">
                  <div className="text-gray-500">Cantidad unidades (total)</div>
                  <div className="font-semibold text-gray-800">{bulto?.cantidad_unidades ?? "—"} un.</div>
                </div>
                <div className="bg-gray-50 border rounded p-2">
                  <div className="text-gray-500">Unidades disponibles</div>
                  <div className="font-semibold text-gray-800">{bulto?.unidades_disponibles ?? "—"} un.</div>
                </div>
                <div className="bg-gray-50 border rounded p-2">
                  <div className="text-gray-500">Peso unitario (formato)</div>
                  <div className="font-semibold text-gray-800">{bulto?.peso_unitario ?? "—"}</div>
                </div>
              </div>

              <div className="mt-3 p-3 rounded border border-amber-200 bg-amber-50 text-amber-900 text-sm">
                <div className="font-semibold">Importante: diferencias de inventario</div>
                <div className="mt-1">
                  Las <span className="font-semibold">unidades</span> y el <span className="font-semibold">peso unitario</span> no se editan desde esta pantalla.
                  Si hay pérdidas o diferencias, primero <span className="font-semibold">divide el bulto</span> por la cantidad afectada y luego marca como <span className="font-semibold">merma</span> el bulto generado.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Categoría</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">Seleccione categoría...</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Si no coincide con el tipo real (lote/MP), el backend lo bloqueará.
              </p>
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={esMerma}
                  onChange={(e) => setEsMerma(e.target.checked)}
                />
                <span className="text-sm font-semibold">Marcar como merma (M)</span>
              </label>
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

          <div>
            <label className="block text-sm font-semibold mb-2">Pallet</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={idPalletDestino}
              onChange={(e) => setIdPalletDestino(e.target.value)}
            >
              <option value="">(sin pallet)</option>
              {pallets.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.identificador} (ID {p.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Si el bulto tiene historial de despacho/recepción, el backend no permitirá cambiarlo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Costo unitario</label>
              <input
                type="number"
                step="any"
                className="border rounded px-3 py-2 w-full"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
              />
            </div>
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
