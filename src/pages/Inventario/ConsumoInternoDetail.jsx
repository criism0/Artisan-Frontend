import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, Undo2 } from "lucide-react";
import { BackButton } from "../../components/Buttons/ActionButtons";
import { PageLoader } from "../../components/UI/PageLoader.jsx";
import { useApi } from "../../lib/api";
import { toast } from "../../lib/toast";
import { formatCLP } from "../../services/formatHelpers";
import { mensajeError } from "../../utils/mensajeError.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { abreviaturaUnidad, cantidadConUnidad, fmtFechaHora } from "../../utils/consumoInterno.js";
import { ModalDeshacer } from "./ConsumoInternoPage.jsx";

/**
 * Un consumo interno, completo (2026-09-28). Pedido de Cristóbal: en vez de leerlo en diez
 * columnas, ver de un vistazo de cuánto a cuánto pasó el bulto, cuánto costó y quién lo hizo.
 *
 * ⚠️ «Antes» y «después» son los del MOMENTO del consumo. Cómo está el bulto hoy es otro dato
 * —pudo seguir consumiéndose, pickearse o entrar a una toma— y se muestra aparte.
 */
export default function ConsumoInternoDetail() {
  const { id } = useParams();
  const api = useApi();
  const [consumo, setConsumo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const puedeDeshacer = checkScope(ModelType.BULTO, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    try {
      const res = await api(`/consumos-internos/${id}`);
      setConsumo(res?.data ?? null);
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "cargar el consumo"));
    } finally {
      setCargando(false);
    }
  }, [api, id]);

  useEffect(() => { cargar(); }, [cargar]);

  const deshacer = async () => {
    try {
      setDeshaciendo(true);
      const res = await api(`/consumos-internos/${id}/anular`, { method: "PUT" });
      toast.success(res?.message || "Consumo deshecho");
      setConfirmar(false);
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, "deshacer el consumo"));
    } finally {
      setDeshaciendo(false);
    }
  };

  if (cargando) return <PageLoader message="Cargando consumo" />;

  if (error || !consumo) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-4"><BackButton to="/Inventario/consumo-interno" /></div>
        <div className="bg-white p-8 rounded-lg shadow text-center text-sm text-red-600">{error ?? "No se encontró el consumo."}</div>
      </div>
    );
  }

  const u = consumo.unidad_medida;
  const deshecho = !!consumo.anulado_en;
  const cantidad = Number(consumo.cantidad);
  const porUnidad = cantidad > 0 ? Number(consumo.costo) / cantidad : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4"><BackButton to="/Inventario/consumo-interno" /></div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">{consumo.materiaPrima?.nombre ?? "Insumo"}</h1>
            {deshecho ? (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Deshecho</span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Vigente</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Consumo interno #{consumo.id} · {fmtFechaHora(consumo.createdAt)} · {consumo.bodega?.nombre ?? "Sin bodega"}
          </p>
        </div>
        {!deshecho && puedeDeshacer && (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
          >
            <Undo2 className="w-4 h-4" /> Deshacer consumo
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold text-text">El bulto</h2>
          <span className="font-mono text-sm text-gray-600">{consumo.identificador_bulto}</span>
        </div>
        <AntesDespues consumo={consumo} />
        {deshecho && (
          <p className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            Deshecho el {fmtFechaHora(consumo.anulado_en)}
            {consumo.anuladoPor?.nombre ? ` por ${consumo.anuladoPor.nombre}` : ""}: los {cantidadConUnidad(cantidad, u)} volvieron al bulto.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Dato titulo="Consumido" valor={cantidadConUnidad(cantidad, u)} />
        <Dato
          titulo="Costo"
          valor={formatCLP(Number(consumo.costo || 0), 0)}
          detalle={porUnidad > 0 ? `${formatCLP(porUnidad, 0)} por ${abreviaturaUnidad(u)}` : null}
          tachado={deshecho}
        />
        <Dato
          titulo="Registró"
          valor={consumo.registradoPor?.nombre ?? "—"}
          detalle={consumo.registradoPor?.email ?? null}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Comentario</h3>
          {consumo.comentario
            ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{consumo.comentario}</p>
            : <p className="text-sm text-gray-400">Sin comentario.</p>}
        </div>
        <div className="bg-white p-5 rounded-lg shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">El bulto hoy</h3>
          <BultoHoy consumo={consumo} />
        </div>
      </div>

      <ModalDeshacer
        consumo={confirmar ? consumo : null}
        guardando={deshaciendo}
        onCancelar={() => setConfirmar(false)}
        onConfirmar={deshacer}
      />
    </div>
  );
}

/**
 * Lo que tenía el bulto y lo que le quedó, con una barra: el largo completo es lo que había, la
 * parte llena lo que quedó y la parte ámbar lo consumido.
 */
function AntesDespues({ consumo }) {
  const u = consumo.unidad_medida;
  const cantidad = Number(consumo.cantidad);
  const antes = consumo.disponible_antes == null ? null : Number(consumo.disponible_antes);
  const despues = consumo.disponible_despues == null ? null : Number(consumo.disponible_despues);

  if (antes == null || despues == null || antes <= 0) {
    return (
      <p className="text-sm text-gray-600">
        Se descontaron <strong>{cantidadConUnidad(cantidad, u)}</strong>. Este consumo se registró antes de que se
        guardara cuánto tenía el bulto, así que no se puede mostrar de cuánto a cuánto pasó.
      </p>
    );
  }

  const pctQueda = Math.max(0, Math.min(100, (despues / antes) * 100));
  const pctConsumo = 100 - pctQueda;

  return (
    <div>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="text-xs text-gray-500">Tenía</div>
          <div className="text-2xl font-bold text-text tabular-nums">{cantidadConUnidad(antes, u)}</div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 mb-1.5" aria-hidden="true" />
        <div>
          <div className="text-xs text-gray-500">Quedó</div>
          <div className="text-2xl font-bold text-text tabular-nums">{cantidadConUnidad(despues, u)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-gray-500">Consumido</div>
          <div className="text-lg font-semibold text-amber-700 tabular-nums">
            −{cantidadConUnidad(cantidad, u)}{" "}
            <span className="text-sm font-normal text-gray-500">({pctConsumo.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%)</span>
          </div>
        </div>
      </div>

      <div
        className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-gray-100"
        role="img"
        aria-label={`Tenía ${cantidadConUnidad(antes, u)}, quedó ${cantidadConUnidad(despues, u)}`}
      >
        {pctQueda > 0 && <div className="h-full bg-primary" style={{ width: `${pctQueda}%` }} />}
        {pctConsumo > 0 && <div className="h-full bg-amber-400" style={{ width: `${pctConsumo}%` }} />}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Quedó en el bulto</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Consumido</span>
      </div>
    </div>
  );
}

function BultoHoy({ consumo }) {
  const hoy = consumo.bulto_hoy;
  if (!hoy) return <p className="text-sm text-gray-500">El bulto ya no existe.</p>;
  return (
    <div className="text-sm text-gray-800">
      <p>
        Tiene <strong className="tabular-nums">{hoy.disponible == null ? "—" : cantidadConUnidad(hoy.disponible, consumo.unidad_medida)}</strong>
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Puede diferir de «Quedó»: el bulto sigue usándose después de este consumo.
        {hoy.es_merma ? " Hoy está marcado como merma." : ""}
        {hoy.en_pallet ? " Hoy está en un pallet." : ""}
      </p>
    </div>
  );
}

function Dato({ titulo, valor, detalle, tachado = false }) {
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <div className="text-xs text-gray-500">{titulo}</div>
      <div className={`text-xl font-bold text-text mt-1 break-words ${tachado ? "line-through text-gray-400" : ""}`}>{valor}</div>
      {detalle && <div className="text-xs text-gray-500 mt-1">{detalle}</div>}
    </div>
  );
}
