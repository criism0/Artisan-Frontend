import { useEffect, useRef, useState } from "react";
import { ApiError, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import SimilarNameConfirmModal from "../Modals/SimilarNameConfirmModal";

/**
 * Selector de Nombre de Facturación (cara comercial del PT en OVs y DTEs).
 * - `value`: id como string ("" = automático: el backend crea/vincula 1:1 con
 *   el nombre del producto al guardar).
 * - Permite crear un nombre nuevo al vuelo (maneja 409 SIMILAR_NAME).
 */
export default function NombreFacturacionSelector({ value, onChange, disabled = false }) {
  const api = useApi();

  const [nombres, setNombres] = useState([]);
  const [creating, setCreating] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  // Default `Unidades`: la venta está estandarizada por pieza y el granel es la excepción.
  const [nuevaUnidad, setNuevaUnidad] = useState("Unidades");
  const [isSaving, setIsSaving] = useState(false);

  const pendingSimilarActionRef = useRef(null);
  const [similarModal, setSimilarModal] = useState({ open: false, inputName: "", matches: [] });

  const fetchNombres = async () => {
    try {
      const res = await api("/nombres-facturacion");
      setNombres(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error("Error cargando nombres de facturación:", e);
    }
  };

  useEffect(() => {
    void fetchNombres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCrear = async (confirmSimilarName = false) => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      toast.error("Escribe el nombre de facturación a crear");
      return;
    }
    try {
      setIsSaving(true);
      const creado = await api("/nombres-facturacion", {
        method: "POST",
        // 🔴 `unidad_venta` viaja acá porque este es un camino de CREACIÓN real, no un atajo:
        // decide cómo se pide, se pickea, se despacha y se factura ese nombre. Sin esto sólo
        // se podía marcar a granel entrando después al mantenedor, y un producto que se vende
        // al peso quedaba mientras tanto pidiéndose en unidades.
        body: JSON.stringify({ nombre, unidad_venta: nuevaUnidad, confirmSimilarName }),
      });
      toast.success("Nombre de facturación creado");
      setCreating(false);
      setNuevoNombre("");
      setNuevaUnidad("Unidades");
      await fetchNombres();
      onChange(String(creado.id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.code === "SIMILAR_NAME") {
        pendingSimilarActionRef.current = () => handleCrear(true);
        setSimilarModal({ open: true, inputName: e.data?.input || nombre, matches: e.data?.matches || [] });
        return;
      }
      console.error(e);
      if (e instanceof ApiError && e.status === 409) {
        // Ya existe con ese nombre exacto: seleccionarlo en vez de fallar
        const existente = nombres.find(
          (n) => n.nombre.trim().toLowerCase() === nombre.toLowerCase()
        );
        if (existente) {
          toast.success(`Ya existía "${existente.nombre}"; quedó seleccionado`);
          setCreating(false);
          setNuevoNombre("");
          onChange(String(existente.id));
          return;
        }
        toast.error("Ya existe un nombre de facturación con ese nombre");
      } else {
        toast.error(`Error creando nombre de facturación: ${e?.message || e}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Nombre de facturación
        <span
          className="ml-1 text-gray-400 cursor-help"
          title="Nombre comercial con el que este producto aparece en Órdenes de Venta y documentos tributarios. Varios productos físicos pueden compartir el mismo nombre."
        >
          ⓘ
        </span>
      </label>

      {!creating ? (
        <div className="flex gap-2">
          <select
            className="flex-1 border rounded-lg px-3 py-2 bg-white disabled:bg-gray-50"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">— Automático (igual al nombre del producto) —</option>
            {nombres.map((n) => (
              <option key={n.id} value={String(n.id)}>
                {n.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="px-3 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 whitespace-nowrap"
            onClick={() => setCreating(true)}
            disabled={disabled}
          >
            Crear nuevo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="Ej: Yogurt Griego Litro Artisan"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-hover disabled:opacity-50"
              onClick={() => handleCrear(false)}
              disabled={isSaving}
            >
              {isSaving ? "Creando..." : "Crear"}
            </button>
            <button
              type="button"
              className="px-3 py-2 border rounded-lg hover:bg-gray-50"
              onClick={() => {
                setCreating(false);
                setNuevoNombre("");
                setNuevaUnidad("Unidades");
              }}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>

          {/* La unidad se decide ACÁ y no después, porque manda las cuatro etapas: cómo se
              pide en la OV, cómo se pickea, qué dice la guía y qué dice la factura. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Se vende y se pickea por:</span>
            {[
              { valor: "Unidades", etiqueta: "Unidad" },
              { valor: "Kilogramos", etiqueta: "Kilo" },
              { valor: "Litros", etiqueta: "Litro" },
            ].map((op) => (
              <button
                key={op.valor}
                type="button"
                onClick={() => setNuevaUnidad(op.valor)}
                disabled={isSaving}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  nuevaUnidad === op.valor
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {op.etiqueta}
              </button>
            ))}
            {nuevaUnidad !== "Unidades" && (
              <span className="text-xs text-amber-700">
                A granel: admite cantidades con decimales, como 1,5.
              </span>
            )}
          </div>
        </div>
      )}

      <SimilarNameConfirmModal
        open={similarModal.open}
        entityLabel="nombre de facturación"
        inputName={similarModal.inputName}
        matches={similarModal.matches}
        confirmText="Crear igualmente"
        onCancel={() => {
          setSimilarModal({ open: false, inputName: "", matches: [] });
          pendingSimilarActionRef.current = null;
        }}
        onConfirm={async () => {
          const fn = pendingSimilarActionRef.current;
          setSimilarModal({ open: false, inputName: "", matches: [] });
          pendingSimilarActionRef.current = null;
          if (typeof fn === "function") await fn();
        }}
      />
    </div>
  );
}
