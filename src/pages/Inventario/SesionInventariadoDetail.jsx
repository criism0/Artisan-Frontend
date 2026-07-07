import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("es-CL", { maximumFractionDigits: 4 }));

function getEstadoBadgeClasses(estado) {
  switch (estado) {
    case "Activa":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "Terminada":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Validada":
      return "border-green-200 bg-green-50 text-green-800";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800";
  }
}

function Seccion({ titulo, tono, items, columns, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items?.length) return null;
  const tonos = {
    rojo: "border-red-200 bg-red-50 text-red-800",
    ambar: "border-amber-200 bg-amber-50 text-amber-800",
    azul: "border-blue-200 bg-blue-50 text-blue-800",
    verde: "border-green-200 bg-green-50 text-green-800",
    gris: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {titulo}
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tonos[tono]}`}>
            {items.length}
          </span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                {columns.map((c) => <th key={c.key} className="px-4 py-2">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id ?? i} className="border-b last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2">{c.render(it)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const COLS_BASE = [
  { key: "ident", label: "Bulto", render: (b) => <span className="font-mono text-xs">{b.identificador}</span> },
  { key: "item", label: "Ítem", render: (b) => b.item },
];

/**
 * Detalle de una sesión de toma de inventario:
 * - Activa/Terminada: previsualización de diferencias (toma vs realidad) y,
 *   si está Terminada, botón para validar (aplica los cambios a la bodega).
 * - Validada: registro de los cambios reales que la sesión aplicó.
 */
export default function SesionInventariadoDetail() {
  const { id } = useParams();
  const api = useApi();
  const canWrite = checkScope(ModelType.SESION_INVENTARIADO, ScopeType.WRITE);

  const [sesion, setSesion] = useState(null);
  const [diff, setDiff] = useState(null);
  const [ajustes, setAjustes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [validando, setValidando] = useState(false);

  const cargar = async () => {
    setIsLoading(true);
    try {
      const res = await api(`/sesiones-inventariado/${id}`);
      const s = res?.data ?? res;
      setSesion(s);
      if (s.estado === "Validada") {
        setAjustes(await api(`/sesiones-inventariado/${id}/ajustes`));
        setDiff(null);
      } else {
        setDiff(await api(`/sesiones-inventariado/${id}/diferencias`));
        setAjustes(null);
      }
    } catch {
      toast.error("No se pudo cargar la sesión");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const validar = async () => {
    setValidando(true);
    try {
      const res = await api(`/sesiones-inventariado/${id}/validar`, { method: "PUT" });
      toast.success(res?.message ?? "Sesión validada");
      setConfirmando(false);
      await cargar();
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "No se pudo validar la sesión (¿tienes el permiso privilegiado?)");
    } finally {
      setValidando(false);
    }
  };

  if (isLoading) return <PageLoader message="Cargando sesión" />;
  if (!sesion) return null;

  const r = diff?.resumen;

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto">
      <div className="mb-4">
        <BackButton to="/Inventario/tomas" />
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">Toma de inventario #{sesion.id}</h1>
            <span className={`px-3 py-1 rounded-full text-xs border ${getEstadoBadgeClasses(sesion.estado)}`}>
              {sesion.estado === "Terminada" ? "Por validar" : sesion.estado}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Bodega <span className="font-medium">{sesion.bodega?.nombre ?? sesion.id_bodega}</span>
            {sesion.creador?.nombre ? ` · Iniciada por ${sesion.creador.nombre}` : ""}
            {sesion.validador?.nombre
              ? ` · Validada por ${sesion.validador.nombre} el ${new Date(sesion.fecha_validacion).toLocaleDateString("es-CL")}`
              : ""}
          </p>
        </div>
        {sesion.estado === "Terminada" && canWrite && (
          <button
            onClick={() => setConfirmando(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-violet-700"
          >
            Validar sesión…
          </button>
        )}
      </div>

      {sesion.estado === "Activa" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-md px-4 py-3 text-sm mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Sesión aún activa en la app móvil — esta previsualización cambiará con nuevos escaneos.
        </div>
      )}

      {/* Resumen de la previsualización */}
      {diff && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
            {[
              ["Escaneados", r.escaneados, "text-gray-800"],
              ["Sin cambio", r.sin_cambio, "text-green-700"],
              ["Ajustes de cantidad", r.ajustes_cantidad, "text-amber-700"],
              ["Traslados", r.traslados, "text-blue-700"],
              ["Reaparecidos", r.reaparecidos, "text-blue-700"],
              ["Faltantes → merma", r.faltantes_a_merma, "text-red-700"],
            ].map(([label, val, color]) => (
              <div key={label} className="bg-white rounded-lg shadow px-4 py-3">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          <Seccion
            titulo="Faltantes — se marcarán como MERMA al validar"
            tono="rojo"
            defaultOpen
            items={diff.faltantes}
            columns={[
              ...COLS_BASE,
              { key: "u", label: "Unidades en sistema", render: (b) => fmt(b.unidades_disponibles) },
            ]}
          />
          <Seccion
            titulo="Ajustes de cantidad (contado ≠ sistema)"
            tono="ambar"
            defaultOpen
            items={diff.ajustes_cantidad}
            columns={[
              ...COLS_BASE,
              { key: "sis", label: "Sistema", render: (b) => fmt(b.unidades_disponibles) },
              { key: "cont", label: "Contado", render: (b) => <span className="font-semibold">{fmt(b.unidades_contadas)}</span> },
              { key: "dif", label: "Diferencia", render: (b) => (
                <span className={b.diferencia_unidades < 0 ? "text-red-600" : "text-green-700"}>
                  {b.diferencia_unidades > 0 ? "+" : ""}{fmt(b.diferencia_unidades)}
                </span>
              ) },
            ]}
          />
          <Seccion
            titulo="Traslados — estaban registrados en otra bodega"
            tono="azul"
            defaultOpen
            items={diff.traslados}
            columns={[
              ...COLS_BASE,
              { key: "bod", label: "Bodega registrada", render: (b) => b.id_bodega ?? "—" },
              { key: "cont", label: "Contado", render: (b) => fmt(b.unidades_contadas) },
            ]}
          />
          <Seccion
            titulo="Reaparecidos — estaban marcados como merma"
            tono="azul"
            defaultOpen
            items={diff.reaparecidos}
            columns={[
              ...COLS_BASE,
              { key: "cont", label: "Contado", render: (b) => fmt(b.unidades_contadas) },
            ]}
          />
          <Seccion
            titulo="Omitidos por estar en pallet (comprometidos en otro proceso — NO se tocan)"
            tono="gris"
            items={diff.omitidos_en_pallet}
            columns={[
              ...COLS_BASE,
              { key: "u", label: "Unidades", render: (b) => fmt(b.unidades_disponibles) },
            ]}
          />
          <Seccion
            titulo="Sin cambio (contado = sistema)"
            tono="verde"
            items={diff.sin_cambio}
            columns={[
              ...COLS_BASE,
              { key: "u", label: "Unidades", render: (b) => fmt(b.unidades_disponibles) },
            ]}
          />
        </>
      )}

      {/* Cambios aplicados (sesión validada) */}
      {ajustes && (
        <>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-md px-4 py-3 text-sm mb-4">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Sesión validada — estos son los cambios reales que se aplicaron sobre la bodega.
          </div>
          <Seccion
            titulo="Cambios aplicados"
            tono="verde"
            defaultOpen
            items={ajustes.ajustes}
            columns={[
              { key: "tipo", label: "Tipo", render: (a) => ({
                ajuste_cantidad: "Ajuste de cantidad",
                traslado: "Traslado",
                reaparecido: "Reaparecido",
                merma_faltante: "Merma (faltante)",
              }[a.tipo] ?? a.tipo) },
              { key: "b", label: "Bulto", render: (a) => <span className="font-mono text-xs">{a.bulto?.identificador ?? a.bulto?.id}</span> },
              { key: "i", label: "Ítem", render: (a) => a.bulto?.item ?? "—" },
              { key: "u", label: "Unidades", render: (a) =>
                a.unidades_antes !== a.unidades_despues
                  ? `${fmt(a.unidades_antes)} → ${fmt(a.unidades_despues)}`
                  : fmt(a.unidades_despues) },
              { key: "bod", label: "Bodega", render: (a) =>
                a.id_bodega_antes !== a.id_bodega_despues
                  ? `${a.id_bodega_antes ?? "—"} → ${a.id_bodega_despues ?? "—"}`
                  : "sin cambio" },
              { key: "m", label: "Merma", render: (a) =>
                a.es_merma_antes !== a.es_merma_despues
                  ? (a.es_merma_despues ? <span className="text-red-600 font-medium">marcado merma</span> : <span className="text-green-700 font-medium">desmarcado</span>)
                  : "—" },
            ]}
          />
        </>
      )}

      {/* Confirmación de validación */}
      {confirmando && r && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-2">Validar toma de inventario</h2>
            <p className="text-sm text-gray-600 mb-4">
              Se aplicarán estos cambios <span className="font-semibold">irreversibles</span> sobre la bodega:
            </p>
            <ul className="text-sm space-y-1 mb-5">
              <li>• <span className="font-semibold">{r.ajustes_cantidad}</span> ajuste(s) de cantidad</li>
              <li>• <span className="font-semibold">{r.traslados}</span> traslado(s) desde otras bodegas</li>
              <li>• <span className="font-semibold">{r.reaparecidos}</span> bulto(s) desmarcados de merma</li>
              <li className="text-red-700">• <span className="font-semibold">{r.faltantes_a_merma}</span> faltante(s) se marcarán como MERMA</li>
              {r.omitidos_en_pallet > 0 && (
                <li className="text-gray-500">• {r.omitidos_en_pallet} en pallet no se tocan</li>
              )}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={validando}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={validar}
                disabled={validando}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {validando ? "Validando…" : "Validar y aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
